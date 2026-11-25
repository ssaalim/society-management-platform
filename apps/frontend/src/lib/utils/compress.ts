/**
 * Shrinks files in the browser before they are uploaded, so phone photos (often 3–8 MB) fit the storage limits
 * and stay cheap to store and fast to load.
 *
 * - Images (JPEG, PNG, WebP; HEIC where the browser can decode it) are scaled down to at most `maxDimension` on the
 *   longest side and re-encoded as WebP (JPEG if the browser can't write WebP), lowering quality until they fit.
 * - PDFs cannot be recompressed in the browser; they are only checked against the limit with a clear message.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB, matches the server limit for images
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB, matches the server limit for documents

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export interface PrepareOptions {
  /** Largest allowed size after compression. */
  maxBytes?: number;
  /** Longest side in pixels. */
  maxDimension?: number;
}

export interface PreparedFile {
  file: File;
  originalBytes: number;
  finalBytes: number;
  compressed: boolean;
}

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImage(file: File, maxBytes: number, maxDimension: number): Promise<File> {
  const source = await decodeImage(file);
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;

  // Try progressively smaller sizes and qualities until the result fits.
  const attempts: { dim: number; quality: number }[] = [
    { dim: maxDimension, quality: 0.8 },
    { dim: maxDimension, quality: 0.65 },
    { dim: Math.round(maxDimension * 0.75), quality: 0.65 },
    { dim: Math.round(maxDimension * 0.6), quality: 0.55 },
    { dim: Math.round(maxDimension * 0.45), quality: 0.5 },
  ];

  let best: Blob | null = null;
  for (const { dim, quality } of attempts) {
    const scale = Math.min(1, dim / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);

    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!blob) break;
    best = blob;
    if (blob.size <= maxBytes) break;
  }
  if ('close' in source && typeof source.close === 'function') source.close();

  if (!best) throw new Error('This image could not be processed. Try a JPEG or PNG file.');
  const ext = best.type === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([best], `${baseName}.${ext}`, { type: best.type, lastModified: Date.now() });
}

/** Returns a file that is safe to upload: compressed if it's an image, size-checked otherwise. */
export async function prepareFileForUpload(file: File, options: PrepareOptions = {}): Promise<PreparedFile> {
  const isImage = IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  const maxBytes = options.maxBytes ?? (isImage ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES);
  const maxDimension = options.maxDimension ?? 1600;

  if (isImage) {
    // Small, already-web-friendly images are left untouched.
    const webFriendly = ['image/jpeg', 'image/webp'].includes(file.type);
    if (webFriendly && file.size <= Math.min(maxBytes, 400 * 1024)) {
      return { file, originalBytes: file.size, finalBytes: file.size, compressed: false };
    }
    const compressed = await compressImage(file, maxBytes, maxDimension);
    const result = compressed.size < file.size || file.size > maxBytes ? compressed : file;
    if (result.size > maxBytes) {
      throw new Error(`This image is still ${mb(result.size)} after compression; the limit is ${mb(maxBytes)}. Try a smaller photo.`);
    }
    return { file: result, originalBytes: file.size, finalBytes: result.size, compressed: result !== file };
  }

  if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    throw new Error('Only images (JPEG, PNG, WebP) and PDF files can be uploaded.');
  }
  if (file.size > maxBytes) {
    throw new Error(`This PDF is ${mb(file.size)}; the limit is ${mb(maxBytes)}. Reduce it (for example with a "compress PDF" tool or by scanning at lower quality) and try again.`);
  }
  return { file, originalBytes: file.size, finalBytes: file.size, compressed: false };
}

/** Human summary such as "Compressed 4.2 MB → 310 KB." for upload messages. */
export function compressionNote(p: PreparedFile): string {
  if (!p.compressed) return '';
  const fmt = (b: number) => (b >= 1024 * 1024 ? mb(b) : `${Math.round(b / 1024)} KB`);
  return ` Compressed ${fmt(p.originalBytes)} → ${fmt(p.finalBytes)}.`;
}
