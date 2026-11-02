"use client";

import { useEffect, type ReactNode } from "react";

/** Full-screen view of one photo with a side panel (actions, tags, comments). */
export function Lightbox({
  src,
  alt,
  onClose,
  onPrev,
  onNext,
  children,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName);
      if (e.key === "Escape") onClose();
      else if (!typing && e.key === "ArrowLeft") onPrev?.();
      else if (!typing && e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 lg:flex-row"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- access-checked image route */}
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
        />
        {onPrev && (
          <button
            type="button"
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/15 px-3 py-2 text-2xl text-white hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
          >
            ‹
          </button>
        )}
        {onNext && (
          <button
            type="button"
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/15 px-3 py-2 text-2xl text-white hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          >
            ›
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          className="absolute right-3 top-3 cursor-pointer rounded-full bg-white/15 px-3 py-1 text-xl text-white hover:bg-white/30"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children && (
        <aside
          className="flex max-h-[45vh] w-full flex-col gap-4 overflow-auto bg-white p-5 lg:max-h-none lg:w-96"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </aside>
      )}
    </div>
  );
}
