"use client";

import { useMemo, useState } from "react";
import { clientAddInspirationsAction, setInspirationStateAction } from "@/app/actions/board";
import type { BoardInspiration, BoardShootPhoto } from "@/lib/data";
import { mediaUrl } from "@/lib/shared";
import { Grid, PhotoTile, type TileState } from "./PhotoTile";
import { Lightbox } from "./Lightbox";
import { Comments } from "./Comments";
import { LibraryPicker } from "./LibraryPicker";

type Filter = "all" | TileState;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "undecided", label: "Undecided" },
];

/**
 * The client's page: Inspirations (F3/F4) and, once visible, Your Photos (F6).
 * Choices save immediately; there is no submit step.
 */
export function ClientBoard({
  accessKey,
  inspirations,
  shootPhotos,
}: {
  accessKey: string;
  inspirations: BoardInspiration[];
  /** null while the "Your Photos" section is hidden. */
  shootPhotos: BoardShootPhoto[] | null;
}) {
  const [tab, setTab] = useState<"inspirations" | "photos">(
    shootPhotos && shootPhotos.length > 0 ? "photos" : "inspirations",
  );

  return (
    <div className="space-y-5">
      {shootPhotos && (
        <div className="flex gap-1 rounded-xl bg-stone-200/70 p-1 sm:w-fit">
          {(["inspirations", "photos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium sm:flex-none ${
                tab === t ? "bg-white shadow-sm" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t === "inspirations" ? "Inspirations" : `Your Photos (${shootPhotos.length})`}
            </button>
          ))}
        </div>
      )}
      {tab === "photos" && shootPhotos ? (
        <YourPhotos accessKey={accessKey} photos={shootPhotos} />
      ) : (
        <Inspirations accessKey={accessKey} inspirations={inspirations} />
      )}
    </div>
  );
}

