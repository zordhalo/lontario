import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  fetchGitHubProfile,
  extractGitHubUsername,
  fetchLinkedInProfile,
  extractLinkedInUrl,
  isGitHubUrl,
  isLinkedInUrl,
} from "@/lib/ai";

// Validation schema
const scrapeProfileSchema = z.object({
  url: z.string().min(1, "URL is required"),
  source: z.enum(["github", "linkedin"]).optional(),
});

/**
 * POST /api/ai/scrape-profile
 * Fetch candidate profile from GitHub or LinkedIn
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication (optional for demo)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse and validate request body
    const body = await req.json();
    const validation = scrapeProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { url } = validation.data;
    let { source } = validation.data;

    // Auto-detect source if not provided
    if (!source) {
      if (isGitHubUrl(url)) {
        source = "github";
      } else if (isLinkedInUrl(url)) {
        source = "linkedin";
      } else {
        // Try as GitHub username
        const username = extractGitHubUsername(url);
        if (username) {
          source = "github";
        }
      }
    }

    if (!source) {
      return NextResponse.json(
        {
          error: "Could not determine profile source. Please provide a GitHub or LinkedIn URL.",
          code: "INVALID_URL",
        },
        { status: 400 }
      );
    }

    let profile;

    if (source === "github") {
      const username = extractGitHubUsername(url);
      if (!username) {
        return NextResponse.json(
          { error: "Invalid GitHub URL or username", code: "INVALID_GITHUB_URL" },
          { status: 400 }
        );
      }
      profile = await fetchGitHubProfile(username);
    } else if (source === "linkedin") {
      const linkedInUrl = extractLinkedInUrl(url);
      if (!linkedInUrl) {
        return NextResponse.json(
          { error: "Invalid LinkedIn URL", code: "INVALID_LINKEDIN_URL" },
          { status: 400 }
        );
      }
      profile = await fetchLinkedInProfile(linkedInUrl);
    }

    return NextResponse.json({
      profile,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error scraping profile:", error);

    if (error instanceof Error) {
      // Handle specific API errors
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: error.message, code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: error.message, code: "RATE_LIMITED" },
          { status: 429 }
        );
      }

      if (error.message.includes("not configured")) {
        return NextResponse.json(
          { error: error.message, code: "NOT_CONFIGURED" },
          { status: 503 }
        );
      }

      if (error.message.includes("Invalid")) {
        return NextResponse.json(
          { error: error.message, code: "INVALID_CREDENTIALS" },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch profile", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/scrape-profile
 * Fetch profile with URL as query parameter (convenience endpoint)
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required", code: "MISSING_URL" },
      { status: 400 }
    );
  }

  // Convert GET to POST internally
  const mockRequest = new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify({ url }),
    headers: req.headers,
  });

  return POST(mockRequest);
}
