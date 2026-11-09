import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, accounts, elections } from "@/db/schema";
import { eq, and, sql, not } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";
import { hashPassword } from "better-auth/crypto";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  username: z.string().trim().min(3, "Username minimal 3 karakter").toLowerCase(),
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
  role: z.enum(["super_admin", "committee"]).default("committee"),
});

const updateUserSchema = z.object({
  id: z.string().min(1, "ID pengguna wajib diisi"),
  role: z.enum(["super_admin", "committee"]).optional(),
  banned: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat mengelola administrator." },
        { status: 403 }
      );
    }

    const adminList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        displayUsername: users.displayUsername,
        role: users.role,
        banned: users.banned,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.role, users.name);

    return NextResponse.json({
      success: true,
      data: adminList,
    });
  } catch (error) {
    console.error("[Admin Users GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memuat daftar admin." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat menambahkan admin." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const { name, username, email, password, role } = result.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";

    // Cek apakah username atau email sudah ada
    const [existing] = await db
      .select()
      .from(users)
      .where(sql`${users.email} = ${email} OR ${users.username} = ${username}`)
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, error: "DUPLICATE_USER", message: "Email atau username sudah terdaftar." },
        { status: 409 }
      );
    }

    const newUserId = `usr_${crypto.randomUUID()}`;
    const hashedPassword = await hashPassword(password);

    await db.insert(users).values({
      id: newUserId,
      name,
      email,
      username,
      displayUsername: name,
      role,
      emailVerified: true,
      banned: false,
    });

    await db.insert(accounts).values({
      id: `acc_${crypto.randomUUID()}`,
      accountId: newUserId,
      providerId: "credential",
      userId: newUserId,
      password: hashedPassword,
    });

    const [activeElection] = await db.select().from(elections).where(eq(elections.isActive, true)).limit(1);

    if (activeElection) {
      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.email,
        action: "admin_user_created",
        actionTitle: "Admin baru ditambahkan",
        description: `Menambahkan akun admin '${username}' dengan peran '${role}'`,
        ipAddress,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Akun admin @${username} berhasil dibuat.`,
      data: { id: newUserId, name, username, email, role },
    });
  } catch (error) {
    console.error("[Admin Users POST Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal membuat akun admin." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat mengubah status admin." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const { id, role, banned } = result.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";

    if (id === session.user.id && (banned === true || role === "committee")) {
      return NextResponse.json(
        { success: false, error: "CANNOT_DEMOTE_SELF", message: "Kamu tidak dapat menurunkan peran atau memblokir akun sendiri." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: sql`now()` };
    if (role !== undefined) updates.role = role;
    if (banned !== undefined) updates.banned = banned;

    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();

    const [activeElection] = await db.select().from(elections).where(eq(elections.isActive, true)).limit(1);
    if (activeElection && updated) {
      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.email,
        action: "admin_user_updated",
        actionTitle: "Admin diperbarui",
        description: `Memperbarui akun admin @${updated.username}: role=${updated.role}, banned=${updated.banned}`,
        ipAddress,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Admin Users PATCH Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memperbarui admin." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat menghapus admin." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "MISSING_ID" }, { status: 400 });
    }

    if (id === session.user.id) {
      return NextResponse.json(
        { success: false, error: "CANNOT_DELETE_SELF", message: "Tidak dapat menghapus akun sendiri." },
        { status: 400 }
      );
    }

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();

    const [activeElection] = await db.select().from(elections).where(eq(elections.isActive, true)).limit(1);
    if (activeElection && deleted) {
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.email,
        action: "admin_user_deleted",
        actionTitle: "Admin dihapus",
        description: `Menghapus akun admin @${deleted.username}`,
        ipAddress,
      });
    }

    return NextResponse.json({ success: true, message: "Akun admin berhasil dihapus." });
  } catch (error) {
    console.error("[Admin Users DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal menghapus admin." },
      { status: 500 }
    );
  }
}
