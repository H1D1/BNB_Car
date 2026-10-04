"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn, intlLocale, isoToCasablancaLocal } from "@/lib/utils";
import { Floating } from "./Floating";

/** Dates are Casablanca wall-time strings: "YYYY-MM-DDTHH:mm". Days are "YYYY-MM-DD". */
type Busy = { start_at: string; end_at: string };

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const TIMES = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Calendar cells for a month, Monday-first, with leading blanks. */
function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => dayKey(year, month, i + 1))];
}

export function DateRangePicker({
  start,
  end,
  onChange,
  sameDay = false,
  busy = [],
  months = 2,
  variant = "bar",
  names,
  align = "center",
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  /** Allow return on the pick-up day (hourly rentals). */
  sameDay?: boolean;
  busy?: Busy[];
  months?: 1 | 2;
  variant?: "bar" | "stack";
  /** Render hidden inputs so the picker works inside plain GET forms. */
  names?: { start: string; end: string };
  align?: "center" | "start" | "end";
}) {
  const { t, locale } = useI18n();
  const loc = intlLocale(locale);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [hover, setHover] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);
  const startTime = start.slice(11, 16) || "10:00";
  const endTime = end.slice(11, 16) || "10:00";
  const today = isoToCasablancaLocal(new Date()).slice(0, 10);

  const [view, setView] = useState(() => ({ y: Number(startDay.slice(0, 4)), m: Number(startDay.slice(5, 7)) - 1 }));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Days touched by an existing booking / host block.
  const busyDays = useMemo(() => {
    const set = new Set<string>();
    for (const b of busy) {
      let d = isoToCasablancaLocal(b.start_at).slice(0, 10);
      const last = isoToCasablancaLocal(new Date(new Date(b.end_at).getTime() - 60_000)).slice(0, 10);
      for (let i = 0; d <= last && i < 400; i++, d = addDays(d, 1)) set.add(d);
    }
    return set;
  }, [busy]);

  const rangeHasBusy = (a: string, b: string) => {
    for (let d = a; d <= b; d = addDays(d, 1)) if (busyDays.has(d)) return true;
    return false;
  };

  const commit = (sDay: string, sTime: string, eDay: string, eTime: string) => {
    let e = `${eDay}T${eTime}`;
    const s = `${sDay}T${sTime}`;
    if (e <= s) {
      // keep the range valid: same day → +1h, otherwise next day same time
      const [h, m] = sTime.split(":").map(Number);
      e = sameDay && h < 23 ? `${sDay}T${pad(h + 1)}:${pad(m)}` : `${addDays(sDay, 1)}T${sTime}`;
    }
    onChange(s, e);
  };

  const pick = (day: string) => {
    if (phase === "start" || day < startDay || (!sameDay && day === startDay && phase === "end")) {
      const nextEnd = sameDay ? day : addDays(day, Math.max(1, Math.round((Date.parse(endDay) - Date.parse(startDay)) / 864e5)));
      commit(day, startTime, nextEnd, endTime);
      setPhase("end");
      return;
    }
    commit(startDay, startTime, day, endTime);
    setPhase("start");
  };

  const shift = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  const fmtDay = (s: string) =>
    new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(s.slice(0, 10) + "T12:00:00Z"));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(loc, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
  const nights = Math.max(0, Math.round((Date.parse(endDay) - Date.parse(startDay)) / 864e5));
  const previewEnd = phase === "end" && hover && hover >= startDay ? hover : endDay;

  const cell = (label: string, value: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-center text-start transition",
        variant === "bar"
          ? "rounded-2xl px-4 py-2 hover:bg-white/[0.06]"
          : "glass-subtle rounded-2xl px-3 py-2 hover:bg-white/[0.08]",
        active && open && (variant === "bar" ? "bg-white/[0.1]" : "ring-2 ring-majorelle-400/60"),
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-white/50 uppercase">
        <CalendarDays className="size-3.5" />
        {label}
      </span>
      <span className="truncate text-[15px] font-semibold">
        {fmtDay(value)} · <span dir="ltr">{value.slice(11, 16)}</span>
      </span>
    </button>
  );

  return (
    <div ref={wrap} className={cn("relative flex min-w-0", variant === "bar" ? "flex-[2] flex-col gap-1 md:flex-row" : "grid grid-cols-2 gap-2")}>
      {names && (
        <>
          <input type="hidden" name={names.start} value={start} />
          <input type="hidden" name={names.end} value={end} />
        </>
      )}
      {cell(t("home.pickup"), start, phase === "start", () => {
        setPhase("start");
        setOpen(true);
      })}
      {variant === "bar" && <div className="hidden w-px self-stretch bg-white/10 md:block" />}
      {cell(t("home.return"), end, phase === "end", () => {
        setPhase("end");
        setOpen(true);
      })}

      <Floating
        ref={panel}
        anchor={wrap}
        open={open}
        align={align}
        offset={14}
        role="dialog"
        aria-label={t("datePicker.title")}
        className={cn("rounded-3xl p-4 animate-fade-up sm:p-5", months === 2 ? "w-[min(94vw,44rem)]" : "w-[min(94vw,22rem)]")}
        style={{ animationDuration: "0.35s" }}
      >
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label={t("datePicker.prev")}>
              <ChevronLeft className="size-5 rtl:rotate-180" />
            </button>
            <p className="text-sm font-semibold text-white/70">
              {phase === "start" ? t("datePicker.selectPickup") : t("datePicker.selectReturn")}
            </p>
            <button type="button" onClick={() => shift(1)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label={t("datePicker.next")}>
              <ChevronRight className="size-5 rtl:rotate-180" />
            </button>
          </div>

          <div className={cn("grid gap-6", months === 2 && "sm:grid-cols-2")}>
            {Array.from({ length: months }, (_, i) => {
              const m = (view.m + i) % 12;
              const y = view.y + Math.floor((view.m + i) / 12);
              return (
                <div key={`${y}-${m}`} className={cn(i === 1 && "hidden sm:block")}>
                  <p className="mb-2 text-center font-bold capitalize">
                    {new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 15)))}
                  </p>
                  <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-white/45">
                    {weekdays.map((w, k) => (
                      <span key={k} className="py-1.5">
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
                    {monthGrid(y, m).map((d, k) => {
                      if (!d) return <span key={k} />;
                      const past = d < today;
                      const isBusy = busyDays.has(d);
                      const blocked = past || isBusy || (phase === "end" && d > startDay && rangeHasBusy(startDay, d));
                      const isStart = d === startDay;
                      const isEnd = d === previewEnd;
                      const inRange = d > startDay && d < previewEnd;
                      return (
                        <div
                          key={d}
                          className={cn(
                            "relative h-10",
                            inRange && "bg-majorelle-500/20",
                            isStart && previewEnd > startDay && "bg-gradient-to-r from-transparent from-50% to-majorelle-500/20 to-50% rtl:bg-gradient-to-l",
                            isEnd && previewEnd > startDay && "bg-gradient-to-l from-transparent from-50% to-majorelle-500/20 to-50% rtl:bg-gradient-to-r",
                          )}
                        >
                          <button
                            type="button"
                            disabled={blocked}
                            onClick={() => pick(d)}
                            onMouseEnter={() => setHover(d)}
                            aria-pressed={isStart || isEnd}
                            aria-label={d}
                            className={cn(
                              "relative mx-auto grid size-10 place-items-center rounded-full text-sm font-semibold transition",
                              isStart || isEnd
                                ? "bg-gradient-to-br from-majorelle-400 to-majorelle-600 text-snow shadow-[0_6px_16px_-4px_rgba(96,80,220,0.7)]"
                                : "hover:ring-2 hover:ring-white/40",
                              d === today && !(isStart || isEnd) && "ring-1 ring-saffron-400/70",
                              blocked && "cursor-not-allowed text-white/25 hover:ring-0",
                              isBusy && !past && "line-through decoration-white/40",
                            )}
                          >
                            {Number(d.slice(8))}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
            {(
              [
                ["start", t("datePicker.pickupTime"), startTime],
                ["end", t("datePicker.returnTime"), endTime],
              ] as const
            ).map(([which, label, value]) => (
              <label key={which} className="block">
                <span className="label flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {label}
                </span>
                <select
                  value={value}
                  onChange={(e) =>
                    which === "start" ? commit(startDay, e.target.value, endDay, endTime) : commit(startDay, startTime, endDay, e.target.value)
                  }
                  className="field py-2.5"
                  dir="ltr"
                >
                  {TIMES.map((tm) => (
                    <option key={tm} value={tm}>
                      {tm}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-white/60">
              {sameDay && nights === 0 ? `${fmtDay(start)}` : t("datePicker.days", { count: Math.max(1, nights) })}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-gradient-to-br from-majorelle-400 to-majorelle-600 px-5 py-2 text-sm font-semibold text-snow shadow transition hover:brightness-110"
            >
              {t("datePicker.done")}
            </button>
          </div>
      </Floating>
    </div>
  );
}
