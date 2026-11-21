import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateTargetDimensions,
  formatFileSize,
  compressCandidatePhoto,
  MAX_RAW_PHOTO_BYTES,
  MAX_UPLOAD_PHOTO_BYTES,
  DEFAULT_MAX_DIMENSION,
} from "@/lib/media/image-compressor";

describe("Image Compressor Unit Tests", () => {
  describe("calculateTargetDimensions", () => {
    it("mempertahankan dimensi jika gambar sudah di bawah batas maksimum", () => {
      const result = calculateTargetDimensions(800, 600, 1200, 1200);
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it("me-resize gambar lanskap beresolusi tinggi dengan rasio proporsional", () => {
      // 2400 x 1200 -> batas 1200 x 1200 -> width 1200, height 600
      const result = calculateTargetDimensions(2400, 1200, 1200, 1200);
      expect(result).toEqual({ width: 1200, height: 600 });
    });

    it("me-resize foto potret tinggi (aspect 3:4 atau 9:16) secara proporsional", () => {
      // 1800 x 2400 -> batas 1200 x 1200 -> height 1200, width 900
      const result = calculateTargetDimensions(1800, 2400, 1200, 1200);
      expect(result).toEqual({ width: 900, height: 1200 });
    });

    it("me-resize foto persegi resolusi tinggi (4000x4000) menjadi tepat batas maksimum", () => {
      const result = calculateTargetDimensions(4000, 4000, 1200, 1200);
      expect(result).toEqual({ width: 1200, height: 1200 });
    });

    it("menangani nilai dimensi 0 atau negatif secara aman tanpa crash", () => {
      const result = calculateTargetDimensions(0, -10, 1200, 1200);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe("formatFileSize", () => {
    it("memformat byte, kilobyte, dan megabyte dengan benar", () => {
      expect(formatFileSize(500)).toBe("500 B");
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(250 * 1024)).toBe("250 KB");
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
      expect(formatFileSize(3.45 * 1024 * 1024)).toBe("3.5 MB");
      expect(formatFileSize(MAX_RAW_PHOTO_BYTES)).toBe("10.0 MB");
      expect(formatFileSize(MAX_UPLOAD_PHOTO_BYTES)).toBe("2.0 MB");
    });
  });

  describe("compressCandidatePhoto validation & processing", () => {
    it("menolak file jika ukuran mentah melebihi batas maksimal 10 MB", async () => {
      // Buat file tiruan > 10 MB
      const oversizedFile = new File(["x".repeat(100)], "large.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(oversizedFile, "size", {
        value: 11 * 1024 * 1024,
      });

      await expect(compressCandidatePhoto(oversizedFile)).rejects.toThrow(
        /Ukuran file terlalu besar/
      );
    });

    it("mengembalikan file asli secara aman jika dijalankan di lingkungan non-browser (SSR/Node)", async () => {
      delete (globalThis as unknown as { window?: unknown }).window;
      delete (globalThis as unknown as { document?: unknown }).document;

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      const result = await compressCandidatePhoto(file);
      expect(result.wasCompressed).toBe(false);
      expect(result.file).toBe(file);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it("mengembalikan file asli tanpa kompresi jika ukuran sudah kecil (<= 250KB) dan dimensi <= 1200px", async () => {
      const smallFile = new File(["dummy-image-bytes"], "small.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(smallFile, "size", { value: 120 * 1024 });

      // Mock window & document di globalThis untuk lingkungan Node
      (globalThis as unknown as { window?: unknown }).window = {
        createImageBitmap: vi.fn().mockResolvedValue({
          width: 800,
          height: 1000,
          close: vi.fn(),
        }),
      };
      (globalThis as unknown as { document?: unknown }).document = {
        createElement: vi.fn(),
      };

      try {
        const result = await compressCandidatePhoto(smallFile);
        expect(result.wasCompressed).toBe(false);
        expect(result.file).toBe(smallFile);
        expect(result.originalBytes).toBe(120 * 1024);
        expect(result.width).toBe(800);
        expect(result.height).toBe(1000);
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
        delete (globalThis as unknown as { document?: unknown }).document;
      }
    });

    it("mengompresi gambar berukuran besar menjadi file baru dengan ekstensi webp", async () => {
      const largeFile = new File(["large-raw-bytes"], "kandidat-hd.png", {
        type: "image/png",
      });
      Object.defineProperty(largeFile, "size", { value: 5 * 1024 * 1024 }); // 5 MB

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "low",
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((callback: (blob: Blob | null) => void, mime: string) => {
          const compressedBlob = new Blob(["compressed-webp-bytes"], {
            type: mime || "image/webp",
          });
          Object.defineProperty(compressedBlob, "size", { value: 240 * 1024 }); // 240 KB
          callback(compressedBlob);
        }),
      };

      (globalThis as unknown as { window?: unknown }).window = {
        createImageBitmap: vi.fn().mockResolvedValue({
          width: 3000,
          height: 4000,
          close: vi.fn(),
        }),
      };
      (globalThis as unknown as { document?: unknown }).document = {
        createElement: vi.fn().mockImplementation((tagName: string) => {
          if (tagName.toLowerCase() === "canvas") {
            return mockCanvas;
          }
          return {};
        }),
      };

      try {
        const result = await compressCandidatePhoto(largeFile);
        expect(result.wasCompressed).toBe(true);
        expect(result.width).toBe(900); // 3000 x 4000 di-scale ke max 1200 -> 900 x 1200
        expect(result.height).toBe(1200);
        expect(result.originalBytes).toBe(5 * 1024 * 1024);
        expect(result.compressedBytes).toBe(240 * 1024);
        expect(result.file.name).toMatch(/\.webp$/);
        expect(result.file.type).toBe("image/webp");
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
        delete (globalThis as unknown as { document?: unknown }).document;
      }
    });
  });
});
