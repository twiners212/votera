import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const adminSession =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  const voterSession = request.cookies.get("votera_voter_session")?.value;

  // 1. Lindungi rute /admin/* (Kecuali /admin/login)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!adminSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Jika sudah ada sesi admin dan membuka /admin/login, alihkan ke dashboard
  if (pathname === "/admin/login" && adminSession) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // 3. Lindungi rute /vote/* (Bilik suara digital pemilih)
  if (pathname.startsWith("/vote")) {
    if (!voterSession) {
      const voterLoginUrl = new URL("/login", request.url);
      voterLoginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(voterLoginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Terapkan ke semua rute admin dan vote
     * Kecuali file statis internal Next.js (_next/static, _next/image, favicon.ico)
     */
    "/admin/:path*",
    "/vote/:path*",
  ],
};
