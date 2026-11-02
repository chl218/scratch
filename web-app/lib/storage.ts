import "server-only";
import path from "node:path";
import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";

// All photo file access goes through this module, so local disk can be swapped
// for cloud storage later without touching the rest of the app.
// Keys look like "library/<photoId>/preview.webp".
//
// The /*turbopackIgnore*/ comments tell the bundler these are runtime data
// paths, not source files to bundle.

const ROOT = path.resolve(
  /*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
);

function resolveKey(key: string): string {
  const full = path.resolve(/*turbopackIgnore: true*/ ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function save(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ full, data);
}

export async function get(key: string): Promise<Buffer> {
  return readFile(/*turbopackIgnore: true*/ resolveKey(key));
}

export async function getStream(key: string): Promise<{ stream: Readable; size: number }> {
  const full = resolveKey(key);
  const { size } = await stat(/*turbopackIgnore: true*/ full);
  return { stream: createReadStream(/*turbopackIgnore: true*/ full), size };
}

/** Removes a key, or a whole folder when given a prefix like "library/<id>". */
export async function remove(keyOrPrefix: string): Promise<void> {
  await rm(/*turbopackIgnore: true*/ resolveKey(keyOrPrefix), { recursive: true, force: true });
}
