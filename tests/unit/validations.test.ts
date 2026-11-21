import { describe, it, expect } from "vitest";
import { MAX_IMPORT_ROWS } from "@/lib/importers/dpt-parser";
import { voterLoginSchema, castVoteSchema } from "@/lib/validations/voter";
import {
  electionRefSchema,
  uuidParamSchema,
  adminPaginationSchema,
} from "@/lib/validations/admin-common";
import {
  candidateThemeSchema,
  candidateSchema,
  candidateUpdateSchema,
  candidateQuerySchema,
} from "@/lib/validations/candidate";
import {
  voterQuerySchema,
  createVoterSchema,
  updateVoterSchema,
  importVoterRowSchema,
  bulkImportVotersSchema,
  bulkDeleteVotersSchema,
} from "@/lib/validations/voter-admin";
import {
  masterQuerySchema,
  createGradeSchema,
  createMajorSchema,
  createGroupSchema,
  masterCreateSchema,
  updateGradeSchema,
  updateMajorSchema,
  updateGroupSchema,
  masterUpdateSchema,
  masterDeleteSchema,
} from "@/lib/validations/master";
import {
  settingsQuerySchema,
  updateSettingsSchema,
} from "@/lib/validations/settings";
import { auditLogQuerySchema } from "@/lib/validations/logs";
import {
  userQuerySchema,
  createAdminUserSchema,
  updateAdminUserSchema,
} from "@/lib/validations/user";

const VALID_UUID = "e1000000-0000-4000-8000-000000000001";
const VALID_UUID_2 = "e2000000-0000-4000-8000-000000000002";

