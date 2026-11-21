import * as XLSX from "xlsx";
import type { ElectionResultsDTO, AuditLogDTO, ElectionStatus } from "@/types/votera";
import { formatDateWIB } from "@/lib/utils";
import { escapeSpreadsheetCell } from "@/lib/importers/dpt-parser";

export interface ExportExcelOptions {
  filename?: string;
  includeAuditLogs?: boolean;
}

const ELECTION_STATUS_LABELS: Record<ElectionStatus, string> = {
  draft: "Draft",
  open: "Sedang Berlangsung",
  closed: "Selesai",
  archived: "Diarsipkan",
};

export function sanitizeReportFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds the official 4-sheet Excel workbook containing:
 * 1. Ringkasan (KPI summary & election status)
 * 2. Hasil Kandidat (Ranked candidate tally & percentages)
 * 3. Partisipasi Rombel (Turnout breakdown by group/class)
 * 4. Log Aktivitas (Audit trails & timestamped events)
 * All string cell values are escaped against formula injection (CWE-1236).
 */
export function generateResultsWorkbook(
  data: ElectionResultsDTO,
  logs?: AuditLogDTO[]
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // ----------------------------------------------------
  // Sheet 1: Ringkasan
  // ----------------------------------------------------
  const leadingText =
    data.leadingCandidate && data.summary.votesCast > 0
      ? data.leadingCandidate.isTie
        ? `Imbang: No. ${data.leadingCandidate.candidateNumber} ${data.leadingCandidate.name}`
        : `No. ${data.leadingCandidate.candidateNumber} ${data.leadingCandidate.name}`
      : "Belum ada suara masuk";

  const summaryRows: Array<Array<string | number>> = [
    ["REKAPITULASI HASIL PEMILIHAN", ""],
    ["Judul Pemilihan", escapeSpreadsheetCell(data.election.title)],
    ["Instansi", escapeSpreadsheetCell(data.election.organizationName)],
    [
      "Status",
      escapeSpreadsheetCell(
        ELECTION_STATUS_LABELS[data.election.status] || data.election.status
      ),
    ],
    [
      "Jadwal Mulai",
      escapeSpreadsheetCell(
        data.election.startAt ? formatDateWIB(data.election.startAt) : "-"
      ),
    ],
    [
      "Jadwal Selesai",
      escapeSpreadsheetCell(
        data.election.endAt ? formatDateWIB(data.election.endAt) : "-"
      ),
    ],
    ["Total Pemilih (DPT)", data.summary.totalVoters],
    ["Suara Masuk", data.summary.votesCast],
    ["Belum Memilih", data.summary.notVoted],
    ["Partisipasi (%)", Number(data.summary.turnoutPercentage.toFixed(1))],
    ["Kandidat Unggul", escapeSpreadsheetCell(leadingText)],
    [
      "Diperbarui Pada",
      escapeSpreadsheetCell(
        formatDateWIB(data.lastUpdatedAt, { withSeconds: true })
      ),
    ],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

  // ----------------------------------------------------
  // Sheet 2: Hasil Kandidat
  // ----------------------------------------------------
  const sortedCandidates = [...data.candidates].sort(
    (a, b) => a.rank - b.rank || a.candidateNumber - b.candidateNumber
  );

  const candidateRows = sortedCandidates.map((c) => ({
    Peringkat: c.rank,
    "No. Urut": c.candidateNumber,
    "Nama Kandidat": escapeSpreadsheetCell(c.name),
    "Kelas / Unit": escapeSpreadsheetCell(c.classOrUnit),
    "Perolehan Suara": c.voteCount,
    "Persentase (%)": Number(c.percentage.toFixed(1)),
  }));

  const candidateSheet = XLSX.utils.json_to_sheet(
    candidateRows.length > 0
      ? candidateRows
      : [
          {
            Peringkat: 1,
            "No. Urut": 1,
            "Nama Kandidat": "-",
            "Kelas / Unit": "-",
            "Perolehan Suara": 0,
            "Persentase (%)": 0,
          },
        ]
  );
  candidateSheet["!cols"] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, candidateSheet, "Hasil Kandidat");

  // ----------------------------------------------------
  // Sheet 3: Partisipasi Rombel
  // ----------------------------------------------------
  const groupRows = data.groupParticipation.map((g) => ({
    "Rombel / Kelas": escapeSpreadsheetCell(g.groupName),
    Tingkat: escapeSpreadsheetCell(g.gradeName ?? "-"),
    Jurusan: escapeSpreadsheetCell(g.majorName ?? "-"),
    "Total Pemilih": g.totalMembers,
    "Sudah Memilih": g.votedMembers,
    "Belum Memilih": Math.max(0, g.totalMembers - g.votedMembers),
    "Partisipasi (%)": Number(g.percentage.toFixed(1)),
  }));

  const groupSheet = XLSX.utils.json_to_sheet(
    groupRows.length > 0
      ? groupRows
      : [
          {
            "Rombel / Kelas": "-",
            Tingkat: "-",
            Jurusan: "-",
            "Total Pemilih": 0,
            "Sudah Memilih": 0,
            "Belum Memilih": 0,
            "Partisipasi (%)": 0,
          },
        ]
  );
  groupSheet["!cols"] = [
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, groupSheet, "Partisipasi Rombel");

  // ----------------------------------------------------
  // Sheet 4: Log Aktivitas
  // ----------------------------------------------------
  let logRows: Array<{
    "Waktu (WIB)": string;
    Aktor: string;
    "Tipe Aktor": string;
    Identitas: string;
    Aksi: string;
    Deskripsi: string;
    "IP Address": string;
  }> = [];

  if (logs && logs.length > 0) {
    logRows = logs.map((log) => ({
      "Waktu (WIB)": escapeSpreadsheetCell(
        formatDateWIB(log.createdAt, { withSeconds: true })
      ),
      Aktor: escapeSpreadsheetCell(log.actorName),
      "Tipe Aktor": escapeSpreadsheetCell(log.actorType),
      Identitas: escapeSpreadsheetCell(log.actorIdentity),
      Aksi: escapeSpreadsheetCell(log.actionTitle || log.action),
      Deskripsi: escapeSpreadsheetCell(log.description),
      "IP Address": escapeSpreadsheetCell(log.ipAddress),
    }));
  } else {
    logRows = [
      {
        "Waktu (WIB)": "-",
        Aktor: "-",
        "Tipe Aktor": "-",
        Identitas: "-",
        Aksi: "-",
        Deskripsi: "Belum ada catatan aktivitas yang terekam",
        "IP Address": "-",
      },
    ];
  }

  const logSheet = XLSX.utils.json_to_sheet(logRows);
  logSheet["!cols"] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 24 },
    { wch: 45 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, logSheet, "Log Aktivitas");

  return workbook;
}

/**
 * Generate XLSX binary Buffer (for server-side Route Handler / API).
 */
export function generateResultsWorkbookBuffer(
  data: ElectionResultsDTO,
  logs?: AuditLogDTO[]
): Buffer {
  const workbook = generateResultsWorkbook(data, logs);
  const arrayBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  return Buffer.from(arrayBuffer);
}

/**
 * Trigger client-side browser download of the 4-sheet Excel report.
 */
export function exportResultsWorkbookFile(
  data: ElectionResultsDTO,
  logs?: AuditLogDTO[],
  options: ExportExcelOptions = {}
): void {
  const workbook = generateResultsWorkbook(data, logs);
  const slug = sanitizeReportFilename(
    data.election.shortName || data.election.title
  );
  const filename = options.filename || `hasil-pemilihan-${slug}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
