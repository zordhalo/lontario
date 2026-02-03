/**
 * @fileoverview Reset Password Page
 *
 * Allows users to set a new password after clicking the reset link.
 * This page handles the password update after email verification.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updatePassword, validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    Lock,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";

// ============================================================
// Validation Schema
// ============================================================

const resetPasswordSchema = z
    .object({
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// ============================================================
// Component
// ============================================================

export default function ResetPasswordPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
    });

    const watchPassword = watch("password", "");
    const passwordValidation = validatePassword(watchPassword);

    // Verify the reset token is valid
    useEffect(() => {
        const verifyToken = async () => {
            const supabase = createClient();
            const { data, error } = await supabase.auth.getSession();

            if (error || !data.session) {
                setIsValidToken(false);
            } else {
                setIsValidToken(true);
            }
        };

        verifyToken();
    }, []);

    // ============================================================
    // Handlers
    // ============================================================

    const onSubmit = async (data: ResetPasswordFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            await updatePassword(data.password);
            setIsSuccess(true);

            // Redirect to login after a short delay
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update password. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============================================================
    // Loading State
    // ============================================================

    if (isValidToken === null) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ============================================================
    // Invalid Token View
    // ============================================================

    if (isValidToken === false) {
        return (
            <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Invalid or expired link</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        This password reset link is invalid or has expired.
                        Please request a new one.
                    </p>
                </div>
                <Button onClick={() => router.push("/forgot-password")}>
                    Request new link
                </Button>
            </div>
        );
    }

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
                    <h1 className="text-2xl font-bold tracking-tight">Password updated!</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Your password has been successfully updated.
                        Redirecting you to login...
                    </p>
                </div>
                <Button onClick={() => router.push("/login")}>
                    Go to login
                </Button>
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
                <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Enter your new password below
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
                {/* New Password */}
                <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            {...register("password")}
                        />
                    </div>
                    {errors.password && (
                        <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}

                    {/* Password Requirements */}
                    {watchPassword.length > 0 && (
                        <div className="space-y-1 text-xs">
                            <RequirementItem
                                met={watchPassword.length >= PASSWORD_REQUIREMENTS.minLength}
                                text={`At least ${PASSWORD_REQUIREMENTS.minLength} characters`}
                            />
                            <RequirementItem
                                met={/[A-Z]/.test(watchPassword)}
                                text="One uppercase letter"
                            />
                            <RequirementItem
                                met={/[a-z]/.test(watchPassword)}
                                text="One lowercase letter"
                            />
                            <RequirementItem
                                met={/\d/.test(watchPassword)}
                                text="One number"
                            />
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            {...register("confirmPassword")}
                        />
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-sm text-destructive">
                            {errors.confirmPassword.message}
                        </p>
                    )}
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !passwordValidation.valid}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                        </>
                    ) : (
                        "Update password"
                    )}
                </Button>
            </form>
        </div>
    );
}

// ============================================================
// Helper Components
// ============================================================

function RequirementItem({ met, text }: { met: boolean; text: string }) {
    return (
        <div className="flex items-center gap-1.5">
            {met ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
            )}
            <span className={met ? "text-muted-foreground" : "text-muted-foreground/60"}>
                {text}
            </span>
        </div>
    );
}
