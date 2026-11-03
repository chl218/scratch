"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addReferencesAction,
  deleteShootPhotoAction,
  markPageSeenAction,
  setReferenceHiddenAction,
  updateShootPhotoAction,
} from "@/app/actions/admin";
import type { BoardReference, BoardShootPhoto } from "@/lib/data";
import { mediaUrl } from "@/lib/shared";
import { JustifiedGrid, PhotoTile, type TileState } from "./PhotoTile";
import { Lightbox } from "./Lightbox";
import { Comments } from "./Comments";
import { LibraryPicker } from "./LibraryPicker";
import { ActionButton } from "./ActionButton";
import { FocusPicker } from "./FocusPicker";
import { FormMessage, SubmitButton } from "./forms";
import { AcceptMark, RejectMark } from "./Marks";

type Filter = "all" | TileState | "hidden";
const ADMIN = { canComment: true } as const;

/** Re-fetches the page now and then so admins see the client's choices live, and marks it seen. */
export function AutoRefresh({ pageId, seconds = 15 }: { pageId: string; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    markPageSeenAction(pageId).catch(() => {});
    const t = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        markPageSeenAction(pageId).catch(() => {});
      }
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, pageId]);
  return null;
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input className="input text-xs" readOnly value={url} aria-label="Private link" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

