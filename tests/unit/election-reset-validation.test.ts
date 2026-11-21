import { describe, expect, it } from "vitest";
import { resetElectionSchema } from "@/lib/validations/election";

describe("Election Reset Validation (resetElectionSchema)", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";
  const validPassword = "SuperAdminPassword123!";

  it("berhasil memvalidasi input lengkap dengan konfirmasi dan password yang benar", () => {
    const input = {
      electionId: validUUID,
      confirmationText: "RESET PEMILIHAN",
      password: validPassword,
      deleteMasterData: true,
      deleteCandidates: true,
    };

    const result = resetElectionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.electionId).toBe(validUUID);
      expect(result.data.confirmationText).toBe("RESET PEMILIHAN");
      expect(result.data.password).toBe(validPassword);
      expect(result.data.deleteMasterData).toBe(true);
      expect(result.data.deleteCandidates).toBe(true);
    }
  });

  it("menerapkan default false pada deleteMasterData dan deleteCandidates saat tidak diisi", () => {
    const input = {
      electionId: validUUID,
      confirmationText: "RESET PEMILIHAN",
      password: validPassword,
    };

    const result = resetElectionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deleteMasterData).toBe(false);
      expect(result.data.deleteCandidates).toBe(false);
    }
  });

  it("menerima teks konfirmasi dengan spasi di awal/akhir karena di-trim", () => {
    const input = {
      electionId: validUUID,
      confirmationText: "   RESET PEMILIHAN   ",
      password: validPassword,
    };

    const result = resetElectionSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmationText).toBe("RESET PEMILIHAN");
    }
  });

  it("menolak jika password Super Admin tidak diisi atau undefined", () => {
    const input = {
      electionId: validUUID,
      confirmationText: "RESET PEMILIHAN",
    };

    const result = resetElectionSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(
        /Password Super Admin wajib diisi/i
      );
    }
  });

  it("menolak jika password Super Admin berupa string kosong", () => {
    const input = {
      electionId: validUUID,
      confirmationText: "RESET PEMILIHAN",
      password: "",
    };

    const result = resetElectionSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(
        /Password Super Admin wajib diisi/i
      );
    }
  });

  it("menolak teks konfirmasi yang salah, typo, atau huruf kecil", () => {
    const invalidTexts = [
      "reset pemilihan",
      "Reset Pemilihan",
      "RESET",
      "PEMILIHAN",
      "RESET_PEMILIHAN",
      "",
      "random string",
    ];

    for (const text of invalidTexts) {
      const result = resetElectionSchema.safeParse({
        electionId: validUUID,
        confirmationText: text,
        password: validPassword,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(
          /Teks konfirmasi harus bernilai "RESET PEMILIHAN"/i
        );
      }
    }
  });

  it("menolak jika confirmationText tidak ada", () => {
    const result = resetElectionSchema.safeParse({
      electionId: validUUID,
      password: validPassword,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(
        /Teks konfirmasi wajib diisi/i
      );
    }
  });

  it("menolak jika electionId bukan format UUID yang valid", () => {
    const invalidIds = ["invalid-uuid", "12345", "active", ""];

    for (const id of invalidIds) {
      const result = resetElectionSchema.safeParse({
        electionId: id,
        confirmationText: "RESET PEMILIHAN",
        password: validPassword,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(
          /ID pemilihan harus berupa UUID yang valid/i
        );
      }
    }
  });

  it("menolak jika payload bernilai null, undefined, atau tipe data non-objek", () => {
    expect(resetElectionSchema.safeParse(null).success).toBe(false);
    expect(resetElectionSchema.safeParse(undefined).success).toBe(false);
    expect(resetElectionSchema.safeParse("string").success).toBe(false);
    expect(resetElectionSchema.safeParse(12345).success).toBe(false);
  });

  it("menolak tipe non-boolean untuk deleteMasterData dan deleteCandidates", () => {
    const invalidMaster = resetElectionSchema.safeParse({
      electionId: validUUID,
      confirmationText: "RESET PEMILIHAN",
      password: validPassword,
      deleteMasterData: "true",
    });
    expect(invalidMaster.success).toBe(false);

    const invalidCandidates = resetElectionSchema.safeParse({
      electionId: validUUID,
      confirmationText: "RESET PEMILIHAN",
      password: validPassword,
      deleteCandidates: 1,
    });
    expect(invalidCandidates.success).toBe(false);
  });
});
