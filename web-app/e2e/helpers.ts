import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..", ".e2e-data");
export const FIXTURES = path.join(ROOT, "fixtures");
const MAIL = path.join(ROOT, "mail");

/** Creates test images: solid-colour JPEGs/PNGs (portrait and landscape), a fake image and an oversized file. */
export async function makeFixtures() {
  await mkdir(FIXTURES, { recursive: true });
  const colors = ["#c8503c", "#282828", "#dcc8aa", "#3c5a8c", "#78a064"];
  for (let i = 0; i < colors.length; i++) {
    const portrait = i % 2 === 1;
    await sharp({ create: { width: portrait ? 1100 : 1600, height: portrait ? 1600 : 1100, channels: 3, background: colors[i] } })
      .jpeg()
      .toFile(path.join(FIXTURES, `ref${i + 1}.jpg`));
  }
  // Full 30.4 MP frame size, as a PNG.
  await sharp({ create: { width: 6720, height: 4480, channels: 3, background: "#5a463c" } })
    .png()
    .toFile(path.join(FIXTURES, "shoot1.png"));
  // A JPEG carrying EXIF that must never reach the client (F1).
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#1e465a" } })
    .withExif({ IFD0: { Copyright: "SECRET-SERIAL-123", Artist: "Studio camera" } })
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

export async function findMail(subject: RegExp, to?: string): Promise<SavedMail | undefined> {
  return (await readMail()).find((m) => subject.test(m.subject) && (!to || m.to === to));
}

/** Waits for an email to arrive (the digest is sent by a timer). */
export async function waitForMail(subject: RegExp, to?: string, timeoutMs = 20_000): Promise<SavedMail> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const m = await findMail(subject, to);
    if (m) return m;
    if (Date.now() > end) throw new Error(`No email matching ${subject}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

export function linkIn(text: string, contains = ""): string {
  const links = text.match(/https?:\/\/\S+/g) ?? [];
  const m = links.find((l) => l.includes(contains));
  if (!m) throw new Error("No link in email");
  return new URL(m).pathname;
}
