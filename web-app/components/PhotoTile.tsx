"use client";

import type { ReactNode } from "react";

export type TileState = "undecided" | "accepted" | "rejected";

const stateStyles: Record<TileState, { ring: string; badge: string; label: string }> = {
  undecided: { ring: "ring-transparent", badge: "", label: "" },
  accepted: { ring: "ring-emerald-500", badge: "bg-emerald-600", label: "Accepted" },
  rejected: { ring: "ring-stone-400", badge: "bg-stone-600", label: "Rejected" },
};

/** One square in a photo grid. Shows the state and comment count (SPEC §4). */
export function PhotoTile({
  src,
  alt,
  onOpen,
  state,
  commentCount = 0,
  selected,
  footer,
}: {
  src: string;
  alt: string;
  onOpen?: () => void;
  state?: TileState;
  commentCount?: number;
  selected?: boolean;
  footer?: ReactNode;
}) {
  const s = state ? stateStyles[state] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        className={`group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-stone-200 ring-3 ${
          selected ? "ring-sky-500" : (s?.ring ?? "ring-transparent")
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- access-checked image route */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className={`h-full w-full object-cover transition group-hover:scale-[1.02] ${
            state === "rejected" ? "opacity-50 grayscale" : ""
          }`}
        />
        {s?.label && (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium text-white ${s.badge}`}>
            {s.label}
          </span>
        )}
        {selected && (
          <span className="absolute left-2 top-2 rounded-full bg-sky-600 px-2 py-0.5 text-xs font-medium text-white">
            Selected
          </span>
        )}
        {commentCount > 0 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            💬 {commentCount}
          </span>
        )}
      </button>
      {footer}
    </div>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{children}</div>;
}
