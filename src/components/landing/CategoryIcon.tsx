import { useId } from "react";
import type { CarCategory } from "@/lib/types";

/**
 * Animated side-view silhouettes, one per body type (city car, compact, sedan, SUV, coupé, van).
 * A 2.4 s loop: wheels turn, the body rides the suspension, the road and speed lines pass under,
 * headlights flash; the luxury coupé gets a light sweep. Faces the reading direction (mirrored in RTL).
 */
type Shape = { body: string; windows: string; wheels: number[]; r: number; cy: number; light: [number, number]; tail: [number, number]; rack?: boolean; colors: [string, string] };

const SHAPES: Record<CarCategory, Shape> = {
  city: {
    body: "M16 50 L16 40 Q16 35 22 34 L34 32 Q40 22 50 20 L74 20 Q82 20 88 28 L94 34 Q104 35 106 40 L106 50 Z",
    windows: "M40 32 Q45 24 52 23 L62 23 L62 32 Z M66 23 L73 23 Q79 23 84 32 L66 32 Z",
    wheels: [34, 86], r: 8, cy: 50, light: [101, 38], tail: [17, 38], colors: ["#ec8b6f", "#c95a43"],
  },
  compact: {
    body: "M12 50 L12 40 Q13 35 20 34 L32 32 Q40 21 52 19 L78 19 Q88 20 94 30 L100 34 Q109 35 110 41 L110 50 Z",
    windows: "M38 32 Q44 23 54 22 L64 22 L64 32 Z M68 22 L77 22 Q85 23 90 32 L68 32 Z",
    wheels: [32, 90], r: 8.5, cy: 50, light: [105, 39], tail: [13, 39], colors: ["#5fd3a2", "#2a9d72"],
  },
  sedan: {
    body: "M6 50 L7 41 Q8 36 16 35 L32 33 Q42 22 54 21 L76 21 Q86 22 94 32 L108 34 Q114 35 114 41 L114 50 Z",
    windows: "M38 33 Q46 24 56 24 L64 24 L64 33 Z M68 24 L75 24 Q83 25 89 33 L68 33 Z",
    wheels: [30, 92], r: 8, cy: 50, light: [109, 39], tail: [8, 40], colors: ["#8479f2", "#4c3cc4"],
  },
  suv: {
    body: "M10 48 L10 30 Q10 26 16 25 L26 24 L34 13 Q36 11 42 11 L86 11 Q92 11 96 17 L102 24 Q110 25 110 31 L110 48 Z",
    windows: "M30 25 L37 15 L56 15 L56 25 Z M60 15 L84 15 Q88 15 91 19 L95 25 L60 25 Z",
    wheels: [32, 90], r: 10, cy: 48, light: [105, 31], tail: [11, 31], rack: true, colors: ["#f7cf55", "#e2a514"],
  },
  luxury: {
    body: "M4 50 L5 43 Q6 38 16 37 L38 34 Q52 22 66 21 L80 22 Q92 25 102 33 L112 35 Q117 36 117 42 L117 50 Z",
    windows: "M44 34 Q54 25 66 24 L70 24 L70 34 Z M74 24 L80 24 Q89 26 96 34 L74 34 Z",
    wheels: [30, 94], r: 8.5, cy: 50, light: [112, 40], tail: [6, 42], colors: ["#2a2f52", "#0d1030"],
  },
  van: {
    body: "M8 50 L8 16 Q8 10 15 10 L82 10 Q90 10 96 18 L108 32 Q112 34 112 40 L112 50 Z",
    windows: "M16 16 L36 16 L36 28 L16 28 Z M40 16 L60 16 L60 28 L40 28 Z M64 16 L84 16 Q88 16 92 21 L98 28 L64 28 Z",
    wheels: [28, 90], r: 8.5, cy: 50, light: [107, 38], tail: [9, 36], colors: ["#9aa0b8", "#5c6280"],
  },
};

/** Each category's signature colour (used to tint its card). */
export const CATEGORY_TINT = Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.colors[0]])) as Record<CarCategory, string>;

export function CategoryIcon({ category, className }: { category: CarCategory; className?: string }) {
  const id = useId().replace(/:/g, "");
  const s = SHAPES[category];
  const ground = s.cy + s.r;
  return (
    <svg viewBox="0 0 120 66" className={`cat-icon w-auto overflow-visible rtl:-scale-x-100 ${className ?? "h-14"}`} aria-hidden>
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.colors[0]} />
          <stop offset="1" stopColor={s.colors[1]} />
        </linearGradient>
        <linearGradient id={`beam${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffe08a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe08a" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d={s.body} />
        </clipPath>
      </defs>

      {/* road + speed lines */}
      <line className="road stroke-white/25" x1="-6" y1={ground + 3} x2="126" y2={ground + 3} strokeWidth="2" strokeDasharray="10 8" strokeLinecap="round" />
      <g className="speed stroke-white/30" strokeWidth="1.6" strokeLinecap="round">
        <line x1="-8" y1="26" x2="4" y2="26" />
        <line x1="-14" y1="36" x2="0" y2="36" />
      </g>

      <g className="body">
        {s.rack && <path d="M44 8 L84 8 M50 8 L50 11 M78 8 L78 11" className="stroke-white/50" strokeWidth="2" strokeLinecap="round" />}
        <path d={s.body} fill={`url(#b${id})`} />
        <path d={s.windows} fill="#cfe3ff" opacity="0.85" />
        {/* light sweep (coupé) */}
        {category === "luxury" && (
          <g clipPath={`url(#c${id})`}>
            <rect className="shine" x="-30" y="0" width="16" height="60" fill="#fff" opacity="0.35" transform="skewX(-20)" />
          </g>
        )}
        <rect x={s.light[0] - 4} y={s.light[1] - 2} width="6" height="4" rx="2" fill="#ffe08a" />
        <rect x={s.tail[0]} y={s.tail[1] - 2} width="4" height="4" rx="2" fill="#fb7185" />
        <path className="beam" d={`M${s.light[0] + 2} ${s.light[1]} L${s.light[0] + 26} ${s.light[1] - 7} L${s.light[0] + 26} ${s.light[1] + 7} Z`} fill={`url(#beam${id})`} />
      </g>

      {s.wheels.map((x) => (
        <g key={x} className="wheel">
          <circle cx={x} cy={s.cy} r={s.r} fill="#151a3d" />
          <circle cx={x} cy={s.cy} r={s.r * 0.55} fill="#e5e7f0" />
          <path d={`M${x - s.r * 0.55} ${s.cy} L${x + s.r * 0.55} ${s.cy} M${x} ${s.cy - s.r * 0.55} L${x} ${s.cy + s.r * 0.55}`} stroke="#151a3d" strokeWidth="1.4" />
          <circle cx={x} cy={s.cy} r="1.4" fill="#151a3d" />
        </g>
      ))}
    </svg>
  );
}
