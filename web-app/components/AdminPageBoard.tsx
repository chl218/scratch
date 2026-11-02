"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addInspirationsAction,
  deleteShootPhotoAction,
  removeInspirationAction,
} from "@/app/actions/admin";
import type { BoardInspiration, BoardShootPhoto } from "@/lib/data";
import { mediaUrl } from "@/lib/shared";
import { Grid, PhotoTile, type TileState } from "./PhotoTile";
import { Lightbox } from "./Lightbox";
import { Comments } from "./Comments";
import { LibraryPicker } from "./LibraryPicker";
import { ActionButton } from "./ActionButton";

type Filter = "all" | TileState;

/** Re-fetches the page every so often so the admin sees the client's choices live. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input className="input font-mono text-xs" readOnly value={url} onFocus={(e) => e.target.select()} />
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

export function AdminInspirations({ pageId, inspirations }: { pageId: string; inspirations: BoardInspiration[] }) {
  const accessKey = `p:${pageId}`;
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState("");

  const visible = filter === "all" ? inspirations : inspirations.filter((i) => i.state === filter);
  const countOf = (f: Filter) => (f === "all" ? inspirations.length : inspirations.filter((i) => i.state === f).length);
  const index = visible.findIndex((i) => i.inspirationId === openId);
  const open = index >= 0 ? visible[index] : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "accepted", "rejected", "undecided"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`pill capitalize ${
                filter === f ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white hover:bg-stone-100"
              }`}
            >
              {f} <span className="opacity-60">{countOf(f)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={() => setPicking(true)}>
          + Add from library
        </button>
      </div>
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">
          {inspirations.length === 0 ? "No inspiration photos yet. Add some from the library." : "Nothing here."}
        </p>
      ) : (
        <Grid>
          {visible.map((i) => (
            <PhotoTile
              key={i.inspirationId}
              src={mediaUrl("photo", i.photoId, "thumb")}
              alt={i.title || "Inspiration"}
              state={i.state}
              commentCount={i.commentCount}
              onOpen={() => setOpenId(i.inspirationId)}
              footer={
                <p className="truncate text-xs text-stone-500">
                  {i.addedBy === "client" ? "Added by client" : i.tags.map((t) => `#${t}`).join(" ")}
                </p>
              }
            />
          ))}
        </Grid>
      )}

      {open && (
        <Lightbox
          src={mediaUrl("photo", open.photoId, "preview")}
          alt={open.title || "Inspiration"}
          onClose={() => setOpenId(null)}
          onPrev={index > 0 ? () => setOpenId(visible[index - 1].inspirationId) : undefined}
          onNext={index < visible.length - 1 ? () => setOpenId(visible[index + 1].inspirationId) : undefined}
        >
          <div className="space-y-2">
            {open.title && <h2 className="font-semibold">{open.title}</h2>}
            <p className="text-sm">
              Client&apos;s choice: <span className="font-medium capitalize">{open.state}</span>
              {open.addedBy === "client" && <span className="text-stone-500"> · added by client</span>}
            </p>
            {open.tags.length > 0 && <p className="text-sm text-stone-500">{open.tags.map((t) => `#${t}`).join(" ")}</p>}
            <ActionButton
              className="btn-danger"
              confirm="Remove this photo from the client's page? Its comments will be deleted too."
              action={async () => {
                await removeInspirationAction(open.inspirationId);
                setOpenId(null);
              }}
            >
              Remove from page
            </ActionButton>
          </div>
          <Comments accessKey={accessKey} target={{ inspirationId: open.inspirationId }} />
        </Lightbox>
      )}

      {picking && (
        <LibraryPicker
          accessKey={accessKey}
          title="Add photos from the library"
          existingPhotoIds={inspirations.map((i) => i.photoId)}
          onAdd={async (ids) => {
            const res = await addInspirationsAction(pageId, ids);
            if (res?.error) throw new Error(res.error);
            setNotice(`${res?.ok ?? "Added."} The client has been emailed.`);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}

export function AdminShootPhotos({ pageId, photos }: { pageId: string; photos: BoardShootPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const index = photos.findIndex((p) => p.id === openId);
  const open = index >= 0 ? photos[index] : null;

  if (photos.length === 0) return <p className="text-sm text-stone-500">No shoot photos uploaded yet.</p>;

  return (
    <>
      <Grid>
        {photos.map((p) => (
          <PhotoTile
            key={p.id}
            src={mediaUrl("shoot", p.id, "thumb")}
            alt={p.filename}
            commentCount={p.commentCount}
            onOpen={() => setOpenId(p.id)}
            footer={<p className="truncate text-xs text-stone-500">{p.filename}</p>}
          />
        ))}
      </Grid>
      {open && (
        <Lightbox
          src={mediaUrl("shoot", open.id, "preview")}
          alt={open.filename}
          onClose={() => setOpenId(null)}
          onPrev={index > 0 ? () => setOpenId(photos[index - 1].id) : undefined}
          onNext={index < photos.length - 1 ? () => setOpenId(photos[index + 1].id) : undefined}
        >
          <div className="space-y-2">
            <h2 className="truncate font-semibold">{open.filename}</h2>
            <p className="text-xs text-stone-500">
              {open.width} × {open.height} px
            </p>
            <ActionButton
              className="btn-danger"
              confirm="Delete this shoot photo?"
              action={async () => {
                await deleteShootPhotoAction(open.id);
                setOpenId(null);
              }}
            >
              Delete photo
            </ActionButton>
          </div>
          <Comments accessKey={`p:${pageId}`} target={{ shootPhotoId: open.id }} />
        </Lightbox>
      )}
    </>
  );
}
