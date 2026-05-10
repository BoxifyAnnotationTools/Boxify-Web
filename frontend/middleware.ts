import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require a valid JWT
const PROTECTED_PATHS = ["/editor", "/dashboard"];

// Routes that logged-in users should be bounced away from
const AUTH_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read the persisted auth from localStorage via the cookie/storage key.
  // Since middleware runs on the Edge (no localStorage), we read the
  // Zustand persist key that is stored as a cookie by the client.
  // Alternatively, we store a lightweight "auth" cookie on login.
  // We use a simple cookie strategy: the authStore sets a cookie "boxify-auth-token".
  const token = request.cookies.get("boxify-auth-token")?.value ?? null;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Not logged in → trying to access protected route → redirect to login
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in → trying to access login/register → redirect to editor
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|boxify.svg).*)"],
};
