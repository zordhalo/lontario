/**
 * @fileoverview Login Form Component
 *
 * Email/password login with OAuth options.
 * Includes form validation and error handling.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    Mail,
    Lock,
    AlertCircle,
    Github,
    Chrome,
    Linkedin,
} from "lucide-react";
import type { OAuthProvider } from "@/lib/supabase/auth";

// ============================================================
// Validation Schema
// ============================================================

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ============================================================
// Component
// ============================================================

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirectTo") || "/dashboard";

    const { signIn, signInWithOAuth, isLoading: authLoading } = useAuth();

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    // ============================================================
    // Handlers
    // ============================================================

    const onSubmit = async (data: LoginFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            await signIn(data.email, data.password);
            router.push(redirectTo);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to sign in. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOAuthLogin = async (provider: OAuthProvider) => {
        setError(null);
        setOauthLoading(provider);

        try {
            await signInWithOAuth(provider);
            // OAuth redirects, no need to handle success here
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "OAuth sign in failed. Please try again."
            );
            setOauthLoading(null);
        }
    };

    const isLoading = isSubmitting || authLoading || oauthLoading !== null;

    // ============================================================
    // Render
    // ============================================================

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Sign in to your account to continue
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* OAuth Buttons */}
            <div className="space-y-3">
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuthLogin("google")}
                    disabled={isLoading}
                >
                    {oauthLoading === "google" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Chrome className="mr-2 h-4 w-4" />
                    )}
                    Continue with Google
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuthLogin("linkedin_oidc")}
                    disabled={isLoading}
                >
                    {oauthLoading === "linkedin_oidc" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Linkedin className="mr-2 h-4 w-4" />
                    )}
                    Continue with LinkedIn
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuthLogin("github")}
                    disabled={isLoading}
                >
                    {oauthLoading === "github" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Github className="mr-2 h-4 w-4" />
                    )}
                    Continue with GitHub
                </Button>
            </div>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                        or continue with email
                    </span>
                </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            className="pl-10"
                            autoComplete="email"
                            disabled={isLoading}
                            {...register("email")}
                        />
                    </div>
                    {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link
                            href="/forgot-password"
                            className="text-sm text-primary hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            autoComplete="current-password"
                            disabled={isLoading}
                            {...register("password")}
                        />
                    </div>
                    {errors.password && (
                        <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        "Sign in"
                    )}
                </Button>
            </form>

            {/* Register Link */}
            <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                    href="/register"
                    className="font-medium text-primary hover:underline"
                >
                    Sign up
                </Link>
            </p>
        </div>
    );
}
