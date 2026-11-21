import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { asc, eq, or } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { accounts, db, users } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { createAdminUserSchema } from "@/lib/validations/user";
import { insertAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const { errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        displayUsername: users.displayUsername,
        role: users.role,
        banned: users.banned,
        banReason: users.banReason,
        banExpires: users.banExpires,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(asc(users.name));

    const userList = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      displayUsername: u.displayUsername,
      role: u.role,
      banned: Boolean(u.banned),
      banReason: u.banReason,
      banExpires: u.banExpires ? u.banExpires.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return formatSuccessResponse(userList);
  } catch (error) {
    console.error("Users GET route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat daftar pengguna admin.",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = createAdminUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const normalizedUsername = parsed.data.username.toLowerCase();

    // Check duplicate email or username
    const [existing] = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(
        or(
          eq(users.email, normalizedEmail),
          eq(users.username, normalizedUsername)
        )
      )
      .limit(1);

    if (existing) {
      const field =
        existing.email === normalizedEmail ? "Email" : "Username";
      return formatErrorResponse(
        "CONFLICT",
        `${field} "${field === "Email" ? normalizedEmail : normalizedUsername}" sudah terdaftar.`,
        409
      );
    }

    const hashedPassword = await hashPassword(parsed.data.password);
    const userId = crypto.randomUUID();

    const [createdUser] = await db
      .insert(users)
      .values({
        id: userId,
        name: parsed.data.name,
        email: normalizedEmail,
        emailVerified: true,
        username: normalizedUsername,
        displayUsername: parsed.data.name,
        role: parsed.data.role,
        banned: false,
      })
      .returning();

    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId: userId,
      password: hashedPassword,
    });

    const activeElection = await resolveTargetElection();
    if (activeElection) {
      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "user_created",
        actionTitle: "Pengguna admin dibuat",
        description: `Membuat akun admin: @${createdUser.username} (${createdUser.role})`,
        ipAddress: extractClientIp(request),
      });
    }

    const dto = {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      username: createdUser.username,
      displayUsername: createdUser.displayUsername,
      role: createdUser.role,
      banned: Boolean(createdUser.banned),
      createdAt: createdUser.createdAt.toISOString(),
      updatedAt: createdUser.updatedAt.toISOString(),
    };

    return formatSuccessResponse(dto, undefined, 201);
  } catch (error) {
    console.error("Users POST route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat membuat pengguna admin.",
      500
    );
  }
}
