/**
 * @fileoverview LinkedIn API integration via Proxycurl
 *
 * Fetches LinkedIn profiles using Proxycurl to extract name, bio, skills, and
 * work history.
 *
 * Wave 1 cost-DoS hardening:
 *   - When `PROXYCURL_API_KEY` is unset, `fetchLinkedInProfile` returns
 *     `null` cleanly instead of throwing. Scoring degrades gracefully.
 *   - Every successful lookup is cached for 7 days — Proxycurl is the most
 *     expensive call in the pipeline ($0.01–$0.10/lookup), so aggressive
 *     caching is the single biggest cost lever.
 *   - 8-second AbortSignal timeout so a slow Proxycurl response can't pin
 *     a Vercel function open.
 *   - The expensive `skills=include` flag is left ON only when the env var
 *     `PROXYCURL_INCLUDE_SKILLS=1` is explicitly set — by default we use
 *     the basic profile and rely on the keyword-grep heuristic below.
 *
 * @module lib/ai/linkedin
 * @see https://nubela.co/proxycurl/
 */

import axios from "axios";
import { CandidateProfile } from "@/types";
import { cacheGet, CACHE_TTL, cacheKey } from "@/lib/ai/cache";

const PROXYCURL_API = "https://nubela.co/proxycurl/api/v2/linkedin";
const PROXYCURL_TIMEOUT_MS = 8_000;

interface ProxycurlExperience {
  title: string;
  company: string;
  starts_at?: { year: number; month?: number };
  ends_at?: { year: number; month?: number } | null;
  description?: string;
}

interface ProxycurlProfile {
  first_name: string;
  last_name: string;
  headline?: string;
  summary?: string;
  skills?: string[];
  experiences?: ProxycurlExperience[];
}

/**
 * Fetches a candidate's profile from LinkedIn via Proxycurl.
 *
 * Returns `null` when:
 *   - `PROXYCURL_API_KEY` is unset (LinkedIn enrichment is optional)
 *   - The profile is not found
 *   - The call fails for any reason that should not block scoring
 *
 * Returns the cached value on repeated lookups within 7 days.
 */
export async function fetchLinkedInProfile(
  profileUrl: string
): Promise<CandidateProfile | null> {
  if (!process.env.PROXYCURL_API_KEY) {
    return null;
  }

  return cacheGet<CandidateProfile | null>(
    cacheKey.proxycurl(profileUrl),
    () => fetchLinkedInProfileUncached(profileUrl),
    CACHE_TTL.PROXYCURL
  );
}

async function fetchLinkedInProfileUncached(
  profileUrl: string
): Promise<CandidateProfile | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXYCURL_TIMEOUT_MS);
  try {
    const params: Record<string, string> = { url: profileUrl };
    // Skills add-on is billed extra. Opt-in only.
    if (process.env.PROXYCURL_INCLUDE_SKILLS === "1") {
      params.skills = "include";
    }

    const response = await axios.get<ProxycurlProfile>(PROXYCURL_API, {
      headers: {
        Authorization: `Bearer ${process.env.PROXYCURL_API_KEY}`,
      },
      params,
      signal: controller.signal,
      timeout: PROXYCURL_TIMEOUT_MS,
    });

    const data = response.data;

    const experience = (data.experiences || []).map((exp) => {
      const startYear = exp.starts_at?.year || "N/A";
      const endYear = exp.ends_at?.year || "Present";
      return `${exp.title} at ${exp.company} (${startYear} - ${endYear})`;
    });

    const skills = data.skills || [];

    // Local keyword extraction so we still surface tech skills when the paid
    // `skills=include` flag is off.
    const experienceSkills = (data.experiences || [])
      .filter((exp) => exp.description)
      .flatMap((exp) => {
        const techKeywords = [
          "JavaScript", "TypeScript", "Python", "Java", "React", "Node.js",
          "AWS", "Docker", "Kubernetes", "SQL", "MongoDB", "GraphQL", "REST",
          "API", "Agile", "Scrum", "Go", "Rust", "C++", "C#", ".NET", "Azure",
          "GCP", "Redis", "PostgreSQL", "MySQL", "Next.js", "Vue.js", "Angular",
          "TensorFlow", "PyTorch", "Machine Learning", "CI/CD", "Terraform",
        ];
        return techKeywords.filter((keyword) =>
          exp.description?.toLowerCase().includes(keyword.toLowerCase())
        );
      });

    const allSkills = [...new Set([...skills, ...experienceSkills])];

    return {
      source: "linkedin",
      url: profileUrl,
      name: `${data.first_name} ${data.last_name}`,
      bio: data.summary || data.headline || undefined,
      skills: allSkills,
      experience,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        // 404 is durable — cache the negative result.
        return null;
      }
      // Auth / rate-limit / network: log and return null so scoring continues.
      // eslint-disable-next-line no-console
      console.warn(
        `[lib/ai/linkedin] Proxycurl fetch failed (${error.response?.status ?? "network"}): ${error.message}`
      );
      return null;
    }
    // eslint-disable-next-line no-console
    console.warn("[lib/ai/linkedin] Proxycurl fetch failed:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracts and normalizes LinkedIn URL from various formats
 */
export function extractLinkedInUrl(input: string): string | null {
  const patterns = [
    /linkedin\.com\/in\/([a-zA-Z0-9\-]+)/i,
    /linkedin\.com\/pub\/([a-zA-Z0-9\-]+)/i,
  ];

  for (const pattern of patterns) {
    if (pattern.test(input)) {
      if (!input.startsWith("http")) {
        return `https://www.${input}`;
      }
      return input;
    }
  }
  return null;
}

/**
 * Checks if a string is a valid LinkedIn URL
 */
export function isLinkedInUrl(input: string): boolean {
  return /linkedin\.com\/(in|pub)\/[a-zA-Z0-9\-]+/i.test(input);
}
