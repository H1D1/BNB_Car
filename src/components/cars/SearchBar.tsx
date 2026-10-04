"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn, defaultDates, placeName } from "@/lib/utils";
import type { Place } from "@/lib/types";
import { LocationInput, type LocationSelection } from "../ui/LocationInput";
import { DateRangePicker } from "../ui/DateRangePicker";

type Initial = { place?: string; start?: string; end?: string; lat?: number; lng?: number; label?: string };

/** GET form → /search. Location is either a curated place slug or a Mapbox point (lat/lng/label). */
export function SearchBar({
  places,
  initial,
  compact,
  extraParams,
}: {
  places: Place[];
  initial?: Initial;
  compact?: boolean;
  extraParams?: Record<string, string>;
}) {
  const { t, locale } = useI18n();
  const defaults = defaultDates();
  const [start, setStart] = useState(initial?.start ?? defaults.start);
  const [end, setEnd] = useState(initial?.end ?? defaults.end);
  const [loc, setLoc] = useState<{ place?: string; lat?: number; lng?: number; label?: string }>({
    place: initial?.place,
    lat: initial?.lat,
    lng: initial?.lng,
    label: initial?.label,
  });

  const initialPlace = places.find((p) => p.slug === initial?.place);
  const defaultLabel =
    initial?.label ?? (initialPlace ? placeName(initialPlace, locale) + (initialPlace.iata ? ` (${initialPlace.iata})` : "") : "");

  const onSelect = (sel: LocationSelection) =>
    setLoc(sel.kind === "place" ? { place: sel.place.slug } : { lat: sel.lat, lng: sel.lng, label: sel.label });

  const cell = "flex min-w-0 flex-1 flex-col justify-center rounded-2xl px-4 py-2 transition hover:bg-white/[0.06] focus-within:bg-white/[0.08]";
  const input = "w-full bg-transparent text-[15px] font-semibold text-white outline-none placeholder:text-white/40 placeholder:font-normal [color-scheme:dark]";

  return (
    <form
      action="/search"
      method="get"
      className={cn(
        "glass-strong relative z-20 flex w-full flex-col gap-1 rounded-[1.75rem] p-2 md:flex-row md:items-stretch md:rounded-full",
        compact ? "max-w-4xl" : "max-w-5xl",
      )}
    >
      {extraParams && Object.entries(extraParams).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {loc.place && <input type="hidden" name="place" value={loc.place} />}
      {loc.lat != null && loc.lng != null && (
        <>
          <input type="hidden" name="lat" value={loc.lat.toFixed(5)} />
          <input type="hidden" name="lng" value={loc.lng.toFixed(5)} />
          <input type="hidden" name="label" value={loc.label ?? ""} />
        </>
      )}
      <div className={cn(cell, "md:flex-[1.5]")}>
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-white/50 uppercase">
          <MapPin className="size-3.5" />
          {t("home.where")}
        </span>
        <LocationInput
          places={places}
          defaultLabel={defaultLabel}
          onSelect={onSelect}
          onClear={() => setLoc({})}
          placeholder={t("location.placeholder")}
          inputClassName={input}
        />
      </div>
      <div className="hidden w-px self-stretch bg-white/10 md:block" />
      <DateRangePicker
        start={start}
        end={end}
        onChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
        names={{ start: "start", end: "end" }}
        align="center"
      />
      <button
        type="submit"
        className="mt-1 flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-saffron-400 to-terracotta-400 px-7 font-bold text-ink-950 shadow-[0_8px_24px_-6px_rgba(226,114,91,0.7)] transition hover:brightness-110 active:scale-[0.98] md:mt-0 md:h-auto md:rounded-full"
      >
        <Search className="size-5" />
        <span className={cn(compact && "md:sr-only lg:not-sr-only")}>{t("home.searchCta")}</span>
      </button>
    </form>
  );
}
