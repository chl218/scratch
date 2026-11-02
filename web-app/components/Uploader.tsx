"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPTED_UPLOAD_TYPES, MAX_UPLOAD_MB } from "@/lib/shared";

type Status = { name: string; state: "waiting" | "uploading" | "done" | "error"; error?: string };

/**
 * Uploads photos one per request to `endpoint`. With `withTags`, the admin can
 * give the whole batch a title/notes/tags (F1). `afterBatch` runs once when the
 * batch finishes (used to send a single notification email).
 */
export function Uploader({
  endpoint,
  withTags = false,
  afterBatch,
  label = "Upload photos",
}: {
  endpoint: string;
  withTags?: boolean;
  afterBatch?: () => Promise<void>;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [busy, setBusy] = useState(false);

  function pick(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    setFiles(chosen);
    setStatuses(
      chosen.map((f) =>
        f.size > MAX_UPLOAD_MB * 1024 * 1024
          ? { name: f.name, state: "error", error: `Larger than ${MAX_UPLOAD_MB} MB` }
          : { name: f.name, state: "waiting" },
      ),
    );
  }

  async function upload() {
    setBusy(true);
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      if (statuses[i]?.state === "error") continue;
      setStatuses((s) => s.map((x, j) => (j === i ? { ...x, state: "uploading" } : x)));
      const body = new FormData();
      body.set("file", files[i]);
      if (withTags) {
        body.set("tags", tags);
        body.set("notes", notes);
      }
      try {
        const res = await fetch(endpoint, { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
        uploaded++;
        setStatuses((s) => s.map((x, j) => (j === i ? { ...x, state: "done" } : x)));
      } catch (err) {
        setStatuses((s) =>
          s.map((x, j) => (j === i ? { ...x, state: "error", error: (err as Error).message } : x)),
        );
      }
    }
    if (uploaded > 0 && afterBatch) await afterBatch();
    setBusy(false);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const ready = files.length > 0 && statuses.some((s) => s.state === "waiting");

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_UPLOAD_TYPES}
          onChange={(e) => pick(e.target.files)}
          disabled={busy}
          className="text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-stone-200"
        />
        <span className="text-xs text-stone-500">
          JPEG, PNG, WebP, AVIF or HEIC · up to {MAX_UPLOAD_MB} MB each · no RAW files
        </span>
      </div>

      {withTags && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="upload-tags">Tags for these photos</label>
            <input
              id="upload-tags"
              className="input"
              placeholder="#portrait #moody #blackandwhite"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label className="label" htmlFor="upload-notes">Notes (optional)</label>
            <input
              id="upload-notes"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
      )}

      <button type="button" className="btn-primary" onClick={upload} disabled={!ready || busy}>
        {busy ? "Uploading…" : `${label}${files.length ? ` (${files.length})` : ""}`}
      </button>

      {statuses.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {statuses.map((s, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate">{s.name}</span>
              <span
                className={
                  s.state === "error"
                    ? "text-red-700"
                    : s.state === "done"
                      ? "text-emerald-700"
                      : "text-stone-500"
                }
              >
                {s.state === "error" ? s.error : s.state === "done" ? "Uploaded" : s.state === "uploading" ? "Uploading…" : "Waiting"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
