import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DISPUTABLE, STATUS_TONE, getTrip, isUuid } from "@/lib/trips";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, EmptyState, Glass, PageHeader } from "@/components/ui/primitives";
import { DisputeForm } from "@/components/disputes/DisputeForm";
import type { Booking } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("disputes.newTitle") };
}

type Row = Pick<Booking, "id" | "reference" | "car_id" | "start_at" | "end_at" | "status">;

export default async function NewDisputePage(props: PageProps<"/disputes/new">) {
  const { booking } = await props.searchParams;
  const user = await getUser();
  if (!user) redirect("/login?next=/disputes/new");
  const { t, locale } = await getI18n();

  if (typeof booking === "string" && booking) {
    if (!isUuid(booking)) notFound();
    const trip = await getTrip(booking);
    if (!trip) notFound();
    const b = trip.booking;
    const carName = trip.car ? `${trip.car.make} ${trip.car.model}` : "";
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Link href={`/trips/${b.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
          <ChevronRight className="size-4 rotate-180 rtl:rotate-0" />
          {t("trip.back")}
        </Link>
        <PageHeader title={t("disputes.newTitle")} subtitle={t("disputes.intro")} />
        <Glass className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="label">{t("disputes.booking")}</p>
            <p className="font-semibold">
              {carName} · <span dir="ltr">{b.reference}</span>
            </p>
            <p className="text-xs text-white/55">
              {formatDate(b.start_at, locale)} → {formatDate(b.end_at, locale)} · {trip.counterpart?.full_name}
            </p>
          </div>
          <Badge tone={STATUS_TONE[b.status]}>{t(`trips.status.${b.status}`)}</Badge>
        </Glass>
        {DISPUTABLE.includes(b.status) ? <DisputeForm bookingId={b.id} userId={user.id} /> : <Alert tone="warning">{t("disputes.noEligible")}</Alert>}
      </div>
    );
  }

  // No booking chosen yet: list the eligible ones.
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, reference, car_id, start_at, end_at, status")
    .or(`renter_id.eq.${user.id},host_id.eq.${user.id}`)
    .in("status", DISPUTABLE)
    .order("start_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Row[];
  // The user is party to each listed booking; cars may be unlisted since, so read names with the service role.
  const carIds = [...new Set(rows.map((b) => b.car_id))];
  const { data: cars } = carIds.length ? await createAdminClient().from("cars").select("id, make, model").in("id", carIds) : { data: [] };
  const carNames = new Map((cars ?? []).map((c) => [c.id as string, `${c.make} ${c.model}`]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <PageHeader title={t("disputes.newTitle")} subtitle={t("disputes.chooseBooking")} />
      {rows.length === 0 ? (
        <EmptyState title={t("disputes.noBookings")} text={t("disputes.noEligible")} />
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => {
            return (
              <li key={b.id}>
                <Link href={`/disputes/new?booking=${b.id}`} className="glass liquid flex items-center gap-4 rounded-[var(--radius-glass)] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {carNames.get(b.car_id)} · <span dir="ltr">{b.reference}</span>
                    </p>
                    <p className="text-xs text-white/55">
                      {formatDate(b.start_at, locale)} → {formatDate(b.end_at, locale)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[b.status]}>{t(`trips.status.${b.status}`)}</Badge>
                  <ChevronRight className="size-5 text-white/40 rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
