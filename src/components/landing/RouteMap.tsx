"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CarFront } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useScrollProgress } from "@/lib/motion";
import { CITY_POINTS, MAP_VIEWBOX, MOROCCO_OUTLINE, ROUTE_ORDER, ROUTE_PATH } from "@/lib/morocco-map";
import { cn, placeName } from "@/lib/utils";
import type { Place } from "@/lib/types";

type Stop = (typeof ROUTE_ORDER)[number];

// Labels that sit west of their dot (over the ocean) so neighbouring cities don't collide.
const LABEL_LEFT = new Set<string>(["casablanca", "agadir", "dakhla"]);

/**
 * The signature motion piece: scrolling drives a car along the Atlantic road from Tangier to
 * Dakhla. The route draws itself, cities light up as the car reaches them, and the side panel
 * follows the current stop. Pinned with `position: sticky`; progress comes from section scroll.
 */
export function RouteMap({ places, counts }: { places: Place[]; counts: Record<string, number> }) {
  const { t, locale } = useI18n();
  const section = useRef<HTMLElement>(null);
  const path = useRef<SVGPathElement>(null);
  const progress = useScrollProgress(section);
  const [geo, setGeo] = useState<{ samples: { x: number; y: number }[]; stops: number[] } | null>(null);

  // Measure the route once: total length + how far along it each city sits.
  useEffect(() => {
    const p = path.current;
    if (!p) return;
    const length = p.getTotalLength();
    const samples = Array.from({ length: 400 }, (_, i) => {
      const pt = p.getPointAtLength((i / 399) * length);
      return { f: i / 399, x: pt.x, y: pt.y };
    });
    const stops = ROUTE_ORDER.map((slug) => {
      const [cx, cy] = CITY_POINTS[slug];
      return samples.reduce((best, s) => ((s.x - cx) ** 2 + (s.y - cy) ** 2 < (best.x - cx) ** 2 + (best.y - cy) ** 2 ? s : best)).f;
    });
    setGeo({ samples: samples.map(({ x, y }) => ({ x, y })), stops });
  }, []);

  // Each leg of the trip gets an equal share of the scroll, eased so the car dwells at
  // every city instead of racing past the close-together northern stops.
  const p = (() => {
    if (!geo) return 0;
    const legs = geo.stops.length - 1;
    const q = Math.min(1, Math.max(0, (progress - 0.04) / 0.9)) * legs;
    const i = Math.min(legs - 1, Math.floor(q));
    const tl = Math.min(1, Math.max(0, (q - i - 0.18) / 0.64));
    const eased = tl * tl * (3 - 2 * tl);
    return geo.stops[i] + (geo.stops[i + 1] - geo.stops[i]) * eased;
  })();
  // Car position from the pre-sampled route (no DOM reads during render).
  const car = (() => {
    if (!geo) return null;
    const n = geo.samples.length - 1;
    const i = Math.min(n - 1, Math.floor(p * n));
    const a = geo.samples[i];
    const b = geo.samples[i + 1];
    const k = p * n - i;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  })();

  const reached = (i: number) => !!geo && p >= geo.stops[i] - 0.004;
  const activeIndex = geo ? Math.max(0, geo.stops.findLastIndex((f) => p >= f - 0.004)) : 0;
  const active: Stop = ROUTE_ORDER[activeIndex];
  const placeOf = (slug: string) => places.find((pl) => pl.slug === slug);

  return (
    <section ref={section} className="relative h-[420vh]" aria-labelledby="route-title">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden pt-20 pb-6">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 md:grid-cols-[1.05fr_1fr] md:gap-14 md:px-6">
          {/* Map */}
          <div className="relative mx-auto h-[44svh] w-full max-w-[520px] md:h-[78svh]">
            <svg viewBox={MAP_VIEWBOX} className="size-full overflow-visible" role="img" aria-label={t("home.route.mapLabel")}>
              <defs>
                <pattern id="zellige" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M14 2l3.5 8.5L26 14l-8.5 3.5L14 26l-3.5-8.5L2 14l8.5-3.5z" fill="none" className="stroke-white/10" strokeWidth="0.6" />
                </pattern>
                <linearGradient id="route-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-saffron-400)" />
                  <stop offset="100%" stopColor="var(--color-terracotta-500)" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path d={MOROCCO_OUTLINE} className="fill-white/[0.05] stroke-white/30" strokeWidth="1.2" strokeLinejoin="round" />
              <path d={MOROCCO_OUTLINE} fill="url(#zellige)" />

              {/* full route, faint */}
              <path d={ROUTE_PATH} fill="none" className="stroke-white/20" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
              {/* travelled route */}
              <path
                ref={path}
                d={ROUTE_PATH}
                fill="none"
                stroke="url(#route-grad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - p}
                filter="url(#glow)"
              />

              {ROUTE_ORDER.map((slug, i) => {
                const [x, y] = CITY_POINTS[slug];
                const on = reached(i);
                const place = placeOf(slug);
                return (
                  <g key={slug} className="transition-opacity duration-500" opacity={on ? 1 : 0.45}>
                    <circle cx={x} cy={y} r={on ? 6 : 4} className={cn("transition-all duration-500", on ? "fill-saffron-400" : "fill-white/50")} />
                    {slug === active && <circle cx={x} cy={y} r="13" className="animate-ping fill-saffron-400/30" style={{ transformOrigin: `${x}px ${y}px` }} />}
                    <text
                      x={x + (LABEL_LEFT.has(slug) ? -11 : 11)}
                      y={y + (slug === "rabat" ? -2 : slug === "casablanca" ? 8 : 4)}
                      textAnchor={LABEL_LEFT.has(slug) ? "end" : "start"}
                      className={cn("text-[13px] font-semibold transition-all duration-500", on ? "fill-white" : "fill-white/50")}
                    >
                      {place ? placeName(place, locale) : slug}
                    </text>
                  </g>
                );
              })}

              {car && (
                <g transform={`translate(${car.x} ${car.y})`}>
                  <circle r="15" className="fill-majorelle-500" filter="url(#glow)" />
                  <circle r="15" className="fill-none stroke-snow/70" strokeWidth="1.5" />
                  <g transform={`rotate(${car.angle + 90})`}>
                    <CarFront x={-8} y={-8} width={16} height={16} className="text-snow" strokeWidth={2.2} />
                  </g>
                </g>
              )}
            </svg>
          </div>

          {/* Narrative */}
          <div className="relative">
            <h2 id="route-title" className="max-w-md text-3xl leading-tight font-bold tracking-tight md:text-5xl">
              {t("home.route.title")}
            </h2>
            <p className="mt-3 max-w-md text-white/60 md:text-lg">{t("home.route.subtitle")}</p>

            <div className="mt-6 md:mt-10">
              <div key={active} className="glass-strong rounded-3xl p-5 animate-fade-up md:p-7" style={{ animationDuration: "0.5s" }}>
                <p className="flex items-baseline justify-between gap-4">
                  <span className="text-2xl font-bold md:text-3xl">{placeOf(active) ? placeName(placeOf(active)!, locale) : active}</span>
                  <span className="text-sm text-white/60">{t("home.route.cars", { count: counts[active] ?? 0 })}</span>
                </p>
                <p className="mt-2 text-white/75">{t(`home.route.stops.${active}`)}</p>
                <Link
                  href={`/search?place=${active}`}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
                >
                  {t("home.route.cta")}
                  <ArrowUpRight className="size-4 rtl:-scale-x-100" />
                </Link>
              </div>

              <ol className="mt-6 flex gap-1.5" aria-label={t("home.route.title")}>
                {ROUTE_ORDER.map((slug, i) => (
                  <li key={slug} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full origin-left rounded-full bg-gradient-to-r from-saffron-400 to-terracotta-500 transition-transform duration-300 rtl:origin-right"
                      style={{ transform: `scaleX(${reached(i) ? 1 : 0})` }}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
