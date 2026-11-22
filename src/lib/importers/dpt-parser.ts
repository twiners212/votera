import type * as XLSX from "xlsx";
import {
  hasCsvFormulaPrefix,
  escapeSpreadsheetCell,
} from "./csv-sanitizer";

export { hasCsvFormulaPrefix, escapeSpreadsheetCell };

export interface ImportVoterRowInput {
  voterIdentity: string;
  name: string;
  groupName: string;
  gradeName?: string;
  majorName?: string;
}

export interface ImportRowError {
  rowNumber: number;
  voterIdentity: string;
  reason: string;
}

export interface ParseDptResult {
  validRows: ImportVoterRowInput[];
  localErrors: ImportRowError[];
  totalRawRows: number;
}

export const MAX_IMPORT_ROWS = 5000;
export const BATCH_CHUNK_SIZE = 500;

/**
 * Normalize column header string for case-insensitive and symbol-agnostic fuzzy matching.
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Extract field value from a row record using a list of candidate alias headers.
 */
export function extractField(
  record: Record<string, unknown>,
  candidates: string[]
): string {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const target = normalizeHeader(candidate);
    const match = entries.find(([key]) => normalizeHeader(key) === target);
    if (match && match[1] !== undefined && match[1] !== null) {
      return String(match[1]).trim();
    }
  }
  return "";
}

const VOTER_IDENTITY_ALIASES = [
  "nis",
  "nisn",
  "nik",
  "id_pemilih",
  "idpemilih",
  "voter_id",
  "voterid",
  "username",
  "no_induk",
  "noinduk",
  "nomor_induk",
  "nomorinduk",
  "identitas",
  "voteridentity",
  "voter_identity",
  "id",
];

const NAME_ALIASES = [
  "nama",
  "nama_lengkap",
  "namalengkap",
  "full_name",
  "fullname",
  "nama_pemilih",
  "namapemilih",
  "name",
];

const GROUP_ALIASES = [
  "kelas",
  "rombel",
  "unit",
  "kelompok",
  "kelas_rombel",
  "kelasrombel",
  "groupname",
  "group_name",
  "group",
];

const GRADE_ALIASES = [
  "tingkat",
  "kelas_tingkat",
  "kelastingkat",
  "grade",
  "gradename",
  "grade_name",
];

const MAJOR_ALIASES = [
  "jurusan",
  "program_keahlian",
  "programkeahlian",
  "kompetensi",
  "kompetensi_keahlian",
  "major",
  "majorname",
  "major_name",
];

export interface DptHeaderLabels {
  idLabel?: string;
  groupLabel?: string;
  gradeLabel?: string;
  majorLabel?: string;
}

/**
 * Validate parsed spreadsheet rows, enforcing the 5,000 row limit,
 * CSV formula injection checks, and in-file duplicate detection.
 * Gender columns (JK, L/P) are tolerated and ignored.
 */
