/**
 * @fileoverview Forgot Password Page
 *
 * Allows users to request a password reset email.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    Mail,
    AlertCircle,
    CheckCircle2,
    ArrowLeft,
} from "lucide-react";

// ============================================================
// Validation Schema
// ============================================================

const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// ============================================================
// Component
// ============================================================

export default function ForgotPasswordPage() {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    // ============================================================
    // Handlers
    // ============================================================

    const onSubmit = async (data: ForgotPasswordFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            await resetPassword(data.email);
            setIsSuccess(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to send reset email. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============================================================
    // Success View
    // ============================================================

    if (isSuccess) {
        return (
            <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        If an account exists with that email, we&apos;ve sent you a password
                        reset link.
                    </p>
                </div>
                <div className="space-y-3">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setIsSuccess(false)}
                    >
                        Try a different email
                    </Button>
                    <Link href="/login">
                        <Button variant="ghost" className="w-full">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to login
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    // ============================================================
    // Render
    // ============================================================

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">Forgot password?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    No worries, we&apos;ll send you reset instructions.
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* Form */}
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
                            disabled={isSubmitting}
                            {...register("email")}
                        />
                    </div>
                    {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        "Reset password"
                    )}
                </Button>
            </form>

            {/* Back to Login */}
            <Link href="/login">
                <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                </Button>
            </Link>
        </div>
    );
}
