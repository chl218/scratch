"use client";

import { useActionState, useState } from "react";
import { deletePhotoAction, pagesUsingPhotoAction, updatePhotoAction } from "@/app/actions/admin";
import type { LibraryPhoto } from "@/lib/data";
import { mediaUrl } from "@/lib/shared";
import { JustifiedGrid, PhotoTile } from "./PhotoTile";
import { Lightbox } from "./Lightbox";
import { FormMessage, SubmitButton } from "./forms";
import { FocusPicker } from "./FocusPicker";

/** Admin library grid (F1, F2). Opening a picture lets the admin edit it. */
export function LibraryGrid({ photos }: { photos: LibraryPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const index = photos.findIndex((p) => p.id === openId);
  const open = index >= 0 ? photos[index] : null;

  if (photos.length === 0) {
    return <p className="py-10 text-loupe">No pictures here. Upload some above, or clear the search.</p>;
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
            caption={p.tags.length ? p.tags.map((t) => `#${t}`).join(" ") : "No tags"}
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

function EditPhoto({ photo, onDeleted }: { photo: LibraryPhoto; onDeleted: () => void }) {
  const [state, action] = useActionState(updatePhotoAction.bind(null, photo.id), undefined);
  const [credit, setCredit] = useState(photo.credit);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const pages = await pagesUsingPhotoAction(photo.id);
    const msg = pages.length
      ? `Delete this picture? It's used on ${pages.length} client page${pages.length === 1 ? "" : "s"}:\n\n${pages.join("\n")}\n\nIt will be removed from pages that aren't locked. Locked pages keep its name.`
      : "Delete this picture from the library?";
    if (window.confirm(msg)) {
      await deletePhotoAction(photo.id);
      onDeleted();
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="input" defaultValue={photo.title} maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="tags">Tags</label>
          <input id="tags" name="tags" className="input" defaultValue={photo.tags.map((t) => `#${t}`).join(" ")} placeholder="#portrait #moody" />
        </div>
        <div>
          <label className="label" htmlFor="credit">Credit</label>
          <input
            id="credit"
            name="credit"
            className="input"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            maxLength={200}
            placeholder="@someone on Instagram (blank for the studio's own work)"
          />
        </div>
        <div>
          <label className="label" htmlFor="sourceUrl">Source URL</label>
          <input id="sourceUrl" name="sourceUrl" className="input" defaultValue={photo.sourceUrl} placeholder="https://" />
          {photo.sourceUrl && (
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
              Open the original post
            </a>
          )}
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" className="input min-h-16" defaultValue={photo.notes} maxLength={2000} />
        </div>
        <label className={`flex items-start gap-2 text-sm ${credit ? "text-loupe" : ""}`}>
          <input type="checkbox" name="inPortfolio" defaultChecked={photo.inPortfolio} disabled={Boolean(credit)} className="mt-1" />
          <span>
            Show in portfolio
            {credit && <span className="block text-xs">Only the studio&apos;s own work (no credit) can be shown publicly.</span>}
          </span>
        </label>
        <FocusPicker src={mediaUrl("photo", photo.id, "thumb")} x={photo.focusX} y={photo.focusY} />
        <div className="flex items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
      <p className="text-xs text-loupe">
        {photo.width} × {photo.height} px.{" "}
        <a className="underline" href={mediaUrl("photo", photo.id, "original")} target="_blank" rel="noreferrer">
          Open original
        </a>
      </p>
      <button type="button" className="btn-danger" onClick={remove} disabled={deleting}>
        {deleting ? "Deleting…" : "Delete from library"}
      </button>
    </div>
  );
}
