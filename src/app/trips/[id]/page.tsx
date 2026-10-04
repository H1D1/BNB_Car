import type { Metadata } from "next";
import Image from "@/components/ui/SmartImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CarFront,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  CreditCard,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
} from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getPlace } from "@/lib/data";
import { DISPUTABLE, STATUS_TONE, getTrip, refundEstimate } from "@/lib/trips";
import { formatMAD } from "@/lib/currency";
import { cn, formatDate, formatDateTime, placeName, whatsappLink } from "@/lib/utils";
import { Alert, Avatar, Badge, Glass, Rating, Stars } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { TripActions } from "@/components/trips/TripActions";
import { ReviewForm } from "@/components/trips/ReviewForm";
import type { Review } from "@/lib/types";

export async function generateMetadata(props: PageProps<"/trips/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const [{ t }, trip] = await Promise.all([getI18n(), getTrip(id)]);
  return { title: trip ? t("trip.reference", { ref: trip.booking.reference }) : t("common.notFound") };
}

function Line({ label, children, strong, muted }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-sm", strong && "border-t border-white/10 pt-3 text-base font-bold", muted && "text-white/55")}>
      <span className={cn(!strong && "text-white/70")}>{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

type InspectionRow = { id: string; phase: "pre" | "post"; created_at: string; acknowledged_at: string | null; submitted_by: string };

export default async function TripPage(props: PageProps<"/trips/[id]">) {
  const { id } = await props.params;
  const trip = await getTrip(id);
  if (!trip) notFound();
  const { booking: b, car, role, userId, counterpart } = trip;
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const [inspectionsRes, reviewsRes, contactRes, airport, city] = await Promise.all([
    supabase.from("inspections").select("id, phase, created_at, acknowledged_at, submitted_by").eq("booking_id", b.id),
    supabase
      .from("reviews")
      .select("id, booking_id, car_id, author_id, subject_id, direction, rating, cleanliness, communication, accuracy, comment, created_at")
      .eq("booking_id", b.id),
    counterpart ? supabase.rpc("get_contact", { p_user: counterpart.id }) : Promise.resolve({ data: null }),
    getPlace(b.airport_slug ?? undefined),
    getPlace(car?.city_slug),
  ]);
  const inspections = (inspectionsRes.data ?? []) as InspectionRow[];
  const pre = inspections.find((i) => i.phase === "pre");
  const post = inspections.find((i) => i.phase === "post");
  const reviews = (reviewsRes.data ?? []) as Review[];
  const myReview = reviews.find((r) => r.author_id === userId);
  const contact = ((contactRes.data ?? []) as { phone: string | null; whatsapp: string | null }[])[0];

  const snap = (b.contract_snapshot?.car ?? {}) as { make?: string; model?: string; year?: number };
  const carName = car ? `${car.make} ${car.model} ${car.year}` : [snap.make, snap.model, snap.year].filter(Boolean).join(" ");
  const unitLabel = b.rental_type === "hourly" ? (b.units === 1 ? t("common.hour") : t("common.hours")) : b.units === 1 ? t("common.day") : t("common.days");

  const needsPay = role === "renter" && (b.status === "pending" || b.status === "confirmed") && b.payment_status === "unpaid" && b.payment_method !== "cash";
  const unpaidBlocksStart = b.payment_method !== "cash" && b.payment_status !== "paid";
  const startBlocked = !pre ? t("trip.hostNeedsInspection") : unpaidBlocksStart ? t("trip.waitingPayment") : undefined;
  const preAvailable = ["confirmed", "active"].includes(b.status);
  const postAvailable = ["active", "completed"].includes(b.status);
  const canDispute = DISPUTABLE.includes(b.status);

  const timeline = [
    { key: "created", at: b.created_at, label: t("trip.events.created") },
    { key: "confirmed", at: b.confirmed_at, label: t("trip.events.confirmed") },
    { key: "started", at: b.started_at, label: t("trip.events.started") },
    { key: "completed", at: b.completed_at, label: t("trip.events.completed") },
    { key: "cancelled", at: b.cancelled_at, label: b.status === "declined" ? t("trips.status.declined") : t("trip.events.cancelled") },
  ].filter((e): e is { key: string; at: string; label: string } => !!e.at);

  const handover =
    b.delivery_option === "address" && b.delivery_address
      ? t("trip.deliveryTo", { address: b.delivery_address })
      : b.delivery_option === "airport"
        ? t("trip.airportTo", { airport: airport ? placeName(airport, locale) : (b.airport_slug ?? "").toUpperCase() })
        : t("trip.pickupAt", {
            address: car?.address || [car?.neighborhood, city ? placeName(city, locale) : null].filter(Boolean).join(", ") || "—",
          });

  const inspectionItem = (phase: "pre" | "post", done: InspectionRow | undefined, available: boolean) => {
    if (!done && !available) return null;
    return (
      <Link
        href={`/trips/${b.id}/inspection/${phase}`}
        className="glass-subtle flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/[0.08]"
      >
        {done ? <CircleCheck className="size-5 shrink-0 text-mint-400" /> : <CircleDashed className="size-5 shrink-0 text-saffron-300" />}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{phase === "pre" ? t("trip.preInspection") : t("trip.postInspection")}</span>
          <span className="block text-xs text-white/55">
            {done
              ? done.acknowledged_at
                ? t("trip.acknowledged")
                : t("trip.inspectionDone", { date: formatDateTime(done.created_at, locale) })
              : t("trip.inspectionTodo")}
          </span>
        </span>
        <ChevronRight className="size-4 text-white/40 rtl:rotate-180" />
      </Link>
    );
  };

  const reviewAuthorName = (r: Review) => (r.author_id === trip.renter?.id ? trip.renter?.full_name : trip.host?.full_name) ?? "";
  const counterpartRating = role === "host" ? counterpart?.renter_rating : counterpart?.host_rating;
  const counterpartCount = role === "host" ? counterpart?.renter_review_count : counterpart?.host_review_count;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <Link href={role === "host" ? "/trips?view=host" : "/trips"} className="mb-4 inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
        <ChevronRight className="size-4 rotate-180 rtl:rotate-0" />
        {role === "host" ? t("trips.hostTitle") : t("trips.title")}
      </Link>

      {/* Summary */}
      <Glass strong className="mb-6 flex flex-col gap-5 overflow-hidden p-4 sm:flex-row sm:items-center md:p-5">
        <Link href={`/cars/${b.car_id}`} className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl bg-white/5 sm:w-56">
          {car?.cover_url ? (
            <Image src={car.cover_url} alt={carName} fill sizes="(max-width: 640px) 100vw, 224px" className="object-cover" priority />
          ) : (
            <CarFront className="absolute inset-0 m-auto size-10 text-white/30" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[b.status]}>{t(`trips.status.${b.status}`)}</Badge>
            <Badge>{t(`trips.payment.${b.payment_status}`)}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">
            <Link href={`/cars/${b.car_id}`} className="hover:underline">
              {carName}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-white/55" dir="auto">
            {t("trip.reference", { ref: b.reference })}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/75">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4 text-white/40" />
              {formatDateTime(b.start_at, locale)} → {formatDateTime(b.end_at, locale)}
            </span>
          </div>
        </div>
      </Glass>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Status hints */}
          {role === "renter" && b.status === "pending" && <Alert tone="info">{t("trip.awaiting")}</Alert>}
          {needsPay && (
            <Alert tone="warning">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{t("trip.renterNeedsPay")}</span>
                <ButtonLink href={`/pay/${b.id}`} variant="accent" size="sm">
                  <CreditCard className="size-4" />
                  {t("trip.payNow")} · {formatMAD(Number(b.total_mad), locale)}
                </ButtonLink>
              </div>
            </Alert>
          )}
          {role === "host" && b.status === "confirmed" && !pre && <Alert tone="info">{t("trip.hostNeedsInspection")}</Alert>}
          {b.cancel_reason && (b.status === "cancelled" || b.status === "declined") && (
            <Alert tone="warning">{t("trip.reasonShown", { reason: b.cancel_reason })}</Alert>
          )}

          {/* Actions */}
          {(["pending", "confirmed", "active"] as const).some((s) => s === b.status) && (
            <Glass className="p-5">
              <h2 className="mb-3 text-sm font-semibold tracking-wider text-white/60 uppercase">{t("trip.actions")}</h2>
              <TripActions
                bookingId={b.id}
                role={role}
                status={b.status}
                refund={refundEstimate(b, role === "host")}
                startBlocked={startBlocked}
              />
            </Glass>
          )}

          {/* Dates & hand-over */}
          <Glass className="grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <p className="label">{t("trip.pickup")}</p>
              <p className="font-semibold">{formatDateTime(b.start_at, locale)}</p>
            </div>
            <div>
              <p className="label">{t("trip.return")}</p>
              <p className="font-semibold">{formatDateTime(b.end_at, locale)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="label">{t("trip.where")}</p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-terracotta-300" />
                <span>{handover}</span>
              </p>
              <p className="mt-2 text-xs text-white/50">
                {t(`booking.delivery.${b.delivery_option}`)} · {t(`booking.insurance.${b.insurance_plan}`)} ·{" "}
                {t("booking.breakdown.km", { km: b.km_included })}
              </p>
            </div>
            {b.renter_message && (
              <blockquote className="glass-subtle rounded-xl p-3 text-sm text-white/75 italic sm:col-span-2" dir="auto">
                “{b.renter_message}”
              </blockquote>
            )}
          </Glass>

          {/* Timeline */}
          <Glass className="p-5">
            <h2 className="mb-4 text-lg font-bold">{t("trip.timeline")}</h2>
            <ol className="relative space-y-4 border-s border-white/15 ps-5">
              {timeline.map((e) => (
                <li key={e.key} className="relative">
                  <span
                    className={cn(
                      "absolute -start-[1.6rem] top-1 size-3 rounded-full ring-4 ring-ink-900",
                      e.key === "cancelled" ? "bg-rose-400" : e.key === "completed" ? "bg-mint-400" : "bg-majorelle-400",
                    )}
                  />
                  <p className="font-semibold">{e.label}</p>
                  <p className="text-xs text-white/55">{formatDateTime(e.at, locale)}</p>
                </li>
              ))}
            </ol>
          </Glass>

          {/* Inspections */}
          {(preAvailable || pre || post) && (
            <Glass className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <ClipboardCheck className="size-5 text-saffron-300" />
                {t("trip.inspections")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {inspectionItem("pre", pre, preAvailable)}
                {inspectionItem("post", post, postAvailable)}
              </div>
            </Glass>
          )}

          {/* Reviews */}
          {b.status === "completed" && !myReview && counterpart && (
            <ReviewForm bookingId={b.id} subjectName={counterpart.full_name} asRenter={role === "renter"} />
          )}
          {reviews.length > 0 && (
            <Glass className="p-5">
              <h2 className="mb-4 text-lg font-bold">{t("trip.reviewsTitle")}</h2>
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className="glass-subtle rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {r.author_id === userId ? t("messages.you") : reviewAuthorName(r)}
                        <span className="ms-2 font-normal text-white/45">{formatDate(r.created_at, locale)}</span>
                      </span>
                      <Stars value={r.rating} />
                    </div>
                    {r.direction === "renter_to_host" && (r.cleanliness || r.communication || r.accuracy) && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
                        {r.cleanliness && (
                          <span>
                            {t("trip.cleanliness")} {r.cleanliness}/5
                          </span>
                        )}
                        {r.communication && (
                          <span>
                            {t("trip.communication")} {r.communication}/5
                          </span>
                        )}
                        {r.accuracy && (
                          <span>
                            {t("trip.accuracy")} {r.accuracy}/5
                          </span>
                        )}
                      </div>
                    )}
                    {r.comment && (
                      <p className="mt-2 text-sm text-white/80" dir="auto">
                        {r.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Glass>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {counterpart && (
            <Glass className="p-5">
              <p className="label">{role === "host" ? t("trips.renter") : t("trips.host")}</p>
              <Link href={`/users/${counterpart.id}`} className="mt-2 flex items-center gap-3 hover:opacity-90">
                <Avatar name={counterpart.full_name} url={counterpart.avatar_url} size={52} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{counterpart.full_name}</span>
                  {counterpartRating != null ? (
                    <Rating value={counterpartRating} count={counterpartCount} />
                  ) : (
                    <span className="text-xs text-white/50">{t("common.new")}</span>
                  )}
                </span>
              </Link>
              <div className="mt-4 flex flex-col gap-2">
                <ButtonLink href={`/messages?booking=${b.id}`} variant="secondary" size="sm">
                  <MessageCircle className="size-4" />
                  {t("trip.chat")}
                </ButtonLink>
                {contact?.phone || contact?.whatsapp ? (
                  <div className="flex gap-2">
                    {contact.phone && (
                      <ButtonLink href={`tel:${contact.phone.replace(/\s+/g, "")}`} variant="secondary" size="sm" className="flex-1">
                        <Phone className="size-4" />
                        <span dir="ltr">{contact.phone}</span>
                      </ButtonLink>
                    )}
                    {contact.whatsapp && (
                      <ButtonLink href={whatsappLink(contact.whatsapp, b.reference)} variant="success" size="sm" className="flex-1">
                        {t("trip.whatsapp")}
                      </ButtonLink>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-white/50">{t("trip.contactHidden")}</p>
                )}
              </div>
            </Glass>
          )}

          <Glass className="p-5">
            <h2 className="mb-2 text-lg font-bold">{t("checkout.priceDetails")}</h2>
            <Line label={t("booking.breakdown.rental", { price: formatMAD(Number(b.unit_price_mad), locale), units: b.units, unit: unitLabel })}>
              <Price mad={Number(b.rental_fee_mad)} showConverted={false} />
            </Line>
            {Number(b.discount_mad) > 0 && (
              <Line label={t("booking.breakdown.discount")}>
                <span className="text-mint-400">−<Price mad={Number(b.discount_mad)} showConverted={false} /></span>
              </Line>
            )}
            {Number(b.delivery_fee_mad) > 0 && (
              <Line label={t("booking.breakdown.delivery")}>
                <Price mad={Number(b.delivery_fee_mad)} showConverted={false} />
              </Line>
            )}
            {Number(b.insurance_fee_mad) > 0 && (
              <Line label={t("booking.breakdown.insurance")}>
                <Price mad={Number(b.insurance_fee_mad)} showConverted={false} />
              </Line>
            )}
            <Line label={t("booking.breakdown.service")}>
              <Price mad={Number(b.service_fee_mad)} showConverted={false} />
            </Line>
            <Line label={t("booking.breakdown.total")} strong>
              <Price mad={Number(b.total_mad)} />
            </Line>
            {role === "host" && (
              <Line label={t("trip.payout")}>
                <span className="font-semibold text-mint-400">
                  <Price mad={Number(b.host_payout_mad)} showConverted={false} />
                </span>
              </Line>
            )}
            <Line label={t("booking.breakdown.deposit")} muted>
              <Price mad={Number(b.deposit_mad)} showConverted={false} />
            </Line>

            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="label">{t("trip.payment")}</p>
              <p className="text-sm">
                {t("trip.paidWith", { method: t(`checkout.method.${b.payment_method}`), status: t(`trips.payment.${b.payment_status}`) })}
              </p>
              {b.refund_mad != null && Number(b.refund_mad) > 0 && (
                <p className="mt-1 text-sm text-mint-400">{t("trip.refund", { amount: formatMAD(Number(b.refund_mad), locale) })}</p>
              )}
            </div>
          </Glass>

          <Glass className="p-5">
            <h2 className="mb-3 text-lg font-bold">{t("trip.documents")}</h2>
            <div className="flex flex-col gap-2">
              <ButtonLink href={`/trips/${b.id}/contract`} variant="ghost" size="sm" className="justify-start">
                <FileText className="size-4" />
                {t("trip.contract")}
              </ButtonLink>
              <ButtonLink href={`/trips/${b.id}/invoice`} variant="ghost" size="sm" className="justify-start">
                <Receipt className="size-4" />
                {t("trip.invoice")}
              </ButtonLink>
              {canDispute && (
                <ButtonLink href={`/disputes/new?booking=${b.id}`} variant="ghost" size="sm" className="justify-start text-terracotta-300">
                  <AlertTriangle className="size-4" />
                  {t("trip.dispute")}
                </ButtonLink>
              )}
            </div>
          </Glass>
        </aside>
      </div>
    </div>
  );
}
