"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { addHoursLocal, draftToQuery, type BookingDraft } from "@/lib/booking";
import { rpcErrorMessage } from "@/lib/errors";
import { distanceKm } from "@/lib/mapbox";
import { casablancaLocalToISO, cn, defaultDates, placeName } from "@/lib/utils";
import type { Car, InsurancePlan, Place, Quote } from "@/lib/types";
import { Button } from "../ui/Button";
import { Price } from "../ui/Price";
import { LocationInput } from "../ui/LocationInput";
import { Alert } from "../ui/primitives";

type CarForWidget = Pick<
  Car,
  | "id"
  | "daily_price_mad"
  | "hourly_price_mad"
  | "instant_book"
  | "delivery_available"
  | "delivery_fee_mad"
  | "delivery_radius_km"
  | "airport_slugs"
  | "airport_fee_mad"
  | "lat"
  | "lng"
  | "min_days"
>;

export function BookingWidget({
  car,
  airports,
  initial,
  loggedIn,
  isOwner,
}: {
  car: CarForWidget;
  airports: Place[];
  initial: { start?: string; end?: string; airport?: string; address?: string; alat?: number; alng?: number };
  loggedIn: boolean;
  isOwner: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const defaults = defaultDates();

  const [type, setType] = useState<"daily" | "hourly">("daily");
  const [start, setStart] = useState(initial.start ?? defaults.start);
  const [end, setEnd] = useState(initial.end ?? defaults.end);
  const [delivery, setDelivery] = useState<BookingDraft["delivery"]>(
    initial.airport && car.airport_slugs.includes(initial.airport) ? "airport" : "pickup",
  );
  const [airport, setAirport] = useState(initial.airport && car.airport_slugs.includes(initial.airport) ? initial.airport : car.airport_slugs[0]);
  const [address, setAddress] = useState<{ label: string; lat?: number; lng?: number }>({
    label: initial.address ?? "",
    lat: initial.alat,
    lng: initial.alng,
  });
  const [insurance, setInsurance] = useState<InsurancePlan>("basic");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const outOfRadius =
    delivery === "address" && address.lat != null && address.lng != null
      ? distanceKm({ lat: address.lat, lng: address.lng }, car) > car.delivery_radius_km
      : false;

  const datesInvalid = !start || !end || end <= start;

  useEffect(() => {
    if (datesInvalid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const pStart = casablancaLocalToISO(start);
      const pEnd = casablancaLocalToISO(end);
      const [q, a] = await Promise.all([
        supabase.rpc("quote_booking", {
          p_car_id: car.id,
          p_start: pStart,
          p_end: pEnd,
          p_rental_type: type,
          p_delivery: delivery,
          p_airport_slug: delivery === "airport" ? airport : null,
          p_insurance: insurance,
        }),
        supabase.rpc("is_available", { p_car_id: car.id, p_start: pStart, p_end: pEnd }),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (q.error) {
        setQuote(null);
        setError(rpcErrorMessage(t, q.error.message));
      } else {
        setQuote(q.data as Quote);
        setError(null);
      }
      setAvailable(a.data !== false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [supabase, car.id, start, end, type, delivery, airport, insurance, t, datesInvalid]);

  const shownQuote = datesInvalid ? null : quote;
  const shownError = datesInvalid ? t("errors.invalid_dates") : error;

  const switchType = (next: "daily" | "hourly") => {
    setType(next);
    if (next === "hourly") setEnd(addHoursLocal(start, 3));
    else setEnd(addHoursLocal(start, 24 * Math.max(car.min_days, 3)));
  };

  const go = () => {
    const q = draftToQuery({ start, end, type, delivery, insurance, airport, address: address.label, alat: address.lat, alng: address.lng });
    const target = `/book/${car.id}?${q}`;
    router.push(loggedIn ? target : `/login?next=${encodeURIComponent(target)}`);
  };

  const unitLabel = type === "hourly" ? t("common.hours") : t("common.days");
  const canBook = !!shownQuote && available && !shownError && !isOwner && !outOfRadius && !(delivery === "address" && !address.label);

  const radio = (active: boolean) =>
    cn(
      "flex w-full items-start gap-3 rounded-2xl border p-3 text-start transition",
      active ? "border-majorelle-300/60 bg-majorelle-500/20" : "border-white/10 hover:bg-white/5",
    );

  return (
    <div className="glass-strong rounded-[1.75rem] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <span>
          <Price mad={type === "hourly" && car.hourly_price_mad ? car.hourly_price_mad : car.daily_price_mad} className="text-2xl font-bold" />
          <span className="ms-1 text-sm text-white/55">{type === "hourly" ? t("common.perHour") : t("common.perDay")}</span>
        </span>
        {car.instant_book && (
          <span className="flex items-center gap-1 text-xs font-bold text-saffron-300">
            <Zap className="size-3.5" />
            {t("car.instant")}
          </span>
        )}
      </div>

      {car.hourly_price_mad && (
        <div className="glass-subtle mt-4 grid grid-cols-2 rounded-full p-1 text-sm font-semibold">
          {(["daily", "hourly"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => switchType(v)}
              className={cn("rounded-full py-2 transition", type === v ? "bg-white text-ink-900" : "text-white/70")}
            >
              {t(`booking.${v}`)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="glass-subtle rounded-2xl px-3 py-2">
          <span className="block text-[11px] font-bold tracking-wider text-white/50 uppercase">{t("booking.pickup")}</span>
          <input
            type="datetime-local"
            value={start}
            step={1800}
            onChange={(e) => {
              setStart(e.target.value);
              if (e.target.value >= end) setEnd(addHoursLocal(e.target.value, type === "hourly" ? 3 : 24));
            }}
            className="w-full bg-transparent text-sm font-semibold outline-none [color-scheme:dark]"
          />
        </label>
        <label className="glass-subtle rounded-2xl px-3 py-2">
          <span className="block text-[11px] font-bold tracking-wider text-white/50 uppercase">{t("booking.return")}</span>
          <input
            type="datetime-local"
            value={end}
            min={start}
            step={1800}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold outline-none [color-scheme:dark]"
          />
        </label>
      </div>

      {(car.delivery_available || car.airport_slugs.length > 0) && (
        <div className="mt-4">
          <p className="label">{t("booking.deliveryLabel")}</p>
          <div className="space-y-2">
            <button type="button" onClick={() => setDelivery("pickup")} className={radio(delivery === "pickup")}>
              <span className="text-sm font-semibold">{t("booking.delivery.pickup")}</span>
            </button>
            {car.delivery_available && (
              <div className={radio(delivery === "address")}>
                <button type="button" onClick={() => setDelivery("address")} className="flex w-full items-center justify-between text-sm font-semibold">
                  {t("booking.delivery.address")}
                  <Price mad={car.delivery_fee_mad} showConverted={false} className="text-white/60" />
                </button>
              </div>
            )}
            {delivery === "address" && (
              <LocationInput
                defaultLabel={address.label}
                types="address,street,neighborhood,locality,place"
                proximity={{ lat: car.lat, lng: car.lng }}
                placeholder={t("location.addressPlaceholder")}
                onSelect={(sel) =>
                  setAddress(sel.kind === "point" ? { label: sel.label, lat: sel.lat, lng: sel.lng } : { label: sel.label, lat: sel.place.lat, lng: sel.place.lng })
                }
                onClear={() => setAddress({ label: "" })}
              />
            )}
            {outOfRadius && (
              <Alert tone="warning">{t("booking.outOfRadius", { km: car.delivery_radius_km })}</Alert>
            )}
            {car.airport_slugs.length > 0 && (
              <button type="button" onClick={() => setDelivery("airport")} className={radio(delivery === "airport")}>
                <span className="flex w-full items-center justify-between text-sm font-semibold">
                  {t("booking.delivery.airport")}
                  <Price mad={car.airport_fee_mad} showConverted={false} className="text-white/60" />
                </span>
              </button>
            )}
            {delivery === "airport" && car.airport_slugs.length > 1 && (
              <select value={airport} onChange={(e) => setAirport(e.target.value)} className="field">
                {car.airport_slugs.map((s) => {
                  const p = airports.find((a) => a.slug === s);
                  return (
                    <option key={s} value={s}>
                      {p ? placeName(p, locale) : s.toUpperCase()}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="label">{t("booking.insuranceLabel")}</p>
        <div className="space-y-2">
          {(["none", "basic", "premium"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setInsurance(p)} className={radio(insurance === p)}>
              <ShieldCheck className={cn("mt-0.5 size-4 shrink-0", insurance === p ? "text-mint-400" : "text-white/40")} />
              <span>
                <span className="block text-sm font-semibold">{t(`booking.insurance.${p}`)}</span>
                <span className="block text-xs text-white/55">{t(`booking.insuranceDesc.${p}`)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm" aria-live="polite">
        {loading && !shownQuote && (
          <p className="flex items-center gap-2 text-white/60">
            <Loader2 className="size-4 animate-spin" />
            {t("booking.checking")}
          </p>
        )}
        {shownQuote && (
          <div className={cn("space-y-2 transition-opacity", loading && "opacity-60")}>
            <Row label={t("booking.breakdown.rental", { price: String(Math.round(shownQuote.unit_price)), units: shownQuote.units, unit: unitLabel })} mad={shownQuote.rental_fee} />
            {shownQuote.discount > 0 && <Row label={t("booking.breakdown.discount")} mad={-shownQuote.discount} accent />}
            {shownQuote.delivery_fee > 0 && <Row label={t("booking.breakdown.delivery")} mad={shownQuote.delivery_fee} />}
            {shownQuote.insurance_fee > 0 && <Row label={t("booking.breakdown.insurance")} mad={shownQuote.insurance_fee} />}
            <Row label={t("booking.breakdown.service")} mad={shownQuote.service_fee} />
            <div className="flex items-baseline justify-between border-t border-white/10 pt-2 text-base font-bold">
              <span>{t("booking.breakdown.total")}</span>
              <Price mad={shownQuote.total} />
            </div>
            <div className="flex justify-between text-xs text-white/50">
              <span>{t("booking.breakdown.deposit")}</span>
              <Price mad={shownQuote.deposit} showConverted={false} />
            </div>
            <p className="text-xs text-white/50">{t("booking.breakdown.km", { km: shownQuote.km_included })}</p>
          </div>
        )}
        {shownError && <Alert tone="error">{shownError}</Alert>}
        {!available && !shownError && (
          <Alert tone="warning">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {t("booking.unavailable")}
            </span>
          </Alert>
        )}
      </div>

      {isOwner ? (
        <Alert tone="info" className="mt-4">
          {t("carPage.ownCar")}
        </Alert>
      ) : (
        <>
          <Button size="lg" variant={car.instant_book ? "accent" : "primary"} className="mt-4 w-full" disabled={!canBook} onClick={go}>
            {car.instant_book && <Zap className="size-4" />}
            {!loggedIn ? t("booking.loginToBook") : car.instant_book ? t("booking.instantCta") : t("booking.requestCta")}
          </Button>
          <p className="mt-2 text-center text-xs text-white/45">{t("booking.notCharged")}</p>
        </>
      )}
    </div>
  );
}

function Row({ label, mad, accent }: { label: string; mad: number; accent?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", accent ? "text-mint-400" : "text-white/75")}>
      <span>{label}</span>
      <Price mad={mad} showConverted={false} />
    </div>
  );
}
