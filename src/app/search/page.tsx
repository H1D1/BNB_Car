import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { getFavoriteIds, getPlace, getPlaces, parseFilters, searchCars } from "@/lib/data";
import { getUser } from "@/lib/supabase/server";
import { placeName } from "@/lib/utils";
import { SearchBar } from "@/components/cars/SearchBar";
import { SearchResults } from "@/components/cars/SearchResults";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const place = await getPlace(typeof sp.place === "string" ? sp.place : undefined);
  return { title: place ? t("home.carsIn", { city: placeName(place, locale) }) : t("search.title") };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const sp = await props.searchParams;
  const filters = parseFilters(sp);
  const [{ t, locale }, places, cars, user] = await Promise.all([getI18n(), getPlaces(), searchCars(filters), getUser()]);
  const favorites = await getFavoriteIds(user?.id);
  const place = places.find((p) => p.slug === filters.place);

  const heading = filters.label
    ? t("search.resultsNear", { count: cars.length, place: filters.label.split(",")[0] })
    : place
      ? t("search.resultsIn", { count: cars.length, place: placeName(place, locale) })
      : t("search.results", { count: cars.length });

  // keep active filters when re-submitting the top search bar
  const extra: Record<string, string> = {};
  for (const k of ["transmission", "fuel", "category", "min", "max", "booking", "delivery", "seats", "sort"]) {
    const v = sp[k];
    if (typeof v === "string" && v) extra[k] = v;
  }

  return (
    <div className="pt-6 pb-10">
      <div className="mx-auto mb-6 flex max-w-[1600px] justify-center px-3 md:px-6">
        <SearchBar places={places} initial={{ place: filters.place, start: filters.start, end: filters.end, lat: filters.lat, lng: filters.lng, label: filters.label }} compact extraParams={extra} />
      </div>
      <SearchResults cars={cars} places={places} favorites={[...favorites]} loggedIn={!!user} heading={heading}
        here={filters.lat != null && filters.lng != null ? { lat: filters.lat, lng: filters.lng } : undefined}
      />
    </div>
  );
}
