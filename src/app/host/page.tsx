import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Car as CarIcon, Clock, KeyRound, Plus, Star, Wallet } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getPlaces } from "@/lib/data";
import { formatMAD } from "@/lib/currency";
import { casablancaLocalToISO, formatDateTime, isoToCasablancaLocal, placeName } from "@/lib/utils";
import { Avatar, Badge, Glass, PageHeader, Rating, type BadgeTone } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { RequestActions } from "@/components/host/RequestActions";
import { CarActions } from "@/components/host/CarActions";
import type { Booking, Car, CarStatus } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("host.title") };
}

type HostCar = Pick<
  Car,
  "id" | "status" | "make" | "model" | "year" | "title" | "daily_price_mad" | "rating" | "review_count" | "trip_count" | "cover_url" | "city_slug"
>;
type HostBooking = Pick<
  Booking,
  "id" | "reference" | "status" | "start_at" | "end_at" | "total_mad" | "host_payout_mad" | "payment_status" | "renter_message" | "instant"
> & {
  car: { id: string; make: string; model: string; cover_url: string | null } | null;
  renter: { id: string; full_name: string; avatar_url: string | null } | null;
};

const STATUS_TONE: Record<CarStatus, BadgeTone> = { draft: "neutral", active: "mint", paused: "saffron" };

function monthBounds() {
  const today = isoToCasablancaLocal(new Date());
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: casablancaLocalToISO(`${y}-${pad(m)}-01T00:00`),
    end: casablancaLocalToISO(`${ny}-${pad(nm)}-01T00:00`),
  };
}

