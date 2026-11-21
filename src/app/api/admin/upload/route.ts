import { NextRequest } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { insertAuditLog } from "@/lib/audit";
import {
  checkAdminUploadRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

interface DetectedImageType {
  ext: "jpg" | "png" | "webp";
  mime: string;
}

function detectImageMagicBytes(buffer: Buffer): DetectedImageType | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: "png", mime: "image/png" };
  }

  // WebP: RIFF ... WEBP
  const riffHeader = buffer.subarray(0, 4).toString("ascii");
  const webpHeader = buffer.subarray(8, 12).toString("ascii");
  if (riffHeader === "RIFF" && webpHeader === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rateLimit = checkAdminUploadRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        10,
        `Terlalu banyak permintaan unggah foto kandidat. Silakan tunggu ${rateLimit.retryAfterSeconds} detik.`
      );
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload formulir tidak valid.",
        400
      );
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "File gambar wajib diunggah.",
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Ukuran file melebihi batas maksimal 2 MB.",
        400
      );
    }

    const electionRef = formData.get("electionId");
    const election = await resolveTargetElection(
      typeof electionRef === "string" ? electionRef : undefined
    );
    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data pemilihan tidak ditemukan.",
        404
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const detected = detectImageMagicBytes(buffer);
    if (!detected) {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Format gambar tidak valid. Hanya JPG, PNG, dan WebP yang diizinkan.",
        400
      );
    }

    const uniqueId = crypto.randomUUID();
    const filename = `${uniqueId}.${detected.ext}`;
    const storagePath = `candidates/${election.id}/${filename}`;

    let uploadedUrl: string | undefined;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(storagePath, buffer, {
          access: "public",
          contentType: detected.mime,
        });
        uploadedUrl = blob.url;
      } catch (blobError) {
        if (process.env.NODE_ENV === "production") {
          throw blobError;
        }
        // In non-production, fall through to local filesystem fallback
      }
    }

    if (!uploadedUrl) {
      if (process.env.NODE_ENV === "production") {
        return formatErrorResponse(
          "SERVICE_UNAVAILABLE",
          "Konfigurasi penyimpanan Vercel Blob belum disetel.",
          503
        );
      }

      // Non-production local fallback
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "candidates",
        election.id
      );
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
      uploadedUrl = `/uploads/candidates/${election.id}/${filename}`;
    }

    await insertAuditLog({
      electionId: election.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "photo_uploaded",
      actionTitle: "Foto kandidat diunggah",
      description: `Mengunggah foto kandidat: ${filename}`,
      ipAddress: extractClientIp(request),
    });

    return formatSuccessResponse({ url: uploadedUrl }, undefined, 201);
  } catch (error) {
    console.error("Upload route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat mengunggah foto.",
      500
    );
  }
}
