import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { removeBlockedDates, removeSeasonalPrice } from "@/app/actions/host";
import { formatMAD } from "@/lib/currency";
import { cn, formatDate, intlLocale, isoToCasablancaLocal } from "@/lib/utils";
import { Glass } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BlockForm, SeasonForm } from "@/components/host/CalendarForms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("calendar.title") };
}

type Blocked = { id: string; start_date: string; end_date: string; note: string | null };
type Season = { id: string; label: string; start_date: string; end_date: string; daily_price_mad: number };
type Busy = { start_at: string; end_at: string; kind: "booked" | "blocked" };

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (iso: string | Date) => isoToCasablancaLocal(iso).slice(0, 10);
const addMonths = (y: number, m: number, d: number) => {
  const total = y * 12 + (m - 1) + d;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
};

export default async function CarCalendarPage(props: PageProps<"/host/cars/[id]/calendar">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=/host/cars/${id}/calendar`);

  const supabase = await createClient();
  const { data: car } = await supabase
    .from("cars")
    .select("id, make, model, year, title, daily_price_mad")
    .eq("id", id)
    .eq("host_id", profile.id)
    .maybeSingle();
  if (!car) notFound();

  const { t, locale } = await getI18n();
  const today = dayOf(new Date());
  const [blockedRes, seasonRes, busyRes] = await Promise.all([
    supabase.from("car_blocked_dates").select("id, start_date, end_date, note").eq("car_id", id).gte("end_date", today).order("start_date"),
    supabase.from("car_seasonal_prices").select("id, label, start_date, end_date, daily_price_mad").eq("car_id", id).gte("end_date", today).order("start_date"),
    supabase.rpc("car_busy_ranges", { p_car_id: id }),
  ]);
  const blocked = (blockedRes.data ?? []) as Blocked[];
  const seasons = (seasonRes.data ?? []) as Season[];
  // Booked time ranges → inclusive Casablanca day ranges (end is exclusive, so step back 1 ms).
  const booked = ((busyRes.data ?? []) as Busy[])
    .filter((b) => b.kind === "booked")
    .map((b) => ({ start: dayOf(b.start_at), end: dayOf(new Date(new Date(b.end_at).getTime() - 1)) }));

  // Month being shown
  const mParam = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const y = Number(mParam.slice(0, 4));
  const m = Math.min(12, Math.max(1, Number(mParam.slice(5, 7))));
  const prev = addMonths(y, m, -1);
  const next = addMonths(y, m, 1);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const monthLabel = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 15));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" }).format(Date.UTC(2024, 0, 1 + i)),
  );

  const cells: (null | { day: number; date: string })[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, date: `${y}-${pad(m)}-${pad(i + 1)}` })),
  ];
  while (cells.length % 7) cells.push(null);

  const inRange = (d: string, r: { start: string; end: string }) => d >= r.start && d <= r.end;
  const range = (a: string, b: string) =>
    a === b ? formatDate(`${a}T12:00:00Z`, locale) : `${formatDate(`${a}T12:00:00Z`, locale)} → ${formatDate(`${b}T12:00:00Z`, locale)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <Link href={`/host/cars/${id}?step=2`} className="mb-2 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {car.title || `${car.make} ${car.model} ${car.year}`}
      </Link>
      <h1 className="mb-8 text-3xl font-bold tracking-tight md:text-4xl">{t("calendar.title")}</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Glass className="p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Link href={`/host/cars/${id}/calendar?m=${prev.y}-${pad(prev.m)}`} aria-label={t("calendar.prevMonth")} className="grid size-10 place-items-center rounded-full bg-white/8 transition hover:bg-white/15">
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </Link>
            <h2 className="text-lg font-bold capitalize">{monthLabel}</h2>
            <Link href={`/host/cars/${id}/calendar?m=${next.y}-${pad(next.m)}`} aria-label={t("calendar.nextMonth")} className="grid size-10 place-items-center rounded-full bg-white/8 transition hover:bg-white/15">
              <ChevronRight className="size-5 rtl:rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-white/45">
            {weekdays.map((w) => (
              <div key={w} className="py-1.5">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <div key={`e${i}`} />;
              const isBooked = booked.some((r) => inRange(c.date, r));
              const isBlocked = blocked.some((b) => inRange(c.date, { start: b.start_date, end: b.end_date }));
              const season = seasons
                .filter((s) => inRange(c.date, { start: s.start_date, end: s.end_date }))
                .sort((a, b) => b.daily_price_mad - a.daily_price_mad)[0];
              const past = c.date < today;
              return (
                <div
                  key={c.date}
                  className={cn(
                    "relative flex aspect-square min-h-12 flex-col justify-between rounded-xl border p-1.5 text-start text-sm transition sm:p-2",
                    isBooked
                      ? "border-majorelle-300/50 bg-majorelle-500/35"
                      : isBlocked
                        ? "border-rose-400/40 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,.22)_0_6px,rgba(244,63,94,.08)_6px_12px)]"
                        : "border-white/8 bg-white/[0.03]",
                    season && !isBooked && !isBlocked && "border-saffron-400/50",
                    past && "opacity-35",
                    c.date === today && "ring-2 ring-white/70",
                  )}
                >
                  <span className="font-semibold">{c.day}</span>
                  <span
                    dir="ltr"
                    className={cn("truncate text-[10px] tabular-nums sm:text-xs", season ? "font-semibold text-saffron-300" : "text-white/40")}
                    title={season?.label}
                  >
                    {season ? season.daily_price_mad : car.daily_price_mad}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/65">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-majorelle-500/60" />
              {t("calendar.legend.booked")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-rose-500/50" />
              {t("calendar.legend.blocked")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded border border-saffron-400" />
              {t("calendar.legend.seasonal")}
            </span>
            <span className="ms-auto text-white/45">{t("calendar.priceLegend")}</span>
          </div>
        </Glass>

        <div className="space-y-6">
          <Glass className="p-5">
            <h2 className="text-lg font-bold">{t("calendar.blocked")}</h2>
            <p className="mt-0.5 mb-4 text-sm text-white/55">{t("calendar.blockedHint")}</p>
            <BlockForm carId={id} today={today} />
            <ul className="mt-4 space-y-2">
              {blocked.length === 0 && <li className="text-sm text-white/45">{t("calendar.none")}</li>}
              {blocked.map((b) => (
                <li key={b.id} className="glass-subtle flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{range(b.start_date, b.end_date)}</span>
                    {b.note && <span className="block truncate text-xs text-white/50">{b.note}</span>}
                  </span>
                  <form action={removeBlockedDates.bind(null, id, b.id)}>
                    <SubmitButton variant="ghost" size="sm" aria-label={t("common.remove")} className="size-9 px-0">
                      <Trash2 className="size-4" />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </Glass>

          <Glass className="p-5">
            <h2 className="text-lg font-bold">{t("calendar.seasonal")}</h2>
            <p className="mt-0.5 mb-4 text-sm text-white/55">{t("calendar.seasonalHint")}</p>
            <SeasonForm carId={id} today={today} basePrice={car.daily_price_mad} />
            <ul className="mt-4 space-y-2">
              {seasons.length === 0 && <li className="text-sm text-white/45">{t("calendar.none")}</li>}
              {seasons.map((s) => (
                <li key={s.id} className="glass-subtle flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {s.label} · <span dir="ltr" className="text-saffron-300">{formatMAD(s.daily_price_mad, locale)}</span>
                    </span>
                    <span className="block text-xs text-white/50">{range(s.start_date, s.end_date)}</span>
                  </span>
                  <form action={removeSeasonalPrice.bind(null, id, s.id)}>
                    <SubmitButton variant="ghost" size="sm" aria-label={t("common.remove")} className="size-9 px-0">
                      <Trash2 className="size-4" />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </Glass>

          {booked.length > 0 && (
            <Glass className="p-5">
              <h2 className="mb-3 text-lg font-bold">{t("calendar.bookings")}</h2>
              <ul className="space-y-1.5 text-sm text-white/75">
                {booked.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full bg-majorelle-400" />
                    {range(b.start, b.end)}
                  </li>
                ))}
              </ul>
            </Glass>
          )}
        </div>
      </div>
    </div>
  );
}
