import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  hasCsvFormulaPrefix,
  escapeSpreadsheetCell,
  normalizeHeader,
  extractField,
  validateDptRows,
  parseDptBuffer,
  MAX_IMPORT_ROWS,
} from "@/lib/importers/dpt-parser";
import {
  generateResultsWorkbook,
  generateResultsWorkbookBuffer,
  sanitizeReportFilename,
} from "@/lib/reports/export-excel";
import {
  generateDocumentVerificationHash,
  generateBeritaAcaraPdfDoc,
  generateBeritaAcaraPdfBuffer,
} from "@/lib/reports/export-pdf";
import type { ElectionResultsDTO, AuditLogDTO } from "@/types/votera";

describe("DPT Parser & Security Modules (Unit)", () => {
  // --------------------------------------------------------------------------
  // 1. CSV Formula Injection Prefix Detection (CWE-1236)
  // --------------------------------------------------------------------------
  describe("hasCsvFormulaPrefix", () => {
    it("detects all formula triggers (=, +, -, @, \\t, \\r) including CMD payloads", () => {
      expect(hasCsvFormulaPrefix("=1+1")).toBe(true);
      expect(hasCsvFormulaPrefix("=CMD|' /C calc'!A0")).toBe(true);
      expect(hasCsvFormulaPrefix("@SUM(A1:A10)")).toBe(true);
      expect(hasCsvFormulaPrefix("-cmd|' /C calc'!A0")).toBe(true);
      expect(hasCsvFormulaPrefix("+62812345678")).toBe(true);
      expect(hasCsvFormulaPrefix("+123")).toBe(true);
      expect(hasCsvFormulaPrefix("\tcmd")).toBe(true);
      expect(hasCsvFormulaPrefix("\rcmd")).toBe(true);
    });

    it("detects formulas with leading spaces before trigger symbol", () => {
      expect(hasCsvFormulaPrefix("   =1+1")).toBe(true);
      expect(hasCsvFormulaPrefix("  @SUM")).toBe(true);
      expect(hasCsvFormulaPrefix(" -danger")).toBe(true);
      expect(hasCsvFormulaPrefix(" +danger")).toBe(true);
    });

    it("returns false for legitimate values and non-string primitives", () => {
      expect(hasCsvFormulaPrefix("NIS2324001")).toBe(false);
      expect(hasCsvFormulaPrefix("Ahmad Fauzi")).toBe(false);
      expect(hasCsvFormulaPrefix("XII IPA 1")).toBe(false);
      expect(hasCsvFormulaPrefix("")).toBe(false);
      expect(hasCsvFormulaPrefix(null)).toBe(false);
      expect(hasCsvFormulaPrefix(undefined)).toBe(false);
      expect(hasCsvFormulaPrefix(12345)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Spreadsheet Cell Export Escaping
  // --------------------------------------------------------------------------
  describe("escapeSpreadsheetCell", () => {
    it("prepends a single apostrophe to strings with any formula prefix (=, +, -, @, \\t, \\r)", () => {
      expect(escapeSpreadsheetCell("=1+1")).toBe("'=1+1");
      expect(escapeSpreadsheetCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
      expect(escapeSpreadsheetCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
      expect(escapeSpreadsheetCell("-cmd")).toBe("'-cmd");
      expect(escapeSpreadsheetCell("+123")).toBe("'+123");
      expect(escapeSpreadsheetCell("\tcmd")).toBe("'\tcmd");
      expect(escapeSpreadsheetCell("\rcmd")).toBe("'\rcmd");
      expect(escapeSpreadsheetCell("  =admin")).toBe("'  =admin");
    });

    it("leaves safe text, numbers, null, and undefined handled cleanly", () => {
      expect(escapeSpreadsheetCell("Budi Santoso")).toBe("Budi Santoso");
      expect(escapeSpreadsheetCell("XII TKJ 2")).toBe("XII TKJ 2");
      expect(escapeSpreadsheetCell(100)).toBe("100");
      expect(escapeSpreadsheetCell(null)).toBe("");
      expect(escapeSpreadsheetCell(undefined)).toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Header Normalization and Alias Matching
  // --------------------------------------------------------------------------
  describe("normalizeHeader & extractField", () => {
    it("normalizes headers by trimming, lowercasing, and stripping whitespace and separators", () => {
      expect(normalizeHeader("  NISN  ")).toBe("nisn");
      expect(normalizeHeader("NAMA_LENGKAP")).toBe("namalengkap");
      expect(normalizeHeader("Kelas - Rombel")).toBe("kelasrombel");
      expect(normalizeHeader("No. Induk")).toBe("noinduk");
    });

    it("extracts field value across various common school column aliases", () => {
      const record1 = { "No. Induk": "2324001", "Nama Lengkap": "Siti Aminah", Kelas: "XII IPA 1" };
      expect(extractField(record1, ["nis", "no_induk", "id"])).toBe("2324001");
      expect(extractField(record1, ["nama", "nama_lengkap"])).toBe("Siti Aminah");
      expect(extractField(record1, ["rombel", "kelas"])).toBe("XII IPA 1");

      const record2 = { USERNAME: "user001", FULL_NAME: "John Doe", UNIT: "XII IPS 2" };
      expect(extractField(record2, ["nis", "username", "id"])).toBe("user001");
      expect(extractField(record2, ["nama", "full_name"])).toBe("John Doe");
      expect(extractField(record2, ["rombel", "unit"])).toBe("XII IPS 2");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Ingestion Validation: TC-12, Formula Rejection, Duplicates, Limits & Gender Tolerance
  // --------------------------------------------------------------------------
  describe("validateDptRows", () => {
    it("rejects rows containing CSV formula prefixes (=, +, -, @, and tab/cr before trigger) across fields", () => {
      const rows = [
        { NIS: "=CMD|' /C calc'!A0", NAMA: "Valid Name", ROMBEL: "XII IPA 1" },
        { NIS: "2324002", NAMA: "@SUM(A1:A10)", ROMBEL: "XII IPA 1" },
        { NIS: "2324003", NAMA: "Valid Name", ROMBEL: "-cmd" },
        { NIS: "2324004", NAMA: "Valid Name", ROMBEL: "XII IPA 1", TINGKAT: "+12" },
        { NIS: "2324005", NAMA: "Valid Name", ROMBEL: "XII IPA 1", JURUSAN: "\t=HYPERLINK(\"http://evil\")" },
        { NIS: "2324006", NAMA: "\r+1+1", ROMBEL: "XII IPA 1" },
        { NIS: "2324007", NAMA: "Clean Voter", ROMBEL: "XII IPA 1", TINGKAT: "XII" },
      ];

      const result = validateDptRows(rows);
      expect(result.validRows).toHaveLength(1);
      expect(result.validRows[0].voterIdentity).toBe("2324007");
      expect(result.localErrors).toHaveLength(6);
      result.localErrors.forEach((err) => {
        expect(err.reason).toContain("CSV Formula Injection protection");
      });
    });

    it("detects in-file duplicate voter identities case-insensitively", () => {
      const rows = [
        { NIS: "2324001", NAMA: "Alya", ROMBEL: "XII IPA 1" },
        { NIS: "2324002", NAMA: "Budi", ROMBEL: "XII IPA 1" },
        { NIS: "2324001", NAMA: "Alya Duplicate", ROMBEL: "XII IPA 1" },
        { NIS: "abc10", NAMA: "Citra", ROMBEL: "XII IPA 2" },
        { NIS: "ABC10", NAMA: "Citra Upper Duplicate", ROMBEL: "XII IPA 2" },
      ];

      const result = validateDptRows(rows);
      expect(result.validRows).toHaveLength(3);
      expect(result.validRows.map((r) => r.voterIdentity)).toEqual([
        "2324001",
        "2324002",
        "abc10",
      ]);
      expect(result.localErrors).toHaveLength(2);
      expect(result.localErrors[0].reason).toContain("duplikat di dalam file");
      expect(result.localErrors[1].reason).toContain("duplikat di dalam file");
    });

    it("validates required fields, field length boundaries, and skips completely empty lines", () => {
      const rows = [
        { NIS: "", NAMA: "", ROMBEL: "" }, // skipped completely
        { NIS: "", NAMA: "Siti", ROMBEL: "Rombel 1" }, // row 3: empty NIS
        { NIS: "A".repeat(51), NAMA: "Terlalu Panjang NIS", ROMBEL: "Rombel 1" }, // row 4: > 50 chars
        { NIS: "2324010", NAMA: "X", ROMBEL: "Rombel 1" }, // row 5: name < 2 chars
        { NIS: "2324011", NAMA: "N".repeat(121), ROMBEL: "Rombel 1" }, // row 6: name > 120 chars
        { NIS: "2324012", NAMA: "Tanpa Rombel", ROMBEL: "" }, // row 7: missing group
        { NIS: "2324013", NAMA: "Rombel Panjang", ROMBEL: "R".repeat(61) }, // row 8: group > 60 chars
        { NIS: "A".repeat(50), NAMA: "N".repeat(120), ROMBEL: "R".repeat(60) }, // row 9: exact max boundary
      ];

      const result = validateDptRows(rows, { idLabel: "NIM", groupLabel: "Kelas" });
      expect(result.validRows).toHaveLength(1);
      expect(result.validRows[0].voterIdentity).toBe("A".repeat(50));
      expect(result.localErrors).toHaveLength(6);
      expect(result.localErrors.map((e) => e.rowNumber)).toEqual([3, 4, 5, 6, 7, 8]);
      expect(result.localErrors[0].reason).toBe("NIM wajib diisi");
      expect(result.localErrors[1].reason).toBe("NIM maksimal 50 karakter");
      expect(result.localErrors[2].reason).toBe("Nama pemilih minimal 2 karakter");
      expect(result.localErrors[3].reason).toBe("Nama pemilih maksimal 120 karakter");
      expect(result.localErrors[4].reason).toBe("Kelas wajib diisi");
      expect(result.localErrors[5].reason).toBe("Kelas maksimal 60 karakter");
    });

    it("enforces the 5,000 row limit strictly (MAX_IMPORT_ROWS = 5000)", () => {
      expect(MAX_IMPORT_ROWS).toBe(5000);

      // Array of exactly 5,000 rows passes
      const exact5000 = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => ({
        NIS: `NIS_${i + 1}`,
        NAMA: `Voter ${i + 1}`,
        ROMBEL: "XII IPA 1",
      }));

      const result = validateDptRows(exact5000);
      expect(result.validRows).toHaveLength(5000);

      // Array of 5,001 rows throws immediately
      const overflow5001 = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({
        NIS: `NIS_${i + 1}`,
        NAMA: `Voter ${i + 1}`,
        ROMBEL: "XII IPA 1",
      }));

      expect(() => validateDptRows(overflow5001)).toThrowError(
        /Jumlah baris melebihi batas maksimal 5\.000 baris/
      );
    });

    it("tolerates and ignores gender columns without errors or trying to store them", () => {
      const rows = [
        {
          NIS: "2324001",
          NAMA: "Dewi Lestari",
          ROMBEL: "XII IPA 1",
          "Jenis Kelamin": "P",
          JK: "Perempuan",
        },
        {
          NIS: "2324002",
          NAMA: "Eko Prasetyo",
          ROMBEL: "XII IPA 1",
          gender: "L",
        },
      ];

      const result = validateDptRows(rows);
      expect(result.validRows).toHaveLength(2);
      expect(result.localErrors).toHaveLength(0);

      // Verify gender was omitted and not injected into output
      const row1 = result.validRows[0] as unknown as Record<string, unknown>;
      expect(row1.gender).toBeUndefined();
      expect(row1.jk).toBeUndefined();
      expect(row1.jenisKelamin).toBeUndefined();
      expect(row1.voterIdentity).toBe("2324001");
      expect(row1.name).toBe("Dewi Lestari");
      expect(row1.groupName).toBe("XII IPA 1");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Buffer Parsers (CSV & XLSX) + TC-12 Mandatory Scenario
  // --------------------------------------------------------------------------
  describe("parseDptBuffer", () => {
    it("TC-12: handles the exact 5-row malformed Excel scenario cleanly without crashing", async () => {
      // Exact 5 rows from docs/TESTING.md section 2.4 TC-12:
      // 1. Valid row (2324099, Budi, Rombel 1)
      // 2. Empty NIS ("", Siti, Rombel 1)
      // 3. Duplicate NIS in file (2324099, Budi 2, Rombel 2)
      // 4. Unregistered rombel (2324100, Andi, Rombel 99) — passes pure structural validation; DB lookup occurs in import tx
      // 5. CSV Formula Injection (2324101, =CMD|' /C calc'!A0, Rombel 1)
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["NIS", "NAMA", "ROMBEL"],
        ["2324099", "Budi", "Rombel 1"],
        ["", "Siti", "Rombel 1"],
        ["2324099", "Budi 2", "Rombel 2"],
        ["2324100", "Andi", "Rombel 99"],
        ["2324101", "=CMD|' /C calc'!A0", "Rombel 1"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "DPT");

      const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
      const result = await parseDptBuffer(xlsxBuffer, "tc12-dpt.xlsx");

      expect(result.totalRawRows).toBe(5);
      expect(result.validRows).toEqual([
        { voterIdentity: "2324099", name: "Budi", groupName: "Rombel 1" },
        { voterIdentity: "2324100", name: "Andi", groupName: "Rombel 99" },
      ]);
      expect(result.localErrors).toHaveLength(3);
      expect(result.localErrors).toEqual([
        {
          rowNumber: 3,
          voterIdentity: "-",
          reason: "NIS wajib diisi",
        },
        {
          rowNumber: 4,
          voterIdentity: "2324099",
          reason: "NIS duplikat di dalam file",
        },
        {
          rowNumber: 6,
          voterIdentity: "2324101",
          reason:
            "Karakter awal (=, +, -, @) tidak diizinkan (CSV Formula Injection protection)",
        },
      ]);
    });

    it("parses CSV buffers correctly, including UTF-8 BOM and quoted strings", async () => {
      const csvContent =
        "\uFEFFNIS,NAMA,ROMBEL,TINGKAT,JURUSAN\n" +
        '2324001,"Pratama, Aditya",XII IPA 1,XII,IPA\n' +
        '2324002,"Siti, Nurhaliza",XII IPA 2,XII,IPA\n';

      const buffer = Buffer.from(csvContent, "utf8");
      const result = await parseDptBuffer(buffer, "voters.csv");

      expect(result.validRows).toHaveLength(2);
      expect(result.validRows[0].voterIdentity).toBe("2324001");
      expect(result.validRows[0].name).toBe("Pratama, Aditya");
      expect(result.validRows[0].groupName).toBe("XII IPA 1");
      expect(result.validRows[0].gradeName).toBe("XII");
      expect(result.validRows[0].majorName).toBe("IPA");
    });

    it("parses XLSX binary buffers correctly with numeric cell preservation", async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["NIS", "NAMA", "ROMBEL"],
        [2324001, "Budi Hartono", "XII TKJ 1"],
        [2324002, "Citra Kirana", "XII TKJ 2"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
      const result = await parseDptBuffer(xlsxBuffer, "voters.xlsx");

      expect(result.validRows).toHaveLength(2);
      expect(result.validRows[0].voterIdentity).toBe("2324001");
      expect(result.validRows[0].name).toBe("Budi Hartono");
      expect(result.validRows[0].groupName).toBe("XII TKJ 1");
    });

    it("rejects empty files and unsupported file formats", async () => {
      const dummyBuffer = Buffer.from("test");
      await expect(
        parseDptBuffer(dummyBuffer, "malicious.exe")
      ).rejects.toThrowError(/Format file tidak didukung/);

      const emptyCsv = Buffer.from("NIS,NAMA,ROMBEL\n", "utf8");
      await expect(parseDptBuffer(emptyCsv, "empty.csv")).rejects.toThrowError(
        /File tidak memiliki baris data pemilih/
      );
    });
  });

  // --------------------------------------------------------------------------
  // 6. Report Exporters (Excel & PDF)
  // --------------------------------------------------------------------------
  describe("Report Exporters", () => {
    const mockElectionResults: ElectionResultsDTO = {
      election: {
        id: "e1000000-0000-0000-0000-000000000001",
        shortName: "PILKETOS-2026",
        title: "Pemilihan Ketua OSIS 2026/2027",
        organizationName: "SMA Negeri 1 Bojong Gede",
        status: "closed",
        startAt: "2026-11-12T01:00:00Z",
        endAt: "2026-11-12T08:00:00Z",
      },
      summary: {
        totalVoters: 100,
        votesCast: 85,
        notVoted: 15,
        turnoutPercentage: 85.0,
      },
      leadingCandidate: {
        candidateNumber: 1,
        name: "Raka & Alya",
        isTie: false,
      },
      candidates: [
        {
          id: "c1",
          candidateNumber: 1,
          name: "Raka Pratama & Alya Zahra",
          classOrUnit: "XII MIPA 1",
          photoUrl: null,
          themeColor: "red",
          voteCount: 55,
          percentage: 64.7,
          rank: 1,
        },
        {
          id: "c2",
          candidateNumber: 2,
          name: "=CMD|' /C calc'!A0",
          classOrUnit: "XII IPS 2",
          photoUrl: null,
          themeColor: "blue",
          voteCount: 30,
          percentage: 35.3,
          rank: 2,
        },
      ],
      groupParticipation: [
        {
          groupId: "g1",
          groupName: "XII MIPA 1",
          gradeName: "XII",
          majorName: "MIPA",
          totalMembers: 50,
          votedMembers: 45,
          percentage: 90.0,
        },
      ],
      lastUpdatedAt: "2026-11-12T08:00:00Z",
    };

    const mockAuditLogs: AuditLogDTO[] = [
      {
        id: "log-1",
        electionId: "e1000000-0000-0000-0000-000000000001",
        actorType: "admin",
        actorId: "admin-1",
        actorName: "Ketua Panitia",
        actorIdentity: "admin@sekolah.sch.id",
        action: "election_closed",
        actionTitle: "Tutup Pemilihan",
        description: "+Pemungutan suara resmi ditutup",
        ipAddress: "127.0.0.1",
        createdAt: "2026-11-12T08:00:00Z",
      },
    ];

    it("generates 4-sheet Excel workbook with escaped formula-prefixed cells", () => {
      const workbook = generateResultsWorkbook(mockElectionResults, mockAuditLogs);
      expect(workbook.SheetNames).toEqual([
        "Ringkasan",
        "Hasil Kandidat",
        "Partisipasi Rombel",
        "Log Aktivitas",
      ]);

      const candidateRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets["Hasil Kandidat"]
      );
      expect(candidateRows[1]["Nama Kandidat"]).toBe("'=CMD|' /C calc'!A0");

      const logRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets["Log Aktivitas"]
      );
      expect(logRows[0]["Deskripsi"]).toBe("'+Pemungutan suara resmi ditutup");

      const buffer = generateResultsWorkbookBuffer(mockElectionResults, mockAuditLogs);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it("generates deterministic verification hash and official PDF document", () => {
      const hash1 = generateDocumentVerificationHash(mockElectionResults);
      const hash2 = generateDocumentVerificationHash(mockElectionResults);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^VTR-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

      const doc = generateBeritaAcaraPdfDoc(mockElectionResults);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      const pdfBytes = generateBeritaAcaraPdfBuffer(mockElectionResults);
      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(1000);
    });

    it("sanitizes filename safely", () => {
      expect(sanitizeReportFilename("PILKETOS 2026/2027 #1")).toBe("pilketos-2026-2027-1");
    });
  });
});
