import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getPlace } from "@/lib/data";
import { getTrip } from "@/lib/trips";
import { formatMAD } from "@/lib/currency";
import { formatDate, formatDateTime, placeName } from "@/lib/utils";
import { Glass } from "@/components/ui/primitives";
import { PrintButton } from "@/components/trips/PrintButton";
import type { FuelType, Transmission } from "@/lib/types";

const CLAUSES = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("contract.title") };
}

type Snapshot = {
  car?: { make?: string; model?: string; year?: number; plate?: string | null; fuel?: FuelType; transmission?: Transmission };
  renter_name?: string;
  host_name?: string;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 py-2 text-sm last:border-0">
      <span className="text-white/60">{label}</span>
      <span className="text-end font-semibold">{children}</span>
    </div>
  );
}

export default async function ContractPage(props: PageProps<"/trips/[id]/contract">) {
  const { id } = await props.params;
  const trip = await getTrip(id);
  if (!trip) notFound();
  const { booking: b, car, renter, host } = trip;
  const { t, locale } = await getI18n();
  const city = await getPlace(car?.city_slug);

  const snap = (b.contract_snapshot ?? {}) as Snapshot;
  const v = {
    make: snap.car?.make ?? car?.make ?? "",
    model: snap.car?.model ?? car?.model ?? "",
    year: snap.car?.year ?? car?.year,
    plate: snap.car?.plate ?? car?.plate ?? "—",
    fuel: snap.car?.fuel ?? car?.fuel,
    transmission: snap.car?.transmission ?? car?.transmission,
  };
  const renterName = snap.renter_name || renter?.full_name || "—";
  const hostName = snap.host_name || host?.full_name || "—";

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
        <header className="border-b border-white/15 pb-6 text-center">
          <p className="text-sm font-semibold tracking-widest text-saffron-300 uppercase">{t("common.appName")}</p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">{t("contract.title")}</h1>
          <p className="mt-1 text-sm text-white/60">{t("contract.subtitle")}</p>
          <p className="mt-3 text-sm font-semibold" dir="auto">
            {t("contract.number", { ref: b.reference })}
          </p>
        </header>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">{t("contract.parties")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="glass-subtle rounded-xl p-4">
              <p className="label">{t("contract.owner")}</p>
              <p className="font-semibold">{hostName}</p>
            </div>
            <div className="glass-subtle rounded-xl p-4">
              <p className="label">{t("contract.renter")}</p>
              <p className="font-semibold">{renterName}</p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">{t("contract.vehicle")}</h2>
          <Row label={t("contract.vehicle")}>
            {v.make} {v.model} {v.year}
          </Row>
          <Row label={t("contract.plate")}>
            <span dir="ltr">{v.plate}</span>
          </Row>
          {(v.fuel || v.transmission) && (
            <Row label={`${t("carPage.specs")}`}>
              {[v.fuel && t(`car.fuel.${v.fuel}`), v.transmission && t(`car.transmission.${v.transmission}`)].filter(Boolean).join(" · ")}
            </Row>
          )}
          {city && <Row label={t("trip.where")}>{placeName(city, locale)}</Row>}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">{t("contract.period")}</h2>
          <Row label={t("trip.pickup")}>{formatDateTime(b.start_at, locale)}</Row>
          <Row label={t("trip.return")}>{formatDateTime(b.end_at, locale)}</Row>
          <Row label={t("contract.price")}>{formatMAD(Number(b.total_mad), locale, { decimals: true })}</Row>
          <Row label={t("contract.deposit")}>{formatMAD(Number(b.deposit_mad), locale)}</Row>
          <Row label={t("contract.mileage")}>
            {t("booking.breakdown.km", { km: b.km_included })} · <span dir="ltr">{formatMAD(Number(b.extra_km_fee_mad), locale, { decimals: true })}/{t("common.km")}</span>
          </Row>
          <Row label={t("contract.insurance")}>{t(`booking.insurance.${b.insurance_plan}`)}</Row>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">{t("contract.clausesTitle")}</h2>
          <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed text-white/85">
            {CLAUSES.map((c) => (
              <li key={c}>{t(`contract.clauses.${c}`)}</li>
            ))}
          </ol>
        </section>

        <footer className="mt-8 space-y-1 border-t border-white/15 pt-5 text-xs text-white/60">
          {b.contract_accepted_at && <p>{t("contract.signed", { date: formatDateTime(b.contract_accepted_at, locale) })}</p>}
          <p>{t("contract.hostSigned")}</p>
          <p>{formatDate(b.created_at, locale, { dateStyle: "long" })}</p>
        </footer>
      </Glass>
    </div>
  );
}
