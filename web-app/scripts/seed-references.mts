// Loads Reference Pictures into the library (SPEC F1). Local stubs only: the image
// files stay where they are on disk and are never added to the repo.
//
//   npm run seed:references                          # pictures listed in seed/references.json
//   npm run seed:references -- path/to/file.json     # another manifest
//   npm run seed:references -- --dir <folder>        # every image under a folder
//
// --dir understands InstaKeep's file names (<account>_<date>_<time>_<shortcode>[_n].jpg):
// the credit becomes "@account on Instagram", the source the post's URL, the title
// "@account, 9 Oct 2026", and the account is added as a tag.
//
// Each picture goes through the same checks and processing as an upload. Pictures
// already in the library (same file name) are skipped, so it is safe to run again.
// With PGlite (no DATABASE_URL), stop `npm run dev` first: only one process can open it.

import path from "node:path";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { getDb, schema } from "../lib/db";
import { storeImage } from "../lib/images";
import { setPhotoTags } from "../lib/data";
import { parseTags } from "../lib/shared";
import * as storage from "../lib/storage";

type Item = { file: string; title: string; tags: string[]; credit?: string; sourceUrl?: string };
type Manifest = { sourceDir: string; items: Item[] };

const IMAGE = /\.(jpe?g|png|webp|avif|heic|heif)$/i;
const PARALLEL = 4;

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: use the defaults (PGlite in .data/).
}

/** Reads InstaKeep's file name: account, date and the post's short code. */
function fromInstaKeepName(relative: string): Item {
  const name = path.basename(relative);
  const m = name.match(/^(.+?)_(\d{4})-(\d{2})-(\d{2})_\d{2}-\d{2}-\d{2}_(.+?)\.\w+$/);
  if (!m) return { file: relative, title: name.replace(/\.\w+$/, ""), tags: [] };
  const [, account, y, mo, d, rest] = m;
  // Carousel posts add _1, _2… after the 11-character short code.
  const code = /^.{11}_\d+$/.test(rest) ? rest.slice(0, 11) : rest;
  const date = new Date(Date.UTC(+y, +mo - 1, +d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return {
    file: relative,
    title: `@${account}, ${date}`,
    tags: [account],
    credit: `@${account} on Instagram`,
    sourceUrl: `https://www.instagram.com/p/${code}/`,
  };
}

async function scan(dir: string): Promise<Manifest> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const items = entries
    .filter((e) => e.isFile() && IMAGE.test(e.name))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
    .sort()
    .map(fromInstaKeepName);
  return { sourceDir: dir, items };
}

const dirFlag = process.argv.indexOf("--dir");
const manifest: Manifest =
  dirFlag >= 0
    ? await scan(path.resolve(process.argv[dirFlag + 1]))
    : JSON.parse(await readFile(process.argv[2] ?? "seed/references.json", "utf8"));

const db = await getDb();
const existing = new Set((await db.select({ filename: schema.photos.filename }).from(schema.photos)).map((r) => r.filename));
const todo = manifest.items.filter((item) => !existing.has(path.basename(item.file)));
let added = 0;
let failed = 0;
console.log(`${manifest.items.length} pictures found, ${manifest.items.length - todo.length} already in the library, ${todo.length} to add.`);

async function add(item: Item) {
  const filename = path.basename(item.file);
  const photoId = randomUUID();
  try {
    const data = await readFile(path.join(manifest.sourceDir, item.file));
    const stored = await storeImage(new File([new Uint8Array(data)], filename), `library/${photoId}`);
    await db.insert(schema.photos).values({
      id: photoId,
      title: item.title,
      credit: item.credit ?? "",
      sourceUrl: item.sourceUrl ?? "",
      ...stored,
    });
    await setPhotoTags(photoId, parseTags(item.tags.join(" ")));
    added++;
    if (added % 100 === 0) console.log(`${added} / ${todo.length} added`);
  } catch (err) {
    failed++;
    await storage.remove(`library/${photoId}`);
    console.error(`failed ${item.file}: ${(err as Error).message}`);
  }
}

// A few at a time: image processing is the slow part.
let next = 0;
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (next < todo.length) await add(todo[next++]);
  }),
);

console.log(`\n${added} added, ${failed} failed, ${manifest.items.length - todo.length} were already in the library.`);
process.exit(0);
