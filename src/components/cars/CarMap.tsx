"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import { formatMAD } from "@/lib/currency";
import { useI18n } from "@/lib/i18n/client";
import { MAPBOX_TOKEN } from "@/lib/mapbox";
import { prepareStoryStyle } from "@/lib/map-style";

type Pin = { id: string; lat: number; lng: number; price?: number; label?: string };

const MOROCCO_CENTER: [number, number] = [-7.1, 31.8];

/**
 * App map (search results, car location, listing picker) on Mapbox GL with Morocco's worldview,
 * so the southern provinces are drawn as part of Morocco — raster tiles can't do that.
 * Airbnb-style price pills (white; dark when the car is hovered in the list).
 */
export default function CarMap({
  pins,
  activeId,
  onHover,
  linkQuery,
  picker,
  onPick,
  zoom,
}: {
  pins: Pin[];
  activeId?: string | null;
  onHover?: (id: string | null) => void;
  linkQuery?: string;
  /** Picker mode: click the map to move the single pin (listing wizard). */
  picker?: boolean;
  onPick?: (lat: number, lng: number) => void;
  zoom?: number;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; pin: Pin }>());
  // latest callbacks/values without re-creating the map or markers
  const latest = useRef({ onHover, onPick, linkQuery, router, activeId });
  useEffect(() => {
    latest.current = { onHover, onPick, linkQuery, router, activeId };
  });

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    if (locale === "ar" && mapboxgl.getRTLTextPluginStatus() === "unavailable") {
      mapboxgl.setRTLTextPlugin("https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js", null, true);
    }
    const first = pins[0];
    const m = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      projection: "mercator",
      center: first ? [first.lng, first.lat] : MOROCCO_CENTER,
      zoom: zoom ?? (first ? 11 : 4.6),
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    m.on("style.load", () => prepareStoryStyle(m, locale, { declutter: false }));
    m.on("click", (e) => {
      if (picker) latest.current.onPick?.(e.lngLat.lat, e.lngLat.lng);
    });
    if (picker) m.getCanvas().style.cursor = "crosshair";
    map.current = m;
    const current = markers.current;
    return () => {
      current.clear();
      m.remove();
      map.current = null;
    };
    // created once per mount (locale / mode changes remount the component)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers with pins (add / move / remove), then frame the results.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.id);
      const existing = markers.current.get(pin.id);
      if (existing) {
        existing.marker.setLngLat([pin.lng, pin.lat]);
        if (pin.price != null && existing.pin.price !== pin.price) existing.el.textContent = formatMAD(pin.price, locale);
        existing.pin = pin;
        continue;
      }
      const el = document.createElement("div");
      if (pin.price != null) {
        el.className = "map-price-pin";
        el.dataset.active = String(pin.id === latest.current.activeId);
        el.textContent = formatMAD(pin.price, locale);
        if (!picker) {
          el.addEventListener("mouseenter", () => latest.current.onHover?.(pin.id));
          el.addEventListener("mouseleave", () => latest.current.onHover?.(null));
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const { router: r, linkQuery: q } = latest.current;
            r.push(`/cars/${pin.id}${q ? `?${q}` : ""}`);
          });
        }
      } else {
        el.className = "map-dot-pin";
      }
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(m);
      markers.current.set(pin.id, { marker, el, pin });
    }
    for (const [id, entry] of markers.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    }

    if (picker) return; // the host drives the view while picking
    const priced = pins.filter((p) => p.price != null);
    const frame = priced.length ? priced : pins;
    if (frame.length === 0) m.jumpTo({ center: MOROCCO_CENTER, zoom: 4.6 });
    else if (frame.length === 1) m.jumpTo({ center: [frame[0].lng, frame[0].lat], zoom: zoom ?? 12 });
    else {
      const b = new mapboxgl.LngLatBounds();
      frame.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 56, maxZoom: 13, duration: 0 });
    }
  }, [pins, picker, zoom, locale]);

  // Highlight the car hovered in the list.
  useEffect(() => {
    for (const [id, { el }] of markers.current) {
      if (!el.classList.contains("map-price-pin")) continue;
      el.setAttribute("data-active", String(id === activeId));
    }
  }, [activeId]);

  // mapbox-gl.css forces .mapboxgl-map to position:relative, so position a wrapper instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  );
}
