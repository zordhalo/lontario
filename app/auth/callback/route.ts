/**
 * @fileoverview Auth Callback Handler
 *
 * Handles OAuth and magic link redirects from Supabase Auth.
 * Exchanges the code for a session and redirects to the appropriate page.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/dashboard";

    if (code) {
        const supabase = await createClient();

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Successful authentication - redirect to the next page
            return NextResponse.redirect(new URL(next, requestUrl.origin));
        }
    }

    // If there's an error or no code, redirect to login with error
    return NextResponse.redirect(
        new URL(`/login?error=auth_callback_error`, requestUrl.origin)
    );
}
