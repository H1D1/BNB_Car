import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getTrip } from "@/lib/trips";
import { formatMAD } from "@/lib/currency";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Badge, Glass } from "@/components/ui/primitives";
import { PrintButton } from "@/components/trips/PrintButton";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("invoice.title") };
}

export default async function InvoicePage(props: PageProps<"/trips/[id]/invoice">) {
  const { id } = await props.params;
  const trip = await getTrip(id);
  if (!trip) notFound();
  const { booking: b, car, renter, host } = trip;
  const { t, locale } = await getI18n();
  const money = (n: number | string) => formatMAD(Number(n), locale, { decimals: true });

  const snap = (b.contract_snapshot?.car ?? {}) as { make?: string; model?: string; year?: number };
  const carName = car ? `${car.make} ${car.model} ${car.year}` : [snap.make, snap.model, snap.year].filter(Boolean).join(" ");
  const unitLabel = b.rental_type === "hourly" ? (b.units === 1 ? t("common.hour") : t("common.hours")) : b.units === 1 ? t("common.day") : t("common.days");

  const lines: { label: string; sub?: string; amount: number; negative?: boolean }[] = [
    {
      label: t("invoice.rental", { car: carName }),
      sub: `${t("booking.breakdown.rental", { price: money(b.unit_price_mad), units: b.units, unit: unitLabel })} · ${formatDateTime(b.start_at, locale)} → ${formatDateTime(b.end_at, locale)}`,
      amount: Number(b.rental_fee_mad),
    },
  ];
  if (Number(b.discount_mad) > 0) lines.push({ label: t("booking.breakdown.discount"), amount: Number(b.discount_mad), negative: true });
  if (Number(b.delivery_fee_mad) > 0) lines.push({ label: t("booking.breakdown.delivery"), sub: t(`booking.delivery.${b.delivery_option}`), amount: Number(b.delivery_fee_mad) });
  if (Number(b.insurance_fee_mad) > 0) lines.push({ label: t("booking.breakdown.insurance"), sub: t(`booking.insurance.${b.insurance_plan}`), amount: Number(b.insurance_fee_mad) });
  lines.push({ label: t("booking.breakdown.service"), amount: Number(b.service_fee_mad) });

  const refund = b.refund_mad != null ? Number(b.refund_mad) : 0;
  const paid = b.payment_status === "paid" || b.payment_status === "refunded";
  const statusLabel = b.payment_status === "refunded" ? t("invoice.refunded") : paid ? t("invoice.paid") : t("invoice.due");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={`/trips/${b.id}`} className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
          <ChevronRight className="size-4 rotate-180 rtl:rotate-0" />
          {t("trip.back")}
        </Link>
        <PrintButton />
      </div>

      <Glass strong className="print-plain p-6 md:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 pb-6">
          <div>
            <p className="text-sm font-semibold tracking-widest text-saffron-300 uppercase">{t("common.appName")}</p>
            <h1 className="mt-2 text-3xl font-bold">{t("invoice.title")}</h1>
            <p className="mt-1 text-sm text-white/60" dir="auto">
              {t("invoice.number", { ref: b.reference })}
            </p>
            <p className="text-sm text-white/60">{t("invoice.issued", { date: formatDate(b.created_at, locale, { dateStyle: "long" }) })}</p>
          </div>
          <Badge tone={b.payment_status === "refunded" ? "neutral" : paid ? "mint" : "saffron"} className="text-sm">
            {statusLabel}
          </Badge>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label">{t("invoice.billedTo")}</p>
            <p className="font-semibold">{renter?.full_name ?? "—"}</p>
          </div>
          <div>
            <p className="label">{t("trips.host")}</p>
            <p className="font-semibold">{host?.full_name ?? "—"}</p>
          </div>
        </section>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-white/15 text-xs tracking-wider text-white/55 uppercase">
              <th className="py-2 text-start font-semibold">{t("invoice.item")}</th>
              <th className="py-2 text-end font-semibold">{t("invoice.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-white/10 align-top">
                <td className="py-3 pe-4">
                  <span className="font-semibold">{l.label}</span>
                  {l.sub && <span className="block text-xs text-white/55">{l.sub}</span>}
                </td>
                <td className={cn("py-3 text-end tabular-nums", l.negative && "text-mint-400")} dir="ltr">
                  {l.negative ? "−" : ""}
                  {money(l.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-base font-bold">
              <td className="pt-4">{t("booking.breakdown.total")}</td>
              <td className="pt-4 text-end tabular-nums" dir="ltr">
                {money(b.total_mad)}
              </td>
            </tr>
            {refund > 0 && (
              <tr className="text-mint-400">
                <td className="pt-2">{t("invoice.refunded")}</td>
                <td className="pt-2 text-end tabular-nums" dir="ltr">
                  −{money(refund)}
                </td>
              </tr>
            )}
            {refund > 0 && (
              <tr className="font-bold">
                <td className="pt-2">{t("common.total")}</td>
                <td className="pt-2 text-end tabular-nums" dir="ltr">
                  {money(Math.max(0, Number(b.total_mad) - refund))}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        <div className="mt-8 grid gap-4 border-t border-white/15 pt-5 text-sm sm:grid-cols-2">
          <div>
            <p className="label">{t("trip.payment")}</p>
            <p>{t("trip.paidWith", { method: t(`checkout.method.${b.payment_method}`), status: t(`trips.payment.${b.payment_status}`) })}</p>
          </div>
          <div>
            <p className="label">{t("booking.breakdown.deposit")}</p>
            <p dir="ltr" className="text-start rtl:text-end">
              {money(b.deposit_mad)}
            </p>
          </div>
        </div>
        <p className="mt-6 text-xs text-white/50">{t("invoice.note")}</p>
      </Glass>
    </div>
  );
}
