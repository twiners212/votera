import { describe, it, expect, vi } from "vitest";
import { sanitizeDescription, insertAuditLog, type AuditDbExecutor } from "@/lib/audit";
import * as auditModule from "@/lib/audit";

describe("Audit Log Helper & Sanitization", () => {
  it("forces generic message for vote_cast regardless of input description", () => {
    const result = sanitizeDescription(
      "vote_cast",
      "Pemilih memilih candidateId=abc-123 (Raka Aditya)"
    );
    expect(result).toBe("Pemilih telah memberikan suara");
  });

  it("redacts sensitive token and password key-value pairs without breaking normal text", () => {
    expect(
      sanitizeDescription(
        "voter_login_failed",
        "Gagal login dengan token=JUFT88TF dan password: Secret123!"
      )
    ).toBe("Gagal login dengan token=[REDACTED] dan password: [REDACTED]");

    expect(
      sanitizeDescription(
        "voter_login_failed",
        "Debug: tokenHash=abcd tokenEncrypted=1234 voter_token=JUFT88TF voterToken: P8TYM5KR newPassword=Secret!"
      )
    ).toBe(
      "Debug: tokenHash=[REDACTED] tokenEncrypted=[REDACTED] voter_token=[REDACTED] voterToken: [REDACTED] newPassword=[REDACTED]"
    );

    expect(
      sanitizeDescription(
        "token_reset",
        "Panitia mereset token pemilih NIS 2324001"
      )
    ).toBe("Panitia mereset token pemilih NIS 2324001");
  });

  it("inserts sanitized audit record using provided tx executor and defaults ipAddress", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    const fakeTx = { insert: insertMock } as unknown as AuditDbExecutor;

    await insertAuditLog({
      electionId: "e1000000-0000-0000-0000-000000000001",
      actorType: "voter",
      actorId: "voter-1",
      actorName: "Aditya Pratama",
      actorIdentity: "NIS 2324001",
      action: "vote_cast",
      actionTitle: "Vote cast",
      description: "candidate_id=c1000000",
      tx: fakeTx,
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "vote_cast",
        description: "Pemilih telah memberikan suara",
        ipAddress: "::1",
      })
    );
  });

  it("exposes no update or delete audit log functions", () => {
    expect("updateAuditLog" in auditModule).toBe(false);
    expect("deleteAuditLog" in auditModule).toBe(false);
  });
});
