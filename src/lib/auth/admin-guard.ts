import { cache } from "react";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/admin-auth";
import type { AdminRole } from "@/types/votera";

export interface AdminSessionUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: AdminRole;
}

export interface AdminSessionResult {
  user: AdminSessionUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

export class AdminAuthError extends Error {
  constructor(
    public code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
    public status: 401 | 403
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

function isAdminRole(value: unknown): value is AdminRole {
  return value === "super_admin" || value === "committee";
}

export const getAdminSession = cache(
  async (): Promise<AdminSessionResult | null> => {
    try {
      const requestHeaders = await headers();
      const session = await auth.api.getSession({
        headers: requestHeaders,
        query: {
          disableCookieCache: true,
        },
      });

      if (!session || !session.user) {
        return null;
      }

      const rawUser = session.user as {
        id: string;
        name: string;
        email: string;
        username?: string | null;
        role?: unknown;
        banned?: boolean | null;
      };

      if (rawUser.banned) {
        return null;
      }

      if (!isAdminRole(rawUser.role)) {
        return null;
      }

      return {
        user: {
          id: rawUser.id,
          name: rawUser.name,
          email: rawUser.email,
          username: rawUser.username ?? null,
          role: rawUser.role,
        },
        session: {
          id: session.session.id,
          userId: session.session.userId,
          expiresAt: new Date(session.session.expiresAt),
        },
      };
    } catch {
      return null;
    }
  }
);

export async function requireAdminSession(
  allowedRoles?: AdminRole[]
): Promise<AdminSessionResult> {
  const session = await getAdminSession();
  if (!session) {
    throw new AdminAuthError(
      "UNAUTHORIZED",
      "Sesi panitia tidak ditemukan atau telah berakhir. Silakan login ulang.",
      401
    );
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new AdminAuthError(
      "FORBIDDEN",
      "Anda tidak memiliki hak akses untuk melakukan aksi ini.",
      403
    );
  }

  return session;
}

export async function requireAdminApiSession(
  allowedRoles?: AdminRole[]
): Promise<
  | { session: AdminSessionResult; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  try {
    const session = await requireAdminSession(allowedRoles);
    return { session, errorResponse: null };
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return {
        session: null,
        errorResponse: NextResponse.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
            },
          },
          { status: err.status }
        ),
      };
    }

    return {
      session: null,
      errorResponse: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Sesi panitia tidak valid.",
          },
        },
        { status: 401 }
      ),
    };
  }
}
