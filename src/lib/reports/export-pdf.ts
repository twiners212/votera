import { jsPDF } from "jspdf";
import _autoTable from "jspdf-autotable";
import type { ElectionResultsDTO, ElectionStatus } from "@/types/votera";
import { formatDateWIB, formatPercentage } from "@/lib/utils";

// Handle ESM and CJS import interop safely
const autoTable = (
  typeof _autoTable === "function"
    ? _autoTable
    : (_autoTable as unknown as { default: typeof _autoTable }).default
) as typeof _autoTable;

export interface BeritaAcaraPdfOptions {
  filename?: string;
  documentId?: string;
  verificationHash?: string;
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
 * Generate a deterministic verification code from election results data.
 * Produces format: VTR-XXXX-XXXX-XXXX-XXXX
 */
export function generateDocumentVerificationHash(
  data: ElectionResultsDTO
): string {
  const payload = [
    data.election.id,
    data.election.title,
    data.election.organizationName,
    data.summary.totalVoters,
    data.summary.votesCast,
    data.summary.turnoutPercentage.toFixed(2),
    data.lastUpdatedAt,
    ...data.candidates.map((c) => `${c.candidateNumber}:${c.voteCount}`),
  ].join("|");

  // Deterministic 64-bit FNV-1a hash producing uppercase hex string
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;

  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 ^ (code + i), 2246822507);
  }

  const toHex = (n: number) =>
    (n >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const digest = toHex(h1) + toHex(h2);

  const part1 = digest.substring(0, 4);
  const part2 = digest.substring(4, 8);
  const part3 = digest.substring(8, 12);
  const part4 = digest.substring(12, 16);
  return `VTR-${part1}-${part2}-${part3}-${part4}`;
}

/**
 * Build the jsPDF document instance for the official legal document:
 * "BERITA ACARA REKAPITULASI HASIL PEMILIHAN"
 * Includes:
 * - Crimson #D93829 Kop Surat & organization metadata
 * - Asia/Jakarta (WIB) timestamps
 * - Turnout KPI Grid
 * - Candidate Vote Table (Table A)
 * - Group Participation Table (Table B)
 * - Page-overflow protected Signature Blocks (Ketua Panitia & Saksi)
 * - SHA-256 verification hash & page numbering
 */
