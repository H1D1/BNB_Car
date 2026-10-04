import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CarFront, KeyRound, MessagesSquare, Plane, Receipt, Search, ShieldCheck, Sparkles, Star } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getPlaces, searchCars } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatMAD } from "@/lib/currency";
import { placeName } from "@/lib/utils";
import { SearchBar } from "@/components/cars/SearchBar";
import { CarCard } from "@/components/cars/CarCard";
import { ButtonLink } from "@/components/ui/Button";
import { Glass } from "@/components/ui/primitives";
import type { CarCategory } from "@/lib/types";

const CITY_PHOTOS: Record<string, string> = {
  marrakech: "1597212618440-806262de4f6b",
  casablanca: "1577147443647-81856d5151af",
  chefchaouen: "1569383746724-6f1b882b8f46",
  fes: "1539020140153-e479b8c22e70",
  ouarzazate: "1489749798305-4fea3ae63d43",
};
const CITY_GRADIENTS = [
  "from-majorelle-500/70 to-terracotta-500/50",
  "from-terracotta-500/70 to-saffron-500/40",
  "from-mint-500/50 to-majorelle-500/60",
];
const ZELLIGE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 72 72'%3E%3Cpath d='M36 4l9 23 23 9-23 9-9 23-9-23-23-9 23-9z' fill='none' stroke='%23fff'/%3E%3C/svg%3E\")";
const CATEGORY_EMOJI: Record<CarCategory, string> = { city: "🚗", compact: "🚙", sedan: "🚘", suv: "🛻", luxury: "✨", van: "🚐" };

async function getStats() {
  const supabase = await createClient();
  const [{ count }, { data: ratings }, { data: cities }] = await Promise.all([
    supabase.from("cars").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("cars").select("rating").eq("status", "active").not("rating", "is", null),
    supabase.from("cars").select("city_slug").eq("status", "active"),
  ]);
  const avg = ratings?.length ? ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length : 0;
  const perCity: Record<string, number> = {};
  for (const c of cities ?? []) perCity[c.city_slug] = (perCity[c.city_slug] ?? 0) + 1;
  return { cars: count ?? 0, rating: avg, perCity };
}

