"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Building2, Crosshair, Loader2, MapPin, Plane, TrainFront } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { geocode, reverseGeocode, type GeoResult } from "@/lib/mapbox";
import { cn, placeName } from "@/lib/utils";
import type { Place } from "@/lib/types";

export type LocationSelection =
  | { kind: "place"; place: Place; label: string }
  | { kind: "point"; lat: number; lng: number; label: string; result?: GeoResult };

type Option =
  | { key: string; kind: "place"; place: Place; label: string; sub: string }
  | { key: string; kind: "geo"; result: GeoResult; label: string; sub: string };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Location combobox: our curated places (cities, airports, stations) first,
 * then Mapbox suggestions in Morocco, plus "use my location" via the browser.
 */
export function LocationInput({
  places = [],
  defaultLabel = "",
  onSelect,
  onClear,
  placeholder,
  types,
  proximity,
  showMyLocation = true,
  className,
  inputClassName,
  id,
  required,
}: {
  places?: Place[];
  defaultLabel?: string;
  onSelect: (sel: LocationSelection) => void;
  onClear?: () => void;
  placeholder?: string;
  /** Mapbox feature types, e.g. "address,street,poi" for precise addresses. */
  types?: string;
  proximity?: { lat: number; lng: number };
  showMyLocation?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  required?: boolean;
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const [text, setText] = useState(defaultLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [geo, setGeo] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const typedRef = useRef(false);

  useEffect(() => setText(defaultLabel), [defaultLabel]);

  // Debounced Mapbox lookup — only after the user actually typed.
  useEffect(() => {
    if (!typedRef.current) return;
    const q = text.trim();
    if (q.length < 2) {
      setGeo([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setGeo(await geocode(q, locale, { proximity, types, signal: ctrl.signal }));
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, locale, types, proximity]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const options: Option[] = useMemo(() => {
    const q = norm(text.trim());
    const local = places
      .filter((p) => !q || [p.name_fr, p.name_en, p.name_ar, p.iata ?? "", p.slug].some((n) => norm(n).includes(q)))
      .slice(0, q ? 5 : 8)
      .map<Option>((p) => ({
        key: `p:${p.slug}`,
        kind: "place",
        place: p,
        label: placeName(p, locale) + (p.iata ? ` (${p.iata})` : ""),
        sub: p.kind === "city" ? t("search.cities") : p.kind === "airport" ? t("search.airports") : t("search.stations"),
      }));
    const remote = geo.map<Option>((r) => ({ key: `g:${r.id}`, kind: "geo", result: r, label: r.name, sub: r.fullAddress }));
    return [...local, ...remote];
  }, [text, places, geo, locale, t]);

  const choose = (o: Option) => {
    typedRef.current = false;
    setText(o.label);
    setOpen(false);
    if (o.kind === "place") onSelect({ kind: "place", place: o.place, label: o.label });
    else onSelect({ kind: "point", lat: o.result.lat, lng: o.result.lng, label: o.result.fullAddress, result: o.result });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return setGeoError(t("location.unsupported"));
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const r = await reverseGeocode(lat, lng, locale).catch(() => null);
        const label = r?.fullAddress ?? t("location.myLocation");
        typedRef.current = false;
        setText(r ? (r.neighborhood ? `${r.neighborhood}, ${r.city ?? ""}` : r.fullAddress) : label);
        setLocating(false);
        setOpen(false);
        onSelect({ kind: "point", lat, lng, label, result: r ?? undefined });
      },
      (err) => {
        setLocating(false);
        setGeoError(err.code === err.PERMISSION_DENIED ? t("location.denied") : t("location.failed"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const Icon = (o: Option) =>
    o.kind === "place" ? (o.place.kind === "airport" ? Plane : o.place.kind === "station" ? TrainFront : Building2) : MapPin;

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          typedRef.current = true;
          setText(e.target.value);
          setActive(0);
          setOpen(true);
          if (!e.target.value) onClear?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && options[active]) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className={inputClassName ?? "field"}
      />
      {(loading || locating) && <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-white/50" />}

      {open && (
        <div
          id={listId}
          role="listbox"
          className="glass-strong absolute inset-x-0 top-full z-50 mt-2 max-h-96 min-w-72 overflow-y-auto rounded-2xl p-1.5"
        >
          {showMyLocation && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={useMyLocation}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-saffron-300 transition hover:bg-white/10"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-saffron-500/15">
                {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
              </span>
              {locating ? t("location.locating") : t("location.useMine")}
            </button>
          )}
          {geoError && <p className="px-3 py-2 text-xs text-rose-300">{geoError}</p>}
          {options.map((o, i) => {
            const I = Icon(o);
            return (
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                key={o.key}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition",
                  i === active ? "bg-white/12" : "hover:bg-white/8",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/8 text-white/70">
                  <I className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{o.label}</span>
                  <span className="block truncate text-xs text-white/50">{o.sub}</span>
                </span>
              </button>
            );
          })}
          {!loading && text.trim().length >= 2 && options.length === 0 && (
            <p className="px-3 py-3 text-sm text-white/50">{t("location.noResults")}</p>
          )}
          {geo.length > 0 && <p className="px-3 pt-1 pb-1.5 text-[10px] text-white/30">© Mapbox</p>}
        </div>
      )}
    </div>
  );
}
