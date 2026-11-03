"use client";

import { useState } from "react";

/**
 * Sets a photo's focus point for portfolio crops (F13): click where the subject is.
 * Writes hidden focusX / focusY inputs (0–100) into the surrounding form.
 */
export function FocusPicker({ src, x, y }: { src: string; x: number; y: number }) {
  const [point, setPoint] = useState({ x, y });
  return (
    <div>
      <p className="label">Focus point for portfolio crops</p>
      <button
        type="button"
        className="relative block w-full cursor-crosshair"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPoint({
            x: Math.round(((e.clientX - r.left) / r.width) * 100),
            y: Math.round(((e.clientY - r.top) / r.height) * 100),
          });
        }}
        aria-label="Click where the subject is"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- media route */}
        <img src={src} alt="" className="block w-full" draggable={false} />
        <span
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_var(--marker)]"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        />
      </button>
      <p className="mt-1 text-xs text-loupe">Click where the subject is. Now at {point.x}% across, {point.y}% down.</p>
      <input type="hidden" name="focusX" value={point.x} />
      <input type="hidden" name="focusY" value={point.y} />
    </div>
  );
}
