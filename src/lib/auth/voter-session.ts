import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, voterGroups, voters, voterSessions } from "@/db";
import {
  VOTER_SESSION_COOKIE,
  VOTER_SESSION_TTL_SECONDS,
  getVoterSessionSecret,
  parseVoterSessionCookieParts,
} from "@/lib/auth/voter-session-edge";
import type { VoterSessionDTO, VoterStatus } from "@/types/votera";

export { VOTER_SESSION_COOKIE, VOTER_SESSION_TTL_SECONDS };

export interface AuthenticatedVoterSession extends VoterSessionDTO {
  sessionId: string;
  sessionTokenHash: string;
  voterStatus: VoterStatus;
}

export interface CreateVoterSessionParams {
  voterId: string;
  electionId: string;
  ipAddress: string;
  userAgent?: string | null;
}

export function signRawSessionToken(rawToken: string): string {
  return crypto
    .createHmac("sha256", getVoterSessionSecret())
    .update(rawToken)
    .digest("hex");
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function verifySignedSessionValue(
  cookieValue: string | undefined | null
): { rawToken: string; sessionTokenHash: string } | null {
  const parsed = parseVoterSessionCookieParts(cookieValue);
  if (!parsed) {
    return null;
  }

  const expectedSig = signRawSessionToken(parsed.rawToken);
  const actualBuf = Buffer.from(parsed.signature, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");

  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return null;
  }

  return {
    rawToken: parsed.rawToken,
    sessionTokenHash: hashSessionToken(parsed.rawToken),
  };
}

export async function createVoterSession(
  params: CreateVoterSessionParams
): Promise<{
  cookieValue: string;
  sessionTokenHash: string;
  expiresAt: Date;
}> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const signature = signRawSessionToken(rawToken);
  const cookieValue = `${rawToken}.${signature}`;
  const sessionTokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + VOTER_SESSION_TTL_SECONDS * 1000);

  await db.insert(voterSessions).values({
    voterId: params.voterId,
    electionId: params.electionId,
    sessionTokenHash,
    ipAddress: params.ipAddress?.trim() || "::1",
    userAgent: params.userAgent ? params.userAgent.slice(0, 512) : null,
    expiresAt,
  });

  return {
    cookieValue,
    sessionTokenHash,
    expiresAt,
  };
}

export function setVoterSessionCookie(
  response: NextResponse,
  cookieValue: string
): void {
  response.cookies.set(VOTER_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: VOTER_SESSION_TTL_SECONDS,
  });
}

export function clearVoterSessionCookie(response: NextResponse): void {
  response.cookies.set(VOTER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export const getVoterSession = cache(
  async (
    cookieValueOverride?: string | null
  ): Promise<AuthenticatedVoterSession | null> => {
    try {
      let rawCookie = cookieValueOverride;
      if (rawCookie === undefined) {
        const cookieStore = await cookies();
        rawCookie = cookieStore.get(VOTER_SESSION_COOKIE)?.value;
      }

      const verified = verifySignedSessionValue(rawCookie);
      if (!verified) {
        return null;
      }

      const [sessionRow] = await db
        .select({
          sessionId: voterSessions.id,
          sessionTokenHash: voterSessions.sessionTokenHash,
          voterId: voters.id,
          electionId: voters.electionId,
          name: voters.name,
          voterIdentity: voters.voterIdentity,
          groupId: voters.groupId,
          groupName: voterGroups.name,
          voterStatus: voters.voterStatus,
          hasVoted: voters.hasVoted,
          votedAt: voters.votedAt,
        })
        .from(voterSessions)
        .innerJoin(voters, eq(voterSessions.voterId, voters.id))
        .innerJoin(voterGroups, eq(voters.groupId, voterGroups.id))
        .where(
          and(
            eq(voterSessions.sessionTokenHash, verified.sessionTokenHash),
            gt(voterSessions.expiresAt, sql`now()`)
          )
        )
        .limit(1);

      if (!sessionRow) {
        return null;
      }

      return {
        sessionId: sessionRow.sessionId,
        sessionTokenHash: sessionRow.sessionTokenHash,
        id: sessionRow.voterId,
        electionId: sessionRow.electionId,
        name: sessionRow.name,
        voterIdentity: sessionRow.voterIdentity,
        groupId: sessionRow.groupId,
        groupName: sessionRow.groupName,
        voterStatus: sessionRow.voterStatus,
        hasVoted: sessionRow.hasVoted,
        votedAt: sessionRow.votedAt ? sessionRow.votedAt.toISOString() : null,
      };
    } catch {
      return null;
    }
  }
);

export async function deleteVoterSessionByCookieValue(
  cookieValue: string | undefined | null
): Promise<boolean> {
  const verified = verifySignedSessionValue(cookieValue);
  if (!verified) {
    return false;
  }

  await db
    .delete(voterSessions)
    .where(eq(voterSessions.sessionTokenHash, verified.sessionTokenHash));

  return true;
}
