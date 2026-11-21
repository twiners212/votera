import { describe, it, expect } from "vitest";
import {
  isElectionOngoing,
  isElectionScheduleExpired,
} from "@/lib/admin/election-state";

describe("Election State Helper Unit Tests", () => {
  const baseNow = new Date("2026-11-14T10:00:00.000Z");

  describe("isElectionOngoing", () => {
    it("mengembalikan false jika election bernilai null atau undefined", () => {
      expect(isElectionOngoing(null, baseNow)).toBe(false);
      expect(isElectionOngoing(undefined, baseNow)).toBe(false);
    });

    it("mengembalikan false jika status bukan 'open'", () => {
      expect(
        isElectionOngoing(
          { status: "draft", endAt: "2026-11-14T15:00:00.000Z" },
          baseNow
        )
      ).toBe(false);
      expect(
        isElectionOngoing(
          { status: "closed", endAt: "2026-11-14T15:00:00.000Z" },
          baseNow
        )
      ).toBe(false);
    });

    it("mengembalikan true jika status 'open' dan waktu selesai masih di masa depan", () => {
      expect(
        isElectionOngoing(
          { status: "open", endAt: "2026-11-14T12:00:00.000Z" },
          baseNow
        )
      ).toBe(true);
    });

    it("mengembalikan false jika status 'open' tetapi waktu selesai sudah lewat di masa lalu", () => {
      expect(
        isElectionOngoing(
          { status: "open", endAt: "2026-11-13T22:00:00.000Z" },
          baseNow
        )
      ).toBe(false);
    });
  });

  describe("isElectionScheduleExpired", () => {
    it("mengembalikan true jika status 'open' dan endAt sudah terlewati di masa lalu", () => {
      expect(
        isElectionScheduleExpired(
          { status: "open", endAt: "2026-11-13T22:00:00.000Z" },
          baseNow
        )
      ).toBe(true);
    });

    it("mengembalikan false jika status 'open' dan endAt masih di masa depan", () => {
      expect(
        isElectionScheduleExpired(
          { status: "open", endAt: "2026-11-14T15:00:00.000Z" },
          baseNow
        )
      ).toBe(false);
    });

    it("mengembalikan false jika status 'closed' meskipun endAt di masa lalu", () => {
      expect(
        isElectionScheduleExpired(
          { status: "closed", endAt: "2026-11-13T22:00:00.000Z" },
          baseNow
        )
      ).toBe(false);
    });
  });
});
