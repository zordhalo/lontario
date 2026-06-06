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

// Read directly — NOT through lib/env.ts. Next.js webpack only statically
// replaces individual process.env.NEXT_PUBLIC_* accesses in client bundles;
// the whole process.env object is not populated, so env.ts's safeParse()
// returns undefined for these vars on the client side.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
