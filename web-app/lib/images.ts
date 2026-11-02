import "server-only";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import * as storage from "./storage";

// Sized for a 30.4 MP full-frame sensor (6720 × 4480). See SPEC.md F1.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const THUMB_EDGE = 400;
const PREVIEW_EDGE = 2000;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export class UploadError extends Error {}

export type StoredImage = {
  filename: string;
  mime: string;
  originalKey: string;
  previewKey: string;
  thumbKey: string;
  width: number;
  height: number;
  size: number;
};

/**
 * Validates an uploaded photo, stores the original plus a preview and a
 * thumbnail under `prefix`, and returns what was stored.
 */
export async function storeImage(file: File, prefix: string): Promise<StoredImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`${file.name} is larger than 50 MB.`);
  }
  let data: Buffer = Buffer.from(await file.arrayBuffer());

  // Check the real file type from its contents, not the extension.
  const type = await fileTypeFromBuffer(data);
  if (!type || !(type.mime in ALLOWED)) {
    throw new UploadError(
      `${file.name} isn't a supported photo. Use JPEG, PNG, WebP, AVIF or HEIC (RAW files aren't accepted).`,
    );
  }

  let mime = type.mime;
  let ext = ALLOWED[mime];
  let filename = file.name || `photo.${ext}`;

  // Browsers can't show HEIC, so convert it to JPEG and keep that as the original.
  if (mime === "image/heic" || mime === "image/heif") {
    const { default: convert } = await import("heic-convert");
    data = Buffer.from(await convert({ buffer: data, format: "JPEG", quality: 0.92 }));
    mime = "image/jpeg";
    ext = "jpg";
    filename = filename.replace(/\.(heic|heif)$/i, "") + ".jpg";
  }

  let width: number;
  let height: number;
  let preview: Buffer;
  let thumb: Buffer;
  try {
    const meta = await sharp(data).rotate().metadata();
    // EXIF orientation 5–8 means the image is stored rotated 90°.
    const rotated = (meta.orientation ?? 1) >= 5;
    width = (rotated ? meta.height : meta.width) ?? 0;
    height = (rotated ? meta.width : meta.height) ?? 0;
    preview = await sharp(data)
      .rotate()
      .resize(PREVIEW_EDGE, PREVIEW_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    thumb = await sharp(data)
      .rotate()
      .resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    throw new UploadError(`${file.name} couldn't be read as an image.`);
  }

  const keys = {
    originalKey: `${prefix}/original.${ext}`,
    previewKey: `${prefix}/preview.webp`,
    thumbKey: `${prefix}/thumb.webp`,
  };
  await storage.save(keys.originalKey, data);
  await storage.save(keys.previewKey, preview);
  await storage.save(keys.thumbKey, thumb);

  return { filename, mime, ...keys, width, height, size: data.length };
}
