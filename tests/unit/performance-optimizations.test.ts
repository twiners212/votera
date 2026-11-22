import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  hasCsvFormulaPrefix,
  escapeSpreadsheetCell,
} from "@/lib/importers/csv-sanitizer";
import {
  hasCsvFormulaPrefix as reExportedHasCsvFormulaPrefix,
  escapeSpreadsheetCell as reExportedEscapeSpreadsheetCell,
  parseDptBuffer,
} from "@/lib/importers/dpt-parser";
import {
  DEFAULT_SHOWCASE_DATA,
  getPublicShowcaseDataCached,
  revalidatePublicShowcase,
} from "@/lib/public/showcase-cache";
import {
  resolveActiveElectionId,
  getActiveBranding,
} from "@/lib/admin/active-election";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";

describe("Performance Optimizations & Cache Layer Unit Tests", () => {
  describe("1. CSV / Spreadsheet Sanitizer (csv-sanitizer.ts)", () => {
    it("detects formula triggers including =, +, -, @ and control characters", () => {
      expect(hasCsvFormulaPrefix("=SUM(A1:A10)")).toBe(true);
      expect(hasCsvFormulaPrefix("+12345")).toBe(true);
      expect(hasCsvFormulaPrefix("-12345")).toBe(true);
      expect(hasCsvFormulaPrefix("@SUM")).toBe(true);
      expect(hasCsvFormulaPrefix("\t=cmd|' /C calc'!A0")).toBe(true);
      expect(hasCsvFormulaPrefix("\r=1+1")).toBe(true);
      expect(hasCsvFormulaPrefix("   =TRIMMED")).toBe(true);
      expect(hasCsvFormulaPrefix("Normal Text")).toBe(false);
      expect(hasCsvFormulaPrefix("12345")).toBe(false);
      expect(hasCsvFormulaPrefix(null)).toBe(false);
      expect(hasCsvFormulaPrefix(undefined)).toBe(false);
      expect(hasCsvFormulaPrefix(42)).toBe(false);
    });

    it("escapes formula injection by prepending single apostrophe", () => {
      expect(escapeSpreadsheetCell("=1+1")).toBe("'=1+1");
      expect(escapeSpreadsheetCell("+cmd")).toBe("'+cmd");
      expect(escapeSpreadsheetCell("-cmd")).toBe("'-cmd");
      expect(escapeSpreadsheetCell("@test")).toBe("'@test");
      expect(escapeSpreadsheetCell("safe text")).toBe("safe text");
      expect(escapeSpreadsheetCell(null)).toBe("");
      expect(escapeSpreadsheetCell(undefined)).toBe("");
      expect(escapeSpreadsheetCell(100)).toBe("100");
    });

    it("maintains 100% backward compatibility via dpt-parser re-export", () => {
      expect(reExportedHasCsvFormulaPrefix).toBe(hasCsvFormulaPrefix);
      expect(reExportedEscapeSpreadsheetCell).toBe(escapeSpreadsheetCell);
    });
  });

  describe("2. Lazy Dynamic Importer in parseDptBuffer", () => {
    it("lazily imports papaparse and parses CSV buffer correctly", async () => {
      const csvContent =
        "NIS,Nama Lengkap,Rombel,Tingkat,Jurusan\n2324001,Budi Utomo,X-1,Kelas X,IPA";
      const result = await parseDptBuffer(csvContent, "voters.csv");
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0].voterIdentity).toBe("2324001");
      expect(result.validRows[0].name).toBe("Budi Utomo");
    });

    it("lazily imports xlsx and parses XLSX buffer correctly", async () => {
      const worksheet = XLSX.utils.aoa_to_sheet([
        ["NIS", "Nama Lengkap", "Rombel", "Tingkat", "Jurusan"],
        ["2324002", "Siti Aminah", "X-2", "Kelas X", "IPS"],
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      const result = await parseDptBuffer(buffer, "voters.xlsx");
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0].voterIdentity).toBe("2324002");
      expect(result.validRows[0].name).toBe("Siti Aminah");
    });

    it("throws error for unsupported extensions without loading parsers", async () => {
      await expect(
        parseDptBuffer(Buffer.from("invalid"), "voters.pdf")
      ).rejects.toThrow("Format file tidak didukung");
    });
  });

  describe("3. Public Showcase & Active Election Cache Helpers", () => {
    it("provides safe default fallback showcase data", () => {
      expect(DEFAULT_SHOWCASE_DATA.shortName).toBe("PILKETOS 2026");
      expect(DEFAULT_SHOWCASE_DATA.status).toBe("draft");
      expect(DEFAULT_SHOWCASE_DATA.candidates).toEqual([]);
    });

    it("executes revalidatePublicShowcase without crashing in any environment", () => {
      expect(() => revalidatePublicShowcase()).not.toThrow();
    });

    it("executes revalidateElectionCaches with electionId without crashing", () => {
      expect(() => revalidateElectionCaches("test-election-uuid")).not.toThrow();
      expect(() => revalidateElectionCaches()).not.toThrow();
    });

    it("getPublicShowcaseDataCached executes and returns valid structure", async () => {
      const data = await getPublicShowcaseDataCached();
      expect(data).toBeDefined();
      expect(data.shortName).toBeDefined();
      expect(Array.isArray(data.candidates)).toBe(true);
    });

    it("resolveActiveElectionId executes and returns string", async () => {
      const id = await resolveActiveElectionId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("getActiveBranding executes and returns branding object", async () => {
      const branding = await getActiveBranding();
      expect(branding).toBeDefined();
      expect(typeof branding.shortName).toBe("string");
    });
  });
});
