/**
 * @fileoverview useAuth hook
 *
 * Re-exports the useAuth hook from AuthContext for convenient imports.
 * Also re-exports related types.
 *
 * @module hooks/use-auth
 */

export { useAuth } from "@/contexts/AuthContext";
export type { UserRole, OAuthProvider } from "@/lib/supabase/auth";
