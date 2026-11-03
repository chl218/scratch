// Grease-pencil marks for Accept and Reject (SPEC §5). A few hand-drawn variants,
// picked per photo so they don't look stamped. They draw themselves only when the
// person taps (the `drawn` prop), and appear instantly with reduced motion.

const CIRCLES = [
  "M 22 38 C 28 16, 70 10, 83 33 C 94 55, 76 86, 46 85 C 19 84, 10 60, 19 42 C 24 32, 35 26, 47 25",
  "M 30 23 C 53 9, 88 24, 85 52 C 82 79, 51 91, 29 78 C 11 67, 13 39, 32 27 C 38 24, 47 22, 56 23",
  "M 77 25 C 60 9, 21 17, 15 46 C 11 73, 41 89, 65 80 C 87 71, 91 43, 74 29 C 66 23, 56 21, 47 22",
];

const CROSSES = [
  ["M 16 14 C 38 36, 62 62, 86 87", "M 84 13 C 62 37, 39 61, 15 86"],
  ["M 13 18 C 36 40, 64 63, 88 84", "M 87 16 C 66 34, 37 64, 18 88"],
  ["M 18 12 C 40 37, 59 60, 83 89", "M 82 14 C 59 35, 41 62, 13 84"],
];

function variant(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % n;
}

const svgProps = {
  viewBox: "0 0 100 100",
  preserveAspectRatio: "none",
  "aria-hidden": true,
  className: "pointer-events-none absolute inset-0 h-full w-full",
} as const;

export function AcceptMark({ seed, drawn = false }: { seed: string; drawn?: boolean }) {
  return (
    <svg {...svgProps} className={`${svgProps.className} mark mark-accept ${drawn ? "mark-draw" : ""}`}>
      <path d={CIRCLES[variant(seed, CIRCLES.length)]} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RejectMark({ seed, drawn = false }: { seed: string; drawn?: boolean }) {
  const [a, b] = CROSSES[variant(seed, CROSSES.length)];
  return (
    <svg {...svgProps} className={`${svgProps.className} mark mark-reject ${drawn ? "mark-draw" : ""}`}>
      <path className="halo" d={a} pathLength={1} vectorEffect="non-scaling-stroke" />
      <path d={a} pathLength={1} vectorEffect="non-scaling-stroke" />
      <path className="halo" d={b} pathLength={1} vectorEffect="non-scaling-stroke" />
      <path d={b} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
