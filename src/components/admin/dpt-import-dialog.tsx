"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type BulkImportVotersResult,
  type ImportVoterRowInput,
  useImportVoters,
} from "@/hooks/use-voters";
import { cn } from "@/lib/utils";

export interface DptImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  electionId: string;
  idLabel?: string;
  groupLabel?: string;
  gradeLabel?: string;
  majorLabel?: string;
}

interface ImportRowError {
  rowNumber: number;
  voterIdentity: string;
  reason: string;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, "");
}

function extractField(
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

function validateParsedRows(
  rawRows: Array<Record<string, unknown>>,
  labels: {
    idLabel: string;
    groupLabel: string;
    gradeLabel: string;
    majorLabel: string;
  }
): {
  validRows: ImportVoterRowInput[];
  localErrors: ImportRowError[];
} {
  const validRows: ImportVoterRowInput[] = [];
  const localErrors: ImportRowError[] = [];
  const seenIdentities = new Set<string>();

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 header, +1 1-indexed
    const voterIdentity = extractField(raw, [
      labels.idLabel,
      "nis",
      "voterIdentity",
      "voter_identity",
      "identitas",
      "nomor_induk",
      "id",
    ]);
    const name = extractField(raw, ["nama", "name", "nama_lengkap", "fullname"]);
    const groupName = extractField(raw, [
      labels.groupLabel,
      "rombel",
      "kelas",
      "groupName",
      "group_name",
      "group",
    ]);
    const gradeName = extractField(raw, [
      labels.gradeLabel,
      "tingkat",
      "gradeName",
      "grade_name",
      "grade",
    ]);
    const majorName = extractField(raw, [
      labels.majorLabel,
      "jurusan",
      "majorName",
      "major_name",
      "major",
    ]);

    // Skip completely empty lines
    if (!voterIdentity && !name && !groupName) {
      return;
    }

    if (!voterIdentity) {
      localErrors.push({
        rowNumber,
        voterIdentity: "-",
        reason: `${labels.idLabel} wajib diisi`,
      });
      return;
    }

    if (/^[=+\-@]/.test(voterIdentity) || /^[=+\-@]/.test(name)) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: "Karakter awal (=, +, -, @) tidak diizinkan",
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

    if (!groupName) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: `${labels.groupLabel} wajib diisi`,
      });
      return;
    }

    const identityKey = voterIdentity.toLowerCase();
    if (seenIdentities.has(identityKey)) {
      localErrors.push({
        rowNumber,
        voterIdentity,
        reason: `${labels.idLabel} duplikat di dalam file`,
      });
      return;
    }
    seenIdentities.add(identityKey);

    validRows.push({
      voterIdentity,
      name,
      groupName,
      ...(gradeName ? { gradeName } : {}),
      ...(majorName ? { majorName } : {}),
    });
  });

  return { validRows, localErrors };
}

