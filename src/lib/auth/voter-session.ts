import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { voters, voterSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const VOTER_SESSION_COOKIE = "votera_voter_session";
const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60; // 2 jam

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Membuat sesi baru untuk pemilih di database dan mengembalikan token sesi mentah
 */
export async function createVoterSession(params: {
  voterId: string;
  electionId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(voterSessions).values({
    voterId: params.voterId,
    electionId: params.electionId,
    sessionTokenHash,
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
    expiresAt,
  });

  return { token: rawToken, expiresAt };
}

/**
 * Memasang cookie sesi pemilih HttpOnly
 */
export async function setVoterSessionCookie(token: string, expiresAt: Date) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(VOTER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: expiresAt,
    });
  } catch {
    // Dipanggil di luar request scope Next.js (mis. pengujian atau script)
  }
}

/**
 * Menghapus cookie sesi pemilih
 */
export async function clearVoterSessionCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(VOTER_SESSION_COOKIE);
  } catch {
    // Dipanggil di luar request scope Next.js
  }
}

/**
 * Mengambil dan memvalidasi sesi pemilih yang sedang aktif
 */
export async function getVoterSession(rawToken?: string) {
  let token = rawToken;
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(VOTER_SESSION_COOKIE)?.value;
    } catch {
      // Dipanggil di luar request scope Next.js
    }
  }

  if (!token) return null;

  const sessionTokenHash = hashSessionToken(token);
  const now = new Date();

  const [record] = await db
    .select({
      session: voterSessions,
      voter: voters,
    })
    .from(voterSessions)
    .innerJoin(voters, eq(voterSessions.voterId, voters.id))
    .where(
      and(
        eq(voterSessions.sessionTokenHash, sessionTokenHash),
        gt(voterSessions.expiresAt, now)
      )
    );

  if (!record) return null;

  return record;
}

/**
 * Menghapus baris sesi pemilih dari database
 */
export async function invalidateVoterSession(rawToken?: string) {
  let token = rawToken;
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(VOTER_SESSION_COOKIE)?.value;
  }

  if (!token) return;

  const sessionTokenHash = hashSessionToken(token);
  await db.delete(voterSessions).where(eq(voterSessions.sessionTokenHash, sessionTokenHash));
  await clearVoterSessionCookie();
}
