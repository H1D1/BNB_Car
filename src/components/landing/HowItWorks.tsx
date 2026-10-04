"use client";

import { useRef } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useInView, useMediaQuery, useScrollProgress } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* --- Motion graphics: small looping SVG scenes, one per step ---------------------------- */

function SearchScene() {
  const pins = [
    { x: 92, y: 118, price: "280", d: "0s" },
    { x: 200, y: 84, price: "350", d: "0.35s" },
    { x: 236, y: 160, price: "520", d: "0.7s" },
  ];
  return (
    <svg viewBox="0 0 320 240" className="size-full">
      <rect x="16" y="16" width="288" height="208" rx="22" className="fill-white/[0.05] stroke-white/15" />
      {/* streets */}
      <g className="stroke-white/15" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M30 150 C 100 130, 170 190, 300 120" />
        <path d="M120 24 C 140 90, 110 150, 150 222" />
        <path d="M200 30 L 260 220" strokeWidth="3" />
      </g>
      <path d="M40 60 h70 v40 h-70z M230 40 h50 v30 h-50z" className="fill-mint-500/15" />
      {pins.map((p) => (
        <g key={p.x}>
          <g data-anim className="pin" style={{ animationDelay: p.d }}>
            <path
              d={`M${p.x} ${p.y} c-10 -12 -16 -20 -16 -28 a16 16 0 1 1 32 0 c0 8 -6 16 -16 28z`}
              className="fill-majorelle-500 stroke-snow"
              strokeWidth="2"
            />
            <circle cx={p.x} cy={p.y - 28} r="5" className="fill-snow" />
          </g>
          <g data-anim className="pill" style={{ animationDelay: p.d }}>
            <rect x={p.x + 10} y={p.y - 52} width="58" height="22" rx="11" className="fill-snow" />
            <text x={p.x + 39} y={p.y - 37} textAnchor="middle" className="fill-ink-900 text-[11px] font-bold">
              {p.price} MAD
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}

function VerifyScene() {
  return (
    <svg viewBox="0 0 320 240" className="size-full">
      <defs>
        <linearGradient id="scan-grad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--color-mint-400)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--color-mint-400)" />
          <stop offset="1" stopColor="var(--color-mint-400)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="card-clip">
          <rect x="40" y="44" width="240" height="152" rx="16" />
        </clipPath>
      </defs>
      <rect x="40" y="44" width="240" height="152" rx="16" className="fill-white/[0.07] stroke-white/25" />
      <rect x="40" y="44" width="240" height="30" rx="16" className="fill-terracotta-500/30" clipPath="url(#card-clip)" />
      <circle cx="96" cy="128" r="26" className="fill-white/15" />
      <circle cx="96" cy="120" r="10" className="fill-white/40" />
      <path d="M76 148 a20 16 0 0 1 40 0" className="fill-white/40" />
      <g className="fill-white/25">
        <rect x="140" y="104" width="110" height="9" rx="4.5" />
        <rect x="140" y="122" width="80" height="9" rx="4.5" />
        <rect x="140" y="140" width="96" height="9" rx="4.5" />
        <rect x="140" y="166" width="60" height="9" rx="4.5" className="fill-white/15" />
      </g>
      <g clipPath="url(#card-clip)">
        <rect data-anim className="scanline" x="40" y="44" width="240" height="4" fill="url(#scan-grad)" />
      </g>
      <g data-anim className="check">
        <circle cx="262" cy="64" r="22" className="fill-mint-500" />
        <path d="M251 64 l8 8 l14 -15" fill="none" className="stroke-snow" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function DriveScene() {
  return (
    <svg viewBox="0 0 320 240" className="size-full">
      <defs>
        <radialGradient id="beam-grad" cx="0.5" cy="1" r="1">
          <stop offset="0" stopColor="var(--color-saffron-300)" stopOpacity="0.6" />
          <stop offset="1" stopColor="var(--color-saffron-300)" stopOpacity="0.05" />
        </radialGradient>
      </defs>
      {/* road in perspective */}
      <path d="M130 70 L190 70 L300 230 L20 230 Z" className="fill-white/[0.06]" />
      <path data-anim className="lane stroke-saffron-400" d="M160 72 L160 230" strokeWidth="5" strokeDasharray="22 38" fill="none" />
      <path d="M130 70 L20 230 M190 70 L300 230" className="stroke-white/20" strokeWidth="2" />
      {/* headlight beams */}
      <g data-anim className="beam">
        <path d="M128 138 L96 70 L156 70 Z" fill="url(#beam-grad)" />
        <path d="M192 138 L164 70 L224 70 Z" fill="url(#beam-grad)" />
      </g>
      {/* car seen from behind, driving into the beams */}
      <g data-anim className="bob">
        <path d="M100 176 Q102 146 122 138 L198 138 Q218 146 220 176 L220 198 Q220 206 212 206 L108 206 Q100 206 100 198 Z" className="fill-majorelle-500" />
        <path d="M120 140 Q126 112 144 108 L176 108 Q194 112 200 140 Z" className="fill-ink-950/45" />
        <path d="M128 136 Q132 118 146 115 L174 115 Q188 118 192 136 Z" className="fill-majorelle-300/40" />
        <rect x="106" y="160" width="28" height="10" rx="5" className="fill-rose-400" />
        <rect x="186" y="160" width="28" height="10" rx="5" className="fill-rose-400" />
        <rect x="142" y="178" width="36" height="12" rx="3" className="fill-snow/85" />
        <rect x="108" y="206" width="20" height="12" rx="3" className="fill-ink-950/70" />
        <rect x="192" y="206" width="20" height="12" rx="3" className="fill-ink-950/70" />
      </g>
    </svg>
  );
}

const SCENES = [SearchScene, VerifyScene, DriveScene];

function Scene({ index, active }: { index: number; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: false, margin: "0px" });
  const S = SCENES[index];
  return (
    <div ref={ref} className="mg size-full" data-active={active && visible}>
      <S />
    </div>
  );
}

/* --- Section ----------------------------------------------------------------------------- */

export function HowItWorks() {
  const { t } = useI18n();
  const section = useRef<HTMLElement>(null);
  const desktop = useMediaQuery("(min-width: 768px)");
  const progress = useScrollProgress(section);
  const active = Math.min(2, Math.floor(progress * 3));

  const steps = [
    { title: t("home.steps.oneTitle"), text: t("home.steps.oneText") },
    { title: t("home.steps.twoTitle"), text: t("home.steps.twoText") },
    { title: t("home.steps.threeTitle"), text: t("home.steps.threeText") },
  ];

  // Mobile: no pinning — each step stacks with its own scene.
  if (!desktop) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16" aria-labelledby="how-title">
        <h2 id="how-title" className="mb-8 text-3xl font-bold tracking-tight">
          {t("home.howTitle")}
        </h2>
        <ol className="space-y-10">
          {steps.map((s, i) => (
            <li key={s.title}>
              <div className="glass aspect-[4/3] overflow-hidden rounded-[var(--radius-glass)] p-4">
                <Scene index={i} active />
              </div>
              <h3 className="mt-4 text-xl font-bold">
                <span className="me-2 text-white/40">{i + 1}.</span>
                {s.title}
              </h3>
              <p className="mt-1 text-white/65">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section ref={section} className="relative h-[300vh]" aria-labelledby="how-title">
      <div className="sticky top-0 flex h-svh items-center pt-16">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_1.15fr] items-center gap-16 px-6">
          <div>
            <h2 id="how-title" className="text-4xl font-bold tracking-tight lg:text-5xl">
              {t("home.howTitle")}
            </h2>
            <ol className="mt-10 space-y-3">
              {steps.map((s, i) => {
                const on = i === active;
                const fill = Math.min(1, Math.max(0, progress * 3 - i));
                return (
                  <li
                    key={s.title}
                    className={cn("rounded-3xl p-5 transition-all duration-500", on ? "glass-strong" : "opacity-50")}
                    aria-current={on ? "step" : undefined}
                  >
                    <h3 className="flex items-baseline gap-3 text-xl font-bold">
                      <span className={cn("tabular-nums transition-colors", on ? "text-terracotta-300" : "text-white/40")}>{i + 1}</span>
                      {s.title}
                    </h3>
                    <div className={cn("grid transition-all duration-500", on ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                      <p className="overflow-hidden ps-7 text-white/65">{s.text}</p>
                    </div>
                    <div className="ms-7 mt-3 h-0.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full origin-left bg-gradient-to-r from-majorelle-400 to-terracotta-400 rtl:origin-right" style={{ transform: `scaleX(${fill})` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="glass-strong relative aspect-[4/3] overflow-hidden rounded-[2rem] p-6">
            {SCENES.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "absolute inset-6 transition-all duration-700 ease-[var(--ease-liquid)]",
                  i === active ? "scale-100 opacity-100" : i < active ? "-translate-y-6 scale-95 opacity-0" : "translate-y-6 scale-95 opacity-0",
                )}
                aria-hidden={i !== active}
              >
                <Scene index={i} active={i === active} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