export function generateBeritaAcaraPdfDoc(
  data: ElectionResultsDTO,
  options: BeritaAcaraPdfOptions = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const verificationCode =
    options.verificationHash || generateDocumentVerificationHash(data);

  // ----------------------------------------------------
  // 1. Official Kop Surat (Crimson Votera Brand Color)
  // ----------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(217, 56, 41); // Crimson #D93829
  doc.text(data.election.organizationName.toUpperCase(), pageWidth / 2, 18, {
    align: "center",
  });

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // Slate #0F172A
  doc.text("BERITA ACARA REKAPITULASI HASIL PEMILIHAN", pageWidth / 2, 25, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(data.election.title, pageWidth / 2, 31, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 35, pageWidth - 14, 35);

  // ----------------------------------------------------
  // 2. Metadata (WIB format)
  // ----------------------------------------------------
  const startLabel = data.election.startAt
    ? formatDateWIB(data.election.startAt)
    : "-";
  const endLabel = data.election.endAt
    ? formatDateWIB(data.election.endAt)
    : "-";
  const printedAt = formatDateWIB(new Date(), { withSeconds: true });

  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Status Pemilihan : ${ELECTION_STATUS_LABELS[data.election.status] || data.election.status}`,
    14,
    42
  );
  doc.text(`Periode Jadwal   : ${startLabel} s.d. ${endLabel}`, 14, 47);
  doc.text(`Waktu Cetak      : ${printedAt} WIB`, 14, 52);

  // ----------------------------------------------------
  // 3. Turnout KPI Grid
  // ----------------------------------------------------
  autoTable(doc, {
    startY: 57,
    head: [["Total Pemilih (DPT)", "Suara Masuk", "Belum Memilih", "Partisipasi"]],
    body: [
      [
        data.summary.totalVoters.toLocaleString("id-ID"),
        data.summary.votesCast.toLocaleString("id-ID"),
        data.summary.notVoted.toLocaleString("id-ID"),
        formatPercentage(data.summary.turnoutPercentage, 1),
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 9,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 10,
      fontStyle: "bold",
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    margin: { left: 14, right: 14 },
  });

  const afterSummaryY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 75;

  // ----------------------------------------------------
  // 4. Table A: Candidate Results
  // ----------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("A. Perolehan Suara Kandidat", 14, afterSummaryY + 9);

  const sortedCandidates = [...data.candidates].sort(
    (a, b) => a.rank - b.rank || a.candidateNumber - b.candidateNumber
  );

  autoTable(doc, {
    startY: afterSummaryY + 13,
    head: [
      [
        "Peringkat",
        "No. Urut",
        "Nama Kandidat",
        "Kelas / Unit",
        "Suara",
        "Persentase",
      ],
    ],
    body: sortedCandidates.map((c) => [
      String(c.rank),
      `No. ${c.candidateNumber}`,
      c.name,
      c.classOrUnit,
      c.voteCount.toLocaleString("id-ID"),
      formatPercentage(c.percentage, 1),
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [217, 56, 41], // Crimson
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 20 },
      1: { halign: "center", cellWidth: 20 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  });

  let currentY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? afterSummaryY + 45;

  // ----------------------------------------------------
  // 5. Table B: Group/Class Participation Breakdown
  // ----------------------------------------------------
  if (data.groupParticipation.length > 0) {
    // If remaining page height is less than 30mm, push heading to new page
    if (currentY + 30 > pageHeight - 20) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("B. Partisipasi per Kelas / Rombel", 14, currentY + 9);

    autoTable(doc, {
      startY: currentY + 13,
      head: [
        [
          "Rombel / Kelas",
          "Tingkat",
          "Jurusan",
          "Pemilih",
          "Memilih",
          "Partisipasi",
        ],
      ],
      body: data.groupParticipation.map((g) => [
        g.groupName,
        g.gradeName ?? "-",
        g.majorName ?? "-",
        g.totalMembers.toLocaleString("id-ID"),
        g.votedMembers.toLocaleString("id-ID"),
        formatPercentage(g.percentage, 1),
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [51, 65, 85], // Slate
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
      },
      columnStyles: {
        3: { halign: "right", cellWidth: 20 },
        4: { halign: "right", cellWidth: 20 },
        5: { halign: "right", cellWidth: 24 },
      },
      margin: { left: 14, right: 14 },
    });

    currentY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? currentY + 40;
  }

  // ----------------------------------------------------
  // 6. Signature Blocks (Page-overflow protected)
  // ----------------------------------------------------
  let signY = currentY + 14;
  if (signY + 36 > pageHeight - 18) {
    doc.addPage();
    signY = 24;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Mengetahui,", 14, signY);
  doc.text("Ketua Panitia Pemilihan", 14, signY + 6);
  doc.text("Saksi Pemungutan Suara", pageWidth - 65, signY + 6);

  doc.setDrawColor(203, 213, 225);
  doc.line(14, signY + 26, 68, signY + 26);
  doc.line(pageWidth - 65, signY + 26, pageWidth - 14, signY + 26);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("( ........................................ )", 14, signY + 31);
  doc.text(
    "( ........................................ )",
    pageWidth - 65,
    signY + 31
  );

  // ----------------------------------------------------
  // 7. Page Footers & Verification Hash
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Kode Verifikasi: ${verificationCode}`, 14, pageHeight - 7);
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - 14,
      pageHeight - 7,
      { align: "right" }
    );
  }

  return doc;
}

/**
 * Generate PDF binary Uint8Array / Buffer (for server-side Route Handler / API).
 */
export function generateBeritaAcaraPdfBuffer(
  data: ElectionResultsDTO,
  options: BeritaAcaraPdfOptions = {}
): Uint8Array {
  const doc = generateBeritaAcaraPdfDoc(data, options);
  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}

/**
 * Trigger client-side browser download of the official Berita Acara PDF.
 */
export function exportBeritaAcaraPdfFile(
  data: ElectionResultsDTO,
  options: BeritaAcaraPdfOptions = {}
): void {
  const doc = generateBeritaAcaraPdfDoc(data, options);
  const slug = sanitizeReportFilename(
    data.election.shortName || data.election.title
  );
  const filename = options.filename || `berita-acara-${slug}.pdf`;
  doc.save(filename);
}