function Inspirations({ accessKey, inspirations }: { accessKey: string; inspirations: BoardInspiration[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  // Local changes shown straight away, before the server confirms.
  const [states, setStates] = useState<Record<string, TileState>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo(
    () =>
      inspirations.map((i) => ({
        ...i,
        state: states[i.inspirationId] ?? i.state,
        commentCount: counts[i.inspirationId] ?? i.commentCount,
      })),
    [inspirations, states, counts],
  );
  const visible = filter === "all" ? items : items.filter((i) => i.state === filter);
  const countOf = (f: Filter) => (f === "all" ? items.length : items.filter((i) => i.state === f).length);

  async function choose(inspirationId: string, current: TileState, next: TileState) {
    // Tapping the active choice again clears it.
    const value = current === next ? "undecided" : next;
    setStates((s) => ({ ...s, [inspirationId]: value }));
    setError("");
    try {
      await setInspirationStateAction(accessKey, inspirationId, value);
    } catch {
      setStates((s) => ({ ...s, [inspirationId]: current }));
      setError("Couldn't save your choice. Check your connection and try again.");
    }
  }

  const openIndex = visible.findIndex((i) => i.inspirationId === openId);
  const open = openIndex >= 0 ? visible[openIndex] : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`pill ${
                filter === f.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white hover:bg-stone-100"
              }`}
            >
              {f.label} <span className="opacity-60">{countOf(f.id)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary" onClick={() => setPicking(true)}>
          + Find more by tag
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {filter === "rejected" && visible.length > 0 && (
        <p className="text-sm text-stone-600">Changed your mind? Tap Accept on any photo to move it back.</p>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">
          {items.length === 0 ? "No inspiration photos yet. Use “Find more by tag” to add some." : "Nothing here."}
        </p>
      ) : (
        <Grid>
          {visible.map((i) => (
            <PhotoTile
              key={i.inspirationId}
              src={mediaUrl("photo", i.photoId, "thumb", accessKey)}
              alt={i.title || "Inspiration photo"}
              state={i.state}
              commentCount={i.commentCount}
              onOpen={() => setOpenId(i.inspirationId)}
              footer={<ChoiceButtons state={i.state} onChoose={(n) => choose(i.inspirationId, i.state, n)} />}
            />
          ))}
        </Grid>
      )}

      {open && (
        <Lightbox
          src={mediaUrl("photo", open.photoId, "preview", accessKey)}
          alt={open.title || "Inspiration photo"}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(visible[openIndex - 1].inspirationId) : undefined}
          onNext={openIndex < visible.length - 1 ? () => setOpenId(visible[openIndex + 1].inspirationId) : undefined}
        >
          <div className="space-y-2">
            {open.title && <h2 className="font-semibold">{open.title}</h2>}
            {open.tags.length > 0 && (
              <p className="text-sm text-stone-500">{open.tags.map((t) => `#${t}`).join(" ")}</p>
            )}
            <ChoiceButtons state={open.state} onChoose={(n) => choose(open.inspirationId, open.state, n)} large />
          </div>
          <Comments
            accessKey={accessKey}
            target={{ inspirationId: open.inspirationId }}
            onCountChange={(n) => setCounts((c) => ({ ...c, [open.inspirationId]: n }))}
          />
        </Lightbox>
      )}

      {picking && (
        <LibraryPicker
          accessKey={accessKey}
          existingPhotoIds={inspirations.map((i) => i.photoId)}
          onAdd={(ids) => clientAddInspirationsAction(accessKey, ids)}
          onClose={() => setPicking(false)}
        />
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
  const base = `flex-1 cursor-pointer rounded-lg border font-medium transition ${large ? "py-2 text-sm" : "py-1 text-xs"}`;
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        aria-pressed={state === "accepted"}
        onClick={() => onChoose("accepted")}
        className={`${base} ${
          state === "accepted"
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-stone-300 bg-white text-stone-700 hover:border-emerald-500 hover:text-emerald-700"
        }`}
      >
        ✓ Accept
      </button>
      <button
        type="button"
        aria-pressed={state === "rejected"}
        onClick={() => onChoose("rejected")}
        className={`${base} ${
          state === "rejected"
            ? "border-stone-700 bg-stone-700 text-white"
            : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
        }`}
      >
        ✕ Reject
      </button>
    </div>
  );
}

function YourPhotos({ accessKey, photos }: { accessKey: string; photos: BoardShootPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const openIndex = photos.findIndex((p) => p.id === openId);
  const open = openIndex >= 0 ? photos[openIndex] : null;

  if (photos.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-500">Your photos will appear here after the shoot.</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          {photos.length} photo{photos.length === 1 ? "" : "s"} from your shoot
        </p>
        <a className="btn-primary" href={`/download/${encodeURIComponent(accessKey)}`}>
          Download all (.zip)
        </a>
      </div>
      <Grid>
        {photos.map((p) => (
          <PhotoTile
            key={p.id}
            src={mediaUrl("shoot", p.id, "thumb", accessKey)}
            alt={p.filename}
            commentCount={counts[p.id] ?? p.commentCount}
            onOpen={() => setOpenId(p.id)}
            footer={
              <a className="text-xs text-stone-600 underline hover:text-stone-900" href={mediaUrl("shoot", p.id, "original", accessKey, true)}>
                Download
              </a>
            }
          />
        ))}
      </Grid>
      {open && (
        <Lightbox
          src={mediaUrl("shoot", open.id, "preview", accessKey)}
          alt={open.filename}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(photos[openIndex - 1].id) : undefined}
          onNext={openIndex < photos.length - 1 ? () => setOpenId(photos[openIndex + 1].id) : undefined}
        >
          <div className="space-y-2">
            <h2 className="truncate font-semibold">{open.filename}</h2>
            <a className="btn-primary w-full" href={mediaUrl("shoot", open.id, "original", accessKey, true)}>
              Download full size
            </a>
          </div>
          <Comments
            accessKey={accessKey}
            target={{ shootPhotoId: open.id }}
            onCountChange={(n) => setCounts((c) => ({ ...c, [open.id]: n }))}
          />
        </Lightbox>
      )}
    </section>
  );
}
