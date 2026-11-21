import {
  calculateTargetDimensions,
  type CompressOptions,
  type CompressResult,
  MAX_UPLOAD_PHOTO_BYTES,
} from "./image-compressor";

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropImageOptions extends CompressOptions {
  fileName?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal membaca sumber gambar untuk cropping."));
    img.src = src;
  });
}

/**
 * Membuat canvas berisi gambar yang sudah diputar sesuai derajat rotasi (0, 90, 180, 270).
 */
export function createRotatedCanvas(
  image: HTMLImageElement,
  rotationDegrees = 0
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Gagal membuat canvas 2D untuk rotasi gambar.");
  }

  const rotRad = (rotationDegrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rotRad));
  const cos = Math.abs(Math.cos(rotRad));

  const rotatedWidth = Math.round(image.naturalWidth * cos + image.naturalHeight * sin);
  const rotatedHeight = Math.round(image.naturalWidth * sin + image.naturalHeight * cos);

  canvas.width = Math.max(1, rotatedWidth);
  canvas.height = Math.max(1, rotatedHeight);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Geser ke titik pusat canvas lalu putar
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2,
    image.naturalWidth,
    image.naturalHeight
  );

  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        // Fallback jika WebP tidak didukung untuk export canvas
        if (mimeType !== "image/jpeg") {
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) {
                resolve(fallbackBlob);
              } else {
                reject(new Error("Gagal mengekspor gambar crop dari canvas."));
              }
            },
            "image/jpeg",
            quality
          );
        } else {
          reject(new Error("Gagal mengekspor gambar crop dari canvas."));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Memotong (crop) dan mengompresi gambar dari source URL (Blob URL atau data URL)
 * berdasarkan koordinat pixel dari cropper dan sudut rotasi.
 */
export async function cropAndCompressImage(
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotationDegrees = 0,
  rawFileBytes = 0,
  options?: CropImageOptions
): Promise<CompressResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Operasi cropping hanya dapat dijalankan di browser.");
  }

  const image = await loadImage(imageSrc);
  const rotatedCanvas = createRotatedCanvas(image, rotationDegrees);

  // Pastikan crop width dan height valid
  const safeCropWidth = Math.max(1, Math.round(pixelCrop.width));
  const safeCropHeight = Math.max(1, Math.round(pixelCrop.height));

  const maxWidth = options?.maxWidth ?? 1200;
  const maxHeight = options?.maxHeight ?? 1200;
  const quality = options?.quality ?? 0.85;
  const preferredMime = options?.preferredMimeType ?? "image/webp";

  const targetDim = calculateTargetDimensions(
    safeCropWidth,
    safeCropHeight,
    maxWidth,
    maxHeight
  );

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = targetDim.width;
  croppedCanvas.height = targetDim.height;
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Gagal membuat canvas 2D untuk hasil crop.");
  }

  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = "high";

  // Gambar irisan dari rotatedCanvas ke croppedCanvas
  croppedCtx.drawImage(
    rotatedCanvas,
    Math.max(0, Math.round(pixelCrop.x)),
    Math.max(0, Math.round(pixelCrop.y)),
    safeCropWidth,
    safeCropHeight,
    0,
    0,
    targetDim.width,
    targetDim.height
  );

  let blob = await canvasToBlob(croppedCanvas, preferredMime, quality);

  // Jika ukuran blob melebihi batas maksimal upload 2MB, lakukan iterasi kompresi dengan kualitas lebih rendah
  if (blob.size > MAX_UPLOAD_PHOTO_BYTES) {
    const reducedQualities = [0.75, 0.65, 0.5];
    for (const q of reducedQualities) {
      const smallerBlob = await canvasToBlob(croppedCanvas, preferredMime, q);
      if (smallerBlob.size <= MAX_UPLOAD_PHOTO_BYTES) {
        blob = smallerBlob;
        break;
      }
    }
  }

  const baseName = (options?.fileName || "cropped-image")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const finalFileName = `${baseName || "cropped"}.${ext}`;

  const finalFile = new File([blob], finalFileName, {
    type: blob.type,
    lastModified: Date.now(),
  });

  const originalSize = rawFileBytes > 0 ? rawFileBytes : finalFile.size;

  return {
    file: finalFile,
    originalBytes: originalSize,
    compressedBytes: finalFile.size,
    width: targetDim.width,
    height: targetDim.height,
    wasCompressed: finalFile.size < originalSize || originalSize === 0,
  };
}
