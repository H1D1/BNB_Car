import Link from "next/link";
import { BadgeCheck, MessagesSquare, Receipt, ShieldCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getMarketStats, getPlaces, searchCars } from "@/lib/data";
import { formatMAD } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";
import { placeName } from "@/lib/utils";
import { Hero } from "@/components/landing/Hero";
import { CarMarquee } from "@/components/landing/CarMarquee";
import { RouteFilm } from "@/components/landing/RouteFilm";
import { ShowcasePlayer } from "@/components/landing/ShowcasePlayer";
import { HostBanner } from "@/components/landing/HostBanner";
import { CATEGORY_TINT, CategoryIcon } from "@/components/landing/CategoryIcon";
import { AirportBoard, type BoardRow } from "@/components/landing/AirportBoard";
import { Glass } from "@/components/ui/primitives";
import type { CarCategory } from "@/lib/types";


async function getHostName(id: string | undefined) {
  if (!id) return "Youssef";
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? "Youssef";
}

export default async function Home() {
  const [{ t, locale }, places, featured] = await Promise.all([getI18n(), getPlaces(), searchCars({ sort: "rating" })]);
  const cityName = Object.fromEntries(places.map((p) => [p.slug, placeName(p, locale)]));
  const showcaseCars = featured.filter((c) => c.city_slug === "casablanca").slice(0, 3);
  const showcaseHost = await getHostName(showcaseCars[0]?.host_id);
  const stats = await getMarketStats();
  // "Aéroport Marrakech Menara" → "Marrakech Menara": the IATA badge already says it's an airport.
  const shortAirport = (name: string) => name.replace(/^(Aéroport( de)? |مطار )/u, "").replace(/ Airport$/, "");
  const boardRows: BoardRow[] = places
    .filter((p) => p.kind === "airport" && p.popular)
    .map((a) => ({
      slug: a.slug,
      iata: a.iata ?? a.slug.toUpperCase(),
      name: shortAirport(placeName(a, locale)),
      city: cityName[a.city_slug] ?? a.city_slug,
      count: stats.byAirport[a.slug]?.count ?? 0,
      from: stats.byAirport[a.slug]?.from ?? null,
    }));
  const categories: CarCategory[] = ["city", "compact", "suv", "sedan", "luxury", "van"];

  return (
    <div className="overflow-x-clip">
      <Hero places={places} />

      {/* Live strip of real listings */}
      <section className="py-14 md:py-20" aria-labelledby="live-title">
        <div className="mx-auto mb-6 flex max-w-7xl items-end justify-between gap-4 px-4 md:px-6">
          <h2 id="live-title" className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("home.liveTitle")}
          </h2>
          <Link href="/search" className="text-sm font-semibold text-majorelle-300 hover:underline">
            {t("common.seeAll")}
          </Link>
        </div>
        <CarMarquee cars={featured.slice(0, 14)} cityName={cityName} perDay={t("common.perDay")} />
      </section>

      <RouteFilm />

      <ShowcasePlayer
        cars={showcaseCars.map(({ id, make, model, year, cover_url, daily_price_mad, rating, review_count }) => ({ id, make, model, year, cover_url, daily_price_mad, rating, review_count }))}
        city={cityName.casablanca ?? "Casablanca"}
        hostName={showcaseHost}
      />

      {/* Categories — each car on its own lit stage, with live supply & price */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6" aria-labelledby="cat-title">
        <h2 id="cat-title" className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">
          {t("home.browseCategories")}
        </h2>
        <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0 lg:grid-cols-6">
          {categories.map((c) => {
            const stat = stats.byCategory[c];
            return (
              <Link key={c} href={`/search?category=${c}`} className="glass liquid group flex min-w-48 snap-start flex-col overflow-hidden rounded-2xl">
                <span
                  className="relative grid h-28 place-items-center overflow-hidden"
                  style={{ background: `radial-gradient(120% 90% at 50% 100%, ${CATEGORY_TINT[c]}38, transparent 70%)` }}
                >
                  <CategoryIcon category={c} className="h-[4.6rem] transition-transform duration-500 ease-[var(--ease-liquid)] group-hover:scale-105" />
                </span>
                <span className="flex flex-1 flex-col p-4 pt-3">
                  <span className="font-bold">{t(`car.category.${c}`)}</span>
                  <span className="mt-1 text-xs text-white/50">{t(`car.categoryHint.${c}`)}</span>
                  <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-white/10 pt-3 text-xs">
                    <span className="text-white/60">{t("home.board.cars", { count: stat?.count ?? 0 })}</span>
                    {stat && (
                      <span className="font-semibold" dir="ltr">
                        {t("home.board.from")} {formatMAD(stat.from, locale)}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Airports — split-flap arrivals board + full-name cards */}
      <section className="mx-auto max-w-7xl px-4 md:px-6" aria-labelledby="airports-title">
        <Glass strong className="grid gap-8 overflow-hidden p-4 sm:p-6 md:grid-cols-[1.05fr_1fr] md:p-10">
          <div className="min-w-0">
            <h2 id="airports-title" className="text-3xl font-bold tracking-tight">
              {t("home.airportsTitle")}
            </h2>
            <p className="mt-2 max-w-md text-white/65">{t("home.airportsSubtitle")}</p>
            <div className="mt-6">
              <AirportBoard rows={boardRows} />
            </div>
          </div>
          <div className="grid min-w-0 content-center gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {boardRows.map((a) => (
              <Link key={a.slug} href={`/search?place=${a.slug}`} className="glass-subtle liquid group flex items-center gap-4 rounded-2xl p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#0b0f2e] text-sm font-bold tracking-wider text-[#ffd166]">{a.iata}</span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug font-semibold">{a.name}</span>
                  <span className="mt-0.5 block text-xs text-white/55">
                    {a.city} · {t("home.board.cars", { count: a.count })}
                    {a.from != null && (
                      <>
                        {" · "}
                        <span dir="ltr">
                          {t("home.board.from")} {formatMAD(a.from, locale)}
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Glass>
      </section>

      {/* Why — a quiet list, not another card grid */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6" aria-labelledby="why-title">
        <h2 id="why-title" className="mb-10 max-w-xl text-2xl font-bold tracking-tight md:text-3xl">
          {t("home.whyTitle")}
        </h2>
        <dl className="grid gap-x-16 gap-y-10 md:grid-cols-2">
          {[
            { icon: Receipt, title: t("home.why.priceTitle"), text: t("home.why.priceText") },
            { icon: BadgeCheck, title: t("home.why.trustTitle"), text: t("home.why.trustText") },
            { icon: ShieldCheck, title: t("home.why.insuranceTitle"), text: t("home.why.insuranceText") },
            { icon: MessagesSquare, title: t("home.why.localTitle"), text: t("home.why.localText") },
          ].map((w) => (
            <div key={w.title} className="flex gap-4">
              <w.icon className="mt-1 size-6 shrink-0 text-terracotta-300" />
              <div>
                <dt className="text-lg font-bold">{w.title}</dt>
                <dd className="mt-1 max-w-md text-white/60">{w.text}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <HostBanner />
      </section>
    </div>
  );
}
