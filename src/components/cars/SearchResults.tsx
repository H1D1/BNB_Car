"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CarFront, List, Map as MapIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn, placeName } from "@/lib/utils";
import type { CarCard as CarCardData } from "@/lib/data";
import type { Place } from "@/lib/types";
import { CarCard } from "./CarCard";
import { CarMapLazy } from "./MapLoader";
import { FilterPanel } from "./FilterPanel";
import { EmptyState } from "../ui/primitives";

export function SearchResults({
  cars,
  places,
  favorites,
  loggedIn,
  heading,
  here,
}: {
  cars: CarCardData[];
  places: Place[];
  favorites: string[];
  loggedIn: boolean;
  heading: string;
  here?: { lat: number; lng: number };
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const cityName = useMemo(() => Object.fromEntries(places.map((p) => [p.slug, placeName(p, locale)])), [places, locale]);
  const pins = useMemo(
    () => [
      ...cars.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, price: c.daily_price_mad as number | undefined })),
      ...(here ? [{ id: "__here", lat: here.lat, lng: here.lng, price: undefined }] : []),
    ],
    [cars, here],
  );

  // carry dates to the car page so the booking widget is prefilled
  const carry = new URLSearchParams();
  for (const k of ["start", "end", "place", "lat", "lng", "label"]) if (sp.get(k)) carry.set(k, sp.get(k)!);
  const query = carry.toString();

  const sort = sp.get("sort") ?? "recommended";

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-3 md:px-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,0.85fr)]">
      <FilterPanel mode="sidebar" className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto" />

      <section className={cn(mobileView === "map" && "hidden xl:block")}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold md:text-2xl">{heading}</h1>
          <div className="flex items-center gap-2">
            <FilterPanel mode="sheet" />
            <label className="sr-only" htmlFor="sort">
              {t("search.sort")}
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => {
                const p = new URLSearchParams(sp.toString());
                p.set("sort", e.target.value);
                router.replace(`/search?${p.toString()}`, { scroll: false });
              }}
              className="field h-9 w-auto rounded-full py-0 text-sm"
            >
              {(["recommended", "price_asc", "price_desc", "rating", "newest"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`search.sortOptions.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {cars.length === 0 ? (
          <EmptyState icon={<CarFront className="size-7" />} title={t("search.noResults")} text={t("search.noResultsHint")} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-2">
            {cars.map((c, i) => (
              <CarCard
                key={c.id}
                car={c}
                placeLabel={cityName[c.city_slug]}
                favorite={favSet.has(c.id)}
                canFavorite={loggedIn}
                highlighted={hovered === c.id}
                onHover={setHovered}
                query={query}
                priority={i < 2}
              />
            ))}
          </div>
        )}
      </section>

      <section
        className={cn(
          "glass sticky top-24 h-[calc(100dvh-7rem)] overflow-hidden rounded-[var(--radius-glass)]",
          mobileView === "map" ? "block" : "hidden xl:block",
          "lg:col-start-2 xl:col-start-auto",
        )}
      >
        <CarMapLazy pins={pins} activeId={hovered} onHover={setHovered} linkQuery={query} />
      </section>

      {/* Mobile list/map toggle */}
      <button
        onClick={() => setMobileView((v) => (v === "list" ? "map" : "list"))}
        className="glass-strong fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-2xl xl:hidden"
      >
        {mobileView === "list" ? <MapIcon className="size-4" /> : <List className="size-4" />}
        {mobileView === "list" ? t("search.map") : t("search.list")}
      </button>
    </div>
  );
}