export function DptImportDialog({
  open,
  onOpenChange,
  electionId,
  idLabel = "NIS",
  groupLabel = "Rombel",
  gradeLabel = "Tingkat",
  majorLabel = "Jurusan",
}: DptImportDialogProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const importMutation = useImportVoters(electionId);

  const [isDragging, setIsDragging] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(
    null
  );
  const [parsedRows, setParsedRows] = React.useState<ImportVoterRowInput[]>([]);
  const [localErrors, setLocalErrors] = React.useState<ImportRowError[]>([]);
  const [autoCreateGroups, setAutoCreateGroups] = React.useState(true);
  const [importResult, setImportResult] =
    React.useState<BulkImportVotersResult | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const resetState = React.useCallback(() => {
    setIsDragging(false);
    setIsParsing(false);
    setSelectedFileName(null);
    setParsedRows([]);
    setLocalErrors([]);
    setAutoCreateGroups(true);
    setImportResult(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  async function processFile(file: File) {
    setParseError(null);
    setImportResult(null);
    setParsedRows([]);
    setLocalErrors([]);

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");

    if (!isCsv && !isXlsx) {
      setParseError("Format file tidak didukung. Gunakan file .csv atau .xlsx.");
      return;
    }

    setIsParsing(true);
    setSelectedFileName(file.name);

    try {
      let rawRecords: Array<Record<string, unknown>> = [];

      if (isCsv) {
        const text = await file.text();
        const result = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });

        if (result.errors.length > 0 && result.data.length === 0) {
          throw new Error(
            result.errors[0]?.message || "File CSV tidak dapat dibaca"
          );
        }
        rawRecords = result.data;
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("Worksheet Excel kosong atau tidak ditemukan");
        }
        const sheet = workbook.Sheets[firstSheetName];
        rawRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
      }

      if (rawRecords.length === 0) {
        setParseError("File tidak memiliki baris data pemilih.");
        return;
      }

      const { validRows, localErrors: rowErrors } = validateParsedRows(
        rawRecords,
        { idLabel, groupLabel, gradeLabel, majorLabel }
      );

      setParsedRows(validRows);
      setLocalErrors(rowErrors);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal membaca file. Pastikan format kolom sesuai template.";
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  function handleDownloadCsvTemplate() {
    const sampleRows = [
      {
        [idLabel]: "2324101",
        Nama: "Putri Ayu Lestari",
        [groupLabel]: "Rombel 1",
        [gradeLabel]: "Kelas X",
        [majorLabel]: "IPA",
      },
      {
        [idLabel]: "2324102",
        Nama: "Budi Santoso",
        [groupLabel]: "Rombel 2",
        [gradeLabel]: "Kelas X",
        [majorLabel]: "IPS",
      },
    ];
    const csv = Papa.unparse(sampleRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-dpt-votera.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleDownloadXlsxTemplate() {
    const sampleRows = [
      {
        [idLabel]: "2324101",
        Nama: "Putri Ayu Lestari",
        [groupLabel]: "Rombel 1",
        [gradeLabel]: "Kelas X",
        [majorLabel]: "IPA",
      },
      {
        [idLabel]: "2324102",
        Nama: "Budi Santoso",
        [groupLabel]: "Rombel 2",
        [gradeLabel]: "Kelas X",
        [majorLabel]: "IPS",
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template DPT");
    XLSX.writeFile(workbook, "template-dpt-votera.xlsx");
  }

  async function handleSubmitImport() {
    if (parsedRows.length === 0 || importMutation.isPending) return;
    setParseError(null);
    try {
      const result = await importMutation.mutateAsync({
        rows: parsedRows,
        autoCreateGroups,
      });
      setImportResult(result);
      if (result.insertedCount > 0) {
        toast.success(
          `${result.insertedCount} pemilih berhasil diimpor ke DPT`
        );
      }
      if (result.failedCount > 0) {
        toast.warning(
          `${result.failedCount} baris gagal diimpor. Periksa tabel laporan di bawah.`
        );
      }
      if (result.failedCount === 0 && localErrors.length === 0) {
        onOpenChange(false);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengimpor data DPT";
      setParseError(message);
      toast.error(message);
    }
  }

  const displayedErrors: ImportRowError[] = importResult
    ? importResult.failures
    : localErrors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Daftar Pemilih Tetap (DPT)</DialogTitle>
          <DialogDescription>
            Unggah file CSV atau Excel (.xlsx) berisi kolom{" "}
            <span className="font-semibold text-[#0F172A]">{idLabel}</span>,{" "}
            <span className="font-semibold text-[#0F172A]">Nama</span>, dan{" "}
            <span className="font-semibold text-[#0F172A]">{groupLabel}</span>{" "}
            (opsional: {gradeLabel}, {majorLabel}). Token unik dibuat otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs text-[#475569]">
              <FileSpreadsheet
                className="h-4 w-4 text-[#15803D]"
                aria-hidden="true"
              />
              <span>Belum punya format file? Unduh template resmi:</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadCsvTemplate}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Template CSV</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadXlsxTemplate}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Template XLSX</span>
              </Button>
            </div>
          </div>

          {/* Drag-and-drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed px-6 py-7 text-center transition-colors",
              isDragging
                ? "border-[#D93829] bg-[#FFF0EE]/50"
                : "border-[#CBD5E1] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Pilih file CSV atau XLSX"
            />
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
              {isParsing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-5 w-5" aria-hidden="true" />
              )}
            </div>

            {selectedFileName ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#0F172A]">
                  {selectedFileName}
                </p>
                <p className="text-xs text-[#64748B]">
                  Seret file lain ke sini untuk mengganti, atau klik tombol di
                  bawah.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#0F172A]">
                  Tarik & lepas file CSV atau XLSX di sini
                </p>
                <p className="text-xs text-[#64748B]">
                  Maksimal 5.000 baris pemilih per sesi impor
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing || importMutation.isPending}
              >
                Pilih file dari perangkat
              </Button>
              {selectedFileName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  disabled={importMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Bersihkan</span>
                </Button>
              )}
            </div>
          </div>

          {parseError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#DC2626]"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsed Preview Summary */}
          {(parsedRows.length > 0 || localErrors.length > 0) && !importResult && (
            <div className="space-y-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" className="tabular-nums">
                    {parsedRows.length} baris valid siap impor
                  </Badge>
                  {localErrors.length > 0 && (
                    <Badge variant="danger" className="tabular-nums">
                      {localErrors.length} baris bermasalah
                    </Badge>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#334155]">
                  <Checkbox
                    checked={autoCreateGroups}
                    onCheckedChange={(checked) =>
                      setAutoCreateGroups(Boolean(checked))
                    }
                  />
                  <span>Buat {groupLabel.toLowerCase()} otomatis jika belum ada</span>
                </label>
              </div>

              {parsedRows.length > 0 && (
                <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">{idLabel}</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>{groupLabel}</TableHead>
                        <TableHead>{gradeLabel}</TableHead>
                        <TableHead>{majorLabel}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 5).map((row) => (
                        <TableRow key={row.voterIdentity}>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {row.voterIdentity}
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-[#475569]">
                            {row.groupName}
                          </TableCell>
                          <TableCell className="text-[#64748B]">
                            {row.gradeName || "—"}
                          </TableCell>
                          <TableCell className="text-[#64748B]">
                            {row.majorName || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedRows.length > 5 && (
                    <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2 text-xs text-[#64748B] tabular-nums">
                      Menampilkan 5 dari {parsedRows.length} baris valid.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Server Import Summary */}
          {importResult && (
            <div className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2
                  className="h-5 w-5 text-[#15803D]"
                  aria-hidden="true"
                />
                <div className="text-sm font-semibold text-[#0F172A] tabular-nums">
                  Selesai memproses {importResult.totalProcessed} baris:{" "}
                  <span className="text-[#15803D]">
                    {importResult.insertedCount} berhasil
                  </span>
                  {importResult.failedCount > 0 && (
                    <>
                      {", "}
                      <span className="text-[#DC2626]">
                        {importResult.failedCount} gagal
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Row-level Error Report Table */}
          {displayedErrors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#DC2626]">
                  Laporan Baris Bermasalah ({displayedErrors.length})
                </h4>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-[10px] border border-[#FECACA] bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FEF2F2]">
                      <TableHead className="w-20">Baris</TableHead>
                      <TableHead className="w-32">{idLabel}</TableHead>
                      <TableHead>Alasan Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedErrors.map((err, idx) => (
                      <TableRow key={`${err.rowNumber}-${err.voterIdentity}-${idx}`}>
                        <TableCell className="font-mono text-xs tabular-nums text-[#64748B]">
                          #{err.rowNumber}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums font-semibold">
                          {err.voterIdentity || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-[#DC2626]">
                          {err.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            {importResult ? "Tutup" : "Batal"}
          </Button>
          {!importResult && (
            <Button
              type="button"
              onClick={handleSubmitImport}
              disabled={parsedRows.length === 0 || importMutation.isPending}
            >
              {importMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>
                Import {parsedRows.length > 0 ? `${parsedRows.length} Pemilih` : "DPT"}
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
