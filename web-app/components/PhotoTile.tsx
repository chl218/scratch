"use client";

import type { ReactNode } from "react";
import { AcceptMark, RejectMark } from "./Marks";

export type TileState = "undecided" | "accepted" | "rejected";

/** Justified-row container (SPEC §4): every photo keeps its shape; nothing is cropped. */
export function JustifiedGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`justified ${className}`}>{children}</div>;
}

/**
 * One photo in a justified row: a print on the light table. Shows the grease-pencil
 * mark for its state, a ♥ for favourites and the comment count. `actions` sit under
 * the photo on touch screens and over it on hover elsewhere.
 */
export function PhotoTile({
  id,
  src,
  alt,
  width,
  height,
  onOpen,
  state,
  justChanged = false,
  favourite,
  commentCount = 0,
  selected,
  badge,
  actions,
  caption,
  openLabel,
}: {
  id: string;
  src: string | null;
  alt: string;
  width: number;
  height: number;
  onOpen?: () => void;
  state?: TileState;
  /** True right after the person changed the state, so the mark draws itself. */
  justChanged?: boolean;
  favourite?: boolean;
  commentCount?: number;
  selected?: boolean;
  badge?: string;
  actions?: ReactNode;
  caption?: ReactNode;
  openLabel?: string;
}) {
  const ar = Math.max(0.4, Math.min(3, width / height || 1));
  return (
    <div className="jt jt-hover" style={{ ["--ar" as string]: ar }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel ?? alt}
        disabled={!onOpen}
        className={`jt-frame cursor-pointer overflow-hidden bg-sleeve disabled:cursor-default ${
          selected ? "outline-3 outline-offset-2 outline-marker" : ""
        }`}
        style={{ paddingBottom: `${100 / ar}%` }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- access-checked image route
          <img
            src={src}
            alt={alt}
            loading="lazy"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className={state === "rejected" ? "opacity-45" : ""}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm text-loupe">
            {alt}
          </span>
        )}
        {state === "accepted" && <AcceptMark seed={id} drawn={justChanged} />}
        {state === "rejected" && <RejectMark seed={id} drawn={justChanged} />}
        {badge && (
          <span className="absolute left-1.5 top-1.5 rounded-[4px] bg-sheet/90 px-1.5 py-0.5 text-xs font-semibold text-graphite">
            {badge}
          </span>
        )}
        {(favourite || commentCount > 0) && (
          <span className="absolute right-1.5 top-1.5 flex gap-1">
            {favourite && (
              <span className="rounded-[4px] bg-sheet/90 px-1.5 py-0.5 text-xs text-marker" aria-label="Favourite">
                ♥
              </span>
            )}
            {commentCount > 0 && (
              <span className="rounded-[4px] bg-sheet/90 px-1.5 py-0.5 text-xs text-graphite" aria-label={`${commentCount} comments`}>
                {commentCount} {commentCount === 1 ? "comment" : "comments"}
              </span>
            )}
          </span>
        )}
      </button>
      {actions && <div className="jt-actions">{actions}</div>}
      {caption && <div className="mt-1 truncate text-xs text-loupe">{caption}</div>}
    </div>
  );
}
