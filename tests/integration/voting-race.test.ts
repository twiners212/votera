import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { auditLogs, db, voters, votes } from "@/db";
import { VotingError, castVoteTransaction } from "@/lib/voting/cast-vote";
import { POST as voterVotePost } from "@/app/api/voter/vote/route";
import {
  type BaselineIds,
  captureBaselineIds,
  cleanupTestArtifacts,
  createIsolatedElectionFixture,
  createIsolatedVoter,
  createPersistedVoterSession,
  createVoterNextRequest,
} from "../helpers/neon-test-harness";

interface VoteApiResponseBody {
  success: boolean;
  data?: {
    votedAt: string;
    redirectTo: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

describe("Atomic Voting & Race Condition Prevention (TC-01, TC-02, TC-04)", () => {
  let baseline: BaselineIds;
  const createdElectionIds: string[] = [];

  async function setupOpenFixture() {
    const fixture = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
    });
    createdElectionIds.push(fixture.election.id);
    return fixture;
  }

  beforeAll(async () => {
    baseline = await captureBaselineIds();
  });

  afterAll(async () => {
    await cleanupTestArtifacts({
      baseline,
      electionIds: createdElectionIds,
    });
  });

  it("TC-01: sequential double-vote on POST /api/voter/vote returns 200 then 409 ALREADY_VOTED and keeps votes count at 1", async () => {
    const { election, group, candidateActive } = await setupOpenFixture();
    const { voter } = await createIsolatedVoter({
      electionId: election.id,
      groupId: group.id,
      voterIdentity: "9101001",
      name: "Pemilih Sequential",
      voterStatus: "logged_in",
      hasVoted: false,
    });

    const { cookieValue } = await createPersistedVoterSession({
      voterId: voter.id,
      electionId: election.id,
      ipAddress: "10.0.1.10",
    });

    const firstRes = await voterVotePost(
      createVoterNextRequest("http://localhost:3000/api/voter/vote", cookieValue, {
        method: "POST",
        body: { candidateId: candidateActive.id },
        ip: "10.0.1.10",
      })
    );
    expect(firstRes.status).toBe(200);
    const firstBody = (await firstRes.json()) as VoteApiResponseBody;
    expect(firstBody.success).toBe(true);
    expect(firstBody.data?.redirectTo).toBe("/vote/thanks");
    expect(firstBody.data?.votedAt).toBeTruthy();

    const secondRes = await voterVotePost(
      createVoterNextRequest("http://localhost:3000/api/voter/vote", cookieValue, {
        method: "POST",
        body: { candidateId: candidateActive.id },
        ip: "10.0.1.10",
      })
    );
    expect(secondRes.status).toBe(409);
    const secondBody = (await secondRes.json()) as VoteApiResponseBody;
    expect(secondBody.success).toBe(false);
    expect(secondBody.error?.code).toBe("ALREADY_VOTED");

    const recordedVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.electionId, election.id));
    expect(recordedVotes).toHaveLength(1);
    expect(recordedVotes[0].candidateId).toBe(candidateActive.id);

    const [updatedVoter] = await db
      .select()
      .from(voters)
      .where(eq(voters.id, voter.id));
    expect(updatedVoter.hasVoted).toBe(true);
    expect(updatedVoter.voterStatus).toBe("voted");
    expect(updatedVoter.tokenEncrypted).toBe("[REDACTED]");
    expect(updatedVoter.votedAt).not.toBeNull();
  });

  it("TC-02 (Transaction): 10 concurrent castVoteTransaction calls via Promise.allSettled record exactly 1 vote and reject 9 with ALREADY_VOTED", async () => {
    const { election, group, candidateActive } = await setupOpenFixture();
    const { voter } = await createIsolatedVoter({
      electionId: election.id,
      groupId: group.id,
      voterIdentity: "9101002",
      name: "Pemilih Race Tx",
      voterStatus: "logged_in",
      hasVoted: false,
    });

    const concurrentCalls = Array.from({ length: 10 }, () =>
      castVoteTransaction({
        electionId: election.id,
        voterId: voter.id,
        candidateId: candidateActive.id,
        ipAddress: "192.168.10.20",
      })
    );

    const results = await Promise.allSettled(concurrentCalls);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    for (const r of rejected) {
      if (r.status === "rejected") {
        expect(r.reason).toBeInstanceOf(VotingError);
        expect((r.reason as VotingError).code).toBe("ALREADY_VOTED");
        expect((r.reason as VotingError).status).toBe(409);
      }
    }

    const recordedVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.electionId, election.id));
    expect(recordedVotes).toHaveLength(1);

    const [updatedVoter] = await db
      .select()
      .from(voters)
      .where(eq(voters.id, voter.id));
    expect(updatedVoter.hasVoted).toBe(true);
    expect(updatedVoter.voterStatus).toBe("voted");
    expect(updatedVoter.tokenEncrypted).toBe("[REDACTED]");
  });

  it("TC-02 (HTTP Route): 10 concurrent POST /api/voter/vote calls return exactly 1x 200 and 9x 409 ALREADY_VOTED", async () => {
    const { election, group, candidateActive } = await setupOpenFixture();
    const { voter } = await createIsolatedVoter({
      electionId: election.id,
      groupId: group.id,
      voterIdentity: "9101003",
      name: "Pemilih Race HTTP",
      voterStatus: "logged_in",
      hasVoted: false,
    });

    const { cookieValue } = await createPersistedVoterSession({
      voterId: voter.id,
      electionId: election.id,
      ipAddress: "192.168.10.30",
    });

    const concurrentRequests = Array.from({ length: 10 }, () =>
      voterVotePost(
        createVoterNextRequest(
          "http://localhost:3000/api/voter/vote",
          cookieValue,
          {
            method: "POST",
            body: { candidateId: candidateActive.id },
            ip: "192.168.10.30",
          }
        )
      )
    );

    const settled = await Promise.allSettled(concurrentRequests);
    expect(settled.every((r) => r.status === "fulfilled")).toBe(true);

    const responses = await Promise.all(
      settled.map(async (r) => {
        if (r.status !== "fulfilled") {
          throw new Error("Expected fulfilled response");
        }
        return {
          status: r.value.status,
          body: (await r.value.json()) as VoteApiResponseBody,
        };
      })
    );

    const okResponses = responses.filter((r) => r.status === 200);
    const conflictResponses = responses.filter((r) => r.status === 409);

    expect(okResponses).toHaveLength(1);
    expect(okResponses[0].body.success).toBe(true);
    expect(okResponses[0].body.data?.redirectTo).toBe("/vote/thanks");

    expect(conflictResponses).toHaveLength(9);
    for (const conflict of conflictResponses) {
      expect(conflict.body.success).toBe(false);
      expect(conflict.body.error?.code).toBe("ALREADY_VOTED");
    }

    const recordedVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.electionId, election.id));
    expect(recordedVotes).toHaveLength(1);

    const [updatedVoter] = await db
      .select()
      .from(voters)
      .where(eq(voters.id, voter.id));
    expect(updatedVoter.hasVoted).toBe(true);
    expect(updatedVoter.voterStatus).toBe("voted");
    expect(updatedVoter.tokenEncrypted).toBe("[REDACTED]");
  });

  it("TC-04: votes table excludes voter_id/ip_address, truncates created_at to minute, and logs generic vote_cast without candidate info", async () => {
    const { election, group, candidateActive } = await setupOpenFixture();
    const { voter } = await createIsolatedVoter({
      electionId: election.id,
      groupId: group.id,
      voterIdentity: "9101004",
      name: "Pemilih Anonimitas",
      voterStatus: "logged_in",
      hasVoted: false,
    });

    const { cookieValue } = await createPersistedVoterSession({
      voterId: voter.id,
      electionId: election.id,
      ipAddress: "10.0.4.44",
    });

    const voteRes = await voterVotePost(
      createVoterNextRequest("http://localhost:3000/api/voter/vote", cookieValue, {
        method: "POST",
        body: { candidateId: candidateActive.id },
        ip: "10.0.4.44",
      })
    );
    expect(voteRes.status).toBe(200);

    const colRes = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'votes'
      ORDER BY ordinal_position
    `);
    const colNames = colRes.rows.map((r) => String(r.column_name));
    expect(colNames).toEqual(["id", "election_id", "candidate_id", "created_at"]);
    expect(colNames).not.toContain("voter_id");
    expect(colNames).not.toContain("ip_address");

    const recordedVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.electionId, election.id));
    expect(recordedVotes).toHaveLength(1);
    expect(Object.keys(recordedVotes[0])).not.toContain("voterId");
    expect(Object.keys(recordedVotes[0])).not.toContain("ipAddress");
    expect(recordedVotes[0].createdAt.getUTCSeconds()).toBe(0);
    expect(recordedVotes[0].createdAt.getUTCMilliseconds()).toBe(0);

    const voteLogs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.electionId, election.id));
    expect(voteLogs).toHaveLength(1);
    expect(voteLogs[0].action).toBe("vote_cast");
    expect(voteLogs[0].actionTitle).toBe("Vote cast");
    expect(voteLogs[0].actorType).toBe("voter");
    expect(voteLogs[0].actorId).toBe(voter.id);
    expect(voteLogs[0].description).toBe("Pemilih telah memberikan suara");
    expect(voteLogs[0].description).not.toContain(candidateActive.id);
    expect(voteLogs[0].description).not.toContain(candidateActive.name);
  });
});
