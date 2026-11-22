import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  VOTER_SESSION_COOKIE,
  verifyVoterSessionCookieEdge,
} from "@/lib/auth/voter-session-edge";

function clearCorruptVoterCookie(response: NextResponse): NextResponse {
  response.cookies.set(VOTER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Proteksi API Admin (/api/admin/*)
  if (pathname.startsWith("/api/admin")) {
    const adminCookie = getSessionCookie(request);
    if (!adminCookie) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "Sesi admin tidak ditemukan atau telah berakhir. Silakan masuk terlebih dahulu.",
          },
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 2. Halaman login admin dibiarkan lewat agar Server Component memvalidasi DB session tanpa redirect loop
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // 3. Proteksi halaman Panel Admin (/admin/*)
  if (pathname.startsWith("/admin")) {
    const adminCookie = getSessionCookie(request);
    if (!adminCookie) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // 4. Proteksi API Pemilih terautentikasi (/api/voter/vote & /api/voter/logout)
  if (pathname === "/api/voter/vote" || pathname === "/api/voter/logout") {
    const rawVoterCookie = request.cookies.get(VOTER_SESSION_COOKIE)?.value;
    if (!rawVoterCookie) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "Sesi pemilih tidak ditemukan. Silakan masuk menggunakan NIS dan Token.",
          },
        },
        { status: 401 }
      );
    }

    const isValid = await verifyVoterSessionCookieEdge(rawVoterCookie);
    if (!isValid) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Sesi pemilih tidak valid. Silakan masuk kembali.",
          },
        },
        { status: 401 }
      );
      return clearCorruptVoterCookie(response);
    }

    return NextResponse.next();
  }

  // 5. Proteksi halaman bilik suara & terima kasih (/vote & /vote/*)
  if (pathname === "/vote" || pathname.startsWith("/vote/")) {
    const rawVoterCookie = request.cookies.get(VOTER_SESSION_COOKIE)?.value;
    if (!rawVoterCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const isValid = await verifyVoterSessionCookieEdge(rawVoterCookie);
    if (!isValid) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      return clearCorruptVoterCookie(response);
    }

    return NextResponse.next();
  }

  // 6. Halaman /login: bersihkan cookie corrupt jika ada, biarkan Server Component cek DB session aktif
  if (pathname === "/login") {
    const rawVoterCookie = request.cookies.get(VOTER_SESSION_COOKIE)?.value;
    if (rawVoterCookie) {
      const isValid = await verifyVoterSessionCookieEdge(rawVoterCookie);
      if (!isValid) {
        return clearCorruptVoterCookie(NextResponse.next());
      }
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/vote",
    "/vote/:path*",
    "/api/voter/vote",
    "/api/voter/logout",
    "/login",
  ],
};
