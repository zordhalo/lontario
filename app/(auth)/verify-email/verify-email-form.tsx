/**
 * @fileoverview Verify Email Form Component
 *
 * Displays email verification status and provides option to resend.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resendVerificationEmail } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    Mail,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
} from "lucide-react";

// ============================================================
// Component
// ============================================================

export function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailFromParams = searchParams.get("email");

    const [email, setEmail] = useState(emailFromParams || "");
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);

    // Check if user is already verified
    useEffect(() => {
        const checkVerification = async () => {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user?.email_confirmed_at) {
                setIsVerified(true);
                // Redirect to dashboard after a short delay
                setTimeout(() => {
                    router.push("/dashboard");
                }, 2000);
            } else {
                setIsVerified(false);
            }
        };

        checkVerification();
    }, [router]);

    // ============================================================
    // Handlers
    // ============================================================

    const handleResend = async () => {
        if (!email) {
            setError("Please enter your email address");
            return;
        }

        setError(null);
        setIsResending(true);
        setResendSuccess(false);

        try {
            await resendVerificationEmail(email);
            setResendSuccess(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to send verification email. Please try again."
            );
        } finally {
            setIsResending(false);
        }
    };

    // ============================================================
    // Loading State
    // ============================================================

    if (isVerified === null) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ============================================================
    // Already Verified View
    // ============================================================

    if (isVerified) {
        return (
            <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Email verified!</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Your email has been successfully verified. Redirecting you to the
                        dashboard...
                    </p>
                </div>
                <Button onClick={() => router.push("/dashboard")}>
                    Go to dashboard
                </Button>
            </div>
        );
    }

    // ============================================================
    // Pending Verification View
    // ============================================================

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Mail className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    We sent a verification link to your email address. Please check your
                    inbox and click the link to verify.
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* Success Alert */}
            {resendSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green-100 dark:bg-green-900/30 p-3 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <p>Verification email sent! Please check your inbox.</p>
                </div>
            )}

            {/* Resend Form */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isResending}
                    />
                </div>

                <Button
                    onClick={handleResend}
                    disabled={isResending || !email}
                    variant="outline"
                    className="w-full"
                >
                    {isResending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Resend verification email
                        </>
                    )}
                </Button>
            </div>

            {/* Tips */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                    Didn&apos;t receive the email?
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>Check your spam or junk folder</li>
                    <li>Make sure you entered the correct email</li>
                    <li>Wait a few minutes and try resending</li>
                </ul>
            </div>

            {/* Back to Login */}
            <div className="text-center">
                <Button variant="ghost" onClick={() => router.push("/login")}>
                    Back to login
                </Button>
            </div>
        </div>
    );
}
