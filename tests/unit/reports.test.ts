import { describe, it, expect } from "vitest";
import { generateOfficialBeritaAcaraPdf } from "@/lib/reports/export-pdf";
import { generateOfficialElectionExcel } from "@/lib/reports/export-excel";
import * as XLSX from "xlsx";

describe("Phase 10: Official Report Generation Tests", () => {
  const mockReportData = {
    election: {
      title: "Pemilihan Ketua OSIS 2026",
      organizationName: "SMA Bojong Gede",
      startAt: "2026-10-25T00:00:00.000Z",
      endAt: "2026-11-02T08:00:00.000Z",
    },
    kpis: {
      totalVoters: 76,
      totalVotes: 24,
      unvotedCount: 52,
      turnoutPercentage: 31.6,
    },
    candidates: [
      {
        candidateNumber: 1,
        name: "Raka Aditya Pratama",
        classOrUnit: "XI IPA",
        voteCount: 16,
        percentage: 66.7,
        isLeader: true,
      },
      {
        candidateNumber: 2,
        name: "Alya Putri Maharani",
        classOrUnit: "XI IPS",
        voteCount: 8,
        percentage: 33.3,
        isLeader: false,
      },
    ],
    classTurnout: [
      {
        name: "Rombel 1",
        total: 10,
        voted: 5,
        percentage: 50.0,
      },
      {
        name: "Rombel 2",
        total: 12,
        voted: 4,
        percentage: 33.3,
      },
    ],
    auditLogs: [
      {
        createdAt: "2026-10-25T13:20:00.000Z",
        actorType: "admin",
        actorName: "Super Admin",
        actorIdentity: "@admin",
        actionTitle: "Admin login",
        description: "Login panitia: admin",
        ipAddress: "::1",
      },
    ],
  };

  it("harus menghasilkan dokumen Berita Acara PDF yang valid", () => {
    const doc = generateOfficialBeritaAcaraPdf(mockReportData);

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const pdfOutput = doc.output("arraybuffer");
    expect(pdfOutput.byteLength).toBeGreaterThan(1000);
  });

  it("harus menghasilkan berkas Excel rekapitulasi dengan 4 lembar kerja (sheets) lengkap", () => {
    const excelBuffer = generateOfficialElectionExcel(mockReportData);

    expect(excelBuffer).toBeDefined();
    expect(excelBuffer.byteLength).toBeGreaterThan(1000);

    // Baca kembali berkas excel menggunakan parser XLSX
    const workbook = XLSX.read(excelBuffer, { type: "array" });

    expect(workbook.SheetNames).toContain("Ringkasan");
    expect(workbook.SheetNames).toContain("Hasil Kandidat");
    expect(workbook.SheetNames).toContain("Partisipasi Rombel");
    expect(workbook.SheetNames).toContain("Audit Log Ledger");

    // Periksa isi lembar kerja kandidat
    const candidateSheet = workbook.Sheets["Hasil Kandidat"];
    const rows = XLSX.utils.sheet_to_json(candidateSheet);
    expect(rows.length).toBe(2);
  });
});
