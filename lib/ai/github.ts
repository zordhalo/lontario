/**
 * @fileoverview GitHub API integration for candidate profile fetching
 *
 * Fetches and processes GitHub profiles to extract:
 * - Skills from programming languages and repo topics
 * - Project experience from public repositories
 * - Years of experience from account age
 * - Avatar URL for display
 *
 * Wave 1 cost-DoS hardening:
 *   - Every outbound call is wrapped in `cacheGet` (6h TTL) so a spammer
 *     re-applying with the same github_url does NOT re-spend GitHub quota.
 *   - `AbortSignal.timeout()` on every fetch — a slow github.com cannot pin
 *     a Vercel function open for the full maxDuration.
 *   - Caps language enrichment to the top 5 repos (was already 5 but is now
 *     a documented invariant tied to budget reasoning).
 *   - Reads `X-RateLimit-Remaining` and logs when the token bucket is low.
 *   - `validateGitHubUser()` is exposed for the public apply route to cheap-
 *     gate non-existent usernames before the full enrichment pipeline runs.
 *
 * @module lib/ai/github
 */

import axios from "axios";
import { CandidateProfile } from "@/types";
import { cacheGet, CACHE_TTL, cacheKey } from "@/lib/ai/cache";

/** GitHub API base URL */
const GITHUB_API = "https://api.github.com";

/** Per-call timeout for outbound GitHub requests (ms). */
const GITHUB_TIMEOUT_MS = 5_000;

/** Warn when remaining budget drops below this in a 5000/hr window. */
const RATE_LIMIT_WARN_THRESHOLD = 100;

/** Cap on repos enriched with language stats — bounds total external calls. */
const MAX_REPOS_FOR_LANGS = 5;

/** GitHub user profile response */
interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  created_at: string;
}

/** GitHub repository response */
interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  languages_url: string;
  html_url: string;
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

/**
 * Inspect rate-limit headers. If remaining is low, surface to logs so we can
 * react before exhaustion. The orchestrator can choose to skip enrichment.
 */
function checkRateLimit(headers: Record<string, unknown>): void {
  const remainingRaw = headers["x-ratelimit-remaining"];
  const remaining = typeof remainingRaw === "string" ? Number(remainingRaw) : NaN;
  if (Number.isFinite(remaining) && remaining < RATE_LIMIT_WARN_THRESHOLD) {
    // eslint-disable-next-line no-console
    console.warn(
      `[lib/ai/github] GitHub rate-limit low: ${remaining} remaining`
    );
  }
}