export default async function Home() {
  const [{ t, locale }, places, stats, featured] = await Promise.all([
    getI18n(),
    getPlaces(),
    getStats(),
    searchCars({ sort: "rating" }),
  ]);
  const cityName = Object.fromEntries(places.map((p) => [p.slug, placeName(p, locale)]));
  const popular = places.filter((p) => p.kind === "city" && p.popular);
  const airports = places.filter((p) => p.kind === "airport" && p.popular);
  const categories: CarCategory[] = ["city", "compact", "suv", "sedan", "luxury", "van"];

  return (
    <div className="overflow-x-clip">
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pt-16 pb-20 md:px-6 md:pt-24">
        <div className="mx-auto max-w-4xl text-center animate-fade-up">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider text-saffron-300 uppercase">
            <Sparkles className="size-3.5" />
            {t("home.eyebrow")}
          </span>
          <h1 className="mt-6 text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl lg:text-7xl">
            {t("home.title")}
            <span className="text-gradient block">{t("home.titleAccent")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/65">{t("home.subtitle")}</p>
        </div>
        <div className="mt-10 flex justify-center [animation-delay:150ms] animate-fade-up">
          <SearchBar places={places} />
        </div>
        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 text-center">
          {[
            { v: stats.cars, l: t("home.statCars") },
            { v: Object.keys(stats.perCity).length, l: t("home.statCities") },
            { v: stats.rating ? stats.rating.toFixed(2) : "—", l: t("home.statRating"), star: true },
          ].map((s) => (
            <Glass key={s.l} className="px-3 py-4">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold md:text-3xl">
                {s.v}
                {s.star && <Star className="size-5 fill-saffron-400 text-saffron-400" />}
              </div>
              <div className="mt-1 text-xs text-white/55 md:text-sm">{s.l}</div>
            </Glass>
          ))}
        </div>
      </section>

      {/* Popular cities */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <h2 className="mb-6 text-2xl font-bold md:text-3xl">{t("home.popularCities")}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {popular.map((c, i) => (
            <Link
              key={c.slug}
              href={`/search?place=${c.slug}`}
              className="liquid glass group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-glass)]"
            >
              {CITY_PHOTOS[c.slug] ? (
                <Image
                  src={`https://images.unsplash.com/photo-${CITY_PHOTOS[c.slug]}?auto=format&fit=crop&w=600&q=70`}
                  alt={placeName(c, locale)}
                  fill
                  sizes="(max-width: 768px) 50vw, 17vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${CITY_GRADIENTS[i % CITY_GRADIENTS.length]}`}>
                  <div className="atmosphere-zellige absolute inset-0 opacity-25" style={{ backgroundImage: ZELLIGE }} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="text-lg font-bold">{placeName(c, locale)}</p>
                <p className="text-xs text-white/65">
                  {stats.perCity[c.slug] ?? 0} {t("home.statCars")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto mt-20 max-w-7xl px-4 md:px-6">
        <h2 className="mb-6 text-2xl font-bold md:text-3xl">{t("home.browseCategories")}</h2>
        <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-6 md:px-0">
          {categories.map((c) => (
            <Link key={c} href={`/search?category=${c}`} className="glass liquid min-w-40 snap-start rounded-2xl p-5">
              <span className="text-3xl">{CATEGORY_EMOJI[c]}</span>
              <p className="mt-3 font-bold">{t(`car.category.${c}`)}</p>
              <p className="mt-1 text-xs text-white/50">{t(`car.categoryHint.${c}`)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto mt-20 max-w-7xl px-4 md:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold md:text-3xl">{t("search.sortOptions.rating")}</h2>
          <Link href="/search?sort=rating" className="flex items-center gap-1 text-sm font-semibold text-saffron-300 hover:underline">
            {t("common.seeAll")}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 6).map((car) => (
            <CarCard key={car.id} car={car} placeLabel={cityName[car.city_slug]} />
          ))}
        </div>
      </section>

      {/* Airports */}
      <section className="mx-auto mt-20 max-w-7xl px-4 md:px-6">
        <Glass strong className="grid gap-8 overflow-hidden p-8 md:grid-cols-[1fr_1.3fr] md:p-12">
          <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-saffron-500/15 text-saffron-300">
              <Plane className="size-6" />
            </span>
            <h2 className="mt-5 text-3xl font-bold">{t("home.airportsTitle")}</h2>
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

      {/* How it works */}
      <section className="mx-auto mt-20 max-w-7xl px-4 md:px-6">
        <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">{t("home.howTitle")}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Search, title: t("home.steps.oneTitle"), text: t("home.steps.oneText") },
            { icon: BadgeCheck, title: t("home.steps.twoTitle"), text: t("home.steps.twoText") },
            { icon: KeyRound, title: t("home.steps.threeTitle"), text: t("home.steps.threeText") },
          ].map((s, i) => (
            <Glass key={s.title} liquid className="relative p-7">
              <span className="absolute end-6 top-5 text-5xl font-bold text-white/5">{i + 1}</span>
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-majorelle-400 to-majorelle-600">
                <s.icon className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/60">{s.text}</p>
            </Glass>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto mt-20 max-w-7xl px-4 md:px-6">
        <h2 className="mb-8 text-2xl font-bold md:text-3xl">{t("home.whyTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Receipt, title: t("home.why.priceTitle"), text: t("home.why.priceText") },
            { icon: BadgeCheck, title: t("home.why.trustTitle"), text: t("home.why.trustText") },
            { icon: ShieldCheck, title: t("home.why.insuranceTitle"), text: t("home.why.insuranceText") },
            { icon: MessagesSquare, title: t("home.why.localTitle"), text: t("home.why.localText") },
          ].map((w) => (
            <div key={w.title} className="glass-subtle rounded-2xl p-6">
              <w.icon className="size-6 text-terracotta-300" />
              <h3 className="mt-4 font-bold">{w.title}</h3>
              <p className="mt-1.5 text-sm text-white/55">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Host CTA */}
      <section className="mx-auto mt-20 max-w-7xl px-4 md:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-terracotta-500 via-terracotta-600 to-majorelle-600 p-8 md:p-14">
          <div className="absolute -end-10 -top-10 size-72 rounded-full bg-saffron-400/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <CarFront className="size-10" />
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">{t("home.hostTitle", { amount: formatMAD(6000, locale) })}</h2>
            <p className="mt-3 text-white/85">{t("home.hostText")}</p>
            <ButtonLink href="/host/cars/new" variant="secondary" size="lg" className="mt-8 bg-white/20">
              {t("home.hostCta")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
