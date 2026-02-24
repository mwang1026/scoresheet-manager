import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: { user?: { email?: string } } | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session?.user;

  // Public routes — always accessible
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon");

  if (isPublic) {
    // Redirect logged-in users away from /login
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Unauthenticated user — redirect to /login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // API proxy requests — inject trusted headers and proxy to backend
  if (pathname.startsWith("/api/")) {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const requestHeaders = new Headers(req.headers);
    const apiKey = process.env.INTERNAL_API_KEY;
    if (apiKey) requestHeaders.set("X-Internal-API-Key", apiKey);
    const email = session?.user?.email;
    if (email) requestHeaders.set("X-User-Email", email);
    const url = new URL(pathname + req.nextUrl.search, backendUrl);
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
