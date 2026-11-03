// Packs portfolio photos into the interlocking mosaic (SPEC §4, F13).
// Portrait photos take 1 column × 2 rows, landscape 2 × 1, square 1 × 1.
// Pure function: runs on the server for 2, 4 and 6 columns, so the page needs no JS to lay out.

export type Placement = { col: number; row: number; w: number; h: number } | null;

export function spanFor(width: number, height: number, cols: number): { w: number; h: number } {
  const ar = width / height;
  if (ar > 1.15) return { w: Math.min(2, cols), h: 1 };
  if (ar < 0.87) return { w: 1, h: 2 };
  return { w: 1, h: 1 };
}

/**
 * Places each photo in the first empty cell, reading left to right, top to bottom.
 * A landscape photo that would overhang a gap or the edge becomes a square there, so
 * the mosaic never has holes. With `trim`, the ragged last row is removed (tall photos
 * crossing it become squares), so the mosaic ends in a clean edge.
 * Returns 1-based grid positions, or null for photos that were left out.
 */
export function packMosaic(items: { width: number; height: number }[], cols: number, trim: boolean): Placement[] {
  const grid: boolean[][] = [];
  const taken = (r: number, c: number) => Boolean(grid[r]?.[c]);
  const fill = (r: number, c: number) => {
    grid[r] ??= Array(cols).fill(false);
    grid[r][c] = true;
  };
  let r = 0;
  let c = 0;

  const out: Placement[] = items.map(({ width, height }) => {
    while (taken(r, c)) {
      c++;
      if (c === cols) {
        c = 0;
        r++;
      }
    }
    const span = spanFor(width, height, cols);
    const h = span.h;
    let w = span.w;
    if (w === 2 && (c + 1 >= cols || taken(r, c + 1))) w = 1;
    // Cells below the first empty cell are always free, so a tall photo always fits.
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) fill(r + dr, c + dc);
    return { col: c + 1, row: r + 1, w, h };
  });

  if (!trim) return out;
  const rows = grid.length;
  const full = grid.filter((row) => row.every(Boolean)).length;
  // Fewer photos than one full row: show them all rather than nothing.
  if (full === 0 || full === rows) return out;
  // Rows fill in order with no holes, so rows 1..full are complete.
  return out.map((p) => {
    if (!p || p.row > full) return null;
    if (p.row + p.h - 1 > full) return { ...p, h: full - p.row + 1 };
    return p;
  });
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
