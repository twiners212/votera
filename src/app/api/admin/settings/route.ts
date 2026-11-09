import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { elections, electionSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";

const updateSettingsSchema = z.object({
  title: z.string().trim().min(3, "Judul pemilihan minimal 3 karakter").optional(),
  shortName: z.string().trim().min(2, "Nama singkat minimal 2 karakter").optional(),
  organizationName: z.string().trim().min(2, "Nama instansi minimal 2 karakter").optional(),
  description: z.string().trim().optional(),
  status: z.enum(["draft", "open", "closed", "archived"]).optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  // Settings
  idLabel: z.string().trim().min(1).default("NIS").optional(),
  groupLabel: z.string().trim().min(1).default("Rombel").optional(),
  gradeLabel: z.string().trim().min(1).default("Tingkat").optional(),
  majorLabel: z.string().trim().min(1).default("Jurusan").optional(),
  isResultPublic: z.boolean().optional(),
  logoUrl: z.string().url().nullable().optional(),
  heroBannerUrl: z.string().url().nullable().optional(),
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

    let [settings] = await db
      .select()
      .from(electionSettings)
      .where(eq(electionSettings.electionId, activeElection.id))
      .limit(1);

    if (!settings) {
      // Buat default settings jika belum ada
      const [created] = await db
        .insert(electionSettings)
        .values({
          electionId: activeElection.id,
          idLabel: "NIS",
          groupLabel: "Rombel",
          gradeLabel: "Tingkat",
          majorLabel: "Jurusan",
        })
        .returning();
      settings = created;
    }

    return NextResponse.json({
      success: true,
      data: {
        election: activeElection,
        settings,
      },
    });
  } catch (error) {
    console.error("[Settings GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memuat pengaturan." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat mengubah pengaturan pemilihan." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = updateSettingsSchema.safeParse(body);
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

    const data = result.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";

    // Update election fields
    const electionUpdates: Record<string, unknown> = {
      updatedAt: sql`now()`,
    };
    if (data.title !== undefined) electionUpdates.title = data.title;
    if (data.shortName !== undefined) electionUpdates.shortName = data.shortName;
    if (data.organizationName !== undefined) electionUpdates.organizationName = data.organizationName;
    if (data.description !== undefined) electionUpdates.description = data.description;
    if (data.status !== undefined) electionUpdates.status = data.status;
    if (data.startAt !== undefined) electionUpdates.startAt = data.startAt ? new Date(data.startAt) : null;
    if (data.endAt !== undefined) electionUpdates.endAt = data.endAt ? new Date(data.endAt) : null;

    const [updatedElection] = await db
      .update(elections)
      .set(electionUpdates)
      .where(eq(elections.id, activeElection.id))
      .returning();

    // Update election settings
    const settingsUpdates: Record<string, unknown> = {
      updatedAt: sql`now()`,
    };
    if (data.idLabel !== undefined) settingsUpdates.idLabel = data.idLabel;
    if (data.groupLabel !== undefined) settingsUpdates.groupLabel = data.groupLabel;
    if (data.gradeLabel !== undefined) settingsUpdates.gradeLabel = data.gradeLabel;
    if (data.majorLabel !== undefined) settingsUpdates.majorLabel = data.majorLabel;
    if (data.isResultPublic !== undefined) settingsUpdates.isResultPublic = data.isResultPublic;
    if (data.logoUrl !== undefined) settingsUpdates.logoUrl = data.logoUrl;
    if (data.heroBannerUrl !== undefined) settingsUpdates.heroBannerUrl = data.heroBannerUrl;

    const [updatedSettings] = await db
      .insert(electionSettings)
      .values({
        electionId: activeElection.id,
        ...settingsUpdates,
      })
      .onConflictDoUpdate({
        target: electionSettings.electionId,
        set: settingsUpdates,
      })
      .returning();

    await insertAuditLog({
      electionId: activeElection.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "settings_updated",
      actionTitle: "Pengaturan pemilihan diperbarui",
      description: `Memperbarui konfigurasi pemilihan: status='${updatedElection.status}', instansi='${updatedElection.organizationName}'`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: "Pengaturan berhasil disimpan.",
      data: {
        election: updatedElection,
        settings: updatedSettings,
      },
    });
  } catch (error) {
    console.error("[Settings PATCH Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memperbarui pengaturan." },
      { status: 500 }
    );
  }
}
