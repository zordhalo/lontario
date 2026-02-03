/**
 * @fileoverview Auth helper functions for Supabase authentication
 *
 * Provides wrapper functions for common auth operations:
 * - Sign up, sign in, sign out
 * - OAuth authentication
 * - Password reset
 * - Role checking utilities
 *
 * @module lib/supabase/auth
 */

import { createClient } from "./client";

// ============================================================
// Types
// ============================================================

export type UserRole = "candidate" | "recruiter" | "hiring_manager" | "admin";

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
  role?: UserRole;
}

export interface SignInData {
  email: string;
  password: string;
}

export type OAuthProvider = "google" | "linkedin_oidc" | "github";

// Role hierarchy levels (higher = more permissions)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  candidate: 0,
  recruiter: 1,
  hiring_manager: 2,
  admin: 3,
};

// ============================================================
// Role Utilities
// ============================================================

/**
 * Check if a user role is included in required roles
 */
export function hasRole(
  userRole: UserRole | undefined | null,
  requiredRoles: UserRole[]
): boolean {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
}

/**
 * Get the hierarchy level for a role (higher = more permissions)
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

/**
 * Check if user has at least the minimum role level
 */
export function hasMinimumRole(
  userRole: UserRole | undefined | null,
  minimumRole: UserRole
): boolean {
  if (!userRole) return false;
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
}

// ============================================================
// Authentication Functions
// ============================================================

/**
 * Sign up a new user with email and password
 *
 * User metadata (fullName, role) is stored in Supabase Auth
 * and used by the trigger to create the profile
 */
export async function signUp(data: SignUpData) {
  const supabase = createClient();

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName ?? "",
        role: data.role ?? "candidate",
      },
      emailRedirectTo: `${getBaseUrl()}/auth/callback`,
    },
  });

  if (error) {
    throw new AuthError(error.message, error.code ?? "SIGNUP_FAILED");
  }

  return authData;
}

/**
 * Sign in with email and password
 */
export async function signIn(data: SignInData) {
  const supabase = createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    throw new AuthError(error.message, error.code ?? "SIGNIN_FAILED");
  }

  return authData;
}

/**
 * Sign in with OAuth provider
 *
 * Note: linkedin_oidc is the correct provider name for LinkedIn in Supabase
 */
export async function signInWithOAuth(provider: OAuthProvider) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${getBaseUrl()}/auth/callback`,
      queryParams:
        provider === "linkedin_oidc"
          ? {
              // Request profile and email scopes for LinkedIn
              scope: "openid profile email",
            }
          : undefined,
    },
  });

  if (error) {
    throw new AuthError(error.message, error.code ?? "OAUTH_FAILED");
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new AuthError(error.message, error.code ?? "SIGNOUT_FAILED");
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getBaseUrl()}/reset-password`,
  });

  if (error) {
    throw new AuthError(error.message, error.code ?? "RESET_FAILED");
  }
}

/**
 * Update password (used after reset link or for logged-in users)
 */
export async function updatePassword(newPassword: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new AuthError(error.message, error.code ?? "UPDATE_PASSWORD_FAILED");
  }
}

/**
 * Resend email verification
 */
export async function resendVerificationEmail(email: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${getBaseUrl()}/auth/callback`,
    },
  });

  if (error) {
    throw new AuthError(error.message, error.code ?? "RESEND_FAILED");
  }
}

/**
 * Get current session
 */
export async function getSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new AuthError(error.message, error.code ?? "SESSION_ERROR");
  }

  return data.session;
}

/**
 * Refresh the current session
 */
export async function refreshSession() {
  const supabase = createClient();

  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    throw new AuthError(error.message, error.code ?? "REFRESH_FAILED");
  }

  return data;
}

// ============================================================
// Utilities
// ============================================================

/**
 * Get the base URL for redirects
 */
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Server-side fallback
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000"
  );
}

// ============================================================
// Error Handling
// ============================================================

/**
 * Custom auth error class for consistent error handling
 */
export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Password validation requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional but recommended
};

/**
 * Validate password against requirements
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