export function validateDptRows(
  rawRows: Array<Record<string, unknown>>,
  labels: DptHeaderLabels = {}
): ParseDptResult {
  const idLabel = labels.idLabel || "NIS";
  const groupLabel = labels.groupLabel || "Rombel";
  const gradeLabel = labels.gradeLabel || "Tingkat";
  const majorLabel = labels.majorLabel || "Jurusan";

  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Jumlah baris melebihi batas maksimal ${MAX_IMPORT_ROWS.toLocaleString("id-ID")} baris.`
    );
  }

  const validRows: ImportVoterRowInput[] = [];
  const localErrors: ImportRowError[] = [];
  const seenIdentities = new Set<string>();

  const idCandidates = [idLabel, ...VOTER_IDENTITY_ALIASES];
  const groupCandidates = [groupLabel, ...GROUP_ALIASES];
  const gradeCandidates = [gradeLabel, ...GRADE_ALIASES];
  const majorCandidates = [majorLabel, ...MAJOR_ALIASES];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-based indexing

    const voterIdentity = extractField(raw, idCandidates);
    const name = extractField(raw, NAME_ALIASES);
    const groupName = extractField(raw, groupCandidates);
    const gradeName = extractField(raw, gradeCandidates);
    const majorName = extractField(raw, majorCandidates);

    // Skip completely empty lines
    if (!voterIdentity && !name && !groupName) {
      return;
    }

    if (!voterIdentity) {
      localErrors.push({
        rowNumber,
        voterIdentity: "-",
        reason: `${idLabel} wajib diisi`,
      });
      return;
    }

    // CSV Formula Injection checks (CWE-1236)
    if (
      hasCsvFormulaPrefix(voterIdentity) ||
      hasCsvFormulaPrefix(name) ||
      hasCsvFormulaPrefix(groupName) ||
      (gradeName && hasCsvFormulaPrefix(gradeName)) ||
      (majorName && hasCsvFormulaPrefix(majorName))
    ) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason:
          "Karakter awal (=, +, -, @) tidak diizinkan (CSV Formula Injection protection)",
      });
      return;
    }

    if (voterIdentity.length > 50) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: `${idLabel} maksimal 50 karakter`,
      });
      return;
    }

    if (name.length < 2) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: "Nama pemilih minimal 2 karakter",
      });
      return;
    }

    if (name.length > 120) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: "Nama pemilih maksimal 120 karakter",
      });
      return;
    }

    if (!groupName) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: `${groupLabel} wajib diisi`,
      });
      return;
    }

    if (groupName.length > 60) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: `${groupLabel} maksimal 60 karakter`,
      });
      return;
    }

    // In-file duplicate detection (case-insensitive)
    const normalizedKey = voterIdentity.toLowerCase();
    if (seenIdentities.has(normalizedKey)) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: `${idLabel} duplikat di dalam file`,
      });
      return;
    }
    seenIdentities.add(normalizedKey);

    validRows.push({
      voterIdentity,
      name,
      groupName,
      ...(gradeName ? { gradeName } : {}),
      ...(majorName ? { majorName } : {}),
    });
  });

  return {
    validRows,
    localErrors,
    totalRawRows: rawRows.length,
  };
}

/**
 * Parse raw CSV or XLSX Buffer / Uint8Array / string into validated DPT rows.
 */
export async function parseDptBuffer(
  buffer: ArrayBuffer | Uint8Array | Buffer | string,
  filename: string,
  labels?: DptHeaderLabels
): Promise<ParseDptResult> {
  const lowerName = filename.toLowerCase();
  const isCsv = lowerName.endsWith(".csv");
  const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");

  if (!isCsv && !isXlsx) {
    throw new Error("Format file tidak didukung. Gunakan file .csv atau .xlsx.");
  }

  let rawRecords: Array<Record<string, unknown>> = [];

  if (isCsv) {
    let text: string;
    if (typeof buffer === "string") {
      text = buffer;
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(buffer)) {
      text = buffer.toString("utf8");
    } else {
      text = new TextDecoder("utf-8").decode(buffer);
    }

    const Papa = (await import("papaparse")).default;
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (result.errors.length > 0 && result.data.length === 0) {
      throw new Error(result.errors[0]?.message || "File CSV tidak dapat dibaca");
    }

    rawRecords = result.data;
  } else {
    const XLSX = await import("xlsx");
    let workbook: XLSX.WorkBook;
    if (typeof buffer === "string") {
      workbook = XLSX.read(buffer, { type: "binary" });
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(buffer)) {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } else {
      workbook = XLSX.read(buffer, { type: "array" });
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Worksheet Excel kosong atau tidak ditemukan");
    }

    const sheet = workbook.Sheets[firstSheetName];
    rawRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
  }

  if (rawRecords.length === 0) {
    throw new Error("File tidak memiliki baris data pemilih.");
  }

  return validateDptRows(rawRecords, labels);
}
