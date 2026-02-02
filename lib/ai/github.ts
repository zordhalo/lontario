/**
 * @fileoverview GitHub API integration for candidate profile fetching
 * 
 * This module fetches and processes GitHub profiles to extract:
 * - Skills from programming languages and repo topics
 * - Project experience from public repositories
 * - Years of experience from account age
 * - Avatar URL for display
 * 
 * Supports authenticated requests with GITHUB_TOKEN env var for higher rate limits.
 * 
 * @module lib/ai/github
 */

import axios from "axios";
import { CandidateProfile } from "@/types";

/** GitHub API base URL */
const GITHUB_API = "https://api.github.com";

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

/**
 * Fetches a candidate's profile from GitHub
 * Extracts skills, experience, and projects from their public repos
 */
export async function fetchGitHubProfile(
  username: string
): Promise<CandidateProfile> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    // Fetch user profile and repositories in parallel
    const [userRes, reposRes] = await Promise.all([
      axios.get<GitHubUser>(`${GITHUB_API}/users/${username}`, { headers }),
      axios.get<GitHubRepo[]>(
        `${GITHUB_API}/users/${username}/repos?sort=stars&per_page=10`,
        { headers }
      ),
    ]);

    const user = userRes.data;
    const repos = reposRes.data;

    // Aggregate languages from top 5 repos
    const languageStats: Record<string, number> = {};
    const languagePromises = repos.slice(0, 5).map(async (repo) => {
      try {
        const langRes = await axios.get<Record<string, number>>(
          repo.languages_url,
          { headers }
        );
        return langRes.data;
      } catch {
        return {};
      }
    });

    const languageResults = await Promise.all(languagePromises);
    languageResults.forEach((langs) => {
      Object.entries(langs).forEach(([lang, bytes]) => {
        languageStats[lang] = (languageStats[lang] || 0) + bytes;
      });
    });

    // Sort languages by usage
    const sortedLanguages = Object.entries(languageStats)
      .sort(([, a], [, b]) => b - a)
      .reduce(
        (acc, [lang, bytes]) => {
          acc[lang] = bytes;
          return acc;
        },
        {} as Record<string, number>
      );

    // Extract unique skills from languages and repo topics
    const allTopics = repos.flatMap((r) => r.topics || []);
    const skills = [...Object.keys(sortedLanguages), ...allTopics].filter(
      (value, index, self) => self.indexOf(value) === index
    );

    // Format experience from repos
    const experience = repos
      .filter((r) => r.description || r.stargazers_count > 0)
      .map(
        (r) =>
          `${r.name}: ${r.description || "No description"} (${r.stargazers_count} stars)`
      );

    // Format projects
    const projects = repos.map((r) => ({
      name: r.name,
      description: r.description || "",
      language: r.language || "Unknown",
      stars: r.stargazers_count,
    }));

    // Calculate years of experience from GitHub account creation date
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
