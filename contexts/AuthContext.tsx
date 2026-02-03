/**
 * @fileoverview Auth Context Provider
 *
 * Provides authentication state and methods to the entire application.
 * Handles session management, user profiles, and auth state changes.
 *
 * @module contexts/AuthContext
 */

"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
    signIn as authSignIn,
    signUp as authSignUp,
    signOut as authSignOut,
    signInWithOAuth as authSignInWithOAuth,
    resetPassword as authResetPassword,
    refreshSession as authRefreshSession,
    hasRole as checkHasRole,
    type UserRole,
    type OAuthProvider,
    AuthError,
} from "@/lib/supabase/auth";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/types";

// ============================================================
// Types
// ============================================================

interface AuthState {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
    /** Sign in with email and password */
    signIn: (email: string, password: string) => Promise<void>;
    /** Sign up with email and password */
    signUp: (
        email: string,
        password: string,
        role?: UserRole,
        fullName?: string
    ) => Promise<{ needsEmailVerification: boolean }>;
    /** Sign in with OAuth provider */
    signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
    /** Sign out */
    signOut: () => Promise<void>;
    /** Send password reset email */
    resetPassword: (email: string) => Promise<void>;
    /** Refresh the current session */
    refreshSession: () => Promise<void>;
    /** Check if user has one of the specified roles */
    hasRole: (roles: UserRole | UserRole[]) => boolean;
    /** Refetch user profile */
    refetchProfile: () => Promise<void>;
}

// ============================================================
// Context
// ============================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================
// Provider
// ============================================================

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [state, setState] = useState<AuthState>({
        user: null,
        profile: null,
        session: null,
        isLoading: true,
        isAuthenticated: false,
    });

    const supabase = useMemo(() => createClient(), []);

    // Fetch user profile from database
    const fetchProfile = useCallback(
        async (userId: string): Promise<Profile | null> => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (error) {
                console.error("Failed to fetch profile:", error);
                return null;
            }

            return data as Profile;
        },
        [supabase]
    );

    // Initialize auth state
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (session?.user) {
                    const profile = await fetchProfile(session.user.id);
                    setState({
                        user: session.user,
                        profile,
                        session,
                        isLoading: false,
                        isAuthenticated: true,
                    });
                } else {
                    setState({
                        user: null,
                        profile: null,
                        session: null,
                        isLoading: false,
                        isAuthenticated: false,
                    });
                }
            } catch (error) {
                console.error("Auth initialization error:", error);
                setState((prev) => ({ ...prev, isLoading: false }));
            }
        };

        initializeAuth();

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "SIGNED_IN" && session?.user) {
                const profile = await fetchProfile(session.user.id);
                setState({
                    user: session.user,
                    profile,
                    session,
                    isLoading: false,
                    isAuthenticated: true,
                });
            } else if (event === "SIGNED_OUT") {
                setState({
                    user: null,
                    profile: null,
                    session: null,
                    isLoading: false,
                    isAuthenticated: false,
                });
            } else if (event === "TOKEN_REFRESHED" && session) {
                setState((prev) => ({
                    ...prev,
                    session,
                }));
            } else if (event === "USER_UPDATED" && session?.user) {
                const profile = await fetchProfile(session.user.id);
                setState((prev) => ({
                    ...prev,
                    user: session.user,
                    profile,
                }));
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, fetchProfile]);

    // ============================================================
    // Auth Methods
    // ============================================================

    const signIn = useCallback(async (email: string, password: string) => {
        setState((prev) => ({ ...prev, isLoading: true }));
        try {
            await authSignIn({ email, password });
            // Auth state change listener will update state
        } catch (error) {
            setState((prev) => ({ ...prev, isLoading: false }));
            throw error;
        }
    }, []);

    const signUp = useCallback(
        async (
            email: string,
            password: string,
            role?: UserRole,
            fullName?: string
        ) => {
            setState((prev) => ({ ...prev, isLoading: true }));
            try {
                const result = await authSignUp({
                    email,
                    password,
                    role,
                    fullName,
                });

                // Check if email confirmation is required
                const needsEmailVerification =
                    result.user?.identities?.length === 0 ||
                    result.user?.confirmed_at === null;

                setState((prev) => ({ ...prev, isLoading: false }));

                return { needsEmailVerification };
            } catch (error) {
                setState((prev) => ({ ...prev, isLoading: false }));
                throw error;
            }
        },
        []
    );

    const signInWithOAuth = useCallback(async (provider: OAuthProvider) => {
        setState((prev) => ({ ...prev, isLoading: true }));
        try {
            await authSignInWithOAuth(provider);
            // Redirect happens, no need to update state
        } catch (error) {
            setState((prev) => ({ ...prev, isLoading: false }));
            throw error;
        }
    }, []);

    const signOut = useCallback(async () => {
        setState((prev) => ({ ...prev, isLoading: true }));
        try {
            await authSignOut();
            // Auth state change listener will update state
        } catch (error) {
            setState((prev) => ({ ...prev, isLoading: false }));
            throw error;
        }
    }, []);

    const resetPassword = useCallback(async (email: string) => {
        await authResetPassword(email);
    }, []);

    const refreshSession = useCallback(async () => {
        try {
            const result = await authRefreshSession();
            if (result.session) {
                setState((prev) => ({
                    ...prev,
                    session: result.session,
                    user: result.user,
                }));
            }
        } catch (error) {
            console.error("Session refresh failed:", error);
            // If refresh fails, sign out
            if (error instanceof AuthError && error.code === "refresh_token_not_found") {
                await signOut();
            }
        }
    }, [signOut]);

    const hasRole = useCallback(
        (roles: UserRole | UserRole[]): boolean => {
            const roleArray = Array.isArray(roles) ? roles : [roles];
            return checkHasRole(state.profile?.role as UserRole, roleArray);
        },
        [state.profile?.role]
    );

    const refetchProfile = useCallback(async () => {
        if (state.user?.id) {
            const profile = await fetchProfile(state.user.id);
            setState((prev) => ({ ...prev, profile }));
        }
    }, [state.user?.id, fetchProfile]);

    // ============================================================
    // Context Value
    // ============================================================

    const value = useMemo<AuthContextValue>(
        () => ({
            ...state,
            signIn,
            signUp,
            signInWithOAuth,
            signOut,
            resetPassword,
            refreshSession,
            hasRole,
            refetchProfile,
        }),
        [
            state,
            signIn,
            signUp,
            signInWithOAuth,
            signOut,
            resetPassword,
            refreshSession,
            hasRole,
            refetchProfile,
        ]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Hook
// ============================================================

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
}
