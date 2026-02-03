/**
 * @fileoverview Auth pages layout
 *
 * Shared layout for authentication pages (login, register, etc.)
 * with centered card design and branding.
 */

import React from "react";
import Link from "next/link";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
            {/* Logo/Brand */}
            <Link
                href="/"
                className="mb-8 flex items-center gap-2 text-2xl font-bold text-foreground"
            >
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg">
                    <span className="text-xl font-black text-white">L</span>
                </div>
                <span>Lontario</span>
            </Link>

            {/* Auth Card Container */}
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl p-8">
                    {children}
                </div>
            </div>

            {/* Footer */}
            <p className="mt-8 text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Lontario. All rights reserved.
            </p>
        </div>
    );
}
