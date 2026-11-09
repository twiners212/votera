import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ElectionReportData {
  election: {
    title: string;
    organizationName: string;
    startAt: string | null;
    endAt: string | null;
  };
  kpis: {
    totalVoters: number;
    totalVotes: number;
    unvotedCount: number;
    turnoutPercentage: number;
  };
  candidates: Array<{
    candidateNumber: number;
    name: string;
    classOrUnit: string;
    voteCount: number;
    percentage: number;
    isLeader: boolean;
  }>;
  classTurnout: Array<{
    name: string;
    total: number;
    voted: number;
    percentage: number;
  }>;
  committeeName?: string;
}

export function generateOfficialBeritaAcaraPdf(data: ElectionReportData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 1. KOP SURAT RESMI
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `PANITIA PEMILIHAN — ${data.election.organizationName.toUpperCase()}`,
    pageWidth / 2,
    18,
    { align: "center" }
  );

  doc.setFontSize(16);
  doc.setTextColor(214, 54, 44); // Civic Red
  doc.text(data.election.title.toUpperCase(), pageWidth / 2, 25, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Dokumen Resmi Berita Acara Perhitungan & Rekapitulasi Suara Elektronik",
    pageWidth / 2,
    30,
    { align: "center" }
  );

  // Garis Pembatas Kop Surat
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(15, 34, pageWidth - 15, 34);
  doc.setDrawColor(214, 54, 44);
  doc.setLineWidth(1);
  doc.line(15, 35, pageWidth - 15, 35);

  // 2. JUDUL BERITA ACARA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("BERITA ACARA PEMUNGUTAN & PERHITUNGAN SUARA", pageWidth / 2, 43, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nomor: BA-${Date.now().toString().slice(-6)}/PILKETOS/2026`, pageWidth / 2, 48, {
    align: "center",
  });

  // 3. PARAGRAF PEMBUKA
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const introText =
    `Pada hari ini, ${today}, telah diselenggarakan pemungutan dan perhitungan suara secara digital melalui platform Votera untuk ` +
    `${data.election.title} di lingkungan ${data.election.organizationName}. ` +
    `Proses pemungutan suara telah selesai dilaksanakan dengan hasil rekapitulasi sebagai berikut:`;
  const splitIntro = doc.splitTextToSize(introText, pageWidth - 30);
  doc.text(splitIntro, 15, 56);

  // 4. TABEL REKAPITULASI PARTISIPASI (KPI)
  autoTable(doc, {
    startY: 68,
    margin: { left: 15, right: 15 },
    head: [["PARAMETER", "JUMLAH", "PERSENTASE / KETERANGAN"]],
    body: [
      ["Total Pemilih Terdaftar (DPT)", `${data.kpis.totalVoters} Pemilih`, "100%"],
      ["Total Suara Masuk (Sah)", `${data.kpis.totalVotes} Suara`, `${data.kpis.turnoutPercentage}%`],
      ["Pemilih Tidak Menggunakan Hak Suara", `${data.kpis.unvotedCount} Pemilih`, `${(100 - data.kpis.turnoutPercentage).toFixed(1)}%`],
      ["Status Pemilihan", "SELESAI", "Kerahasiaan Suara Dijamin Kriptografis"],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [214, 54, 44],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
  });

  // 5. TABEL PEROLEHAN SUARA KANDIDAT
  const lastY1 = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("A. Hasil Perolehan Suara Kandidat", 15, lastY1);

  const candidateRows = data.candidates.map((cand) => [
    `No. ${cand.candidateNumber}`,
    cand.name,
    cand.classOrUnit,
    `${cand.voteCount} Suara`,
    `${cand.percentage.toFixed(1)}%`,
    cand.isLeader ? "UNGGUL / TERPILIH" : "-",
  ]);

  autoTable(doc, {
    startY: lastY1 + 3,
    margin: { left: 15, right: 15 },
    head: [["NO", "NAMA KANDIDAT", "KELAS / UNIT", "PEROLEHAN SUARA", "PERSENTASE", "KETERANGAN"]],
    body: candidateRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
  });

  // 6. TABEL PARTISIPASI PER KELAS / ROMBEL
  const lastY2 = (doc as any).lastAutoTable.finalY + 8;

  // Jika posisi mendekati batas bawah halaman, tambah halaman baru
  let currentY = lastY2;
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("B. Partisipasi Berdasarkan Rombongan Belajar (Rombel)", 15, currentY);

  const classRows = data.classTurnout.map((c) => [
    c.name,
    `${c.total} Pemilih`,
    `${c.voted} Pemilih`,
    `${c.percentage.toFixed(1)}%`,
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 15, right: 15 },
    head: [["NAMA KELAS / ROMBEL", "TOTAL DPT", "SUDAH MEMILIH", "PARTISIPASI"]],
    body: classRows,
    theme: "striped",
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
  });

  // 7. TANDA TANGAN PANITIA & SAKSI
  let signY = (doc as any).lastAutoTable.finalY + 12;
  if (signY > 230) {
    doc.addPage();
    signY = 25;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    "Demikian Berita Acara ini dibuat dengan sebenarnya dan ditandatangani secara sah untuk digunakan sebagaimana mestinya.",
    15,
    signY
  );

  const signBlockY = signY + 10;
  doc.setFont("helvetica", "bold");
  doc.text("Ketua Panitia Pemilihan,", 25, signBlockY);
  doc.text("Saksi Perwakilan Siswa,", pageWidth - 70, signBlockY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("[ Tanda Tangan & Cap Digital ]", 25, signBlockY + 18);
  doc.text("[ Tanda Tangan Saksi ]", pageWidth - 70, signBlockY + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`( ${data.committeeName || "Panitia Pelaksana"} )`, 25, signBlockY + 28);
  doc.text("( Perwakilan MPK/OSIS )", pageWidth - 70, signBlockY + 28);

  // 8. FOOTER KEAMANAN & HASH DI SETIAP HALAMAN
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.line(15, 287, pageWidth - 15, 287);
    doc.text(
      "Votera E-Voting System — Integritas Ledger & Kerahasiaan Suara Dijamin Kriptografis",
      15,
      291
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 15, 291, {
      align: "right",
    });
  }

  return doc;
}
