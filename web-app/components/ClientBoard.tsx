"use client";

import { useEffect, useMemo, useState } from "react";
import { rememberLinkAction, setFavouriteAction, setReferenceStateAction } from "@/app/actions/board";
import type { BoardReference, BoardShootPhoto } from "@/lib/data";
import { mediaUrl } from "@/lib/shared";
import { JustifiedGrid, PhotoTile, type TileState } from "./PhotoTile";
import { Lightbox } from "./Lightbox";
import { Comments, type CommentPermission } from "./Comments";
import { AcceptMark, RejectMark } from "./Marks";

type Filter = "all" | TileState;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "undecided", label: "Undecided" },
];

/** Lets this browser reach the client's area later (F17). Runs once per private-link visit. */
export function RememberLink({ token }: { token: string }) {
  useEffect(() => {
    rememberLinkAction(token).catch(() => {});
  }, [token]);
  return null;
}

/** The Board (F3): accept or reject each Reference Picture. Choices save immediately. */
export function Board({
  accessKey,
  references,
  permission,
}: {
  accessKey: string;
  references: BoardReference[];
  permission: CommentPermission;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  // Local changes shown straight away, before the server confirms.
  const [states, setStates] = useState<Record<string, TileState>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [changed, setChanged] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const items = useMemo(
    () =>
      references.map((r) => ({
        ...r,
        state: states[r.referenceId] ?? r.state,
        commentCount: counts[r.referenceId] ?? r.commentCount,
      })),
    [references, states, counts],
  );
  const visible = filter === "all" ? items : items.filter((i) => i.state === filter);
  const countOf = (f: Filter) => (f === "all" ? items.length : items.filter((i) => i.state === f).length);

  async function choose(referenceId: string, current: TileState, next: TileState) {
    // Tapping the active choice again clears it.
    const value = current === next ? "undecided" : next;
    setStates((s) => ({ ...s, [referenceId]: value }));
    setChanged(referenceId);
    setError("");
    try {
      const res = await setReferenceStateAction(accessKey, referenceId, value);
      if (res.error) throw new Error(res.error);
    } catch (err) {
      setStates((s) => ({ ...s, [referenceId]: current }));
      setError((err as Error).message || "Your choice wasn't saved. Check your connection and try again.");
    }
  }

  const openIndex = visible.findIndex((i) => i.referenceId === openId);
  const open = openIndex >= 0 ? visible[openIndex] : null;

  return (
    <section className="space-y-4" aria-label="Reference pictures">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`pill ${filter === f.id ? "pill-on" : ""}`}
          >
            {f.label} <span className="opacity-75">{countOf(f.id)}</span>
          </button>
        ))}
      </div>

      {error && <p className="error-note" role="alert">⚠ {error}</p>}
      {filter === "rejected" && visible.length > 0 && (
        <p className="text-sm text-loupe">Changed your mind? Tap Accept on any picture to bring it back.</p>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-loupe">
          {items.length === 0 ? "No reference pictures yet. The studio will add some soon." : "Nothing here yet."}
        </p>
      ) : (
        <JustifiedGrid>
          {visible.map((r) => (
            <PhotoTile
              key={r.referenceId}
              id={r.referenceId}
              src={mediaUrl("photo", r.photoId!, "thumb", accessKey)}
              alt={r.title || "Reference picture"}
              width={r.width}
              height={r.height}
              state={r.state}
              justChanged={changed === r.referenceId}
              commentCount={r.commentCount}
              onOpen={() => setOpenId(r.referenceId)}
              actions={<ChoiceButtons state={r.state} onChoose={(n) => choose(r.referenceId, r.state, n)} />}
            />
          ))}
        </JustifiedGrid>
      )}

      {open && (
        <Lightbox
          src={mediaUrl("photo", open.photoId!, "preview", accessKey)}
          alt={open.title || "Reference picture"}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(visible[openIndex - 1].referenceId) : undefined}
          onNext={openIndex < visible.length - 1 ? () => setOpenId(visible[openIndex + 1].referenceId) : undefined}
          overlay={
            open.state === "accepted" ? (
              <AcceptMark seed={open.referenceId} drawn={changed === open.referenceId} />
            ) : open.state === "rejected" ? (
              <RejectMark seed={open.referenceId} drawn={changed === open.referenceId} />
            ) : null
          }
        >
          <div className="space-y-2">
            {open.title && <h2 className="text-lg font-semibold">{open.title}</h2>}
            {open.credit && <p className="text-sm text-loupe">Photo: {open.credit}</p>}
            {open.tags.length > 0 && <p className="text-sm text-loupe">{open.tags.map((t) => `#${t}`).join(" ")}</p>}
            <ChoiceButtons state={open.state} onChoose={(n) => choose(open.referenceId, open.state, n)} large />
          </div>
          <Comments
            accessKey={accessKey}
            target={{ referencePictureId: open.referenceId }}
            permission={permission}
            onCountChange={(n) => setCounts((c) => ({ ...c, [open.referenceId]: n }))}
          />
        </Lightbox>
      )}
    </section>
  );
}

