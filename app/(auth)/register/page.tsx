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
} from "lucide-react";

function GoogleIcon() {
    return (
        <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

function LinkedInIcon() {
    return (
        <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
}
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
                        <GoogleIcon />
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
                        <LinkedInIcon />
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