describe("Zod Validation Schemas (Unit)", () => {
  // --------------------------------------------------------------------------
  // 1. voter.ts
  // --------------------------------------------------------------------------
  describe("voter.ts", () => {
    describe("voterLoginSchema", () => {
      it("accepts valid NIS and normalizes lowercase/padded 8-char token", () => {
        const parsed = voterLoginSchema.parse({
          electionId: VALID_UUID,
          voterIdentity: "  2324001  ",
          token: "  juft88tf  ",
        });

        expect(parsed).toEqual({
          electionId: VALID_UUID,
          voterIdentity: "2324001",
          token: "JUFT88TF",
        });

        expect(
          voterLoginSchema.safeParse({
            voterIdentity: "123", // exact min 3
            token: "23456789",
          }).success
        ).toBe(true);

        expect(
          voterLoginSchema.safeParse({
            voterIdentity: "A".repeat(50), // exact max 50
            token: "ABCDEFGH",
          }).success
        ).toBe(true);
      });

      it("rejects invalid identity lengths, bad electionId, wrong token length, and ambiguous token characters (0, O, 1, I, L)", () => {
        expect(
          voterLoginSchema.safeParse({
            electionId: "not-a-uuid",
            voterIdentity: "2324001",
            token: "JUFT88TF",
          }).success
        ).toBe(false);

        expect(
          voterLoginSchema.safeParse({ voterIdentity: "12", token: "JUFT88TF" }).success
        ).toBe(false);

        expect(
          voterLoginSchema.safeParse({
            voterIdentity: "A".repeat(51),
            token: "JUFT88TF",
          }).success
        ).toBe(false);

        expect(
          voterLoginSchema.safeParse({ voterIdentity: "2324001", token: "JUFT88T" }).success
        ).toBe(false);

        expect(
          voterLoginSchema.safeParse({ voterIdentity: "2324001", token: "JUFT88TF9" }).success
        ).toBe(false);

        for (const ambiguous of ["0", "O", "1", "I", "L"]) {
          expect(
            voterLoginSchema.safeParse({
              voterIdentity: "2324001",
              token: `JUFT88T${ambiguous}`,
            }).success
          ).toBe(false);
        }
      });
    });

    describe("castVoteSchema", () => {
      it("requires a valid UUID candidateId", () => {
        expect(castVoteSchema.safeParse({ candidateId: VALID_UUID }).success).toBe(true);
        expect(castVoteSchema.safeParse({ candidateId: "candidate-1" }).success).toBe(false);
        expect(castVoteSchema.safeParse({}).success).toBe(false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. admin-common.ts
  // --------------------------------------------------------------------------
  describe("admin-common.ts", () => {
    it("validates electionRefSchema for undefined, 'active', and UUID", () => {
      expect(electionRefSchema.safeParse(undefined).success).toBe(true);
      expect(electionRefSchema.safeParse("active").success).toBe(true);
      expect(electionRefSchema.safeParse(VALID_UUID).success).toBe(true);
      expect(electionRefSchema.safeParse("").success).toBe(false);
      expect(electionRefSchema.safeParse("inactive").success).toBe(false);
    });

    it("validates uuidParamSchema", () => {
      expect(uuidParamSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
      expect(uuidParamSchema.safeParse({ id: "123" }).success).toBe(false);
      expect(uuidParamSchema.safeParse({}).success).toBe(false);
    });

    it("validates adminPaginationSchema defaults, coercion, and bounds (1..100)", () => {
      expect(adminPaginationSchema.parse({})).toEqual({ page: 1, limit: 25 });
      expect(adminPaginationSchema.parse({ page: "3", limit: "100" })).toEqual({
        page: 3,
        limit: 100,
      });
      expect(adminPaginationSchema.safeParse({ page: 1, limit: 1 }).success).toBe(true);

      expect(adminPaginationSchema.safeParse({ page: 0 }).success).toBe(false);
      expect(adminPaginationSchema.safeParse({ page: 1.5 }).success).toBe(false);
      expect(adminPaginationSchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(adminPaginationSchema.safeParse({ limit: 101 }).success).toBe(false);
      expect(adminPaginationSchema.safeParse({ limit: "abc" }).success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. candidate.ts
  // --------------------------------------------------------------------------
  describe("candidate.ts", () => {
    const validCandidate = {
      candidateNumber: 1,
      name: "Raka Pratama & Alya Zahra",
      classOrUnit: "XII MIPA 1",
      motto: "Bersama Maju",
      vision: "Mewujudkan OSIS yang inklusif dan berprestasi.",
      missions: ["Meningkatkan literasi digital"],
    };

    it("validates candidateThemeSchema", () => {
      for (const theme of ["red", "green", "blue", "amber"]) {
        expect(candidateThemeSchema.safeParse(theme).success).toBe(true);
      }
      expect(candidateThemeSchema.safeParse("purple").success).toBe(false);
    });

    it("validates candidateSchema defaults, coercion, and boundary lengths", () => {
      const parsed = candidateSchema.parse({
        ...validCandidate,
        candidateNumber: "99",
        electionId: "active",
      });
      expect(parsed.candidateNumber).toBe(99);
      expect(parsed.programs).toEqual([]);
      expect(parsed.supporters).toEqual([]);
      expect(parsed.themeColor).toBe("red");
      expect(parsed.isActive).toBe(true);

      // Exact min & max boundaries
      expect(
        candidateSchema.safeParse({
          candidateNumber: 1,
          name: "AB", // min 2
          classOrUnit: "X", // min 1
          motto: "ABC", // min 3
          vision: "ABCDE", // min 5
          missions: ["Misi 1"],
          photoUrl: null,
        }).success
      ).toBe(true);

      expect(
        candidateSchema.safeParse({
          candidateNumber: 99,
          name: "N".repeat(120),
          classOrUnit: "C".repeat(60),
          motto: "M".repeat(200),
          vision: "V".repeat(2000),
          missions: ["Misi 1"],
          programs: ["Program 1"],
          supporters: ["XII IPA 1"],
        }).success
      ).toBe(true);

      // Out-of-bounds failures
      expect(candidateSchema.safeParse({ ...validCandidate, candidateNumber: 0 }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, candidateNumber: 100 }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, candidateNumber: 1.5 }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, name: "A" }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, name: "N".repeat(121) }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, classOrUnit: "   " }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, classOrUnit: "C".repeat(61) }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, motto: "AB" }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, motto: "M".repeat(201) }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, vision: "ABCD" }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, vision: "V".repeat(2001) }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, missions: [] }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, missions: ["   "] }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, programs: [""] }).success).toBe(false);
      expect(candidateSchema.safeParse({ ...validCandidate, supporters: [""] }).success).toBe(false);
    });

    it("validates candidateUpdateSchema (partial without electionId) and candidateQuerySchema", () => {
      expect(candidateUpdateSchema.safeParse({}).success).toBe(true);
      const updated = candidateUpdateSchema.parse({
        name: "Nama Baru",
        electionId: VALID_UUID,
      }) as Record<string, unknown>;
      expect(updated.name).toBe("Nama Baru");
      expect(updated.electionId).toBeUndefined();
      expect(candidateUpdateSchema.safeParse({ candidateNumber: 100 }).success).toBe(false);

      expect(candidateQuerySchema.safeParse({}).success).toBe(true);
      expect(candidateQuerySchema.safeParse({ electionId: VALID_UUID }).success).toBe(true);
      expect(candidateQuerySchema.safeParse({ electionId: "bad" }).success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. voter-admin.ts
  // --------------------------------------------------------------------------
  describe("voter-admin.ts", () => {
    it("validates voterQuerySchema defaults and filters", () => {
      expect(voterQuerySchema.parse({})).toEqual({
        page: 1,
        limit: 25,
        status: "all",
      });

      expect(
        voterQuerySchema.safeParse({
          electionId: "active",
          page: 2,
          limit: 100,
          search: "Budi",
          status: "voted",
          groupId: VALID_UUID,
          gradeLevelId: "all",
          majorId: VALID_UUID_2,
        }).success
      ).toBe(true);

      expect(voterQuerySchema.safeParse({ status: "pending" }).success).toBe(false);
      expect(voterQuerySchema.safeParse({ groupId: "not-uuid" }).success).toBe(false);
      expect(voterQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    });

    it("validates createVoterSchema and updateVoterSchema including formula injection and character checks", () => {
      expect(
        createVoterSchema.safeParse({
          electionId: VALID_UUID,
          voterIdentity: "2026_01.A-1",
          name: "Budi Santoso",
          groupId: VALID_UUID_2,
        }).success
      ).toBe(true);

      // Boundary lengths
      expect(
        createVoterSchema.safeParse({
          voterIdentity: "abc",
          name: "Bo",
          groupId: VALID_UUID,
        }).success
      ).toBe(true);
      expect(
        createVoterSchema.safeParse({
          voterIdentity: "a".repeat(50),
          name: "B".repeat(120),
          groupId: VALID_UUID,
        }).success
      ).toBe(true);

      // Invalid lengths & invalid chars
      expect(
        createVoterSchema.safeParse({
          voterIdentity: "ab",
          name: "Budi",
          groupId: VALID_UUID,
        }).success
      ).toBe(false);
      expect(
        createVoterSchema.safeParse({
          voterIdentity: "a".repeat(51),
          name: "Budi",
          groupId: VALID_UUID,
        }).success
      ).toBe(false);
      expect(
        createVoterSchema.safeParse({
          voterIdentity: "2324 001",
          name: "Budi",
          groupId: VALID_UUID,
        }).success
      ).toBe(false);

      // Formula injection prefixes on voterIdentity and name
      for (const dangerous of ["=1+1", "+628123", "-cmd", "@SUM"]) {
        expect(
          createVoterSchema.safeParse({
            voterIdentity: dangerous,
            name: "Budi",
            groupId: VALID_UUID,
          }).success
        ).toBe(false);
        expect(
          createVoterSchema.safeParse({
            voterIdentity: "2324001",
            name: dangerous,
            groupId: VALID_UUID,
          }).success
        ).toBe(false);
      }

      expect(
        createVoterSchema.safeParse({
          voterIdentity: "2324001",
          name: "Budi",
          groupId: "invalid-uuid",
        }).success
      ).toBe(false);

      // updateVoterSchema
      expect(updateVoterSchema.safeParse({}).success).toBe(true);
      expect(
        updateVoterSchema.safeParse({
          voterIdentity: "2324_002",
          name: "Siti Aminah",
          groupId: VALID_UUID,
        }).success
      ).toBe(true);
      expect(updateVoterSchema.safeParse({ name: "=CMD" }).success).toBe(false);
      expect(updateVoterSchema.safeParse({ voterIdentity: "bad id" }).success).toBe(false);
      expect(updateVoterSchema.safeParse({ groupId: "bad" }).success).toBe(false);
    });

    it("validates importVoterRowSchema and bulkImportVotersSchema up to MAX_IMPORT_ROWS = 5000", () => {
      expect(MAX_IMPORT_ROWS).toBe(5000);

      const validRow = {
        voterIdentity: "2324099",
        name: "Budi",
        groupName: "Rombel 1",
      };
      expect(importVoterRowSchema.safeParse(validRow).success).toBe(true);
      expect(
        importVoterRowSchema.safeParse({
          ...validRow,
          gradeName: "XII",
          majorName: "IPA",
        }).success
      ).toBe(true);

      // Formula injection rejection on voterIdentity, name, groupName
      expect(
        importVoterRowSchema.safeParse({ ...validRow, voterIdentity: "=1+1" }).success
      ).toBe(false);
      expect(
        importVoterRowSchema.safeParse({ ...validRow, name: "=CMD|' /C calc'!A0" }).success
      ).toBe(false);
      expect(
        importVoterRowSchema.safeParse({ ...validRow, groupName: "@SUM(A1)" }).success
      ).toBe(false);
      expect(
        importVoterRowSchema.safeParse({ ...validRow, groupName: "" }).success
      ).toBe(false);
      expect(
        importVoterRowSchema.safeParse({ ...validRow, groupName: "G".repeat(51) }).success
      ).toBe(false);
      expect(
        importVoterRowSchema.safeParse({ ...validRow, gradeName: "G".repeat(51) }).success
      ).toBe(false);
      expect(
        importVoterRowSchema.safeParse({ ...validRow, majorName: "M".repeat(51) }).success
      ).toBe(false);

      // bulkImportVotersSchema defaults & row bounds (1 .. MAX_IMPORT_ROWS)
      const parsedOne = bulkImportVotersSchema.parse({ rows: [validRow] });
      expect(parsedOne.autoCreateGroups).toBe(true);

      expect(bulkImportVotersSchema.safeParse({ rows: [] }).success).toBe(false);

      const exact5000Rows = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => ({
        voterIdentity: `2324_${i + 1}`,
        name: `Pemilih ${i + 1}`,
        groupName: "XII IPA 1",
      }));
      expect(
        bulkImportVotersSchema.safeParse({
          electionId: "active",
          autoCreateGroups: false,
          rows: exact5000Rows,
        }).success
      ).toBe(true);

      const overflow5001Rows = [
        ...exact5000Rows,
        {
          voterIdentity: "2324_5001",
          name: "Pemilih 5001",
          groupName: "XII IPA 1",
        },
      ];
      expect(bulkImportVotersSchema.safeParse({ rows: overflow5001Rows }).success).toBe(false);
    });

    it("validates bulkDeleteVotersSchema requiring voterIds or allNotVoted", () => {
      // Valid cases
      expect(
        bulkDeleteVotersSchema.safeParse({
          electionId: "active",
          voterIds: [VALID_UUID, VALID_UUID_2],
        }).success
      ).toBe(true);

      expect(
        bulkDeleteVotersSchema.safeParse({
          electionId: VALID_UUID,
          allNotVoted: true,
        }).success
      ).toBe(true);

      // Invalid cases: neither voterIds nor allNotVoted
      expect(
        bulkDeleteVotersSchema.safeParse({
          electionId: "active",
        }).success
      ).toBe(false);

      expect(
        bulkDeleteVotersSchema.safeParse({
          electionId: "active",
          voterIds: [],
        }).success
      ).toBe(false);

      // Invalid UUID
      expect(
        bulkDeleteVotersSchema.safeParse({
          voterIds: ["not-a-valid-uuid"],
        }).success
      ).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. master.ts (discriminatedUnion)
  // --------------------------------------------------------------------------
  describe("master.ts", () => {
    it("validates masterQuerySchema", () => {
      expect(masterQuerySchema.safeParse({}).success).toBe(true);
      expect(masterQuerySchema.safeParse({ electionId: "active" }).success).toBe(true);
      expect(masterQuerySchema.safeParse({ electionId: "invalid" }).success).toBe(false);
    });

    it("validates masterCreateSchema discriminated union (grade, major, group)", () => {
      const grade = masterCreateSchema.parse({
        entity: "grade",
        name: "XII",
        sortOrder: "3",
      });
      expect(grade).toEqual({ entity: "grade", name: "XII", sortOrder: 3 });

      const major = masterCreateSchema.parse({
        entity: "major",
        name: "Teknik Komputer dan Jaringan",
        code: "TKJ",
      });
      expect(major).toEqual({
        entity: "major",
        name: "Teknik Komputer dan Jaringan",
        code: "TKJ",
        sortOrder: 0,
      });

      const group = masterCreateSchema.parse({
        entity: "group",
        name: "XII TKJ 1",
        gradeLevelId: VALID_UUID,
        majorId: null,
      });
      expect(group).toEqual({
        entity: "group",
        name: "XII TKJ 1",
        gradeLevelId: VALID_UUID,
        majorId: null,
        sortOrder: 0,
      });

      // Individual sub-schemas & invalid discriminator/fields
      expect(createGradeSchema.safeParse({ entity: "grade", name: "" }).success).toBe(false);
      expect(createMajorSchema.safeParse({ entity: "major", name: "IPA", code: "C".repeat(21) }).success).toBe(false);
      expect(createGroupSchema.safeParse({ entity: "group", name: "A", gradeLevelId: "bad" }).success).toBe(false);
      expect(masterCreateSchema.safeParse({ entity: "unknown", name: "Test" }).success).toBe(false);
      expect(masterCreateSchema.safeParse({ entity: "grade", name: "G".repeat(51) }).success).toBe(false);
    });

    it("validates masterUpdateSchema discriminated union and masterDeleteSchema", () => {
      expect(
        masterUpdateSchema.safeParse({ entity: "grade", id: VALID_UUID, name: "XI" }).success
      ).toBe(true);
      expect(
        masterUpdateSchema.safeParse({ entity: "major", id: VALID_UUID, code: null }).success
      ).toBe(true);
      expect(
        masterUpdateSchema.safeParse({
          entity: "group",
          id: VALID_UUID,
          majorId: VALID_UUID_2,
          sortOrder: "2",
        }).success
      ).toBe(true);

      expect(updateGradeSchema.safeParse({ entity: "grade", id: "bad" }).success).toBe(false);
      expect(updateMajorSchema.safeParse({ entity: "major", id: VALID_UUID, name: "" }).success).toBe(false);
      expect(updateGroupSchema.safeParse({ entity: "group", id: VALID_UUID, majorId: "bad" }).success).toBe(false);
      expect(masterUpdateSchema.safeParse({ entity: "other", id: VALID_UUID }).success).toBe(false);

      expect(
        masterDeleteSchema.safeParse({
          entity: "group",
          id: VALID_UUID,
          electionId: "active",
        }).success
      ).toBe(true);
      expect(
        masterDeleteSchema.safeParse({ entity: "voter", id: VALID_UUID }).success
      ).toBe(false);
      expect(
        masterDeleteSchema.safeParse({ entity: "grade", id: "not-uuid" }).success
      ).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. settings.ts
  // --------------------------------------------------------------------------
  describe("settings.ts", () => {
    it("validates settingsQuerySchema", () => {
      expect(settingsQuerySchema.safeParse({}).success).toBe(true);
      expect(settingsQuerySchema.safeParse({ electionId: VALID_UUID }).success).toBe(true);
      expect(settingsQuerySchema.safeParse({ electionId: "bad" }).success).toBe(false);
    });

    it("validates updateSettingsSchema fields, boundary lengths, and endAt > startAt refinement", () => {
      expect(updateSettingsSchema.safeParse({}).success).toBe(true);

      expect(
        updateSettingsSchema.safeParse({
          electionId: VALID_UUID,
          shortName: "OS", // min 2
          title: "AB", // min 2
          organizationName: "SM", // min 2
          description: null,
          status: "open",
          startAt: new Date(Date.now() + 3600000).toISOString(),
          endAt: new Date(Date.now() + 86400000).toISOString(),
          idLabel: "N", // min 1
          groupLabel: "R",
          gradeLabel: "T",
          majorLabel: "J",
          isResultPublic: false,
          logoUrl: null,
          heroBannerUrl: "/images/hero-flag-ballot.jpg",
        }).success
      ).toBe(true);

      // Max boundaries
      expect(
        updateSettingsSchema.safeParse({
          shortName: "S".repeat(50),
          title: "T".repeat(150),
          organizationName: "O".repeat(120),
          description: "D".repeat(500),
          idLabel: "I".repeat(30),
          groupLabel: "G".repeat(30),
          gradeLabel: "R".repeat(30),
          majorLabel: "M".repeat(30),
        }).success
      ).toBe(true);

      // Out-of-bounds
      expect(updateSettingsSchema.safeParse({ shortName: "A" }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ shortName: "S".repeat(51) }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ title: "T".repeat(151) }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ organizationName: "O".repeat(121) }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ description: "D".repeat(501) }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ idLabel: "" }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ groupLabel: "G".repeat(31) }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ status: "paused" }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ startAt: "not-a-date" }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ endAt: "not-a-date" }).success).toBe(false);

      // endAt <= startAt rejected on path ["endAt"]
      const equalResult = updateSettingsSchema.safeParse({
        startAt: "2026-11-12T08:00:00Z",
        endAt: "2026-11-12T08:00:00Z",
      });
      expect(equalResult.success).toBe(false);
      if (!equalResult.success) {
        expect(equalResult.error.issues[0].path).toEqual(["endAt"]);
      }

      const earlierResult = updateSettingsSchema.safeParse({
        startAt: "2026-11-12T09:00:00Z",
        endAt: "2026-11-12T08:00:00Z",
      });
      expect(earlierResult.success).toBe(false);
      if (!earlierResult.success) {
        expect(earlierResult.error.issues[0].path).toEqual(["endAt"]);
      }

      // Single timestamp or null counterpart does not trigger range failure
      expect(
        updateSettingsSchema.safeParse({
          startAt: "2026-11-12T08:00:00Z",
          endAt: null,
        }).success
      ).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. logs.ts
  // --------------------------------------------------------------------------
  describe("logs.ts", () => {
    it("validates auditLogQuerySchema defaults and filters", () => {
      expect(auditLogQuerySchema.parse({})).toEqual({
        page: 1,
        limit: 25,
        actorType: "all",
      });

      expect(
        auditLogQuerySchema.safeParse({
          electionId: VALID_UUID,
          page: "2",
          limit: "50",
          search: "vote_cast",
          actorType: "voter",
          action: "vote_cast",
          dateFrom: "2026-11-01",
          dateTo: "2026-11-12",
        }).success
      ).toBe(true);

      expect(auditLogQuerySchema.safeParse({ actorType: "anonymous" }).success).toBe(false);
      expect(auditLogQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      expect(auditLogQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 8. user.ts
  // --------------------------------------------------------------------------
  describe("user.ts", () => {
    it("validates userQuerySchema", () => {
      expect(userQuerySchema.parse({ search: "  panitia  " })).toEqual({
        search: "panitia",
      });
      expect(userQuerySchema.safeParse({}).success).toBe(true);
    });

    it("validates createAdminUserSchema boundaries, username regex, email, password, and role default", () => {
      const parsed = createAdminUserSchema.parse({
        username: "panitia.01_a-b",
        name: "Ketua Panitia",
        email: "panitia@sekolah.sch.id",
        password: "Password123!",
      });
      expect(parsed.role).toBe("committee");

      expect(
        createAdminUserSchema.safeParse({
          username: "abc", // min 3
          name: "AB", // min 2
          email: "a@b.co",
          password: "p".repeat(8), // min 8
          role: "super_admin",
        }).success
      ).toBe(true);

      expect(
        createAdminUserSchema.safeParse({
          username: "u".repeat(32), // max 32
          name: "N".repeat(120), // max 120
          email: `${"a".repeat(108)}@sekolah.id`, // 108 + 11 = 119 <= 120
          password: "p".repeat(128), // max 128
        }).success
      ).toBe(true);

      // Failures
      const base = {
        username: "panitia01",
        name: "Panitia",
        email: "panitia@sekolah.sch.id",
        password: "Password123!",
      };
      expect(createAdminUserSchema.safeParse({ ...base, username: "ab" }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, username: "u".repeat(33) }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, username: "user name" }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, username: "user@1" }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, name: "A" }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, name: "N".repeat(121) }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, email: "invalid-email" }).success).toBe(false);
      expect(
        createAdminUserSchema.safeParse({
          ...base,
          email: `${"a".repeat(110)}@sekolah.id`, // 121 chars
        }).success
      ).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, password: "p".repeat(129) }).success).toBe(false);
      expect(createAdminUserSchema.safeParse({ ...base, role: "admin" }).success).toBe(false);
    });

    it("validates updateAdminUserSchema", () => {
      expect(updateAdminUserSchema.safeParse({}).success).toBe(true);
      expect(
        updateAdminUserSchema.safeParse({
          name: "Panitia Baru",
          email: "baru@sekolah.sch.id",
          role: "super_admin",
          banned: true,
          password: "NewPassword123",
        }).success
      ).toBe(true);

      expect(updateAdminUserSchema.safeParse({ name: "A" }).success).toBe(false);
      expect(updateAdminUserSchema.safeParse({ email: "bad" }).success).toBe(false);
      expect(updateAdminUserSchema.safeParse({ password: "123" }).success).toBe(false);
      expect(updateAdminUserSchema.safeParse({ role: "voter" }).success).toBe(false);
    });
  });
});
