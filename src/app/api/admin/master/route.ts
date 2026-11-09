import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { gradeLevels, majors, voterGroups, elections, voters } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";

const createMasterSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("grade"),
    name: z.string().trim().min(1, "Nama tingkat kelas wajib diisi"),
    sortOrder: z.number().int().default(0),
  }),
  z.object({
    type: z.literal("major"),
    name: z.string().trim().min(1, "Nama jurusan wajib diisi"),
    code: z.string().trim().optional(),
    sortOrder: z.number().int().default(0),
  }),
  z.object({
    type: z.literal("group"),
    name: z.string().trim().min(1, "Nama rombel wajib diisi"),
    gradeLevelId: z.string().uuid().optional().nullable(),
    majorId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().default(0),
  }),
]);

const deleteMasterSchema = z.object({
  type: z.enum(["grade", "major", "group"]),
  id: z.string().uuid("ID tidak valid"),
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

    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return NextResponse.json(
        { success: false, error: "NO_ACTIVE_ELECTION", message: "Tidak ada pemilihan aktif." },
        { status: 404 }
      );
    }

    const [gradesList, majorsList, groupsList] = await Promise.all([
      db
        .select()
        .from(gradeLevels)
        .where(eq(gradeLevels.electionId, activeElection.id))
        .orderBy(asc(gradeLevels.sortOrder), asc(gradeLevels.name)),
      db
        .select()
        .from(majors)
        .where(eq(majors.electionId, activeElection.id))
        .orderBy(asc(majors.sortOrder), asc(majors.name)),
      db
        .select({
          id: voterGroups.id,
          electionId: voterGroups.electionId,
          gradeLevelId: voterGroups.gradeLevelId,
          majorId: voterGroups.majorId,
          name: voterGroups.name,
          sortOrder: voterGroups.sortOrder,
          createdAt: voterGroups.createdAt,
          voterCount: sql<number>`count(${voters.id})::int`,
        })
        .from(voterGroups)
        .leftJoin(voters, eq(voters.groupId, voterGroups.id))
        .where(eq(voterGroups.electionId, activeElection.id))
        .groupBy(voterGroups.id)
        .orderBy(asc(voterGroups.sortOrder), asc(voterGroups.name)),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        electionId: activeElection.id,
        gradeLevels: gradesList,
        majors: majorsList,
        voterGroups: groupsList,
      },
    });
  } catch (error) {
    console.error("[Master Data GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memuat master data." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat menambah master data." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = createMasterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return NextResponse.json(
        { success: false, error: "NO_ACTIVE_ELECTION", message: "Tidak ada pemilihan aktif." },
        { status: 404 }
      );
    }

    const payload = result.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";

    if (payload.type === "grade") {
      const [inserted] = await db
        .insert(gradeLevels)
        .values({
          electionId: activeElection.id,
          name: payload.name,
          sortOrder: payload.sortOrder,
        })
        .returning();

      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.email,
        action: "master_grade_created",
        actionTitle: "Tingkat kelas ditambahkan",
        description: `Menambahkan tingkat kelas '${payload.name}'`,
        ipAddress,
      });

      return NextResponse.json({ success: true, data: inserted });
    }

    if (payload.type === "major") {
      const [inserted] = await db
        .insert(majors)
        .values({
          electionId: activeElection.id,
          name: payload.name,
          code: payload.code || null,
          sortOrder: payload.sortOrder,
        })
        .returning();

      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.email,
        action: "master_major_created",
        actionTitle: "Jurusan ditambahkan",
        description: `Menambahkan jurusan '${payload.name}' (${payload.code || "-"})`,
        ipAddress,
      });

      return NextResponse.json({ success: true, data: inserted });
    }

    if (payload.type === "group") {
      const [inserted] = await db
        .insert(voterGroups)
        .values({
          electionId: activeElection.id,
          gradeLevelId: payload.gradeLevelId || null,
          majorId: payload.majorId || null,
          name: payload.name,
          sortOrder: payload.sortOrder,
        })
        .returning();

      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.email,
        action: "master_group_created",
        actionTitle: "Rombel ditambahkan",
        description: `Menambahkan rombel '${payload.name}'`,
        ipAddress,
      });

      return NextResponse.json({ success: true, data: inserted });
    }

    return NextResponse.json({ success: false, error: "INVALID_TYPE" }, { status: 400 });
  } catch (error) {
    console.error("[Master Data POST Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal menambahkan master data." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat menghapus master data." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = deleteMasterSchema.safeParse({
      type: searchParams.get("type"),
      id: searchParams.get("id"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Parameter query type dan id wajib diisi." },
        { status: 400 }
      );
    }

    const { type, id } = parsed.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";

    if (type === "group") {
      // Periksa apakah ada pemilih di rombel ini
      const [voterCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(voters)
        .where(eq(voters.groupId, id));

      if (voterCount && voterCount.count > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "GROUP_HAS_VOTERS",
            message: `Rombel tidak dapat dihapus karena masih memuat ${voterCount.count} pemilih DPT.`,
          },
          { status: 409 }
        );
      }

      const [deleted] = await db
        .delete(voterGroups)
        .where(eq(voterGroups.id, id))
        .returning();

      if (deleted) {
        await insertAuditLog({
          electionId: deleted.electionId,
          actorType: "admin",
          actorId: session.user.id,
          actorName: session.user.name,
          actorIdentity: session.user.email,
          action: "master_group_deleted",
          actionTitle: "Rombel dihapus",
          description: `Menghapus rombel '${deleted.name}'`,
          ipAddress,
        });
      }

      return NextResponse.json({ success: true, message: "Rombel berhasil dihapus." });
    }

    if (type === "grade") {
      const [deleted] = await db
        .delete(gradeLevels)
        .where(eq(gradeLevels.id, id))
        .returning();

      if (deleted) {
        await insertAuditLog({
          electionId: deleted.electionId,
          actorType: "admin",
          actorId: session.user.id,
          actorName: session.user.name,
          actorIdentity: session.user.email,
          action: "master_grade_deleted",
          actionTitle: "Tingkat kelas dihapus",
          description: `Menghapus tingkat kelas '${deleted.name}'`,
          ipAddress,
        });
      }

      return NextResponse.json({ success: true, message: "Tingkat kelas berhasil dihapus." });
    }

    if (type === "major") {
      const [deleted] = await db
        .delete(majors)
        .where(eq(majors.id, id))
        .returning();

      if (deleted) {
        await insertAuditLog({
          electionId: deleted.electionId,
          actorType: "admin",
          actorId: session.user.id,
          actorName: session.user.name,
          actorIdentity: session.user.email,
          action: "master_major_deleted",
          actionTitle: "Jurusan dihapus",
          description: `Menghapus jurusan '${deleted.name}'`,
          ipAddress,
        });
      }

      return NextResponse.json({ success: true, message: "Jurusan berhasil dihapus." });
    }

    return NextResponse.json({ success: false, error: "INVALID_TYPE" }, { status: 400 });
  } catch (error) {
    console.error("[Master Data DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal menghapus data master." },
      { status: 500 }
    );
  }
}
