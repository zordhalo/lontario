/**
 * @fileoverview RoleGate Component
 *
 * Conditionally renders children based on the current user's role.
 * Useful for showing/hiding UI elements based on permissions.
 *
 * @example
 * // Only show admin panel to admins and recruiters
 * <RoleGate allowedRoles={["admin", "recruiter"]}>
 *   <AdminPanel />
 * </RoleGate>
 *
 * @example
 * // Show fallback content for unauthorized users
 * <RoleGate allowedRoles={["admin"]} fallback={<AccessDenied />}>
 *   <SecretContent />
 * </RoleGate>
 */

"use client";

import { useAuth, type UserRole } from "@/hooks/use-auth";
import type { ReactNode } from "react";

interface RoleGateProps {
    /** Content to render if user has the required role */
    children: ReactNode;
    /** Roles that are allowed to see the content */
    allowedRoles: UserRole[];
    /** Optional content to show if user doesn't have required role */
    fallback?: ReactNode;
    /** If true, show loading state while auth is initializing */
    showLoading?: boolean;
}

export function RoleGate({
    children,
    allowedRoles,
    fallback = null,
    showLoading = false,
}: RoleGateProps) {
    const { hasRole, isLoading, isAuthenticated } = useAuth();

    // Show nothing while loading (unless showLoading is true)
    if (isLoading) {
        if (showLoading) {
            return (
                <div className="flex items-center justify-center p-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            );
        }
        return null;
    }

    // User is not authenticated
    if (!isAuthenticated) {
        return <>{fallback}</>;
    }

    // Check if user has required role
    if (!hasRole(allowedRoles)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * Inverse RoleGate - shows content to users WITHOUT the specified roles
 *
 * @example
 * // Show upgrade prompt to non-admin users
 * <RoleGateExclude excludeRoles={["admin"]}>
 *   <UpgradePrompt />
 * </RoleGateExclude>
 */
export function RoleGateExclude({
    children,
    excludeRoles,
    fallback = null,
}: {
    children: ReactNode;
    excludeRoles: UserRole[];
    fallback?: ReactNode;
}) {
    const { hasRole, isLoading, isAuthenticated } = useAuth();

    if (isLoading) {
        return null;
    }

    // Show to unauthenticated users
    if (!isAuthenticated) {
        return <>{children}</>;
    }

    // Show if user does NOT have excluded roles
    if (!hasRole(excludeRoles)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}
