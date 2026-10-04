import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  DoorOpen,
  Fuel,
  Gauge,
  MapPin,
  MessageCircle,
  Plane,
  Settings2,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { badgesOf, getCar, getFavoriteIds, getPlaces, searchCars } from "@/lib/data";
import { getUser } from "@/lib/supabase/server";
import { formatMAD } from "@/lib/currency";
import { formatDate, placeName } from "@/lib/utils";
import { startConversation } from "@/app/actions/messages";
import { CarGallery } from "@/components/cars/CarGallery";
import { BookingWidget } from "@/components/cars/BookingWidget";
import { CarCard } from "@/components/cars/CarCard";
import { FavoriteButton } from "@/components/cars/FavoriteButton";
import { CarMapLazy } from "@/components/cars/MapLoader";
import { Avatar, Badge, Glass, Rating, Stars } from "@/components/ui/primitives";
import { Button, ButtonLink } from "@/components/ui/Button";

export async function generateMetadata(props: PageProps<"/cars/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const data = await getCar(id);
  if (!data) return {};
  const { car } = data;
  return {
    title: `${car.make} ${car.model} ${car.year}`,
    openGraph: { images: car.cover_url ? [car.cover_url] : [] },
  };
}

export default async function CarPage(props: PageProps<"/cars/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [{ t, locale }, data, places, user] = await Promise.all([getI18n(), getCar(id), getPlaces(), getUser()]);
  if (!data) notFound();
  const { car, photos, host, reviews, seasonal, busy } = data;
  const favorites = await getFavoriteIds(user?.id);
  const similar = (await searchCars({ place: car.city_slug, sort: "recommended" })).filter((c) => c.id !== car.id).slice(0, 3);

  const city = places.find((p) => p.slug === car.city_slug);
  const airports = places.filter((p) => p.kind === "airport");
  const cityName = Object.fromEntries(places.map((p) => [p.slug, placeName(p, locale)]));
  const isOwner = user?.id === car.host_id;
  const hostBadges = badgesOf(host);
  const description = car.description[locale] || car.description.fr || car.description.en || car.description.ar || "";
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const num = (k: string) => (str(k) ? Number(str(k)) : undefined);

  const avg = (k: "cleanliness" | "communication" | "accuracy") => {
    const vals = reviews.map((r) => r[k]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const specs = [
    { icon: Settings2, label: t(`car.transmission.${car.transmission}`) },
    { icon: Fuel, label: t(`car.fuel.${car.fuel}`) },
    { icon: Users, label: t("car.seats", { count: car.seats }) },
    { icon: DoorOpen, label: t("car.doors", { count: car.doors }) },
    { icon: CalendarClock, label: `${t("carPage.year")} ${car.year}` },
    { icon: Gauge, label: `${new Intl.NumberFormat(locale).format(car.mileage_km)} ${t("common.km")}` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-10 md:px-6">
      {/* Title */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone="majorelle">{t(`car.category.${car.category}`)}</Badge>
            {car.instant_book && (
              <Badge tone="saffron">
                <Zap className="size-3" />
                {t("car.instant")}
              </Badge>
            )}
            {car.status !== "active" && <Badge tone="rose">{t(`host.status.${car.status}`)}</Badge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {car.make} {car.model} <span className="text-white/45">{car.year}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/65">
            {car.rating != null && <Rating value={car.rating} count={car.review_count} />}
            {car.trip_count > 0 && <span>{t("car.trips", { count: car.trip_count })}</span>}
            <span className="flex items-center gap-1">
              <MapPin className="size-4" />
              {[car.neighborhood, city && placeName(city, locale)].filter(Boolean).join(", ")}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {user && !isOwner && <FavoriteButton carId={car.id} initial={favorites.has(car.id)} withLabel />}
          {isOwner && (
            <ButtonLink href={`/host/cars/${car.id}`} variant="secondary">
              {t("carPage.manageCar")}
            </ButtonLink>
          )}
        </div>
      </div>

      <CarGallery photos={photos} alt={`${car.make} ${car.model}`} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-8">
          {/* Host strip */}
          <Glass className="flex flex-wrap items-center justify-between gap-4 p-5">
            <Link href={`/users/${host.id}`} className="flex items-center gap-4">
              <Avatar name={host.full_name} url={host.avatar_url} size={56} />
              <span>
                <span className="block text-lg font-bold">{t("carPage.hostedBy", { name: host.full_name })}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-white/55">
                  {host.host_rating != null && <Rating value={host.host_rating} count={host.host_review_count} />}
                  <span>{t("carPage.joined", { date: formatDate(host.created_at, locale, { month: "long", year: "numeric" }) })}</span>
                </span>
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {hostBadges.verifiedHost && (
                <Badge tone="mint">
                  <BadgeCheck className="size-3.5" />
                  {t("badges.verifiedHost")}
                </Badge>
              )}
              {!isOwner && (
                <form action={startConversation.bind(null, car.id)}>
                  <Button variant="secondary" size="sm" type="submit">
                    <MessageCircle className="size-4" />
                    {t("carPage.messageHost")}
                  </Button>
                </form>
              )}
            </div>
          </Glass>

          {/* Specs */}
          <section>
            <h2 className="mb-4 text-xl font-bold">{t("carPage.specs")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map((s) => (
                <div key={s.label} className="glass-subtle flex items-center gap-3 rounded-2xl p-4">
                  <s.icon className="size-5 text-terracotta-300" />
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {description && (
            <section>
              <h2 className="mb-3 text-xl font-bold">{t("carPage.description")}</h2>
              <p className="leading-relaxed whitespace-pre-line text-white/75">{description}</p>
            </section>
          )}

          {car.features.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-bold">{t("carPage.features")}</h2>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {car.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/80">
                    <Check className="size-4 text-mint-400" />
                    {t(`car.features.${f}` as `car.features.ac`)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Location */}
          <section>
            <h2 className="mb-1 text-xl font-bold">{t("carPage.location")}</h2>
            <p className="mb-4 text-sm text-white/55">
              {[car.neighborhood, city && placeName(city, locale)].filter(Boolean).join(", ")} · {t("carPage.locationNote")}
            </p>
            <div className="glass h-72 overflow-hidden rounded-[var(--radius-glass)]">
              <CarMapLazy pins={[{ id: "car", lat: car.lat, lng: car.lng }]} zoom={13} />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <h3 className="font-semibold">{t("carPage.deliveryTitle")}</h3>
              {car.delivery_available && (
                <p className="flex items-center gap-2 text-white/75">
                  <Truck className="size-4 text-saffron-300" />
                  {t("carPage.deliveryAddress", { km: car.delivery_radius_km, fee: formatMAD(car.delivery_fee_mad, locale) })}
                </p>
              )}
              {car.airport_slugs.length > 0 && (
                <p className="flex items-center gap-2 text-white/75">
                  <Plane className="size-4 text-saffron-300" />
                  {t("carPage.deliveryAirport", {
                    airports: car.airport_slugs.map((s) => airports.find((a) => a.slug === s)?.iata ?? s.toUpperCase()).join(", "),
                    fee: formatMAD(car.airport_fee_mad, locale),
                  })}
                </p>
              )}
              {!car.delivery_available && car.airport_slugs.length === 0 && <p className="text-white/55">{t("carPage.noDelivery")}</p>}
            </div>
          </section>

          {/* Policies */}
          <section>
            <h2 className="mb-4 text-xl font-bold">{t("carPage.policies")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Policy icon={Wallet} title={t("carPage.deposit")} text={t("carPage.depositText", { amount: formatMAD(car.deposit_mad, locale) })} />
              <Policy
                icon={Gauge}
                title={t("wizard.kmPerDay")}
                text={
                  car.features.includes("unlimited_km") || car.km_per_day >= 1000
                    ? t("carPage.unlimited")
                    : t("carPage.mileageText", { km: car.km_per_day, fee: formatMAD(Number(car.extra_km_fee_mad), locale, { decimals: true }) })
                }
              />
              <Policy icon={ShieldCheck} title={t("trip.cancel")} text={t("carPage.cancellation")} />
              <Policy icon={CalendarClock} title={t("wizard.minDays")} text={t("carPage.minDays", { count: car.min_days })} />
              {car.cash_allowed && <Policy icon={Wallet} title={t("checkout.method.cash")} text={t("carPage.cashAccepted")} />}
              {(car.weekly_discount_pct > 0 || car.monthly_discount_pct > 0) && (
                <Policy
                  icon={Sparkles}
                  title={t("carPage.discounts")}
                  text={[
                    car.weekly_discount_pct > 0 && t("carPage.weekly", { pct: car.weekly_discount_pct }),
                    car.monthly_discount_pct > 0 && t("carPage.monthly", { pct: car.monthly_discount_pct }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}
            </div>
            {seasonal.length > 0 && (
              <div className="mt-4 text-sm">
                <h3 className="mb-2 font-semibold">{t("carPage.seasonal")}</h3>
                <ul className="space-y-1 text-white/70">
                  {seasonal.map((s) => (
                    <li key={s.id}>
                      {t("carPage.seasonalItem", {
                        label: s.label,
                        price: formatMAD(s.daily_price_mad, locale),
                        from: formatDate(s.start_date, locale),
                        to: formatDate(s.end_date, locale),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Reviews */}
          <section>
            <h2 className="mb-4 flex items-center gap-3 text-xl font-bold">
              {t("carPage.reviewsTitle")}
              {car.rating != null && <Rating value={car.rating} count={car.review_count} className="text-base" />}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-white/55">{t("carPage.noReviews")}</p>
            ) : (
              <>
                <div className="mb-6 grid gap-3 sm:grid-cols-3">
                  {(["cleanliness", "communication", "accuracy"] as const).map((k) => {
                    const v = avg(k);
                    return v == null ? null : (
                      <div key={k} className="glass-subtle rounded-2xl p-4">
                        <p className="text-xs text-white/55">{t(`trip.${k}`)}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-bold">{v.toFixed(1)}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-saffron-400" style={{ width: `${(v / 5) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {reviews.slice(0, 8).map((r) => (
                    <Glass key={r.id} className="p-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.author.full_name} url={r.author.avatar_url} size={40} />
                        <div>
                          <p className="font-semibold">{r.author.full_name}</p>
                          <p className="text-xs text-white/50">{formatDate(r.created_at, locale, { month: "long", year: "numeric" })}</p>
                        </div>
                        <Stars value={r.rating} className="ms-auto" />
                      </div>
                      {r.comment && <p className="mt-3 text-sm leading-relaxed text-white/75">{r.comment}</p>}
                    </Glass>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <BookingWidget
            car={car}
            airports={airports}
            loggedIn={!!user}
            isOwner={isOwner}
            busy={busy}
            initial={{
              start: str("start"),
              end: str("end"),
              airport: str("place"),
              address: str("label"),
              alat: num("lat"),
              alng: num("lng"),
            }}
          />
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-2xl font-bold">{t("carPage.similar")}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((c) => (
              <CarCard key={c.id} car={c} placeLabel={cityName[c.city_slug]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Policy({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="glass-subtle flex gap-3 rounded-2xl p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-majorelle-300" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-white/60">{text}</p>
      </div>
    </div>
  );
}
