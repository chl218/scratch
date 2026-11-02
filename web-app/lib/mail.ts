import "server-only";
import path from "node:path";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import nodemailer from "nodemailer";

export type Mail = { to: string; subject: string; text: string };

export const OUTBOX_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.MAIL_DIR || path.join(process.cwd(), ".mail"),
);

/** True when emails are saved locally instead of being sent. */
export function usingLocalOutbox(): boolean {
  return !process.env.SMTP_URL;
}

// With SMTP_URL set (e.g. smtp://localhost:1025 for Mailpit), emails are sent.
// Without it, each email is saved as a JSON file in .mail/ and shown at /admin/outbox.
export async function sendMail(mail: Mail): Promise<void> {
  const from = process.env.MAIL_FROM || "Moodboard <no-reply@localhost>";
  if (process.env.SMTP_URL) {
    const transport = nodemailer.createTransport(process.env.SMTP_URL);
    await transport.sendMail({ from, ...mail });
    return;
  }
  await mkdir(OUTBOX_DIR, { recursive: true });
  const sentAt = new Date().toISOString();
  const name = `${sentAt.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.json`;
  await writeFile(path.join(OUTBOX_DIR, name), JSON.stringify({ from, sentAt, ...mail }, null, 2));
  console.log(`[mail] saved to .mail/${name} — to: ${mail.to} — ${mail.subject}`);
}

export type SavedMail = Mail & { from: string; sentAt: string; file: string };

export async function readOutbox(limit = 100): Promise<SavedMail[]> {
  let files: string[];
  try {
    files = await readdir(OUTBOX_DIR);
  } catch {
    return [];
  }
  const newest = files.filter((f) => f.endsWith(".json")).sort().reverse().slice(0, limit);
  return Promise.all(
    newest.map(async (file) => ({
      file,
      ...JSON.parse(await readFile(path.join(OUTBOX_DIR, file), "utf8")),
    })),
  );
}
