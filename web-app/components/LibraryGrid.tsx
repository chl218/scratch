"use client";

import { useActionState, useState } from "react";
import { deletePhotoAction, updatePhotoAction } from "@/app/actions/admin";
import type { LibraryPhoto } from "@/lib/data";
import { mediaUrl } from "@/lib/shared";
import { Grid, PhotoTile } from "./PhotoTile";
import { Lightbox } from "./Lightbox";
import { FormMessage, SubmitButton } from "./forms";
import { ActionButton } from "./ActionButton";

/** Admin library grid. Opening a photo lets the admin edit its title, notes and tags. */
export function LibraryGrid({ photos }: { photos: LibraryPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const index = photos.findIndex((p) => p.id === openId);
  const open = index >= 0 ? photos[index] : null;

  if (photos.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-500">No photos yet.</p>;
  }

  return (
    <>
      <Grid>
        {photos.map((p) => (
          <PhotoTile
            key={p.id}
            src={mediaUrl("photo", p.id, "thumb")}
            alt={p.title || "Library photo"}
            onOpen={() => setOpenId(p.id)}
            footer={
              <p className="truncate text-xs text-stone-500">
                {p.tags.length ? p.tags.map((t) => `#${t}`).join(" ") : "No tags"}
              </p>
            }
          />
        ))}
      </Grid>
      {open && (
        <Lightbox
          src={mediaUrl("photo", open.id, "preview")}
          alt={open.title || "Library photo"}
          onClose={() => setOpenId(null)}
          onPrev={index > 0 ? () => setOpenId(photos[index - 1].id) : undefined}
          onNext={index < photos.length - 1 ? () => setOpenId(photos[index + 1].id) : undefined}
        >
          {/* key resets the form when moving to another photo */}
          <EditPhoto key={open.id} photo={open} onDeleted={() => setOpenId(null)} />
        </Lightbox>
      )}
    </>
  );
}

function EditPhoto({ photo, onDeleted }: { photo: LibraryPhoto; onDeleted: () => void }) {
  const [state, action] = useActionState(updatePhotoAction.bind(null, photo.id), undefined);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="input" defaultValue={photo.title} maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="tags">Tags</label>
          <input
            id="tags"
            name="tags"
            className="input"
            defaultValue={photo.tags.map((t) => `#${t}`).join(" ")}
            placeholder="#portrait #moody"
          />
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" className="input min-h-20" defaultValue={photo.notes} maxLength={2000} />
        </div>
        <div className="flex items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
      <p className="text-xs text-stone-500">
        {photo.width} × {photo.height} px ·{" "}
        <a className="underline" href={mediaUrl("photo", photo.id, "original")} target="_blank" rel="noreferrer">
          Open original
        </a>
      </p>
      <ActionButton
        className="btn-danger"
        confirm="Delete this photo? It will also be removed from every client page."
        action={async () => {
          await deletePhotoAction(photo.id);
          onDeleted();
        }}
      >
        Delete photo
      </ActionButton>
    </div>
  );
}
