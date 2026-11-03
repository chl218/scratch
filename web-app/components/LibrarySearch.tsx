"use client";

import { useEffect, useState, useTransition } from "react";
import { searchLibraryAction } from "@/app/actions/client";
import { addFromLibraryAction } from "@/app/actions/board";
import type { LibraryPhoto, SavedReference } from "@/lib/data";
import { mediaUrl, parseTags } from "@/lib/shared";
import { JustifiedGrid, PhotoTile } from "./PhotoTile";
import { Lightbox } from "./Lightbox";

type OpenPage = { id: string; title: string; key: string; photoIds: string[] };

/**
 * The library search in the client area (F4). Saved references from locked pages
 * come first; before a page locks, results can be added to it.
 */
export function LibrarySearch({
  username,
  mediaKey,
  pages,
  initialPageId,
}: {
  username: string;
  /** Any of this client's page keys, used to load library thumbnails. */
  mediaKey: string;
  /** Pages that aren't locked, so pictures can still be added. */
  pages: OpenPage[];
  initialPageId?: string;
}) {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [saved, setSaved] = useState<SavedReference[]>([]);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [pageId, setPageId] = useState(pages.find((p) => p.id === initialPageId)?.id ?? pages[0]?.id ?? "");
  const [added, setAdded] = useState<Record<string, Set<string>>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searching, startSearch] = useTransition();
  const activeTags = parseTags(query);
  const page = pages.find((p) => p.id === pageId);
  const onPage = new Set([...(page?.photoIds ?? []), ...(added[pageId] ?? [])]);

  function search(q: string) {
    startSearch(async () => {
      setError("");
      try {
        const res = await searchLibraryAction(username, q);
        setPhotos(res.photos);
        setSaved(res.saved);
        setTags(res.tags);
      } catch {
        setError("The search didn't load. Check your connection and try again.");
      }
    });
  }

  useEffect(() => {
    search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  function toggleTag(name: string) {
    const next = activeTags.includes(name) ? activeTags.filter((t) => t !== name) : [...activeTags, name];
    const q = next.map((t) => `#${t}`).join(" ");
    setQuery(q);
    search(q);
  }

  async function add(photoId: string) {
    if (!page) return;
    setError("");
    setMessage("");
    const res = await addFromLibraryAction(page.key, [photoId]).catch(() => ({ error: "That didn't save. Try again." }));
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setAdded((a) => ({ ...a, [page.id]: new Set([...(a[page.id] ?? []), photoId]) }));
    setMessage(`Added to ${page.title}.`);
  }

  const savedPhotoIds = new Set(saved.map((s) => s.photoId).filter(Boolean));
  const results = (photos ?? []).filter((p) => !savedPhotoIds.has(p.id));
  const open = results.find((p) => p.id === openId) ?? null;

  return (
    <section className="space-y-4" aria-labelledby="search-heading">
      <h2 id="search-heading" className="text-[24px] font-semibold">Find references</h2>
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
      >
        <label htmlFor="library-search" className="sr-only">Search the library by tag</label>
        <input
          id="library-search"
          className="input"
          placeholder="Search by tag, e.g. #window #moody"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={searching}>
          Search
        </button>
      </form>
      {tags.length > 0 && (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-auto">
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

      {pages.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="add-to" className="font-semibold">Adding to</label>
          <select id="add-to" className="input w-auto" value={pageId} onChange={(e) => setPageId(e.target.value)}>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-loupe">Your photos are ready, so these are for browsing only.</p>
      )}
      {message && <p className="ok-note" role="status">{message}</p>}
      {error && <p className="error-note" role="alert">⚠ {error}</p>}

      {saved.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Your references</h3>
          <JustifiedGrid>
            {saved.map((s) => (
              <PhotoTile
                key={s.referenceId}
                id={s.referenceId}
                src={s.photoId ? mediaUrl("photo", s.photoId, "thumb", mediaKey) : null}
                alt={s.title || s.filename}
                width={s.width}
                height={s.height}
                state="accepted"
                badge="Your reference"
                caption={`${s.title || s.filename}, from ${s.pageTitle}`}
              />
            ))}
          </JustifiedGrid>
        </div>
      )}

      {photos === null || searching ? (
        <p className="text-sm text-loupe">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-loupe">No pictures match those tags. Try fewer tags.</p>
      ) : (
        <JustifiedGrid>
          {results.map((p) => {
            const already = onPage.has(p.id);
            return (
              <PhotoTile
                key={p.id}
                id={p.id}
                src={mediaUrl("photo", p.id, "thumb", mediaKey)}
                alt={p.title || p.tags.map((t) => `#${t}`).join(" ")}
                width={p.width}
                height={p.height}
                onOpen={() => setOpenId(p.id)}
                actions={
                  page ? (
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => add(p.id)}
                      className="w-full cursor-pointer rounded-[6px] border border-sleeve bg-sheet py-1 text-xs font-semibold hover:border-graphite disabled:cursor-default disabled:opacity-60"
                    >
                      {already ? `On ${page.title}` : `Add to ${page.title}`}
                    </button>
                  ) : undefined
                }
              />
            );
          })}
        </JustifiedGrid>
      )}

      {open && (
        <Lightbox src={mediaUrl("photo", open.id, "preview", mediaKey)} alt={open.title || "Reference picture"} onClose={() => setOpenId(null)}>
          <div className="space-y-2">
            {open.title && <h2 className="text-lg font-semibold">{open.title}</h2>}
            {open.credit && <p className="text-sm text-loupe">Photo: {open.credit}</p>}
            {open.tags.length > 0 && <p className="text-sm text-loupe">{open.tags.map((t) => `#${t}`).join(" ")}</p>}
            {page && (
              <button type="button" className="btn-primary w-full" disabled={onPage.has(open.id)} onClick={() => add(open.id)}>
                {onPage.has(open.id) ? `On ${page.title}` : `Add to ${page.title}`}
              </button>
            )}
          </div>
        </Lightbox>
      )}
    </section>
  );
}