export default async function HostDashboard() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/host");
  const [{ t, locale }, places, supabase] = await Promise.all([getI18n(), getPlaces(), createClient()]);

  const { data: carsData } = await supabase
    .from("cars")
    .select("id, status, make, model, year, title, daily_price_mad, rating, review_count, trip_count, cover_url, city_slug")
    .eq("host_id", profile.id)
    .order("created_at", { ascending: false });
  const cars = (carsData ?? []) as HostCar[];

  if (cars.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <Glass strong liquid className="relative overflow-hidden px-6 py-14 md:px-14 md:py-20">
          <div className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-terracotta-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -start-24 size-80 rounded-full bg-majorelle-500/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge tone="saffron" className="mb-5">
              <KeyRound className="size-3.5" />
              {t("host.title")}
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t("host.becomeHostTitle")}</h1>
            <p className="mt-4 text-lg text-white/70">{t("host.becomeHostText")}</p>
            <p className="mt-2 text-sm text-white/50">{t("host.noListingsText")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/host/cars/new" variant="accent" size="lg">
                <Plus className="size-5" />
                {t("host.addCar")}
              </ButtonLink>
            </div>
          </div>
        </Glass>
      </div>
    );
  }

  const nowIso = new Date().toISOString();
  const { start, end } = monthBounds();
  const bookingCols =
    "id, reference, status, start_at, end_at, total_mad, host_payout_mad, payment_status, renter_message, instant, car:cars(id, make, model, cover_url), renter:profiles!bookings_renter_id_fkey(id, full_name, avatar_url)";
  const [pendingRes, upcomingRes, earningsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(bookingCols)
      .eq("host_id", profile.id)
      .eq("status", "pending")
      .gt("end_at", nowIso)
      .order("start_at")
      .limit(20),
    supabase
      .from("bookings")
      .select(bookingCols)
      .eq("host_id", profile.id)
      .in("status", ["confirmed", "active"])
      .gt("end_at", nowIso)
      .order("start_at")
      .limit(20),
    supabase
      .from("bookings")
      .select("host_payout_mad")
      .eq("host_id", profile.id)
      .in("status", ["confirmed", "active", "completed"])
      .eq("payment_status", "paid")
      .gte("start_at", start)
      .lt("start_at", end),
  ]);
  const pending = (pendingRes.data ?? []) as unknown as HostBooking[];
  const upcoming = (upcomingRes.data ?? []) as unknown as HostBooking[];
  const earnings = (earningsRes.data ?? []).reduce((s, b) => s + Number(b.host_payout_mad), 0);
  const activeCount = cars.filter((c) => c.status === "active").length;
  const cityLabel = (slug: string) => {
    const p = places.find((x) => x.slug === slug);
    return p ? placeName(p, locale) : slug;
  };

  const stats = [
    { icon: Wallet, label: t("host.stats.earnings"), value: <Price mad={earnings} showConverted={false} />, tone: "text-mint-400" },
    { icon: CalendarDays, label: t("host.stats.upcoming"), value: upcoming.length, tone: "text-majorelle-300" },
    { icon: CarIcon, label: t("host.stats.listings"), value: activeCount, tone: "text-saffron-300" },
    {
      icon: Star,
      label: t("host.stats.rating"),
      value: profile.host_rating != null ? Number(profile.host_rating).toFixed(2) : "—",
      tone: "text-terracotta-300",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <PageHeader
        title={t("host.hello", { name: profile.full_name.split(" ")[0] || profile.full_name })}
        subtitle={t("host.title")}
        actions={
          <>
            <ButtonLink href="/trips?view=host" variant="secondary">
              {t("host.viewAll")}
            </ButtonLink>
            <ButtonLink href="/host/cars/new" variant="accent">
              <Plus className="size-4" />
              {t("host.addCar")}
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, tone }) => (
          <Glass key={label} liquid className="p-5">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Icon className={`size-4 ${tone}`} />
              {label}
            </div>
            <div className="mt-2 text-2xl font-bold md:text-3xl">{value}</div>
          </Glass>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            {t("host.requests")}
            {pending.length > 0 && <Badge tone="terracotta">{pending.length}</Badge>}
          </h2>
          {pending.length === 0 ? (
            <Glass className="px-5 py-8 text-center text-sm text-white/55">{t("host.noRequests")}</Glass>
          ) : (
            <ul className="space-y-3">
              {pending.map((b) => (
                <li key={b.id}>
                  <Glass className="p-4">
                    <BookingRow b={b} locale={locale} />
                    {b.renter_message && (
                      <p className="mt-3 line-clamp-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70 italic">“{b.renter_message}”</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <span className="text-sm text-white/60">
                        {t("trip.payout")}: <span className="font-semibold text-white">{formatMAD(b.host_payout_mad, locale)}</span>
                      </span>
                      <RequestActions bookingId={b.id} />
                    </div>
                  </Glass>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold">{t("host.upcomingTitle")}</h2>
          {upcoming.length === 0 ? (
            <Glass className="px-5 py-8 text-center text-sm text-white/55">{t("host.noUpcoming")}</Glass>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((b) => (
                <li key={b.id}>
                  <Link href={`/trips/${b.id}`} className="block">
                    <Glass liquid className="p-4">
                      <BookingRow b={b} locale={locale} showStatus statusLabel={t(`trips.status.${b.status}`)} />
                    </Glass>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-bold">{t("host.listingsTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cars.map((c) => (
            <Glass as="article" key={c.id} liquid className="flex flex-col overflow-hidden">
              <Link href={`/host/cars/${c.id}`} className="relative block aspect-[16/10] overflow-hidden">
                {c.cover_url ? (
                  <Image src={c.cover_url} alt={`${c.make} ${c.model}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-white/5 text-white/30">
                    <CarIcon className="size-12" />
                  </div>
                )}
                <div className="absolute start-3 top-3">
                  <Badge tone={STATUS_TONE[c.status]} className="backdrop-blur-md">
                    {t(`host.status.${c.status}`)}
                  </Badge>
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold">{c.title || `${c.make} ${c.model}`}</h3>
                    <p className="text-sm text-white/50">
                      {c.make} {c.model} · {c.year} · {cityLabel(c.city_slug)}
                    </p>
                  </div>
                  {c.rating != null ? <Rating value={c.rating} count={c.review_count} /> : <Badge tone="majorelle">{t("car.noReviewsYet")}</Badge>}
                </div>
                <div className="mt-3 flex items-end justify-between text-sm">
                  <span className="text-white/50">{c.trip_count > 0 ? t("car.trips", { count: c.trip_count }) : ""}</span>
                  <span>
                    <Price mad={c.daily_price_mad} className="text-lg font-bold" showConverted={false} />
                    <span className="ms-1 text-xs text-white/50">{t("common.perDay")}</span>
                  </span>
                </div>
                <CarActions carId={c.id} status={c.status} />
              </div>
            </Glass>
          ))}
          <Link
            href="/host/cars/new"
            className="glass-subtle flex min-h-64 flex-col items-center justify-center gap-3 rounded-[var(--radius-glass)] border border-dashed border-white/20 text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-white/10">
              <Plus className="size-6" />
            </span>
            <span className="font-semibold">{t("host.addCar")}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function BookingRow({
  b,
  locale,
  showStatus,
  statusLabel,
}: {
  b: HostBooking;
  locale: Parameters<typeof formatDateTime>[1];
  showStatus?: boolean;
  statusLabel?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
        {b.car?.cover_url && <Image src={b.car.cover_url} alt="" fill sizes="64px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/trips/${b.id}`} className="truncate font-semibold hover:underline">
            {b.car ? `${b.car.make} ${b.car.model}` : b.reference}
          </Link>
          {showStatus && statusLabel && <Badge tone={b.status === "active" ? "mint" : "majorelle"}>{statusLabel}</Badge>}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/55">
          <Clock className="size-3.5 shrink-0" />
          <span dir="ltr">
            {formatDateTime(b.start_at, locale)} → {formatDateTime(b.end_at, locale)}
          </span>
        </p>
        {b.renter && (
          <p className="mt-1.5 flex items-center gap-2 text-sm text-white/75">
            <Avatar name={b.renter.full_name} url={b.renter.avatar_url} size={22} />
            {b.renter.full_name}
            <span className="text-xs text-white/40">· {b.reference}</span>
          </p>
        )}
      </div>
    </div>
  );
}
