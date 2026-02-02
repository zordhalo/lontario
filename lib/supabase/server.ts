/**
 * @fileoverview Server Supabase clients
 * 
 * Creates Supabase clients for server-side usage:
 * - createClient(): For Server Components and API Routes (uses cookies)
 * - createAdminClient(): For background jobs that bypass RLS
 * 
 * @module lib/supabase/server
 * @requires NEXT_PUBLIC_SUPABASE_URL
 * @requires NEXT_PUBLIC_SUPABASE_ANON_KEY
 * @requires SUPABASE_SERVICE_ROLE_KEY (for admin client)
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for server-side usage
 * 
 * This client:
 * - Uses the anon key with RLS policies
 * - Manages auth session via cookies (for SSR)
 * - Safe for Server Components and API Routes
 * 
 * @returns Supabase client configured for server usage
 * @throws Error if environment variables are missing
 * 
 * @example
 * // In a Server Component or API Route
 * const supabase = await createClient();
 * const { data } = await supabase.from("jobs").select("*");
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from Server Component - cookies are read-only
        }
      },
    },
  });
}

/**
 * Creates an admin Supabase client with service role key
 * 
 * This client:
 * - Uses the service role key (NEVER expose to client!)
 * - Bypasses Row Level Security (RLS) policies
 * - Has full database access
 * 
 * Use ONLY for:
 * - Background jobs (cron, webhooks)
 * - Admin operations that need elevated access
 * - Operations not tied to a user session
 * 
 * @returns Supabase client with admin privileges
 * @throws Error if environment variables are missing
 * 
 * @example
 * // In a cron job or webhook handler
 * const supabase = createAdminClient();
 * await supabase.from("candidates").update({ ... }).eq("id", id);
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Missing Supabase admin environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createServerClient(supabaseUrl, secretKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