function ChoiceButtons({
  state,
  onChoose,
  large = false,
}: {
  state: TileState;
  onChoose: (next: TileState) => void;
  large?: boolean;
}) {
  const base = `flex-1 cursor-pointer rounded-[6px] border font-semibold transition-colors ${large ? "py-2 text-sm" : "py-1 text-xs"}`;
  return (
    <div className="flex w-full gap-1.5">
      <button
        type="button"
        aria-pressed={state === "accepted"}
        onClick={() => onChoose("accepted")}
        className={`${base} ${
          state === "accepted" ? "border-marker bg-marker text-white" : "border-sleeve bg-sheet text-graphite hover:border-marker"
        }`}
      >
        Accept
      </button>
      <button
        type="button"
        aria-pressed={state === "rejected"}
        onClick={() => onChoose("rejected")}
        className={`${base} ${
          state === "rejected" ? "border-graphite bg-graphite text-on-graphite" : "border-sleeve bg-sheet text-graphite hover:border-graphite"
        }`}
      >
        Reject
      </button>
    </div>
  );
}

/** Your Photos (F6, F8): favourites and downloads once the page is locked. */
export function YourPhotos({
  accessKey,
  photos,
  favouritesLimit,
  permission,
}: {
  accessKey: string;
  photos: BoardShootPhoto[];
  favouritesLimit: number | null;
  permission: CommentPermission;
}) {
  const [filter, setFilter] = useState<"all" | "favourites">("all");
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const items = photos.map((p) => ({ ...p, favourite: favs[p.id] ?? p.favourite, commentCount: counts[p.id] ?? p.commentCount }));
  const favCount = items.filter((p) => p.favourite).length;
  const visible = filter === "all" ? items : items.filter((p) => p.favourite);
  const openIndex = visible.findIndex((p) => p.id === openId);
  const open = openIndex >= 0 ? visible[openIndex] : null;

  async function toggle(id: string, current: boolean) {
    setError("");
    setFavs((f) => ({ ...f, [id]: !current }));
    try {
      const res = await setFavouriteAction(accessKey, id, !current);
      if (res.error) throw new Error(res.error);
    } catch (err) {
      setFavs((f) => ({ ...f, [id]: current }));
      setError((err as Error).message || "That didn't save. Check your connection and try again.");
    }
  }

  if (photos.length === 0) {
    return <p className="py-10 text-loupe">Your photos will appear here after the shoot.</p>;
  }

  const heart = (p: (typeof items)[number], large = false) => (
    <button
      type="button"
      aria-pressed={p.favourite}
      onClick={() => toggle(p.id, p.favourite)}
      className={`flex-1 cursor-pointer rounded-[6px] border font-semibold transition-colors ${large ? "py-2 text-sm" : "py-1 text-xs"} ${
        p.favourite ? "border-marker bg-marker text-white" : "border-sleeve bg-sheet text-graphite hover:border-marker"
      }`}
    >
      {p.favourite ? "♥ Favourite" : "♡ Favourite"}
    </button>
  );

  return (
    <section className="space-y-4" aria-label="Your photos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`pill ${filter === "all" ? "pill-on" : ""}`}>
            All <span className="opacity-75">{items.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={filter === "favourites"}
            onClick={() => setFilter("favourites")}
            className={`pill ${filter === "favourites" ? "pill-on" : ""}`}
          >
            Favourites <span className="opacity-75">{favouritesLimit ? `${favCount} of ${favouritesLimit}` : favCount}</span>
          </button>
        </div>
        <a className="btn-primary" href={`/download/${encodeURIComponent(accessKey)}`}>
          Download all
        </a>
      </div>
      {favouritesLimit && (
        <p className="text-sm text-loupe">Choose up to {favouritesLimit} favourites for editing.</p>
      )}
      {error && <p className="error-note" role="alert">⚠ {error}</p>}
      {visible.length === 0 ? (
        <p className="py-10 text-loupe">Tap ♡ on the photos you love and they&apos;ll gather here.</p>
      ) : (
        <JustifiedGrid>
          {visible.map((p) => (
            <PhotoTile
              key={p.id}
              id={p.id}
              src={mediaUrl("shoot", p.id, "thumb", accessKey)}
              alt={p.filename}
              width={p.width}
              height={p.height}
              favourite={p.favourite}
              commentCount={p.commentCount}
              onOpen={() => setOpenId(p.id)}
              actions={heart(p)}
            />
          ))}
        </JustifiedGrid>
      )}
      {open && (
        <Lightbox
          src={mediaUrl("shoot", open.id, "preview", accessKey)}
          alt={open.filename}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(visible[openIndex - 1].id) : undefined}
          onNext={openIndex < visible.length - 1 ? () => setOpenId(visible[openIndex + 1].id) : undefined}
        >
          <div className="space-y-2">
            <h2 className="truncate text-lg font-semibold">{open.filename}</h2>
            <div className="flex gap-2">
              {heart(open, true)}
              <a className="btn-secondary flex-1" href={mediaUrl("shoot", open.id, "original", accessKey, true)}>
                Download
              </a>
            </div>
          </div>
          <Comments
            accessKey={accessKey}
            target={{ shootPhotoId: open.id }}
            permission={permission}
            onCountChange={(n) => setCounts((c) => ({ ...c, [open.id]: n }))}
          />
        </Lightbox>
      )}
    </section>
  );
}