/** The client's Board as the admin sees it (F3): their choices, plus add, hide and comment. */
export function AdminReferences({ pageId, references }: { pageId: string; references: BoardReference[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState("");

  const shown = references.filter((r) => !r.hidden);
  const visible =
    filter === "all" ? shown : filter === "hidden" ? references.filter((r) => r.hidden) : shown.filter((r) => r.state === filter);
  const countOf = (f: Filter) =>
    f === "all" ? shown.length : f === "hidden" ? references.length - shown.length : shown.filter((r) => r.state === f).length;
  const index = visible.findIndex((r) => r.referenceId === openId);
  const open = index >= 0 ? visible[index] : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "accepted", "rejected", "undecided", "hidden"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`pill capitalize ${filter === f ? "pill-on" : ""}`}>
              {f} <span className="opacity-75">{countOf(f)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={() => setPicking(true)}>
          Add from library
        </button>
      </div>
      {notice && <p className="ok-note" role="status">{notice}</p>}

      {visible.length === 0 ? (
        <p className="py-8 text-loupe">
          {references.length === 0 ? "No reference pictures yet. Add some from the library." : "Nothing here."}
        </p>
      ) : (
        <JustifiedGrid>
          {visible.map((r) => (
            <PhotoTile
              key={r.referenceId}
              id={r.referenceId}
              src={mediaUrl("photo", r.photoId!, "thumb")}
              alt={r.title || "Reference picture"}
              width={r.width}
              height={r.height}
              state={r.state}
              commentCount={r.commentCount}
              badge={r.addedBy === "client" ? "Added by client" : undefined}
              onOpen={() => setOpenId(r.referenceId)}
            />
          ))}
        </JustifiedGrid>
      )}

      {open && (
        <Lightbox
          src={mediaUrl("photo", open.photoId!, "preview")}
          alt={open.title || "Reference picture"}
          onClose={() => setOpenId(null)}
          onPrev={index > 0 ? () => setOpenId(visible[index - 1].referenceId) : undefined}
          onNext={index < visible.length - 1 ? () => setOpenId(visible[index + 1].referenceId) : undefined}
          overlay={
            open.state === "accepted" ? <AcceptMark seed={open.referenceId} /> : open.state === "rejected" ? <RejectMark seed={open.referenceId} /> : null
          }
        >
          <div className="space-y-2">
            {open.title && <h2 className="text-lg font-semibold">{open.title}</h2>}
            <p className="text-sm">
              Client&apos;s choice: <span className="font-semibold capitalize">{open.state}</span>
              {open.addedBy === "client" && <span className="text-loupe">. Added by the client</span>}
            </p>
            {open.credit && <p className="text-sm text-loupe">Photo: {open.credit}</p>}
            {open.tags.length > 0 && <p className="text-sm text-loupe">{open.tags.map((t) => `#${t}`).join(" ")}</p>}
            <ActionButton
              className={open.hidden ? "btn-secondary" : "btn-danger"}
              confirm={open.hidden ? undefined : "Take this picture off the client's page? It stays in the library."}
              action={async () => {
                await setReferenceHiddenAction(open.referenceId, !open.hidden);
                setOpenId(null);
              }}
            >
              {open.hidden ? "Show on the page again" : "Hide from this page"}
            </ActionButton>
          </div>
          <Comments accessKey={`p:${pageId}`} target={{ referencePictureId: open.referenceId }} permission={ADMIN} />
        </Lightbox>
      )}

      {picking && (
        <LibraryPicker
          existingPhotoIds={references.filter((r) => !r.hidden && r.photoId).map((r) => r.photoId!)}
          onAdd={async (ids) => {
            const res = await addReferencesAction(pageId, ids);
            if (res?.error) throw new Error(res.error);
            setNotice(`${res?.ok ?? "Added."} The client has been emailed.`);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}

/** Shoot Photos as the admin sees them (F6): favourites, tags, portfolio flag, focus point. */
export function AdminShootPhotos({ pageId, photos }: { pageId: string; photos: BoardShootPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const list = onlyFavs ? photos.filter((p) => p.favourite) : photos;
  const index = list.findIndex((p) => p.id === openId);
  const open = index >= 0 ? list[index] : null;
  const favs = photos.filter((p) => p.favourite).length;

  if (photos.length === 0) return <p className="text-sm text-loupe">No Shoot Photos uploaded yet.</p>;

  return (
    <>
      <div className="flex gap-2">
        <button type="button" aria-pressed={!onlyFavs} onClick={() => setOnlyFavs(false)} className={`pill ${!onlyFavs ? "pill-on" : ""}`}>
          All <span className="opacity-75">{photos.length}</span>
        </button>
        <button type="button" aria-pressed={onlyFavs} onClick={() => setOnlyFavs(true)} className={`pill ${onlyFavs ? "pill-on" : ""}`}>
          Client&apos;s favourites <span className="opacity-75">{favs}</span>
        </button>
      </div>
      <JustifiedGrid>
        {list.map((p) => (
          <PhotoTile
            key={p.id}
            id={p.id}
            src={mediaUrl("shoot", p.id, "thumb")}
            alt={p.filename}
            width={p.width}
            height={p.height}
            favourite={p.favourite}
            commentCount={p.commentCount}
            badge={p.inPortfolio ? "Portfolio" : undefined}
            onOpen={() => setOpenId(p.id)}
            caption={p.filename}
          />
        ))}
      </JustifiedGrid>
      {open && (
        <Lightbox
          src={mediaUrl("shoot", open.id, "preview")}
          alt={open.filename}
          onClose={() => setOpenId(null)}
          onPrev={index > 0 ? () => setOpenId(list[index - 1].id) : undefined}
          onNext={index < list.length - 1 ? () => setOpenId(list[index + 1].id) : undefined}
        >
          <EditShootPhoto key={open.id} photo={open} onDeleted={() => setOpenId(null)} />
          <Comments accessKey={`p:${pageId}`} target={{ shootPhotoId: open.id }} permission={ADMIN} />
        </Lightbox>
      )}
    </>
  );
}

function EditShootPhoto({ photo, onDeleted }: { photo: BoardShootPhoto; onDeleted: () => void }) {
  const [state, action] = useActionState(updateShootPhotoAction.bind(null, photo.id), undefined);
  return (
    <div className="space-y-3">
      <h2 className="truncate font-semibold">{photo.filename}</h2>
      <p className="text-xs text-loupe">
        {photo.width} × {photo.height} px{photo.favourite ? ". The client's favourite" : ""}
      </p>
      <form action={action} className="space-y-3">
        <div>
          <label className="label" htmlFor="shoot-tags">Tags (for portfolio search)</label>
          <input id="shoot-tags" name="tags" className="input" defaultValue={photo.tags.map((t) => `#${t}`).join(" ")} placeholder="#portrait #golden" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="inPortfolio" defaultChecked={photo.inPortfolio} />
          Show in portfolio
        </label>
        <FocusPicker src={mediaUrl("shoot", photo.id, "thumb")} x={photo.focusX} y={photo.focusY} />
        <div className="flex items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
      <ActionButton
        className="btn-danger"
        confirm="Delete this Shoot Photo?"
        action={async () => {
          await deleteShootPhotoAction(photo.id);
          onDeleted();
        }}
      >
        Delete photo
      </ActionButton>
    </div>
  );
}
