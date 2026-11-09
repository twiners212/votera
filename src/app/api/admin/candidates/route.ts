import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { candidates, elections } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";

const createCandidateSchema = z.object({
  candidateNumber: z.number().int().min(1, "Nomor urut minimal 1"),
  name: z.string().trim().min(2, "Nama kandidat minimal 2 karakter"),
  classOrUnit: z.string().trim().min(1, "Kelas atau unit asal wajib diisi"),
  motto: z.string().trim().min(3, "Motto minimal 3 karakter"),
  vision: z.string().trim().min(5, "Visi minimal 5 karakter"),
  missions: z.array(z.string().trim().min(1)).min(1, "Minimal sertakan 1 misi"),
  programs: z.array(z.string().trim().min(1)).min(1, "Minimal sertakan 1 program kerja"),
  supporters: z.array(z.string().trim().min(1)).default([]),
  photoUrl: z.string().nullable().optional(),
  themeColor: z.enum(["red", "green", "blue", "amber"]).default("red"),
  isActive: z.boolean().default(true),
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

    const candidatesList = await db
      .select()
      .from(candidates)
      .where(eq(candidates.electionId, activeElection.id))
      .orderBy(asc(candidates.candidateNumber));

    return NextResponse.json({
      success: true,
      data: candidatesList,
    });
  } catch (error) {
    console.error("[Candidates GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memuat kandidat." },
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
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat menambahkan kandidat." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = createCandidateSchema.safeParse(body);
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

    // Cek duplikasi nomor urut
    const [existing] = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, activeElection.id),
          eq(candidates.candidateNumber, payload.candidateNumber)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "DUPLICATE_NUMBER",
          message: `Nomor urut #${payload.candidateNumber} sudah digunakan oleh ${existing.name}.`,
        },
        { status: 409 }
      );
    }

    const [inserted] = await db
      .insert(candidates)
      .values({
        electionId: activeElection.id,
        candidateNumber: payload.candidateNumber,
        name: payload.name,
        classOrUnit: payload.classOrUnit,
        motto: payload.motto,
        vision: payload.vision,
        missions: payload.missions,
        programs: payload.programs,
        supporters: payload.supporters,
        photoUrl: payload.photoUrl || null,
        themeColor: payload.themeColor,
        isActive: payload.isActive,
      })
      .returning();

    await insertAuditLog({
      electionId: activeElection.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "candidate_created",
      actionTitle: "Kandidat ditambahkan",
      description: `Menambahkan kandidat #${inserted.candidateNumber} (${inserted.name})`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Kandidat #${inserted.candidateNumber} berhasil ditambahkan.`,
      data: inserted,
    });
  } catch (error) {
    console.error("[Candidates POST Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal menyimpan kandidat." },
      { status: 500 }
    );
  }
}
