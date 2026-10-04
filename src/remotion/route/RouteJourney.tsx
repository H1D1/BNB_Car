import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { dictionaries, makeT } from "../../lib/i18n/config";
import { prepareStoryStyle } from "../../lib/map-style";
import type { Locale } from "../../lib/types";
import { ROUTE, cameraAt, routeState, type StopSlug } from "../../components/landing/route-math";
import { easeOut, progress, up } from "../showcase/motion";

export type RouteJourneyProps = {
  locale: Locale;
  token: string;
  counts: Record<string, number>;
  names: Record<string, string>;
};

export const ROUTE_FPS = 30;
export const ROUTE_FRAMES = 24 * ROUTE_FPS;

type Overlay = { cities: Record<string, [number, number]>; car: [number, number]; carAngle: number };

/**
 * "From Tangier to Dakhla" rendered as a film: real Mapbox streets (Moroccan worldview), the real
 * 2,000 km driving route drawn as the car advances, camera following in 3D. Each frame waits for
 * the map to be fully idle (all tiles loaded) before Remotion captures it — no blank tiles, no lag.
 */
export function RouteJourney({ locale, token, counts, names }: RouteJourneyProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loadHandle] = useState(() => delayRender("Loading Mapbox style", { timeoutInMilliseconds: 120_000 }));
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const t = makeT(dictionaries[locale]);
  const rtl = locale === "ar";

  const p = frame / (durationInFrames - 1);
  const s = routeState(p);
  const ms = (frame / fps) * 1000;

  // Map once.
  useEffect(() => {
    if (!container.current) return;
    mapboxgl.accessToken = token;
    if (rtl && mapboxgl.getRTLTextPluginStatus() === "unavailable") {
      mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js", null, false);
    }
    const m = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      projection: "mercator",
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      antialias: true,
      center: ROUTE.coords[0],
      zoom: 5,
    });
    map.current = m;
    m.on("load", () => {
      prepareStoryStyle(m, locale);
      const firstSymbol = m.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      const line = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: ROUTE.coords } };
      m.addSource("route", { type: "geojson", data: line, lineMetrics: true });
      m.addLayer({ id: "route-full", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#151a3d", "line-opacity": 0.3, "line-width": 2.5, "line-dasharray": [1.5, 2] } }, firstSymbol);
      m.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#f4c430", "line-width": 14, "line-blur": 9, "line-opacity": 0.75, "line-trim-offset": [0, 1] } }, firstSymbol);
      m.addLayer({ id: "route-done", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#e2725b", "line-width": 5, "line-trim-offset": [0, 1] } }, firstSymbol);
      m.once("idle", () => {
        setReady(true);
        continueRender(loadHandle);
      });
    });
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per frame: move camera + trim the route, then hold the frame until tiles are loaded.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const handle = delayRender(`frame ${frame}`, { timeoutInMilliseconds: 60_000 });
    const cam = cameraAt(s, false);
    m.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: 0, padding: { top: 40, bottom: 40, left: rtl ? 640 : 60, right: rtl ? 60 : 640 } });
    // show [0, f] of the line: trim everything after the car
    const trim: [number, number] = [Math.min(0.9999, s.f), 1];
    m.setPaintProperty("route-done", "line-trim-offset", trim);
    m.setPaintProperty("route-glow", "line-trim-offset", trim);

    const cities = Object.fromEntries(ROUTE.order.map((slug) => {
      const pt = m.project(ROUTE.cities[slug]);
      return [slug, [pt.x, pt.y] as [number, number]];
    }));
    const car = m.project(s.position);
    const idx = Math.min(ROUTE.coords.length - 1, Math.max(1, Math.round(s.f * (ROUTE.coords.length - 1)) + 2));
    const ahead = m.project(ROUTE.coords[idx]);
    setOverlay({ cities, car: [car.x, car.y], carAngle: (Math.atan2(ahead.y - car.y, ahead.x - car.x) * 180) / Math.PI + 90 });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(handle);
    };
    m.once("idle", finish);
    m.triggerRepaint();
    const safety = setTimeout(finish, 20_000);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, ready]);

  const active = s.active;
  const introP = 1 - easeOut(progress(ms, 1600, 600));

  return (
    <AbsoluteFill dir={rtl ? "rtl" : "ltr"} className="bg-[#efece6]" style={{ fontFamily: rtl ? "var(--font-arabic)" : "var(--font-sans)" }}>
      <div ref={container} style={{ position: "absolute", inset: 0 }} />

      {/* city pills + car (positioned from the live map projection) */}
      {overlay &&
        ROUTE.order.map((slug) => {
          const [x, y] = overlay.cities[slug];
          return (
            <div
              key={slug}
              className="route-city absolute"
              data-reached={String(s.reached.includes(slug as StopSlug))}
              data-active={String(active === slug)}
              style={{ left: x - 7, top: y, transform: "translateY(-50%)", direction: "ltr" }}
            >
              <span className="route-city-dot" />
              <span className="route-city-label">
                <b>{names[slug] ?? slug}</b>
                <small>{counts[slug] ?? 0}</small>
              </span>
            </div>
          );
        })}
      {overlay && (
        <div className="route-car absolute" style={{ left: overlay.car[0], top: overlay.car[1], transform: `translate(-50%, -50%) rotate(${overlay.carAngle}deg)` }}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 3l6 16-6-3-6 3z" fill="#fff" />
          </svg>
        </div>
      )}

      {/* edge vignette for legibility */}
      <AbsoluteFill className="pointer-events-none" style={{ background: `linear-gradient(${rtl ? "270deg" : "90deg"}, transparent 55%, rgba(10,15,44,0.35) 100%)` }} />

      {/* Title (intro) */}
      <div className="absolute start-[80px] top-[70px] max-w-[900px] text-[#151a3d]" style={{ opacity: introP }}>
        <p className="text-[78px] leading-none font-bold tracking-tight" style={up(ms, 150, 700, 30)}>
          {t("home.route.title")}
        </p>
        <p className="mt-4 text-[32px] text-[#151a3d]/70" style={up(ms, 350, 700, 24)}>
          {t("home.route.subtitle").split(".")[0]}.
        </p>
      </div>

      {/* Stop card */}
      <div className="absolute end-[80px] top-1/2 w-[480px] -translate-y-1/2 rounded-[32px] bg-[#0f1434]/88 p-9 text-white shadow-2xl backdrop-blur-xl">
        <p className="flex items-baseline justify-between gap-4">
          <span className="text-[44px] leading-none font-bold">{names[active] ?? active}</span>
          <span className="text-[22px] text-white/60">{t("home.route.cars", { count: counts[active] ?? 0 })}</span>
        </p>
        <p className="mt-4 min-h-[96px] text-[24px] leading-snug text-white/80">{t(`home.route.stops.${active}`)}</p>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex flex-1 gap-1.5">
            {ROUTE.order.slice(1).map((slug) => (
              <div key={slug} className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-gradient-to-r from-[#f7cf55] to-[#e2725b]" style={{ width: s.reached.includes(slug) ? "100%" : "0%" }} />
              </div>
            ))}
          </div>
          <span className="text-[22px] font-semibold text-white/70 tabular-nums" dir="ltr">
            {s.km.toLocaleString(rtl ? "ar-MA" : locale)} km
          </span>
        </div>
      </div>

      {/* brand + attribution (required) */}
      <div className="absolute start-[80px] bottom-[56px] flex items-center gap-3 text-[#151a3d]">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#8479f2] to-[#e2725b]">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round">
            <rect x="5.5" y="5.5" width="13" height="13" rx="1" />
            <rect x="5.5" y="5.5" width="13" height="13" rx="1" transform="rotate(45 12 12)" />
            <circle cx="12" cy="12" r="2.4" fill="#fff" stroke="none" />
          </svg>
        </span>
        <span className="text-[26px] font-bold">CarShare Morocco</span>
      </div>
      <p className="absolute end-[24px] bottom-[16px] text-[14px] text-[#151a3d]/60" dir="ltr">
        © Mapbox © OpenStreetMap
      </p>
    </AbsoluteFill>
  );
}
