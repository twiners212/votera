import { describe, it, expect, afterEach } from "vitest";
import {
  VOTER_TOKEN_ALPHABET,
  generateVoterToken,
  hashVoterToken,
  verifyVoterToken,
  encryptVoterToken,
  decryptVoterToken,
} from "@/lib/crypto/token";
import { formatDateWIB, formatPercentage } from "@/lib/utils";

describe("Token Cryptography Utilities", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("generates an 8-character token using only the 31 non-ambiguous alphabet", () => {
    expect(VOTER_TOKEN_ALPHABET).toHaveLength(31);
    for (const forbidden of ["0", "O", "1", "I", "L"]) {
      expect(VOTER_TOKEN_ALPHABET).not.toContain(forbidden);
    }

    for (let i = 0; i < 50; i++) {
      const token = generateVoterToken();
      expect(token).toHaveLength(8);
      for (const char of token) {
        expect(VOTER_TOKEN_ALPHABET).toContain(char);
      }
    }

    expect(generateVoterToken(12)).toHaveLength(12);
    expect(() => generateVoterToken(0)).toThrow();
    expect(() => generateVoterToken(-3)).toThrow();
  });

  it("hashes and verifies tokens in constant time with trim and uppercase normalization", () => {
    const token = "JUFT88TF";
    const hash = hashVoterToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyVoterToken("JUFT88TF", hash)).toBe(true);
    expect(verifyVoterToken("  juft88tf  ", hash)).toBe(true);
    expect(verifyVoterToken("WRONG123", hash)).toBe(false);
    expect(verifyVoterToken("", hash)).toBe(false);
    expect(verifyVoterToken("   ", hashVoterToken(""))).toBe(false);
    expect(verifyVoterToken("JUFT88TF", "not-hex")).toBe(false);
    expect(verifyVoterToken("JUFT88TF", "abcd")).toBe(false);
    expect(verifyVoterToken("JUFT88TF", "abc")).toBe(false);
  });

  it("encrypts and decrypts tokens via AES-256-GCM and handles [REDACTED]", () => {
    const token = "P8TYM5KR";
    const encryptedA = encryptVoterToken(token);
    const encryptedB = encryptVoterToken(token);

    expect(encryptedA).not.toBe(encryptedB);
    expect(encryptedA.split(":")).toHaveLength(3);
    expect(decryptVoterToken(encryptedA)).toBe(token);
    expect(decryptVoterToken(encryptedB)).toBe(token);

    expect(decryptVoterToken("[REDACTED]")).toBe("••••••••");
    expect(decryptVoterToken("")).toBe("••••••••");

    const parts = encryptedA.split(":");
    const tampered = `${parts[0]}:${parts[1]}:${"ff".repeat(parts[2].length / 2)}`;
    expect(() => decryptVoterToken(tampered)).toThrow();
    expect(() => decryptVoterToken("invalid-payload")).toThrow();
    expect(() =>
      decryptVoterToken(`${parts[0]}:${parts[1]}:abc`)
    ).toThrow(/Struktur hex token terenkripsi tidak valid/);
  });

  it("enforces strict secrets in NODE_ENV=production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.TOKEN_HMAC_SECRET;
    delete process.env.TOKEN_ENCRYPTION_KEY;

    expect(() => hashVoterToken("JUFT88TF")).toThrow(/TOKEN_HMAC_SECRET/);
    process.env.TOKEN_HMAC_SECRET = "   ";
    expect(() => hashVoterToken("JUFT88TF")).toThrow(/TOKEN_HMAC_SECRET/);

    expect(() => encryptVoterToken("JUFT88TF")).toThrow(/TOKEN_ENCRYPTION_KEY/);
    process.env.TOKEN_ENCRYPTION_KEY = "invalid-short-key";
    expect(() => encryptVoterToken("JUFT88TF")).toThrow(/64 karakter hex/);
  });

  it("formats WIB dates and percentages safely including -0 and invalid inputs", () => {
    expect(formatPercentage(-0)).toBe("0,0%");
    expect(formatPercentage(2.63, 1)).toBe("2,6%");
    expect(formatPercentage(Number.NaN)).toBe("0%");
    expect(formatDateWIB("invalid-date")).toBe("-");
    expect(formatDateWIB("2026-10-25T14:24:00Z")).toContain("2026");
  });
});
