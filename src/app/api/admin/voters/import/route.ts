import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  parseDptBuffer,
  hasCsvFormulaPrefix,
  type ImportVoterRowInput,
  type ImportRowError,
} from "@/lib/importers/dpt-parser";
import { executeBulkImportTransaction } from "@/lib/importers/dpt-import-tx";
import {
  checkAdminImportRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function extractClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "::1";
}

const importVoterRowSchema = z.object({
  voterIdentity: z
    .string()
    .trim()
    .min(1, "NIS wajib diisi")
    .max(50, "NIS maksimal 50 karakter")
    .refine(
      (val) => !hasCsvFormulaPrefix(val),
      "Karakter awal tidak diizinkan (CSV Formula Injection protection)"
    ),
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter")
    .refine(
      (val) => !hasCsvFormulaPrefix(val),
      "Karakter awal tidak diizinkan (CSV Formula Injection protection)"
    ),
  groupName: z
    .string()
    .trim()
    .min(1, "Nama Rombel/Kelas wajib diisi")
    .max(60, "Nama Rombel maksimal 60 karakter")
    .refine(
      (val) => !hasCsvFormulaPrefix(val),
      "Karakter awal tidak diizinkan (CSV Formula Injection protection)"
    ),
  gradeName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .refine(
      (val) => !val || !hasCsvFormulaPrefix(val),
      "Karakter awal tidak diizinkan (CSV Formula Injection protection)"
    ),
  majorName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .refine(
      (val) => !val || !hasCsvFormulaPrefix(val),
      "Karakter awal tidak diizinkan (CSV Formula Injection protection)"
    ),
});

const bulkImportJsonSchema = z.object({
  electionId: z.string().trim().optional(),
  autoCreateGroups: z.boolean().default(true),
  rows: z
    .array(importVoterRowSchema)
    .min(1, "Data pemilih tidak boleh kosong")
    .max(5000, "Maksimal 5.000 baris per import"),
});

export async function POST(req: NextRequest) {
  // 1. Guard with admin session (committee or super_admin)
  const { session, errorResponse } = await requireAdminApiSession([
    "committee",
    "super_admin",
  ]);

  if (errorResponse) {
    return errorResponse;
  }

  const rateLimit = checkAdminImportRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit,
      3,
      `Terlalu banyak permintaan impor DPT. Silakan tunggu ${rateLimit.retryAfterSeconds} detik.`
    );
  }

  const clientIp = extractClientIp(req);
  const contentType = req.headers.get("content-type") || "";

  try {
    let electionId: string = "active";
    let autoCreateGroups = true;
    let validRows: ImportVoterRowInput[] = [];
    const preliminaryFailures: ImportRowError[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "BAD_REQUEST",
              message: "File spreadsheet (.csv / .xlsx) wajib diunggah.",
            },
          },
          { status: 400 }
        );
      }

      const formElectionId = formData.get("electionId");
      if (typeof formElectionId === "string" && formElectionId.trim()) {
        electionId = formElectionId.trim();
      }

      const formAutoCreate = formData.get("autoCreateGroups");
      if (formAutoCreate !== null) {
        autoCreateGroups = formAutoCreate === "true" || formAutoCreate === "1";
      }

      const blob = file as Blob;
      const filename = (file as { name?: string }).name || "import.xlsx";
      const buffer = await blob.arrayBuffer();

      const parseResult = await parseDptBuffer(buffer, filename);
      validRows = parseResult.validRows;
      preliminaryFailures.push(...parseResult.localErrors);
    } else {
      // JSON body from UI or automated calls
      const json = await req.json().catch(() => null);
      if (!json) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "BAD_REQUEST",
              message: "Format request tidak valid.",
            },
          },
          { status: 400 }
        );
      }

      const parsed = bulkImportJsonSchema.safeParse(json);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || "Validasi gagal";
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: firstError,
            },
          },
          { status: 400 }
        );
      }

      if (parsed.data.electionId) {
        electionId = parsed.data.electionId;
      }
      autoCreateGroups = parsed.data.autoCreateGroups;
      validRows = parsed.data.rows;
    }

    if (validRows.length === 0 && preliminaryFailures.length > 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            totalProcessed: preliminaryFailures.length,
            insertedCount: 0,
            failedCount: preliminaryFailures.length,
            failures: preliminaryFailures,
          },
        },
        { status: 200 }
      );
    }

    // 2. Execute transactional batch import
    const importResult = await executeBulkImportTransaction({
      electionId,
      rows: validRows,
      autoCreateGroups,
      actor: {
        id: session.user.id,
        name: session.user.name,
        identity: session.user.username || session.user.email,
        ipAddress: clientIp,
      },
    });

    // Merge any preliminary file-level parsing errors
    const combinedFailures = [...preliminaryFailures, ...importResult.failures];
    const finalResult = {
      totalProcessed: importResult.totalProcessed + preliminaryFailures.length,
      insertedCount: importResult.insertedCount,
      failedCount: combinedFailures.length,
      failures: combinedFailures,
    };

    // 3. Cache revalidation
    try {
      revalidateTag("election-dashboard");
      revalidateTag(`election-dashboard:${electionId}`);
      revalidateTag("election-results");
      revalidateTag(`election-results:${electionId}`);
      revalidateTag(electionId);
      revalidatePath("/admin/dashboard");
      revalidatePath("/admin/results");
      revalidatePath("/admin/voters");
    } catch {
      // In non-Next server environments, revalidation can safely be skipped
    }

    return NextResponse.json(
      {
        success: true,
        data: finalResult,
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat mengimpor DPT.";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
