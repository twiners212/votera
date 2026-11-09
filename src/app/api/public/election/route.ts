import { NextResponse } from "next/server";
import { db } from "@/db";
import { elections, electionSettings, candidates } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return NextResponse.json(
        { success: false, error: "NO_ACTIVE_ELECTION", message: "Tidak ada pemilihan aktif saat ini." },
        { status: 404 }
      );
    }

    const [settings, candidatesList] = await Promise.all([
      db
        .select()
        .from(electionSettings)
        .where(eq(electionSettings.electionId, activeElection.id))
        .limit(1)
        .then((res) => res[0] || null),
      db
        .select({
          id: candidates.id,
          candidateNumber: candidates.candidateNumber,
          name: candidates.name,
          classOrUnit: candidates.classOrUnit,
          motto: candidates.motto,
          vision: candidates.vision,
          missions: candidates.missions,
          programs: candidates.programs,
          supporters: candidates.supporters,
          photoUrl: candidates.photoUrl,
          themeColor: candidates.themeColor,
          isActive: candidates.isActive,
        })
        .from(candidates)
        .where(eq(candidates.electionId, activeElection.id))
        .orderBy(asc(candidates.candidateNumber)),
    ]);

    const now = new Date();
    const isWithinSchedule =
      activeElection.status === "open" &&
      (!activeElection.startAt || now >= activeElection.startAt) &&
      (!activeElection.endAt || now <= activeElection.endAt);

    return NextResponse.json({
      success: true,
      data: {
        election: activeElection,
        settings,
        candidates: candidatesList,
        isWithinSchedule,
      },
    });
  } catch (error) {
    console.error("[Public Election GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memuat informasi pemilihan." },
      { status: 500 }
    );
  }
}
