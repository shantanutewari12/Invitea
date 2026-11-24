import { UPLOAD_LIMITS } from "@/config/plans";

/** Scale (never up) so the longer edge is at most `max`. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/** Browser only: decode, downscale to <=1600px and re-encode as WebP (EXIF rotation applied). */
export async function resizeToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, UPLOAD_LIMITS.imageMaxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.82, 0.65, 0.5]) {
    const blob = await toBlob(canvas, quality);
    if (!blob || blob.type !== "image/webp") throw new Error("WebP encoding is not supported");
    if (blob.size <= UPLOAD_LIMITS.imageMaxBytes) return blob;
  }
  throw new Error("Image is too large even after compression");
}
