"use client";

import { useState, type CSSProperties } from "react";
import { mediaUrl } from "@/lib/shared";
import { Lightbox } from "./Lightbox";

export type MosaicItem = {
  kind: "photo" | "shoot";
  id: string;
  title: string;
  focusX: number;
  focusY: number;
  /** CSS custom properties with this photo's place at 2, 4 and 6 columns (see lib/mosaic.ts). */
  style: Record<string, string>;
};

/** The landing page mosaic (F13). Tapping a photo opens it full screen with Back and Next. */
export function Mosaic({ items }: { items: MosaicItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const item = open === null ? null : items[open];

  return (
    <div className="mosaic">
      <ul className="mosaic-grid">
        {items.map((p, i) => (
          <li key={`${p.kind}-${p.id}`} style={p.style as CSSProperties} className="min-h-0 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={p.title || "Open photo"}
              className="block h-full w-full cursor-zoom-in overflow-hidden bg-sleeve"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- media route */}
              <img
                src={mediaUrl(p.kind, p.id, "thumb")}
                srcSet={`${mediaUrl(p.kind, p.id, "thumb")} 400w, ${mediaUrl(p.kind, p.id, "preview")} 2000w`}
                sizes="(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 100vw"
                alt={p.title}
                loading={i < 8 ? "eager" : "lazy"}
                draggable={false}
                className="h-full w-full object-cover"
                style={{ objectPosition: `${p.focusX}% ${p.focusY}%` }}
              />
            </button>
          </li>
        ))}
      </ul>
      {item && open !== null && (
        <Lightbox
          src={mediaUrl(item.kind, item.id, "preview")}
          alt={item.title || "Photo from the studio"}
          onClose={() => setOpen(null)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < items.length - 1 ? () => setOpen(open + 1) : undefined}
        />
      )}
    </div>
  );
}
