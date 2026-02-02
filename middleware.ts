import { NextResponse, type NextRequest } from "next/server";

/**
 * Simplified middleware for MVP - no authentication checks
 * All routes are publicly accessible
 */
export async function middleware(request: NextRequest) {
  // MVP: Pass through all requests without auth checks
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
