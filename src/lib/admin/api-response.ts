import { NextResponse } from "next/server";
import { type ZodError } from "zod";
import type { PaginationMeta } from "@/types/votera";

export function formatSuccessResponse<T>(
  data: T,
  meta?: PaginationMeta,
  status = 200,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta ? { meta } : {}),
    },
    {
      status,
      headers,
    }
  );
}

export function formatErrorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

export function formatZodErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data input tidak valid. Periksa kembali form yang diisi.",
        details: error.flatten().fieldErrors,
      },
    },
    { status: 400 }
  );
}

export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);
    if (firstIp) {
      return firstIp.slice(0, 64);
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 64);
  }

  return "::1";
}
