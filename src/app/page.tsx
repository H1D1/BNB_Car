import Link from "next/link";
import { BadgeCheck, MessagesSquare, Plane, Receipt, ShieldCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getPlaces, searchCars } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { placeName } from "@/lib/utils";
import { Hero } from "@/components/landing/Hero";
import { CarMarquee } from "@/components/landing/CarMarquee";
import { ShowcasePlayer } from "@/components/landing/ShowcasePlayer";
import { HostBanner } from "@/components/landing/HostBanner";
import { CategoryIcon } from "@/components/landing/CategoryIcon";
import { Glass } from "@/components/ui/primitives";
import type { CarCategory } from "@/lib/types";


async function getCityCounts() {
  const supabase = await createClient();
  const { data } = await supabase.from("cars").select("city_slug").eq("status", "active");
  const perCity: Record<string, number> = {};
  for (const c of data ?? []) perCity[c.city_slug] = (perCity[c.city_slug] ?? 0) + 1;
  return perCity;
}

async function getHostName(id: string | undefined) {
  if (!id) return "Youssef";
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? "Youssef";
}

export default async function Home() {
  const [{ t, locale }, places, perCity, featured] = await Promise.all([getI18n(), getPlaces(), getCityCounts(), searchCars({ sort: "rating" })]);
  const cityName = Object.fromEntries(places.map((p) => [p.slug, placeName(p, locale)]));
  const showcaseCars = featured.filter((c) => c.city_slug === "casablanca").slice(0, 3);
  const showcaseHost = await getHostName(showcaseCars[0]?.host_id);
  const airports = places.filter((p) => p.kind === "airport" && p.popular);
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

      <ShowcasePlayer
        cars={showcaseCars.map(({ id, make, model, year, cover_url, daily_price_mad, rating, review_count }) => ({ id, make, model, year, cover_url, daily_price_mad, rating, review_count }))}
        city={cityName.casablanca ?? "Casablanca"}
        hostName={showcaseHost}
      />

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6" aria-labelledby="cat-title">
        <h2 id="cat-title" className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">
          {t("home.browseCategories")}
        </h2>
        <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-6 md:px-0">
          {categories.map((c) => (
            <Link key={c} href={`/search?category=${c}`} className="glass liquid group min-w-40 snap-start rounded-2xl p-5">
              <CategoryIcon category={c} />
              <p className="mt-3 font-bold">{t(`car.category.${c}`)}</p>
              <p className="mt-1 text-xs text-white/50">{t(`car.categoryHint.${c}`)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Airports */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <Glass strong className="grid gap-8 overflow-hidden p-8 md:grid-cols-[1fr_1.3fr] md:p-12">
          <div>
            <Plane className="size-8 text-terracotta-300" />
            <h2 className="mt-5 text-3xl font-bold tracking-tight">{t("home.airportsTitle")}</h2>
            <p className="mt-3 text-white/65">{t("home.airportsSubtitle")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {airports.map((a) => (
              <Link key={a.slug} href={`/search?place=${a.slug}`} className="glass-subtle liquid flex items-center gap-4 rounded-2xl p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-bold tracking-wider">{a.iata}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{placeName(a, locale)}</span>
                  <span className="text-xs text-white/50">{cityName[a.city_slug]}</span>
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
