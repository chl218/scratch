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
  /** Set when stored with { clean: true }: the original with metadata removed. */
  cleanKey?: string;
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
export async function storeImage(
  file: File,
  prefix: string,
  opts: { clean?: boolean } = {},
): Promise<StoredImage> {
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

  let cleanKey: string | undefined;
  if (opts.clean) {
    cleanKey = `${prefix}/clean.${ext}`;
    await storage.save(cleanKey, await removeMetadata(data, mime));
  }

  return { filename, mime, ...keys, cleanKey, width, height, size: data.length };
}

// ---------- Metadata removal (SPEC F1: nothing a client receives carries EXIF/GPS/XMP) ----------

/**
 * Returns the image with EXIF, GPS, XMP, IPTC and comments removed, keeping the
 * colour profile. JPEG and PNG are cleaned without re-encoding when possible.
 * (Previews and thumbnails need nothing: sharp drops metadata by default.)
 */
export async function removeMetadata(data: Buffer, mime: string): Promise<Buffer> {
  if (mime === "image/jpeg") {
    const { orientation } = await sharp(data).metadata();
    // EXIF orientation lives in the metadata we drop, so a rotated photo has to be re-encoded upright.
    if (orientation && orientation > 1) {
      return sharp(data).rotate().keepIccProfile().jpeg({ quality: 95 }).toBuffer();
    }
    return stripJpeg(data);
  }
  if (mime === "image/png") return stripPng(data);
  const img = sharp(data).rotate().keepIccProfile();
  if (mime === "image/webp") return img.webp({ quality: 95 }).toBuffer();
  if (mime === "image/avif") return img.avif({ quality: 80 }).toBuffer();
  return img.jpeg({ quality: 95 }).toBuffer();
}

/** Drops APP1 (EXIF/XMP), APP3–APP15 (IPTC etc.) and COM segments; keeps JFIF, ICC (APP2) and Adobe (APP14). */
function stripJpeg(data: Buffer): Buffer {
  if (data[0] !== 0xff || data[1] !== 0xd8) return data;
  const out: Buffer[] = [data.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= data.length) {
    if (data[i] !== 0xff) return data; // unexpected layout: leave untouched rather than corrupt it
    const marker = data[i + 1];
    if (marker === 0xda) {
      out.push(data.subarray(i)); // start of scan: the rest is image data
      return Buffer.concat(out);
    }
    const len = data.readUInt16BE(i + 2);
    const segment = data.subarray(i, i + 2 + len);
    const isApp = marker >= 0xe1 && marker <= 0xef;
    const keep = !(isApp && marker !== 0xe2 && marker !== 0xee) && marker !== 0xfe;
    if (keep) out.push(segment);
    i += 2 + len;
  }
  return data;
}

/** Drops text, time and EXIF chunks from a PNG. */
function stripPng(data: Buffer): Buffer {
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const out: Buffer[] = [data.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= data.length) {
    const len = data.readUInt32BE(i);
    const type = data.toString("latin1", i + 4, i + 8);
    const end = i + 12 + len;
    if (!drop.has(type)) out.push(data.subarray(i, end));
    i = end;
  }
  return Buffer.concat(out);
}

/** A shoot photo's clean original, creating it for photos uploaded before v0.6. */
export async function cleanOriginalKey(row: {
  originalKey: string;
  cleanKey: string | null;
  mime: string;
}): Promise<{ key: string; created: boolean }> {
  if (row.cleanKey) return { key: row.cleanKey, created: false };
  const key = row.originalKey.replace(/original(\.\w+)$/, "clean$1");
  await storage.save(key, await removeMetadata(await storage.get(row.originalKey), row.mime));
  return { key, created: true };
}

/** A square team portrait (F14). */
export async function storeTeamPhoto(file: File, key: string): Promise<void> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`${file.name} is larger than 50 MB.`);
  const data = Buffer.from(await file.arrayBuffer());
  const type = await fileTypeFromBuffer(data);
  if (!type || !(type.mime in ALLOWED) || type.mime === "image/heic" || type.mime === "image/heif") {
    throw new UploadError("Use a JPEG, PNG, WebP or AVIF photo.");
  }
  const out = await sharp(data).rotate().resize(900, 900, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  await storage.save(key, out);
}
