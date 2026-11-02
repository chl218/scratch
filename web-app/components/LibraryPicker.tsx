"use client";

import { useEffect, useState, useTransition } from "react";
import { searchLibraryAction } from "@/app/actions/board";
import type { LibraryPhoto } from "@/lib/data";
import { mediaUrl, parseTags } from "@/lib/shared";
import { Grid, PhotoTile } from "./PhotoTile";

/**
 * Search the whole library by tag and pick photos to add to a client page (F4).
 * Used by the client (private link / account) and by the admin.
 */
export function LibraryPicker({
  accessKey,
  existingPhotoIds,
  onAdd,
  onClose,
  title = "Find inspiration by tag",
}: {
  accessKey: string;
  existingPhotoIds: string[];
  onAdd: (photoIds: string[]) => Promise<void>;
  onClose: () => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const existing = new Set(existingPhotoIds);
  const activeTags = parseTags(query);

  function search(q: string) {
    startSearch(async () => {
      try {
        const res = await searchLibraryAction(accessKey, q);
        setPhotos(res.photos);
        setTags(res.tags);
      } catch {
        setError("Search failed. Please try again.");
      }
    });
  }

  useEffect(() => {
    search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on open
  }, []);

  function toggleTag(name: string) {
    const next = activeTags.includes(name) ? activeTags.filter((t) => t !== name) : [...activeTags, name];
    const q = next.map((t) => `#${t}`).join(" ");
    setQuery(q);
    search(q);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function add() {
    startAdd(async () => {
      try {
        await onAdd([...selected]);
        onClose();
      } catch {
        setError("Couldn't add the photos. Please try again.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl bg-stone-50 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-3 border-b border-stone-200 p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
          >
            <input
              className="input"
              placeholder="Search tags, e.g. #moody #portrait"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={searching}>
              Search
            </button>
          </form>
          {tags.length > 0 && (
            <div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">
              {tags.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => toggleTag(t.name)}
                  className={`pill text-xs ${
                    activeTags.includes(t.name)
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white hover:bg-stone-100"
                  }`}
                >
                  #{t.name} <span className="opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
          {photos === null || searching ? (
            <p className="text-sm text-stone-500">Searching…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-stone-500">No photos match those tags.</p>
          ) : (
            <Grid>
              {photos.map((p) => {
                const already = existing.has(p.id);
                return (
                  <PhotoTile
                    key={p.id}
                    src={mediaUrl("photo", p.id, "thumb", accessKey)}
                    alt={p.title || p.tags.map((t) => `#${t}`).join(" ")}
                    selected={selected.has(p.id)}
                    onOpen={already ? undefined : () => toggle(p.id)}
                    footer={
                      <p className="truncate text-xs text-stone-500">
                        {already ? "Already added" : p.tags.map((t) => `#${t}`).join(" ")}
                      </p>
                    }
                  />
                );
              })}
            </Grid>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-200 p-4">
          <span className="text-sm text-stone-600">{selected.size} selected</span>
          <button type="button" className="btn-primary" disabled={selected.size === 0 || adding} onClick={add}>
            {adding ? "Adding…" : `Add ${selected.size || ""} to inspirations`}
          </button>
        </div>
      </div>
    </div>
  );
}
