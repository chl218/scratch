// Helpers used by both server and browser code.

/**
 * Turns "#Portrait, moody #black-and-white" into ["portrait", "moody", "black-and-white"].
 * Tags are lowercase letters, digits, "-" and "_".
 */
export function parseTags(input: string): string[] {
  const tags = input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9_-]/g, ""))
    .filter((t) => t.length > 0 && t.length <= 40);
  return [...new Set(tags)];
}

export type MediaKind = "photo" | "shoot";
export type MediaSize = "thumb" | "preview" | "original";

/**
 * URL for an image. `access` is the client-page access key ("t:<token>" or
 * "p:<pageId>"); admins don't need one.
 */
export function mediaUrl(
  kind: MediaKind,
  id: string,
  size: MediaSize,
  access?: string,
  download = false,
): string {
  const params = new URLSearchParams();
  if (access) params.set("a", access);
  if (download) params.set("download", "1");
  const qs = params.toString();
  return `/media/${kind}/${id}/${size}${qs ? `?${qs}` : ""}`;
}

export const ACCEPTED_UPLOAD_TYPES =
  "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif";
export const MAX_UPLOAD_MB = 50;

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? value + "T00:00:00" : value) : value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The base username for a client name (SPEC F17): first initial + last word,
 * lowercase a–z only. "John Doe" → "jdoe", "José Núñez" → "jnunez",
 * "Ana María García López" → "alopez", "Cher" → "cher".
 */
export function baseUsername(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "client";
  if (words.length === 1) return words[0].slice(0, 30);
  return (words[0][0] + words[words.length - 1]).slice(0, 30);
}

export const USERNAME_PATTERN = /^[a-z]{1,30}[0-9]{0,4}$/;
