/**
 * @fileoverview Browser Supabase client
 * 
 * Creates a Supabase client for client-side (browser) usage.
 * Uses the anon/publishable key with Row Level Security (RLS) policies.
 * 
 * @module lib/supabase/client
 * @requires NEXT_PUBLIC_SUPABASE_URL
 * @requires NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for browser/client-side usage
 * 
 * This client:
 * - Uses the publishable/anon key (safe to expose in browser)
 * - Respects Row Level Security (RLS) policies
 * - Handles auth state in browser storage
 * 
 * @returns Supabase client configured for browser usage
 * @throws Error if environment variables are missing
 * 
 * @example
 * // In a client component
 * const supabase = createClient();
 * const { data } = await supabase.from("jobs").select("*");
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
