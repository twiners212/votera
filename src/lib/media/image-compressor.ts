export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  preferredMimeType?: "image/webp" | "image/jpeg";
}

export interface CompressResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

export const MAX_RAW_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB batas input mentah
export const MAX_UPLOAD_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB batas backend
export const DEFAULT_MAX_DIMENSION = 1200;
export const DEFAULT_QUALITY = 0.85;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Menghitung dimensi target dengan mempertahankan rasio aspek gambar.
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth = DEFAULT_MAX_DIMENSION,
  maxHeight = DEFAULT_MAX_DIMENSION
): { width: number; height: number } {
  if (origWidth <= 0 || origHeight <= 0) {
    return {
      width: Math.max(1, Math.round(origWidth)),
      height: Math.max(1, Math.round(origHeight)),
    };
  }

  if (origWidth <= maxWidth && origHeight <= maxHeight) {
    return {
      width: Math.round(origWidth),
      height: Math.round(origHeight),
    };
  }

  const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight);
  return {
    width: Math.max(1, Math.round(origWidth * ratio)),
    height: Math.max(1, Math.round(origHeight * ratio)),
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca file gambar."));
    };
    img.src = url;
  });
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

        // Jika WebP tidak didukung untuk export canvas, fallback ke JPEG
        if (mimeType !== "image/jpeg") {
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) {
                resolve(fallbackBlob);
              } else {
                reject(new Error("Gagal mengekspor gambar dari canvas."));
              }
            },
            "image/jpeg",
            quality
          );
        } else {
          reject(new Error("Gagal mengekspor gambar dari canvas."));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Mengompresi dan me-resize foto kandidat di sisi browser menggunakan HTML5 Canvas.
 * Menghasilkan File baru dengan format WebP/JPEG berukuran <= 2MB yang siap diunggah.
 */
export async function compressCandidatePhoto(
  file: File,
  options?: CompressOptions
): Promise<CompressResult> {
  if (file.size > MAX_RAW_PHOTO_BYTES) {
    throw new Error(
      `Ukuran file terlalu besar (${formatFileSize(file.size)}). Maksimal ${formatFileSize(MAX_RAW_PHOTO_BYTES)}.`
    );
  }

  // Safety fallback untuk lingkungan non-browser (misal saat SSR)
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      file,
      originalBytes: file.size,
      compressedBytes: file.size,
      width: 0,
      height: 0,
      wasCompressed: false,
    };
  }

  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_DIMENSION;
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_QUALITY;
  const preferredMime = options?.preferredMimeType ?? "image/webp";

  let imgWidth = 0;
  let imgHeight = 0;
  let source: CanvasImageSource | null = null;
  let cleanup: (() => void) | undefined;

  // Gunakan createImageBitmap jika tersedia (lebih cepat dan hemat memori), fallback ke Image
  if (typeof window.createImageBitmap === "function") {
    try {
      const bitmap = await window.createImageBitmap(file);
      imgWidth = bitmap.width;
      imgHeight = bitmap.height;
      source = bitmap;
      cleanup = () => bitmap.close();
    } catch {
      // Fallback ke elemen Image biasa jika createImageBitmap gagal
      const img = await loadImageElement(file);
      imgWidth = img.naturalWidth || img.width;
      imgHeight = img.naturalHeight || img.height;
      source = img;
    }
  } else {
    const img = await loadImageElement(file);
    imgWidth = img.naturalWidth || img.width;
    imgHeight = img.naturalHeight || img.height;
    source = img;
  }

  // Jika file sudah kecil (<= 250 KB) dan dimensinya sudah <= batas maksimum,
  // tidak perlu kompresi ulang agar menghindari penurunan kualitas gambar yang tidak perlu
  if (
    imgWidth <= maxWidth &&
    imgHeight <= maxHeight &&
    file.size <= 250 * 1024
  ) {
    if (cleanup) cleanup();
    return {
      file,
      originalBytes: file.size,
      compressedBytes: file.size,
      width: imgWidth,
      height: imgHeight,
      wasCompressed: false,
    };
  }

  const targetDim = calculateTargetDimensions(
    imgWidth,
    imgHeight,
    maxWidth,
    maxHeight
  );

  const canvas = document.createElement("canvas");
  canvas.width = targetDim.width;
  canvas.height = targetDim.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    if (cleanup) cleanup();
    // Jika canvas tidak tersedia namun file asli sudah <= 2MB, gunakan file asli
    if (file.size <= MAX_UPLOAD_PHOTO_BYTES) {
      return {
        file,
        originalBytes: file.size,
        compressedBytes: file.size,
        width: imgWidth,
        height: imgHeight,
        wasCompressed: false,
      };
    }
    throw new Error("Gagal menginisialisasi canvas untuk kompresi gambar.");
  }

  // Gunakan smoothing berkualitas tinggi
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, targetDim.width, targetDim.height);

  if (cleanup) cleanup();

  const blob = await canvasToBlob(canvas, preferredMime, quality);

  // Jika hasil kompresi ternyata lebih besar dari file asli (misal SVG/PNG kecil ber-lossy)
  // dan file asli sudah <= 2MB, pertahankan file asli
  if (blob.size >= file.size && file.size <= MAX_UPLOAD_PHOTO_BYTES) {
    return {
      file,
      originalBytes: file.size,
      compressedBytes: file.size,
      width: imgWidth,
      height: imgHeight,
      wasCompressed: false,
    };
  }

  const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-]/g, "_");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const compressedName = `${baseName || "photo"}.${ext}`;

  const compressedFile = new File([blob], compressedName, {
    type: blob.type,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    originalBytes: file.size,
    compressedBytes: compressedFile.size,
    width: targetDim.width,
    height: targetDim.height,
    wasCompressed: true,
  };
}
