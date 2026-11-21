import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { accounts, db, sessions, users } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { updateAdminUserSchema } from "@/lib/validations/user";
import { insertAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "ID pengguna tidak valid.",
        400
      );
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = updateAdminUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Pengguna admin tidak ditemukan.",
        404
      );
    }

    // SELF-PROTECTION GUARDS
    const isSelf = session.user.id === targetUser.id;
    if (isSelf) {
      if (parsed.data.role && parsed.data.role !== "super_admin") {
        return formatErrorResponse(
          "BAD_REQUEST",
          "Anda tidak dapat menurunkan role akun Anda sendiri.",
          400
        );
      }
      if (parsed.data.banned === true) {
        return formatErrorResponse(
          "BAD_REQUEST",
          "Anda tidak dapat memblokir akun Anda sendiri.",
          400
        );
      }
    }

    // Check duplicate email if changed
    if (parsed.data.email) {
      const normalizedEmail = parsed.data.email.toLowerCase();
      if (normalizedEmail !== targetUser.email.toLowerCase()) {
        const [duplicate] = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.email, normalizedEmail),
              ne(users.id, id)
            )
          )
          .limit(1);

        if (duplicate) {
          return formatErrorResponse(
            "CONFLICT",
            `Email "${normalizedEmail}" sudah digunakan oleh akun lain.`,
            409
          );
        }
      }
    }

    const userUpdates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (parsed.data.name !== undefined) {
      userUpdates.name = parsed.data.name;
      userUpdates.displayUsername = parsed.data.name;
    }
    if (parsed.data.email !== undefined) {
      userUpdates.email = parsed.data.email.toLowerCase();
    }
    if (parsed.data.role !== undefined) {
      userUpdates.role = parsed.data.role;
    }
    if (parsed.data.banned !== undefined) {
      userUpdates.banned = parsed.data.banned;
    }

    const [updatedUser] = await db
      .update(users)
      .set(userUpdates)
      .where(eq(users.id, id))
      .returning();

    // If password is updated, hash and update accounts
    if (parsed.data.password) {
      const hashedPassword = await hashPassword(parsed.data.password);
      await db
        .update(accounts)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(accounts.userId, id));
    }

    // Force logout across all devices if password updated or account banned
    if (parsed.data.password || parsed.data.banned === true) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

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
        action: "user_updated",
        actionTitle: "Pengguna admin diperbarui",
        description: `Memperbarui akun admin: @${updatedUser.username}`,
        ipAddress: extractClientIp(request),
      });
    }

    const dto = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      username: updatedUser.username,
      displayUsername: updatedUser.displayUsername,
      role: updatedUser.role,
      banned: Boolean(updatedUser.banned),
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };

    return formatSuccessResponse(dto);
  } catch (error) {
    console.error("Users PATCH route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memperbarui pengguna admin.",
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "ID pengguna tidak valid.",
        400
      );
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Pengguna admin tidak ditemukan.",
        404
      );
    }

    // SELF-PROTECTION GUARD
    if (session.user.id === targetUser.id) {
      return formatErrorResponse(
        "BAD_REQUEST",
        "Anda tidak dapat menghapus akun Anda sendiri.",
        400
      );
    }

    await db.delete(users).where(eq(users.id, id));

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
        action: "user_deleted",
        actionTitle: "Pengguna admin dihapus",
        description: `Menghapus akun admin: @${targetUser.username} (${targetUser.name})`,
        ipAddress: extractClientIp(request),
      });
    }

    return formatSuccessResponse({ id: targetUser.id });
  } catch (error) {
    console.error("Users DELETE route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menghapus pengguna admin.",
      500
    );
  }
}
