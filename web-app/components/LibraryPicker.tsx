"use client";

import { useEffect, useState, useTransition } from "react";
import { adminSearchLibraryAction } from "@/app/actions/admin";
import type { LibraryPhoto } from "@/lib/data";
import { mediaUrl, parseTags } from "@/lib/shared";
import { JustifiedGrid, PhotoTile } from "./PhotoTile";

/** Admin dialog: search the library by tag and pick pictures to add to a client page (F3). */
export function LibraryPicker({
  existingPhotoIds,
  onAdd,
  onClose,
}: {
  existingPhotoIds: string[];
  onAdd: (photoIds: string[]) => Promise<void>;
  onClose: () => void;
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
        const res = await adminSearchLibraryAction(q);
        setPhotos(res.photos);
        setTags(res.tags);
      } catch {
        setError("The search didn't load. Try again.");
      }
    });
  }

  useEffect(() => {
    search("");
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
        setError("The pictures weren't added. Try again.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#26292c]/70 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-[6px] bg-table sm:rounded-[6px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add from the library"
      >
        <div className="flex items-center justify-between border-b border-sleeve p-4">
          <h2 className="text-lg font-semibold">Add from the library</h2>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-3 border-b border-sleeve p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
          >
            <input className="input" aria-label="Search tags" placeholder="Search tags, e.g. #moody #portrait" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" className="btn-primary" disabled={searching}>Search</button>
          </form>
          {tags.length > 0 && (
            <div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">
              {tags.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  aria-pressed={activeTags.includes(t.name)}
                  onClick={() => toggleTag(t.name)}
                  className={`pill text-xs ${activeTags.includes(t.name) ? "pill-on" : ""}`}
                >
                  #{t.name} <span className="opacity-75">{t.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {error && <p className="error-note mb-3">⚠ {error}</p>}
          {photos === null || searching ? (
            <p className="text-sm text-loupe">Searching…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-loupe">No pictures match those tags.</p>
          ) : (
            <JustifiedGrid>
              {photos.map((p) => {
                const already = existing.has(p.id);
                return (
                  <PhotoTile
                    key={p.id}
                    id={p.id}
                    src={mediaUrl("photo", p.id, "thumb")}
                    alt={p.title || p.tags.map((t) => `#${t}`).join(" ")}
                    width={p.width}
                    height={p.height}
                    selected={selected.has(p.id)}
                    badge={already ? "On this page" : selected.has(p.id) ? "Selected" : undefined}
                    onOpen={already ? undefined : () => toggle(p.id)}
                  />
                );
              })}
            </JustifiedGrid>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-sleeve p-4">
          <span className="text-sm text-loupe">{selected.size} selected</span>
          <button type="button" className="btn-primary" disabled={selected.size === 0 || adding} onClick={add}>
            {adding ? "Adding…" : `Add ${selected.size || ""} to the page`}
          </button>
        </div>
      </div>
    </div>
  );
}
