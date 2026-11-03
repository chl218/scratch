"use client";

import { useEffect, type ReactNode } from "react";

/** Full-screen view of one photo, with an optional side panel (choices, details, comments). */
export function Lightbox({
  src,
  alt,
  onClose,
  onPrev,
  onNext,
  overlay,
  children,
}: {
  src: string | null;
  alt: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** Drawn over the photo (e.g. the grease-pencil mark). */
  overlay?: ReactNode;
  children?: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
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

  const nav = "absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-[6px] bg-white/12 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#26292c]/96 lg:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
        <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- access-checked image route
            <img
              src={src}
              alt={alt}
              className="block max-h-[calc(55vh-2rem)] max-w-full object-contain lg:max-h-[calc(100vh-5rem)]"
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          ) : (
            <p className="p-10 text-white/80">{alt}</p>
          )}
          {overlay}
        </div>
        {onPrev && (
          <button type="button" aria-label="Previous photo" className={`${nav} left-2`} onClick={(e) => { e.stopPropagation(); onPrev(); }}>
            Back
          </button>
        )}
        {onNext && (
          <button type="button" aria-label="Next photo" className={`${nav} right-2`} onClick={(e) => { e.stopPropagation(); onNext(); }}>
            Next
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          className="absolute right-3 top-3 cursor-pointer rounded-[6px] bg-white/12 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {children && (
        <aside
          className="flex max-h-[45vh] w-full flex-col gap-4 overflow-auto bg-sheet p-5 text-graphite lg:max-h-none lg:w-96"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </aside>
      )}
    </div>
  );
}
