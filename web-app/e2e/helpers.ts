import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..", ".e2e-data");
export const FIXTURES = path.join(ROOT, "fixtures");
const MAIL = path.join(ROOT, "mail");

/** Creates test images: solid-colour JPEGs/PNGs, a fake image and an oversized file. */
export async function makeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const colors = ["#c8503c", "#282828", "#dcc8aa", "#3c5a8c", "#78a064"];
  for (let i = 0; i < colors.length; i++) {
    await sharp({ create: { width: 1600, height: 1100, channels: 3, background: colors[i] } })
      .jpeg()
      .toFile(path.join(FIXTURES, `ref${i + 1}.jpg`));
  }
  // Full 30.4 MP frame size, as a PNG.
  await sharp({ create: { width: 6720, height: 4480, channels: 3, background: "#5a463c" } })
    .png()
    .toFile(path.join(FIXTURES, "shoot1.png"));
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#1e465a" } })
    .jpeg()
    .toFile(path.join(FIXTURES, "shoot2.jpg"));
  await writeFile(path.join(FIXTURES, "fake.jpg"), "this is not an image");
  await writeFile(path.join(FIXTURES, "too-big.jpg"), Buffer.alloc(51 * 1024 * 1024));
}

export const fixture = (name: string) => path.join(FIXTURES, name);

export type SavedMail = { to: string; subject: string; text: string; sentAt: string };

/** Emails saved by the app's local outbox, newest first. */
export async function readMail(): Promise<SavedMail[]> {
  let files: string[] = [];
  try {
    files = await readdir(MAIL);
  } catch {
    return [];
  }
  const mails = await Promise.all(
    files.filter((f) => f.endsWith(".json")).map(async (f) => JSON.parse(await readFile(path.join(MAIL, f), "utf8"))),
  );
  return mails.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export async function findMail(subject: RegExp): Promise<SavedMail | undefined> {
  return (await readMail()).find((m) => subject.test(m.subject));
}

export function linkIn(text: string): string {
  const m = text.match(/https?:\/\/\S+/);
  if (!m) throw new Error("No link in email");
  return new URL(m[0]).pathname;
}
