"use client";

import { useEffect, useRef, useState } from "react";
import { deletePhotoAction, pagesUsingPhotoAction, updatePhotoAction } from "@/app/actions/admin";
import type { LibraryPhoto } from "@/lib/data";
import { mediaUrl } from "@/lib/shared";
import { JustifiedGrid, PhotoTile } from "./PhotoTile";
import { Lightbox } from "./Lightbox";

/** Admin library grid (F1, F2). Opening a picture lets the admin edit it; changes save on their own. */
export function LibraryGrid({ photos }: { photos: LibraryPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const index = photos.findIndex((p) => p.id === openId);
  const open = index >= 0 ? photos[index] : null;

  if (photos.length === 0) {
    return <p className="py-10 text-loupe">No pictures here. Clear the search, or add some in the Upload tab.</p>;
  }

  return (
    <>
      <JustifiedGrid>
        {photos.map((p) => (
          <PhotoTile
            key={p.id}
            id={p.id}
            src={mediaUrl("photo", p.id, "thumb")}
            alt={p.title || "Reference picture"}
            width={p.width}
            height={p.height}
            badge={p.inPortfolio ? "Portfolio" : undefined}
            onOpen={() => setOpenId(p.id)}
          />
        ))}
      </JustifiedGrid>
      {open && (
        <Lightbox
          src={mediaUrl("photo", open.id, "preview")}
          alt={open.title || "Reference picture"}
          onClose={() => setOpenId(null)}
          onPrev={index > 0 ? () => setOpenId(photos[index - 1].id) : undefined}
          onNext={index < photos.length - 1 ? () => setOpenId(photos[index + 1].id) : undefined}
        >
          {/* key resets the form when moving to another picture */}
          <EditPhoto key={open.id} photo={open} onDeleted={() => setOpenId(null)} />
        </Lightbox>
      )}
    </>
  );
}

type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const TYPING_DELAY = 700;

/** Edits one picture. There is no Save button: each change is saved shortly after it's made. */
function EditPhoto({ photo, onDeleted }: { photo: LibraryPhoto; onDeleted: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  // The latest values, kept so a change can still be saved after the form has gone.
  const latest = useRef<FormData | null>(null);
  const [credit, setCredit] = useState(photo.credit);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current || !formRef.current) return;
    dirty.current = false;
    setStatus({ kind: "saving" });
    try {
      const res = await updatePhotoAction(photo.id, undefined, new FormData(formRef.current));
      setStatus(res?.error ? { kind: "error", message: res.error } : { kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "Changes weren't saved. Check your connection and try again." });
    }
  }

  /** Text fields wait until typing pauses; the portfolio switch saves at once. */
  function changed(immediate: boolean) {
    dirty.current = true;
    if (formRef.current) latest.current = new FormData(formRef.current);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void save();
    else timer.current = setTimeout(() => void save(), TYPING_DELAY);
  }

  // Closing the picture (or moving to the next one) saves anything still waiting.
  useEffect(() => {
    return () => {
      if (dirty.current && latest.current) void updatePhotoAction(photo.id, undefined, latest.current);
    };
  }, [photo.id]);

  async function remove() {
    setDeleting(true);
    const pages = await pagesUsingPhotoAction(photo.id);
    const msg = pages.length
      ? `Delete this picture? It's used on ${pages.length} client page${pages.length === 1 ? "" : "s"}:\n\n${pages.join("\n")}\n\nIt will be removed from pages that aren't locked. Locked pages keep its name.`
      : "Delete this picture from the library?";
    if (window.confirm(msg)) {
      dirty.current = false;
      await deletePhotoAction(photo.id);
      onDeleted();
    }
    setDeleting(false);
  }

  const text = { onChange: () => changed(false), onBlur: () => void save() };

  return (
    <div className="space-y-4">
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="input" defaultValue={photo.title} maxLength={200} {...text} />
        </div>
        <div>
          <label className="label" htmlFor="tags">Tags</label>
          <input id="tags" name="tags" className="input" defaultValue={photo.tags.map((t) => `#${t}`).join(" ")} placeholder="#portrait #moody" {...text} />
        </div>
        <div>
          <label className="label" htmlFor="credit">Credit</label>
          <input
            id="credit"
            name="credit"
            className="input"
            value={credit}
            onChange={(e) => {
              setCredit(e.target.value);
              changed(false);
            }}
            onBlur={() => void save()}
            maxLength={200}
            placeholder="@someone on Instagram (blank for the studio's own work)"
          />
        </div>
        <div>
          <label className="label" htmlFor="sourceUrl">Source URL</label>
          <input id="sourceUrl" name="sourceUrl" className="input" defaultValue={photo.sourceUrl} placeholder="https://" {...text} />
          {photo.sourceUrl && (
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
              Open the original post
            </a>
          )}
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" className="input min-h-16" defaultValue={photo.notes} maxLength={2000} {...text} />
        </div>
        <label className={`flex items-start gap-2 text-sm ${credit ? "text-loupe" : ""}`}>
          <input
            type="checkbox"
            name="inPortfolio"
            defaultChecked={photo.inPortfolio}
            disabled={Boolean(credit)}
            className="mt-1"
            onChange={() => changed(true)}
          />
          <span>
            Show in portfolio
            {credit && <span className="block text-xs">Only the studio&apos;s own work (no credit) can be shown publicly.</span>}
          </span>
        </label>
        <p aria-live="polite" className="min-h-5 text-sm">
          {status.kind === "saving" && <span className="text-loupe">Saving…</span>}
          {status.kind === "saved" && <span className="text-loupe">All changes saved</span>}
          {status.kind === "error" && <span className="error-note">⚠ {status.message}</span>}
        </p>
      </form>
      {/* Same width, so the two actions line up as a pair. */}
      <div className="grid w-fit grid-cols-1 gap-2">
        <a className="btn-secondary" href={mediaUrl("photo", photo.id, "original")} target="_blank" rel="noreferrer">
          Open original
        </a>
        <button type="button" className="btn-danger" onClick={remove} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete from library"}
        </button>
      </div>
    </div>
  );
}
