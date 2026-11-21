import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createRotatedCanvas,
  type PixelCrop,
} from "@/lib/media/crop-image";

describe("Crop Image Utility Unit Tests", () => {
  const originalDocument = (globalThis as unknown as { document?: unknown }).document;

  afterEach(() => {
    if (originalDocument) {
      (globalThis as unknown as { document?: unknown }).document = originalDocument;
    } else {
      delete (globalThis as unknown as { document?: unknown }).document;
    }
  });

  describe("createRotatedCanvas", () => {
    it("menghitung dimensi kanvas yang benar saat rotasi 0 derajat", () => {
      const fakeImage = {
        naturalWidth: 800,
        naturalHeight: 600,
      } as unknown as HTMLImageElement;

      const mockCtx = {
        translate: vi.fn(),
        rotate: vi.fn(),
        drawImage: vi.fn(),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
      };

      (globalThis as unknown as { document?: unknown }).document = {
        createElement: vi.fn().mockImplementation((tagName: string) => {
          if (tagName === "canvas") {
            return {
              width: 0,
              height: 0,
              getContext: vi.fn().mockReturnValue(mockCtx),
            };
          }
          return {};
        }),
      };

      const canvas = createRotatedCanvas(fakeImage, 0);
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(fakeImage, -400, -300, 800, 600);
    });

    it("menukar dimensi kanvas saat diputar 90 derajat", () => {
      const fakeImage = {
        naturalWidth: 800,
        naturalHeight: 600,
      } as unknown as HTMLImageElement;

      const mockCtx = {
        translate: vi.fn(),
        rotate: vi.fn(),
        drawImage: vi.fn(),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
      };

      (globalThis as unknown as { document?: unknown }).document = {
        createElement: vi.fn().mockImplementation((tagName: string) => {
          if (tagName === "canvas") {
            return {
              width: 0,
              height: 0,
              getContext: vi.fn().mockReturnValue(mockCtx),
            };
          }
          return {};
        }),
      };

      const canvas = createRotatedCanvas(fakeImage, 90);
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(800);
    });
  });

  describe("PixelCrop interface validation", () => {
    it("dapat menyimpan nilai x, y, width, height dengan valid", () => {
      const crop: PixelCrop = {
        x: 10,
        y: 20,
        width: 400,
        height: 400,
      };
      expect(crop.width).toBe(400);
      expect(crop.height).toBe(400);
      expect(crop.x).toBe(10);
      expect(crop.y).toBe(20);
    });
  });
});