async function ghGet<T>(url: string): Promise<{ data: T; headers: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
  try {
    const res = await axios.get<T>(url, {
      headers: ghHeaders(),
      signal: controller.signal,
      // Keep axios's own timeout as a belt-and-suspenders second line of defense.
      timeout: GITHUB_TIMEOUT_MS,
    });
    checkRateLimit(res.headers as Record<string, unknown>);
    return { data: res.data, headers: res.headers as Record<string, unknown> };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lightweight existence check for the public apply form. Cached for 24h —
 * a non-existent username today is still non-existent tomorrow. Returns
 * `{ exists: false }` rather than throwing so callers can keep going with
 * partial data.
 */
export async function validateGitHubUser(
  url: string
): Promise<{ exists: boolean; username: string | null }> {
  const username = extractGitHubUsername(url);
  if (!username) return { exists: false, username: null };
  try {
    const exists = await cacheGet<boolean>(
      cacheKey.ghValidate(username),
      async () => {
        try {
          await ghGet<GitHubUser>(`${GITHUB_API}/users/${username}`);
          return true;
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            return false;
          }
          // Network / 5xx / abort — don't cache; surface as "exists" so we
          // attempt the full path (which will cache its own result/error).
          throw err;
        }
      },
      CACHE_TTL.GITHUB_VALIDATE
    );
    return { exists, username };
  } catch {
    // Treat transient failures as "exists" to avoid false negatives blocking
    // legitimate applicants. The full fetch path will handle/skip cleanly.
    return { exists: true, username };
  }
}

/**
 * Fetches a candidate's profile from GitHub (cached, 6h TTL).
 * Extracts skills, experience, and projects from their public repos.
 */
export async function fetchGitHubProfile(
  username: string
): Promise<CandidateProfile> {
  return cacheGet<CandidateProfile>(
    cacheKey.ghUser(username),
    () => fetchGitHubProfileUncached(username),
    CACHE_TTL.GITHUB
  );
}

async function fetchGitHubProfileUncached(
  username: string
): Promise<CandidateProfile> {
  try {
    // User + repos in parallel.
    const [userRes, reposRes] = await Promise.all([
      ghGet<GitHubUser>(`${GITHUB_API}/users/${username}`),
      ghGet<GitHubRepo[]>(
        `${GITHUB_API}/users/${username}/repos?sort=stars&per_page=10`
      ),
    ]);

    const user = userRes.data;
    const repos = reposRes.data;

    // Aggregate languages from top N repos (bounded so a popular user
    // can't explode the per-applicant call count).
    const languageStats: Record<string, number> = {};
    const languagePromises = repos
      .slice(0, MAX_REPOS_FOR_LANGS)
      .map(async (repo) => {
        try {
          const langRes = await ghGet<Record<string, number>>(repo.languages_url);
          return langRes.data;
        } catch {
          return {} as Record<string, number>;
        }
      });

    const languageResults = await Promise.all(languagePromises);
    languageResults.forEach((langs) => {
      Object.entries(langs).forEach(([lang, bytes]) => {
        languageStats[lang] = (languageStats[lang] || 0) + bytes;
      });
    });

    const sortedLanguages = Object.entries(languageStats)
      .sort(([, a], [, b]) => b - a)
      .reduce(
        (acc, [lang, bytes]) => {
          acc[lang] = bytes;
          return acc;
        },
        {} as Record<string, number>
      );

    const allTopics = repos.flatMap((r) => r.topics || []);
    const skills = [...Object.keys(sortedLanguages), ...allTopics].filter(
      (value, index, self) => self.indexOf(value) === index
    );

    const experience = repos
      .filter((r) => r.description || r.stargazers_count > 0)
      .map(
        (r) =>
          `${r.name}: ${r.description || "No description"} (${r.stargazers_count} stars)`
      );

    const projects = repos.map((r) => ({
      name: r.name,
      description: r.description || "",
      language: r.language || "Unknown",
      stars: r.stargazers_count,
    }));

    const accountCreated = new Date(user.created_at);
    const yearsOnGitHub = Math.floor(
      (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24 * 365)
    );

    return {
      source: "github",
      url: `https://github.com/${username}`,
      name: user.name || username,
      bio: user.bio || undefined,
      avatar_url: user.avatar_url,
      skills,
      experience,
      projects,
      languages: sortedLanguages,
      years_of_experience: yearsOnGitHub,
      github_created_at: user.created_at,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error(`GitHub user "${username}" not found`);
      } else if (error.response?.status === 403) {
        throw new Error(
          "GitHub rate limit exceeded. Add GITHUB_TOKEN environment variable to increase limit."
        );
      }
      throw new Error(
        `GitHub API error: ${error.response?.data?.message || error.message}`
      );
    }
    throw new Error(`Failed to fetch GitHub profile: ${error}`);
  }
}

/**
 * Extracts GitHub username from a URL or plain username
 */
export function extractGitHubUsername(input: string): string | null {
  // Handle full URL
  const urlPattern =
    /github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/i;
  const urlMatch = input.match(urlPattern);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Handle plain username
  const usernamePattern =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  if (usernamePattern.test(input.trim())) {
    return input.trim();
  }

  return null;
}

/**
 * Checks if a string is a valid GitHub URL
 */
export function isGitHubUrl(input: string): boolean {
  return /github\.com\/[a-zA-Z0-9]/.test(input);
}
