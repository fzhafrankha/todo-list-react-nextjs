import { NextResponse, type NextRequest } from "next/server";
import { verifySessionSignature, SESSION_COOKIE_NAME } from "@/lib/auth/session";

// proxy.ts always runs on the Node.js runtime (not configurable in Next.js
// 16+), which is what allows node:crypto here.
export const config = {
  matcher: ["/", "/todos/:path*"],
};

/**
 * "Thin proxy" per Next.js 16 guidance: fast, DB-free redirect for
 * unauthenticated requests. This only checks signature + expiry, not token
 * revocation (that needs a DB lookup) — the authoritative check happens in
 * Server Components/Actions via lib/auth/currentUser.ts. This is a UX
 * shortcut, not the security boundary.
 */
export function proxy(request: NextRequest): NextResponse {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionSignature(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
