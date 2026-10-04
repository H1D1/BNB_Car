import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CarFront, ChevronRight } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn, formatDateTime } from "@/lib/utils";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONE } from "@/lib/trips";
import { ButtonLink } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import type { Booking, BookingStatus } from "@/lib/types";

const TABS = ["upcoming", "active", "completed", "cancelled"] as const;
type Tab = (typeof TABS)[number];

const TAB_STATUSES: Record<Tab, BookingStatus[]> = {
  upcoming: ["pending", "confirmed"],
  active: ["active"],
  completed: ["completed"],
  cancelled: ["cancelled", "declined"],
};

type Row = Pick<
  Booking,
  "id" | "reference" | "car_id" | "renter_id" | "host_id" | "start_at" | "end_at" | "status" | "total_mad" | "host_payout_mad" | "payment_status" | "payment_method" | "contract_snapshot"
>;

export async function generateMetadata(props: PageProps<"/trips">): Promise<Metadata> {
  const { t } = await getI18n();
  const { view } = await props.searchParams;
  return { title: view === "host" ? t("trips.hostTitle") : t("trips.title") };
}

export default async function TripsPage(props: PageProps<"/trips">) {
  const sp = await props.searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/trips");
  const { t, locale } = await getI18n();

  const view: "renter" | "host" = sp.view === "host" ? "host" : "renter";
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "upcoming";

  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, reference, car_id, renter_id, host_id, start_at, end_at, status, total_mad, host_payout_mad, payment_status, payment_method, contract_snapshot")
    .eq(view === "host" ? "host_id" : "renter_id", profile.id)
    .order("start_at", { ascending: false })
    .limit(300);
  const all = (data ?? []) as Row[];

  const counts = Object.fromEntries(TABS.map((x) => [x, all.filter((b) => TAB_STATUSES[x].includes(b.status)).length])) as Record<Tab, number>;
  const rows = all.filter((b) => TAB_STATUSES[tab].includes(b.status));
  if (tab === "upcoming") rows.reverse(); // soonest first

  // Cars may be paused since; the user is party to every booking listed, so read them with the service role.
  const carIds = [...new Set(rows.map((b) => b.car_id))];
  const otherIds = [...new Set(rows.map((b) => (view === "host" ? b.renter_id : b.host_id)))];
  const [cars, people] = await Promise.all([
    carIds.length
      ? createAdminClient().from("cars").select("id, make, model, year, cover_url").in("id", carIds)
      : Promise.resolve({ data: [] }),
    otherIds.length ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", otherIds) : Promise.resolve({ data: [] }),
  ]);
  const carMap = new Map((cars.data ?? []).map((c) => [c.id as string, c as { id: string; make: string; model: string; year: number; cover_url: string | null }]));
  const peopleMap = new Map((people.data ?? []).map((p) => [p.id as string, p as { id: string; full_name: string; avatar_url: string | null }]));

  const href = (next: { view?: string; tab?: string }) => {
    const q = new URLSearchParams();
    const v = next.view ?? view;
    if (v === "host") q.set("view", "host");
    const tb = next.tab ?? tab;
    if (tb !== "upcoming") q.set("tab", tb);
    const s = q.toString();
    return `/trips${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <PageHeader
        title={view === "host" ? t("trips.hostTitle") : t("trips.title")}
        actions={
          profile.is_host ? (
            <div className="glass-subtle inline-flex rounded-full p-1 text-sm">
              {(["renter", "host"] as const).map((v) => (
                <Link
                  key={v}
                  href={href({ view: v, tab: "upcoming" })}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-semibold transition",
                    v === view ? "bg-white/15 text-white" : "text-white/60 hover:text-white",
                  )}
                >
                  {v === "host" ? t("profile.asHost") : t("profile.asRenter")}
                </Link>
              ))}
            </div>
          ) : undefined
        }
      />

      <nav className="scrollbar-none -mx-1 mb-6 flex gap-2 overflow-x-auto px-1" aria-label={t("trips.title")}>
        {TABS.map((x) => (
          <Link
            key={x}
            href={href({ tab: x })}
            aria-current={x === tab ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition",
              x === tab ? "border-white/30 bg-white/15 text-white" : "border-white/10 text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            {t(`trips.tabs.${x}`)}
            {counts[x] > 0 && <span className="rounded-full bg-white/15 px-2 text-xs">{counts[x]}</span>}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CarFront className="size-7" />}
          title={t("trips.empty")}
          action={
            view === "host" ? (
              <ButtonLink href="/host" variant="secondary">
                {t("nav.hostDashboard")}
              </ButtonLink>
            ) : (
              <ButtonLink href="/search" variant="accent">
                {t("trips.emptyCta")}
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => {
            const car = carMap.get(b.car_id);
            const snap = (b.contract_snapshot?.car ?? {}) as { make?: string; model?: string; year?: number };
            const other = peopleMap.get(view === "host" ? b.renter_id : b.host_id);
            const carName = car ? `${car.make} ${car.model}` : [snap.make, snap.model].filter(Boolean).join(" ");
            return (
              <li key={b.id}>
                <Link href={`/trips/${b.id}`} className="glass liquid flex items-stretch gap-4 overflow-hidden rounded-[var(--radius-glass)] p-3 animate-fade-up">
                  <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl bg-white/5 sm:w-40">
                    {car?.cover_url ? (
                      <Image src={car.cover_url} alt={carName} fill sizes="160px" className="object-cover" />
                    ) : (
                      <CarFront className="absolute inset-0 m-auto size-8 text-white/30" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold sm:text-lg">
                          {carName} {car?.year ?? snap.year}
                        </h2>
                        <p className="text-xs text-white/45" dir="ltr">
                          {b.reference}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[b.status]}>{t(`trips.status.${b.status}`)}</Badge>
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-white/70">
                      <CalendarDays className="size-4 shrink-0 text-white/40" />
                      <span>
                        {formatDateTime(b.start_at, locale)} → {formatDateTime(b.end_at, locale)}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      {other ? (
                        <span className="flex items-center gap-2 text-sm text-white/70">
                          <Avatar name={other.full_name} url={other.avatar_url} size={24} />
                          {t("trips.with", { name: other.full_name })}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="flex items-center gap-2 text-end">
                        <span className="text-xs text-white/45">{view === "host" ? t("trip.payout") : t("common.total")}</span>
                        <Price mad={Number(view === "host" ? b.host_payout_mad : b.total_mad)} className="font-bold" showConverted={view !== "host"} />
                        <ChevronRight className="size-4 text-white/40 rtl:rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
