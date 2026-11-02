import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A long random URL-safe token (256 bits). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored hashed, so the database alone can't be used to log in. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function appUrl(pathname: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + pathname;
}
