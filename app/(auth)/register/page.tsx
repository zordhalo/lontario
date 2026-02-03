/**
 * @fileoverview Register Page
 *
 * User registration with email/password and role selection.
 * Includes form validation and password requirements.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Loader2,
    Mail,
    Lock,
    User,
    AlertCircle,
    CheckCircle2,
    Github,
    Chrome,
    Linkedin,
} from "lucide-react";
import type { OAuthProvider, UserRole } from "@/lib/supabase/auth";

// ============================================================
// Validation Schema
// ============================================================

const registerSchema = z
    .object({
        fullName: z.string().min(2, "Full name must be at least 2 characters"),
        email: z.string().email("Please enter a valid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string(),
        role: z.enum(["candidate", "recruiter"]),
        acceptTerms: z.boolean().refine((val) => val === true, {
            message: "You must accept the terms and conditions",
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

// ============================================================
// Component
// ============================================================

export default function RegisterPage() {
    const router = useRouter();
    const { signUp, signInWithOAuth, isLoading: authLoading } = useAuth();

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
    const [showVerifyEmail, setShowVerifyEmail] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            role: "candidate",
            acceptTerms: false,
        },
    });

    const watchPassword = watch("password", "");
    const passwordValidation = validatePassword(watchPassword);

    // ============================================================
    // Handlers
    // ============================================================

    const onSubmit = async (data: RegisterFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await signUp(
                data.email,
                data.password,
                data.role as UserRole,
                data.fullName
            );

            if (result.needsEmailVerification) {
                setShowVerifyEmail(true);
            } else {
                router.push("/dashboard");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to create account. Please try again."
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
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "OAuth sign up failed. Please try again."
            );
            setOauthLoading(null);
        }
    };

    const isLoading = isSubmitting || authLoading || oauthLoading !== null;

    // ============================================================
    // Verify Email View
    // ============================================================

    if (showVerifyEmail) {
        return (
            <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        We&apos;ve sent you a verification link to complete your registration.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/login")}>
                    Back to login
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
                <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Get started with Lontario today
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
            <div className="grid gap-3 sm:grid-cols-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOAuthLogin("google")}
                    disabled={isLoading}
                >
                    {oauthLoading === "google" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Chrome className="h-4 w-4" />
                    )}
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOAuthLogin("linkedin_oidc")}
                    disabled={isLoading}
                >
                    {oauthLoading === "linkedin_oidc" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Linkedin className="h-4 w-4" />
                    )}
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOAuthLogin("github")}
                    disabled={isLoading}
                >
                    {oauthLoading === "github" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Github className="h-4 w-4" />
                    )}
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

            {/* Registration Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="fullName"
                            type="text"
                            placeholder="John Doe"
                            className="pl-10"
                            autoComplete="name"
                            disabled={isLoading}
                            {...register("fullName")}
                        />
                    </div>
                    {errors.fullName && (
                        <p className="text-sm text-destructive">{errors.fullName.message}</p>
                    )}
                </div>

                {/* Email */}
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

                {/* Role Selection */}
                <div className="space-y-2">
                    <Label htmlFor="role">I am a...</Label>
                    <Select
                        defaultValue="candidate"
                        onValueChange={(value) =>
                            setValue("role", value as "candidate" | "recruiter")
                        }
                        disabled={isLoading}
                    >
                        <SelectTrigger id="role">
                            <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="candidate">
                                Job Seeker / Candidate
                            </SelectItem>
                            <SelectItem value="recruiter">
                                Recruiter / Hiring Manager
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.role && (
                        <p className="text-sm text-destructive">{errors.role.message}</p>
                    )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            autoComplete="new-password"
                            disabled={isLoading}
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
                            disabled={isLoading}
                            {...register("confirmPassword")}
                        />
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-sm text-destructive">
                            {errors.confirmPassword.message}
                        </p>
                    )}
                </div>

                {/* Terms Checkbox */}
                <div className="flex items-start space-x-2">
                    <Checkbox
                        id="acceptTerms"
                        disabled={isLoading}
                        onCheckedChange={(checked) =>
                            setValue("acceptTerms", checked === true)
                        }
                    />
                    <div className="grid gap-1.5 leading-none">
                        <label
                            htmlFor="acceptTerms"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            I agree to the{" "}
                            <Link href="/terms" className="text-primary hover:underline">
                                Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>
                        </label>
                    </div>
                </div>
                {errors.acceptTerms && (
                    <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
                )}

                <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !passwordValidation.valid}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                        </>
                    ) : (
                        "Create account"
                    )}
                </Button>
            </form>

            {/* Login Link */}
            <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                    href="/login"
                    className="font-medium text-primary hover:underline"
                >
                    Sign in
                </Link>
            </p>
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
