import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronRight, Fuel, Gauge, XCircle } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getTrip } from "@/lib/trips";
import { INSPECTION_ANGLES, INSPECTION_CHECKS, isPhase, type InspectionAngle } from "@/lib/inspection";
import { formatMAD } from "@/lib/currency";
import { formatDateTime, intlLocale } from "@/lib/utils";
import { Alert, Glass, PageHeader } from "@/components/ui/primitives";
import { InspectionForm } from "@/components/trips/InspectionForm";
import { AcknowledgeButton } from "@/components/trips/AcknowledgeButton";

type InspectionRow = {
  id: string;
  phase: "pre" | "post";
  submitted_by: string;
  odometer_km: number | null;
  fuel_level: number | null;
  checklist: Record<string, boolean>;
  notes: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  photos: { id: string; angle: string; storage_path: string; damage_note: string | null }[];
};

export async function generateMetadata(props: PageProps<"/trips/[id]/inspection/[phase]">): Promise<Metadata> {
  const { phase } = await props.params;
  const { t } = await getI18n();
  return { title: phase === "post" ? t("inspection.postTitle") : t("inspection.preTitle") };
}

export default async function InspectionPage(props: PageProps<"/trips/[id]/inspection/[phase]">) {
  const { id, phase } = await props.params;
  if (!isPhase(phase)) notFound();
  const trip = await getTrip(id);
  if (!trip) notFound();
  const { booking: b, userId } = trip;
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const { data } = await supabase
    .from("inspections")
    .select("id, phase, submitted_by, odometer_km, fuel_level, checklist, notes, acknowledged_by, acknowledged_at, created_at, photos:inspection_photos(id, angle, storage_path, damage_note)")
    .eq("booking_id", b.id);
  const all = (data ?? []) as InspectionRow[];
  const inspection = all.find((i) => i.phase === phase);
  const pre = all.find((i) => i.phase === "pre");

  const available = phase === "pre" ? ["confirmed", "active"].includes(b.status) : ["active", "completed"].includes(b.status);
  const title = phase === "pre" ? t("inspection.preTitle") : t("inspection.postTitle");
  const nameOf = (uid: string | null) => (uid === trip.renter?.id ? trip.renter?.full_name : uid === trip.host?.id ? trip.host?.full_name : "") ?? "";

  const angleLabel = (a: string) => ((INSPECTION_ANGLES as readonly string[]).includes(a) ? t(`inspection.angles.${a as InspectionAngle}`) : a);

  let signed = new Map<string, string>();
  if (inspection?.photos.length) {
    const { data: urls } = await supabase.storage.from("inspections").createSignedUrls(
      inspection.photos.map((p) => p.storage_path),
      3600,
    );
    signed = new Map((urls ?? []).flatMap((u) => (u.signedUrl && u.path ? [[u.path, u.signedUrl] as const] : [])));
  }
  const photos = [...(inspection?.photos ?? [])].sort(
    (a, c) => INSPECTION_ANGLES.indexOf(a.angle as InspectionAngle) - INSPECTION_ANGLES.indexOf(c.angle as InspectionAngle),
  );

  const kmDriven =
    phase === "post" && inspection?.odometer_km != null && pre?.odometer_km != null ? Math.max(0, inspection.odometer_km - pre.odometer_km) : null;
  const extraKm = kmDriven != null ? Math.max(0, kmDriven - b.km_included) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <Link href={`/trips/${b.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
        <ChevronRight className="size-4 rotate-180 rtl:rotate-0" />
        {t("trip.back")} · <span dir="ltr">{b.reference}</span>
      </Link>
      <PageHeader title={title} subtitle={inspection ? undefined : t("inspection.intro")} />

      {inspection ? (
        <div className="space-y-6">
          <Alert tone={inspection.acknowledged_at ? "success" : "info"}>
            <p>{t("inspection.submittedBy", { name: nameOf(inspection.submitted_by), date: formatDateTime(inspection.created_at, locale) })}</p>
            <p className="mt-1">
              {inspection.acknowledged_at
                ? `${t("trip.acknowledged")} · ${formatDateTime(inspection.acknowledged_at, locale)}`
                : t("inspection.waitingAck", { name: nameOf(inspection.submitted_by === b.renter_id ? b.host_id : b.renter_id) })}
            </p>
          </Alert>
          {!inspection.acknowledged_at && inspection.submitted_by !== userId && (
            <AcknowledgeButton inspectionId={inspection.id} bookingId={b.id} />
          )}

          <Glass className="p-5">
            <h2 className="mb-4 text-lg font-bold">{t("inspection.photos")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => {
                const url = signed.get(p.storage_path);
                return (
                  <figure key={p.id} className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket */}
                        <img src={url} alt={angleLabel(p.angle)} className="size-full object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <div className="skeleton aspect-[4/3]" />
                    )}
                    <figcaption className="px-3 py-2 text-xs font-semibold">
                      {angleLabel(p.angle)}
                      {p.damage_note && <span className="block font-normal text-white/60">{p.damage_note}</span>}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </Glass>

          <Glass className="grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <p className="label">{t("inspection.odometer")}</p>
              <p className="flex items-center gap-2 text-lg font-semibold" dir="ltr">
                <Gauge className="size-5 text-white/50" />
                {inspection.odometer_km != null ? `${inspection.odometer_km.toLocaleString(intlLocale(locale))} ${t("common.km")}` : "—"}
              </p>
            </div>
            <div>
              <p className="label">{t("inspection.fuel")}</p>
              <div className="flex items-center gap-3">
                <Fuel className="size-5 shrink-0 text-white/50" />
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-terracotta-400 to-saffron-300" style={{ width: `${inspection.fuel_level ?? 0}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums">{inspection.fuel_level ?? 0}%</span>
              </div>
            </div>
            {kmDriven != null && (
              <div className="sm:col-span-2">
                <Alert tone={extraKm > 0 ? "warning" : "success"}>
                  <p>{t("inspection.kmDriven", { km: kmDriven, included: b.km_included })}</p>
                  {extraKm > 0 && (
                    <p className="mt-1">
                      {t("inspection.extraKm", { km: extraKm, amount: formatMAD(extraKm * Number(b.extra_km_fee_mad), locale, { decimals: true }) })}
                    </p>
                  )}
                </Alert>
              </div>
            )}
          </Glass>

          <Glass className="p-5">
            <h2 className="mb-4 text-lg font-bold">{t("inspection.checklist")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {INSPECTION_CHECKS.map((k) => (
                <li key={k} className="glass-subtle flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
                  {inspection.checklist?.[k] ? (
                    <CheckCircle2 className="size-4 shrink-0 text-mint-400" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-white/30" />
                  )}
                  {t(`inspection.checks.${k}`)}
                </li>
              ))}
            </ul>
            {inspection.notes && (
              <div className="mt-5">
                <p className="label">{t("inspection.notes")}</p>
                <p className="text-sm whitespace-pre-line text-white/80" dir="auto">
                  {inspection.notes}
                </p>
              </div>
            )}
          </Glass>
        </div>
      ) : available ? (
        <InspectionForm bookingId={b.id} phase={phase} />
      ) : (
        <Alert tone="info">{t("inspection.notAvailable")}</Alert>
      )}
    </div>
  );
}
