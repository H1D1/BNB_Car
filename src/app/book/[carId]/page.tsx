import type { Metadata } from "next";
import Image from "@/components/ui/SmartImage";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, ShieldCheck, ShieldAlert, Star } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getPlaces } from "@/lib/data";
import { parseDraft, draftToQuery } from "@/lib/booking";
import { rpcErrorMessage } from "@/lib/errors";
import { casablancaLocalToISO, formatDateTime, placeName } from "@/lib/utils";
import { CheckoutForm } from "@/components/booking/CheckoutForm";
import { Alert, Glass } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import type { Car, Quote } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("checkout.title") };
}

export default async function CheckoutPage(props: PageProps<"/book/[carId]">) {
  const { carId } = await props.params;
  const sp = await props.searchParams;
  const draft = parseDraft(sp);
  if (!draft) redirect(`/cars/${carId}`);

  const [{ t, locale }, profile, places] = await Promise.all([getI18n(), getProfile(), getPlaces()]);
  if (!profile) redirect(`/login?next=/book/${carId}`);

  const supabase = await createClient();
  const { data: car } = await supabase
    .from("cars")
    .select("id, host_id, make, model, year, cover_url, city_slug, neighborhood, instant_book, cash_allowed, rating, review_count, status")
    .eq("id", carId)
    .eq("status", "active")
    .maybeSingle<Pick<Car, "id" | "host_id" | "make" | "model" | "year" | "cover_url" | "city_slug" | "neighborhood" | "instant_book" | "cash_allowed" | "rating" | "review_count" | "status">>();
  if (!car) notFound();

  const { data: host } = await supabase.from("profiles").select("full_name").eq("id", car.host_id).single();
  const { data: quote, error } = await supabase.rpc("quote_booking", {
    p_car_id: carId,
    p_start: casablancaLocalToISO(draft.start),
    p_end: casablancaLocalToISO(draft.end),
    p_rental_type: draft.type,
    p_delivery: draft.delivery,
    p_airport_slug: draft.delivery === "airport" ? (draft.airport ?? null) : null,
    p_insurance: draft.insurance,
  });
  const q = quote as Quote | null;

  const verified = profile.id_status === "verified" && profile.license_status === "verified";
  const cashEligible = car.cash_allowed && profile.trips_completed >= 1 && profile.phone_verified;
  const selfUrl = `/book/${carId}?${draftToQuery(draft)}`;
  const city = places.find((p) => p.slug === car.city_slug);
  const airport = places.find((p) => p.slug === draft.airport);
  const unit = draft.type === "hourly" ? t("common.hours") : t("common.days");

  const handover =
    draft.delivery === "address"
      ? `${t("booking.delivery.address")}: ${draft.address ?? ""}`
      : draft.delivery === "airport" && airport
        ? `${t("booking.delivery.airport")}: ${placeName(airport, locale)}`
        : `${t("booking.delivery.pickup")} — ${[car.neighborhood, city && placeName(city, locale)].filter(Boolean).join(", ")}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-10 md:px-6">
      <Link href={`/cars/${carId}?start=${draft.start}&end=${draft.end}`} className="text-sm font-semibold text-white/60 hover:text-white">
        ← {t("common.back")}
      </Link>
      <h1 className="mt-3 mb-8 text-3xl font-bold md:text-4xl">{car.instant_book ? t("checkout.title") : t("checkout.requestTitle")}</h1>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Glass className="p-6">
            <h2 className="mb-4 text-lg font-bold">{t("checkout.yourTrip")}</h2>
            <dl className="space-y-4 text-sm">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-5 text-terracotta-300" />
                <div>
                  <dt className="font-semibold">{t("checkout.dates")}</dt>
                  <dd className="text-white/65">
                    {formatDateTime(casablancaLocalToISO(draft.start), locale)} → {formatDateTime(casablancaLocalToISO(draft.end), locale)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-5 text-terracotta-300" />
                <div>
                  <dt className="font-semibold">{t("checkout.handover")}</dt>
                  <dd className="text-white/65">{handover}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-terracotta-300" />
                <div>
                  <dt className="font-semibold">{t("checkout.protection")}</dt>
                  <dd className="text-white/65">
                    {t(`booking.insurance.${draft.insurance}`)} — {t(`booking.insuranceDesc.${draft.insurance}`)}
                  </dd>
                </div>
              </div>
            </dl>
          </Glass>

          {error ? (
            <Alert tone="error">{rpcErrorMessage(t, error.message)}</Alert>
          ) : !verified ? (
            <Glass strong className="p-6">
              <ShieldAlert className="size-8 text-saffron-300" />
              <h2 className="mt-3 text-xl font-bold">{t("checkout.verifyTitle")}</h2>
              <p className="mt-2 text-white/65">{t("checkout.verifyText")}</p>
              <ButtonLink href={`/account/verification?next=${encodeURIComponent(selfUrl)}`} className="mt-5">
                {t("checkout.verifyCta")}
              </ButtonLink>
            </Glass>
          ) : (
            q && <CheckoutForm carId={carId} draft={draft} total={q.total} instant={car.instant_book} cashEligible={cashEligible} hostName={host?.full_name ?? ""} />
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Glass strong className="overflow-hidden">
            <div className="flex gap-4 p-5">
              {car.cover_url && (
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl">
                  <Image src={car.cover_url} alt="" fill sizes="112px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold">
                  {car.make} {car.model} {car.year}
                </p>
                <p className="text-sm text-white/55">{host?.full_name}</p>
                {car.rating != null && (
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="size-3.5 fill-saffron-400 text-saffron-400" />
                    {Number(car.rating).toFixed(1)} <span className="text-white/45">({car.review_count})</span>
                  </p>
                )}
              </div>
            </div>
            {q && (
              <div className="space-y-2 border-t border-white/10 p-5 text-sm">
                <h3 className="mb-2 font-bold">{t("checkout.priceDetails")}</h3>
                <Line label={t("booking.breakdown.rental", { price: String(Math.round(q.unit_price)), units: q.units, unit })} mad={q.rental_fee} />
                {q.discount > 0 && <Line label={t("booking.breakdown.discount")} mad={-q.discount} />}
                {q.delivery_fee > 0 && <Line label={t("booking.breakdown.delivery")} mad={q.delivery_fee} />}
                {q.insurance_fee > 0 && <Line label={t("booking.breakdown.insurance")} mad={q.insurance_fee} />}
                <Line label={t("booking.breakdown.service")} mad={q.service_fee} />
                <div className="flex items-baseline justify-between border-t border-white/10 pt-3 text-base font-bold">
                  <span>{t("booking.breakdown.total")}</span>
                  <Price mad={q.total} />
                </div>
                <Line label={t("booking.breakdown.deposit")} mad={q.deposit} muted />
                <p className="text-xs text-white/45">{t("booking.breakdown.km", { km: q.km_included })}</p>
              </div>
            )}
          </Glass>
        </aside>
      </div>
    </div>
  );
}

function Line({ label, mad, muted }: { label: string; mad: number; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${muted ? "text-xs text-white/50" : "text-white/75"}`}>
      <span>{label}</span>
      <Price mad={mad} showConverted={false} />
    </div>
  );
}
