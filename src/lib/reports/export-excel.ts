import * as XLSX from "xlsx";
import { ElectionReportData } from "./export-pdf";

export interface FullExportData extends ElectionReportData {
  auditLogs?: Array<{
    createdAt: string;
    actorType: string;
    actorName: string;
    actorIdentity: string;
    actionTitle: string;
    description: string;
    ipAddress: string;
  }>;
}

export function generateOfficialElectionExcel(data: FullExportData): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Ringkasan Pemilihan
  const summaryRows = [
    ["LAPORAN REKAPITULASI RESMI E-VOTING — VOTERA"],
    ["Instansi", data.election.organizationName],
    ["Pemilihan", data.election.title],
    ["Waktu Cetak", new Date().toLocaleString("id-ID")],
    [],
    ["METRIK UTAMA", "NILAI"],
    ["Total Pemilih Terdaftar (DPT)", data.kpis.totalVoters],
    ["Total Suara Masuk (Sah)", data.kpis.totalVotes],
    ["Belum Menggunakan Hak Suara", data.kpis.unvotedCount],
    ["Tingkat Partisipasi (%)", `${data.kpis.turnoutPercentage}%`],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  // 2. Sheet: Hasil Perolehan Suara
  const candidateRows = [
    ["No. Urut", "Nama Kandidat", "Kelas / Unit", "Perolehan Suara", "Persentase (%)", "Status"],
    ...data.candidates.map((c) => [
      c.candidateNumber,
      c.name,
      c.classOrUnit,
      c.voteCount,
      `${c.percentage.toFixed(1)}%`,
      c.isLeader ? "Unggul / Terpilih" : "-",
    ]),
  ];
  const candidateWs = XLSX.utils.aoa_to_sheet(candidateRows);
  XLSX.utils.book_append_sheet(wb, candidateWs, "Hasil Kandidat");

  // 3. Sheet: Partisipasi Per Rombel
  const classRows = [
    ["Nama Kelas / Rombel", "Total DPT", "Sudah Memilih", "Belum Memilih", "Persentase (%)"],
    ...data.classTurnout.map((c) => [
      c.name,
      c.total,
      c.voted,
      Math.max(0, c.total - c.voted),
      `${c.percentage.toFixed(1)}%`,
    ]),
  ];
  const classWs = XLSX.utils.aoa_to_sheet(classRows);
  XLSX.utils.book_append_sheet(wb, classWs, "Partisipasi Rombel");

  // 4. Sheet: Audit Log (Jika ada)
  if (data.auditLogs && data.auditLogs.length > 0) {
    const logRows = [
      ["Waktu (WIB)", "Tipe Pelaku", "Nama Pelaku", "Identitas Pelaku", "Aksi", "Keterangan", "IP Address"],
      ...data.auditLogs.map((log) => [
        new Date(log.createdAt).toLocaleString("id-ID"),
        log.actorType,
        log.actorName,
        log.actorIdentity,
        log.actionTitle,
        log.description,
        log.ipAddress,
      ]),
    ];
    const logWs = XLSX.utils.aoa_to_sheet(logRows);
    XLSX.utils.book_append_sheet(wb, logWs, "Audit Log Ledger");
  }

  // Generate buffer
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
