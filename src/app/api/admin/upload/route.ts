import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/admin-auth";
import { put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "NO_FILE", message: "File gambar tidak ditemukan." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_FILE_TYPE",
          message: "Format file harus JPEG, PNG, atau WebP.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "FILE_TOO_LARGE",
          message: "Ukuran file maksimal adalah 2 MB.",
        },
        { status: 400 }
      );
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const isRealBlobToken =
      blobToken &&
      !blobToken.includes("dummy") &&
      !blobToken.includes("local_development");

    const ext = file.name.split(".").pop() || "png";
    const uniqueFilename = `candidate-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

    // A. Produksi dengan Vercel Blob
    if (isRealBlobToken) {
      const blob = await put(`candidates/${uniqueFilename}`, file, {
        access: "public",
        token: blobToken,
      });

      return NextResponse.json({
        success: true,
        url: blob.url,
      });
    }

    // B. Development / Local Fallback (simpan ke public/uploads/candidates)
    const uploadDir = path.join(process.cwd(), "public", "uploads", "candidates");
    await fs.mkdir(uploadDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filePath = path.join(uploadDir, uniqueFilename);

    await fs.writeFile(filePath, buffer);

    const localUrl = `/uploads/candidates/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      url: localUrl,
    });
  } catch (error) {
    console.error("[Upload Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal mengunggah foto kandidat." },
      { status: 500 }
    );
  }
}
