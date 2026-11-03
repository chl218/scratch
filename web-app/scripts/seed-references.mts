// Loads Reference Pictures listed in a manifest into the library (SPEC F1).
//
//   npm run seed:references                      # uses seed/references.json
//   npm run seed:references -- path/to/file.json
//
// Each picture goes through the same checks and processing as an upload
// (type check, HEIC conversion, preview + thumbnail). Pictures already in the
// library (same file name and credit) are skipped, so it is safe to run twice.
// With PGlite (no DATABASE_URL), stop `npm run dev` first: only one process can open it.

import path from "node:path";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../lib/db";
import { storeImage } from "../lib/images";
import { setPhotoTags } from "../lib/data";
import { parseTags } from "../lib/shared";
import * as storage from "../lib/storage";

type Manifest = {
  sourceDir: string;
  items: { file: string; title: string; tags: string[]; credit?: string; sourceUrl?: string }[];
};

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: use the defaults (PGlite in .data/).
}

const manifestPath = process.argv[2] ?? "seed/references.json";
const manifest: Manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const db = await getDb();
let added = 0;
let skipped = 0;

for (const item of manifest.items) {
  const filename = path.basename(item.file);
  const credit = item.credit ?? "";
  const [existing] = await db
    .select({ id: schema.photos.id })
    .from(schema.photos)
    .where(and(eq(schema.photos.filename, filename), eq(schema.photos.credit, credit)));
  if (existing) {
    skipped++;
    continue;
  }
  const data = await readFile(path.join(manifest.sourceDir, item.file));
  const file = new File([new Uint8Array(data)], filename);
  const photoId = randomUUID();
  try {
    const stored = await storeImage(file, `library/${photoId}`);
    await db.insert(schema.photos).values({
      id: photoId,
      title: item.title,
      credit,
      sourceUrl: item.sourceUrl ?? "",
      ...stored,
    });
    await setPhotoTags(photoId, parseTags(item.tags.join(" ")));
    added++;
    console.log(`added  ${item.title}`);
  } catch (err) {
    await storage.remove(`library/${photoId}`);
    console.error(`failed ${item.file}: ${(err as Error).message}`);
  }
}

console.log(`\n${added} added, ${skipped} already in the library.`);
process.exit(0);
