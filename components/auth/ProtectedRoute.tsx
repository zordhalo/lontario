/**
 * @fileoverview ProtectedRoute Component
 *
 * Client-side route protection for pages that require authentication.
 * Use this in addition to middleware for extra protection and
 * better loading states.
 *
 * @example
 * // Protect a page from unauthenticated users
 * <ProtectedRoute>
 *   <DashboardContent />
 * </ProtectedRoute>
 *
 * @example
 * // Require specific roles
 * <ProtectedRoute requiredRoles={["admin", "recruiter"]}>
 *   <AdminPanel />
 * </ProtectedRoute>
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type UserRole } from "@/hooks/use-auth";
import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
    /** Content to render when authenticated */
    children: ReactNode;
    /** Optional: Specific roles required to view this content */
    requiredRoles?: UserRole[];
    /** URL to redirect to if not authenticated (default: /login) */
    redirectTo?: string;
    /** Custom loading component */
    loadingComponent?: ReactNode;
    /** Custom unauthorized component */
    unauthorizedComponent?: ReactNode;
}

export function ProtectedRoute({
    children,
    requiredRoles,
    redirectTo = "/login",
    loadingComponent,
    unauthorizedComponent,
}: ProtectedRouteProps) {
    const router = useRouter();
    const { isAuthenticated, isLoading, hasRole, user } = useAuth();

    useEffect(() => {
        // Only redirect after loading is complete
        if (!isLoading && !isAuthenticated) {
            const currentPath = window.location.pathname;
            router.push(`${redirectTo}?redirectTo=${encodeURIComponent(currentPath)}`);
        }
    }, [isLoading, isAuthenticated, router, redirectTo]);

    // Loading state
    if (isLoading) {
        if (loadingComponent) {
            return <>{loadingComponent}</>;
        }

        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated - will redirect
    if (!isAuthenticated) {
        return null;
    }

    // Check role requirements
    if (requiredRoles && !hasRole(requiredRoles)) {
        if (unauthorizedComponent) {
            return <>{unauthorizedComponent}</>;
        }

        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <ShieldAlert className="h-8 w-8 text-destructive" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Access Denied</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            You don&apos;t have permission to view this page.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push("/dashboard")}>
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

/**
 * Higher-order component version of ProtectedRoute
 * Useful for wrapping entire page components
 */
export function withAuth<P extends object>(
    Component: React.ComponentType<P>,
    options?: Omit<ProtectedRouteProps, "children">
) {
    return function AuthenticatedComponent(props: P) {
        return (
            <ProtectedRoute {...options}>
                <Component {...props} />
            </ProtectedRoute>
        );
    };
}
