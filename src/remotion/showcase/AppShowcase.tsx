import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { BadgeCheck, CalendarDays, Check, Fuel, KeyRound, Lock, MapPin, MessageCircle, Search, Settings2, ShieldCheck, Star, Users, Zap } from "lucide-react";
import { dictionaries, makeT, type TFn } from "../../lib/i18n/config";
import { formatMAD } from "../../lib/currency";
import type { Locale } from "../../lib/types";
import { actIn, clamp, easeOut, fade, pop, progress, sheet, tap, up, zoomIn } from "./motion";

export type ShowcaseCar = {
  id: string;
  make: string;
  model: string;
  year: number;
  cover_url: string | null;
  daily_price_mad: number;
  rating: number | null;
  review_count: number;
};

export type AppShowcaseProps = {
  locale: Locale;
  cars: ShowcaseCar[];
  city: string;
  hostName: string;
  /** wide = 1920×1080 (desktop / downloads), tall = 1080×1350 (phones, social) */
  layout?: "wide" | "tall";
};

export const SHOWCASE_FPS = 30;
export const ACTS = [5200, 5600, 5600];
const OUTRO = 2400;
export const SHOWCASE_DURATION_MS = ACTS.reduce((a, b) => a + b, 0) + OUTRO;
export const SHOWCASE_FRAMES = Math.round((SHOWCASE_DURATION_MS / 1000) * SHOWCASE_FPS);

/** Which act we're in and how far into it, from absolute ms. act = 3 → outro. */
function timeline(ms: number) {
  let start = 0;
  for (let i = 0; i < ACTS.length; i++) {
    if (ms < start + ACTS[i]) return { act: i, t: ms - start };
    start += ACTS[i];
  }
  return { act: 3, t: ms - start };
}

/* ========================================================================================= */

export function AppShowcase({ locale, cars, city, hostName, layout = "wide" }: AppShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const { act, t: tAct } = timeline(ms);
  const t = makeT(dictionaries[locale]);
  const rtl = locale === "ar";
  const car = cars[0];

  const steps = [
    { title: t("home.demo.act1Title"), text: t("home.demo.act1Text") },
    { title: t("home.demo.act2Title"), text: t("home.demo.act2Text") },
    { title: t("home.demo.act3Title"), text: t("home.demo.act3Text") },
  ];
  const outro = act === 3;
  const outroP = outro ? easeOut(progress(tAct, 0, 700)) : 0;
  const floatY = Math.sin((ms / 6000) * Math.PI * 2) * 10;
  const tall = layout === "tall";

  return (
    <AbsoluteFill dir={rtl ? "rtl" : "ltr"} className="overflow-hidden bg-[var(--bg-base)] text-white [background-image:var(--atmo)]" style={{ fontFamily: rtl ? "var(--font-arabic)" : "var(--font-sans)" }}>
      {/* soft brand glow behind the device */}
      <div className="absolute top-[12%] end-[8%] size-[760px] rounded-full bg-gradient-to-br from-majorelle-500/40 via-terracotta-500/25 to-saffron-400/20 blur-[120px]" />

      {/* Captions */}
      <div
        className={tall ? "absolute inset-x-[90px] top-[80px] flex flex-col" : "absolute inset-y-0 start-[140px] flex w-[760px] flex-col justify-center"}
        style={{ opacity: 1 - outroP }}
      >
        <Logo />
        {act < 3 && (
          <div key={act} className={tall ? "mt-8 h-[270px]" : "mt-16"}>
            <p className="text-[34px] font-bold text-terracotta-300 tabular-nums" style={up(tAct, 0, 500)}>
              0{act + 1}
            </p>
            <h2 className={`mt-3 leading-[1.02] font-bold tracking-tight ${tall ? "text-[64px]" : "text-[82px]"}`} style={up(tAct, 80, 650, 28)}>
              {steps[act].title}
            </h2>
            <p className={`mt-5 max-w-[860px] leading-snug text-white/65 ${tall ? "text-[28px]" : "text-[30px]"}`} style={up(tAct, 220, 650, 22)}>
              {steps[act].text}
            </p>
          </div>
        )}
        <div className={tall ? "mt-6 flex gap-3" : "mt-16 flex gap-3"}>
          {ACTS.map((d, i) => (
            <div key={i} className="h-1.5 w-[160px] overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-gradient-to-r from-majorelle-400 to-terracotta-400"
                style={{ width: `${(i < act ? 1 : i === act ? clamp(tAct / d) : 0) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Device + chips */}
      <div
        className={tall ? "absolute start-1/2 top-[548px]" : "absolute top-1/2 end-[300px]"}
        style={{
          transform: tall
            ? `translateX(${rtl ? 50 : -50}%) translateY(${floatY}px) scale(${1.2 - outroP * 0.1}) perspective(1600px) rotateX(4deg)`
            : `translateY(calc(-50% + ${floatY}px)) scale(${1.58 - outroP * 0.12}) perspective(1600px) rotateY(${rtl ? 8 : -8}deg) rotateX(4deg)`,
          transformOrigin: tall ? "top center" : "center",
          opacity: 1 - outroP,
        }}
      >
        <Phone>
          {act === 0 && <ActSearch t={t} ms={tAct} cars={cars} city={city} locale={locale} />}
          {act === 1 && car && <ActBook t={t} ms={tAct} car={car} locale={locale} />}
          {act >= 2 && car && <ActDrive t={t} ms={act === 2 ? tAct : ACTS[2]} car={car} hostName={hostName} city={city} />}
        </Phone>
        {act === 0 && (
          <Chip className="-end-[170px] top-[150px]" style={pop(tAct, 2700)}>
            <MapPin className="size-4 text-terracotta-400" />
            {t("home.demo.chipNearby", { count: cars.length })}
          </Chip>
        )}
        {act === 1 && (
          <>
            <Chip className="-start-[190px] top-[120px]" style={pop(tAct, 1600)}>
              <Lock className="size-4 text-majorelle-400" />
              {t("home.demo.chipCmi")}
            </Chip>
            <Chip className="-end-[160px] bottom-[170px]" style={pop(tAct, 4400)}>
              <Check className="size-4 text-mint-500" />
              {t("home.demo.chipBooked")}
            </Chip>
          </>
        )}
        {act === 2 && (
          <>
            <Chip className="-start-[170px] top-[190px]" style={pop(tAct, 700)}>
              <BadgeCheck className="size-4 text-mint-500" />
              {t("badges.idVerified")}
            </Chip>
            <Chip className="-end-[150px] bottom-[130px]" style={pop(tAct, 3700)}>
              <MessageCircle className="size-4 text-[#25D366]" />
              WhatsApp
            </Chip>
          </>
        )}
      </div>

      {/* Outro card */}
      {outro && (
        <AbsoluteFill className="items-center justify-center text-center">
          <div style={up(tAct, 250, 700, 30)}>
            <div className="flex justify-center">
              <Logo big />
            </div>
            <p className="mt-10 text-[76px] leading-tight font-bold tracking-tight">{t("home.title")}</p>
            <p className="mt-2 text-[40px] text-white/65">{t("home.titleAccent")}</p>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/* --- Brand & device ------------------------------------------------------------------------ */

function Logo({ big }: { big?: boolean }) {
  const s = big ? 1.6 : 1;
  return (
    <div className="flex items-center gap-4" style={{ transform: `scale(${s})`, transformOrigin: "center" }}>
      <span className="grid size-16 place-items-center rounded-[20px] bg-gradient-to-br from-majorelle-400 via-majorelle-500 to-terracotta-500 shadow-[0_10px_30px_-6px_rgba(96,80,220,0.8)]">
        <svg viewBox="0 0 24 24" className="size-10 text-snow" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="5.5" y="5.5" width="13" height="13" rx="1" />
          <rect x="5.5" y="5.5" width="13" height="13" rx="1" transform="rotate(45 12 12)" />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="text-start leading-none">
        <span className="block text-[30px] font-bold tracking-tight">CarShare</span>
        <span className="block text-[15px] font-semibold tracking-[0.32em] text-saffron-300 uppercase">Morocco</span>
      </span>
    </div>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[600px] w-[290px] rounded-[48px] bg-gradient-to-b from-[#2a2f52] to-[#0d1030] p-[10px] shadow-[0_40px_80px_-20px_rgba(10,12,40,0.55),inset_0_0_0_1.5px_rgba(255,255,255,0.18)]">
      <div className="relative size-full overflow-hidden rounded-[38px] bg-[var(--bg-base)] [background-image:var(--atmo)]">
        <div className="relative z-20 flex h-11 items-center justify-between px-7 pt-1 text-[11px] font-semibold" dir="ltr">
          <span>9:41</span>
          <span className="absolute top-2 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          <span className="h-2 w-3.5 rounded-sm border border-current opacity-70" />
        </div>
        {children}
        <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      </div>
    </div>
  );
}

function Chip({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className={`glass-menu absolute z-20 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap shadow-xl ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}

function Tap({ x, y, ms, delay }: { x: string; y: string; ms: number; delay: number }) {
  return <span className="absolute z-40 size-10 rounded-full border-2 border-white/80 bg-white/30" style={{ left: x, top: y, ...tap(ms, delay) }} />;
}

/* --- Act 1: search ------------------------------------------------------------------------- */

function ActSearch({ t, ms, cars, city, locale }: { t: TFn; ms: number; cars: ShowcaseCar[]; city: string; locale: Locale }) {
  const typed = city.slice(0, Math.max(0, Math.floor((ms - 350) / 85)));
  const typing = typed.length < city.length;
  const caretOn = Math.floor(ms / 400) % 2 === 0;
  return (
    <div className="absolute inset-0 px-4 pt-12" style={actIn(ms)}>
      <div className="glass-strong rounded-2xl px-3.5 py-2.5" style={up(ms, 100)}>
        <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-white/50 uppercase">
          <Search className="size-3" />
          {t("home.where")}
        </p>
        <p className="mt-0.5 h-5 text-[15px] font-semibold">
          {typed}
          {typing && caretOn && <span className="ms-px inline-block h-4 w-0.5 translate-y-0.5 bg-majorelle-400" />}
        </p>
      </div>
      <div className="mt-2 flex gap-2" style={up(ms, 1300)}>
        {["10 nov. · 10:00", "13 nov. · 10:00"].map((l) => (
          <span key={l} className="glass-subtle flex flex-1 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px]">
            <CalendarDays className="size-3.5 text-white/50" />
            <span className="truncate font-semibold" dir="ltr">
              {l}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-4 mb-2 text-[13px] font-bold" style={up(ms, 1700)}>
        {t("search.resultsIn", { count: cars.length, place: city })}
      </p>
      <div className="space-y-2.5">
        {cars.map((c, i) => (
          <div key={c.id} className="glass overflow-hidden rounded-2xl" style={up(ms, 2000 + i * 220, 650)}>
            <div className="flex gap-3 p-2">
              <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-white/10">
                {c.cover_url && <Img src={c.cover_url} className="absolute inset-0 size-full object-cover" referrerPolicy="no-referrer" />}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="truncate text-[13px] font-bold">
                  {c.make} {c.model}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-white/55">
                  <Star className="size-3 fill-saffron-400 text-saffron-400" />
                  {c.rating?.toFixed(1) ?? "—"} · {c.year}
                </p>
                <p className="mt-1 text-[13px] font-bold" dir="ltr">
                  {formatMAD(c.daily_price_mad, locale)} <span className="text-[10px] font-normal text-white/50">{t("common.perDay")}</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Tap x="45%" y="64%" ms={ms} delay={4400} />
    </div>
  );
}

/* --- Act 2: car + booking ------------------------------------------------------------------ */

function ActBook({ t, ms, car, locale }: { t: TFn; ms: number; car: ShowcaseCar; locale: Locale }) {
  const days = 3;
  const rental = car.daily_price_mad * days;
  const protection = 180;
  const service = Math.round(rental * 0.1);
  const total = rental + protection + service;
  const shownTotal = Math.round(total * easeOut(progress(ms, 2300, 1000)));
  const booked = ms > 4250;
  const lines = [
    { label: `${formatMAD(car.daily_price_mad, locale)} × ${days} ${t("common.days")}`, value: rental, d: 1400 },
    { label: t("booking.breakdown.insurance"), value: protection, d: 1650 },
    { label: t("booking.breakdown.service"), value: service, d: 1900 },
  ];
  return (
    <div className="absolute inset-0">
      <div className="relative h-56 overflow-hidden" style={zoomIn(ms, 0)}>
        {car.cover_url && <Img src={car.cover_url} className="absolute inset-0 size-full object-cover" referrerPolicy="no-referrer" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 to-transparent" />
        <div className="absolute start-4 bottom-3 text-snow">
          <p className="text-lg font-bold">
            {car.make} {car.model}
          </p>
          <p className="flex items-center gap-1 text-xs text-snow/80">
            <Star className="size-3 fill-saffron-400 text-saffron-400" />
            {car.rating?.toFixed(1)} ({car.review_count}) · {car.year}
          </p>
        </div>
      </div>
      <div className="flex gap-1.5 px-4 pt-3" style={up(ms, 500)}>
        {[
          { i: Settings2, l: t("car.transmission.automatic") },
          { i: Fuel, l: t("car.fuel.diesel") },
          { i: Users, l: "5" },
        ].map(({ i: Icon, l }) => (
          <span key={l} className="glass-subtle flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold">
            <Icon className="size-3" />
            {l}
          </span>
        ))}
      </div>
      <div className="glass-strong absolute inset-x-2 bottom-2 rounded-[28px] p-4" style={sheet(ms, 900)}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
          <ShieldCheck className="size-3.5 text-mint-400" />
          {t("booking.insurance.basic")}
        </p>
        {lines.map((l) => (
          <p key={l.label} className="flex justify-between py-0.5 text-[12px] text-white/75" style={up(ms, l.d, 450)}>
            <span>{l.label}</span>
            <span dir="ltr">{formatMAD(l.value, locale)}</span>
          </p>
        ))}
        <p className="mt-2 flex justify-between border-t border-white/10 pt-2 text-[15px] font-bold" style={fade(ms, 2200)}>
          <span>{t("booking.breakdown.total")}</span>
          <span dir="ltr" className="tabular-nums">
            {formatMAD(shownTotal, locale)}
          </span>
        </p>
        <div
          className={`mt-3 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-bold ${booked ? "bg-mint-500 text-snow" : "bg-gradient-to-br from-saffron-400 to-terracotta-400 text-ink-950"}`}
          style={up(ms, 2600, 450)}
        >
          {booked ? <Check className="size-4" /> : <Zap className="size-4" />}
          {booked ? t("home.demo.booked") : t("booking.instantCta")}
        </div>
      </div>
      <Tap x="50%" y="91%" ms={ms} delay={3950} />
    </div>
  );
}

/* --- Act 3: trip, contract, host message --------------------------------------------------- */

function ActDrive({ t, ms, car, hostName, city }: { t: TFn; ms: number; car: ShowcaseCar; hostName: string; city: string }) {
  const typingDots = ms > 2300 && ms < 3200;
  const message = ms >= 3200;
  const sign = easeOut(progress(ms, 1000, 1300));
  return (
    <div className="absolute inset-0 space-y-2.5 px-4 pt-12" style={actIn(ms)}>
      <div className="glass rounded-2xl p-3" style={up(ms, 100)}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold">
            {car.make} {car.model}
          </p>
          <span className="rounded-full bg-mint-500/20 px-2 py-0.5 text-[10px] font-bold text-mint-400" style={pop(ms, 500)}>
            {t("trips.status.confirmed")}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-white/55">
          <CalendarDays className="size-3" /> <span dir="ltr">10 → 13 nov.</span> · {city}
        </p>
      </div>
      <div className="glass rounded-2xl p-3" style={up(ms, 600)}>
        <p className="text-[11px] font-semibold text-white/55">{t("trip.contract")}</p>
        <svg viewBox="0 0 220 50" className="mt-1 h-10 w-full">
          <path
            d="M6 34 C 20 6, 32 44, 46 24 S 70 10, 78 30 S 100 42, 112 20 C 120 8, 128 40, 140 28 S 168 18, 182 30 L 214 26"
            fill="none"
            className="stroke-majorelle-400"
            strokeWidth="2.6"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - sign}
          />
        </svg>
        <p className="flex items-center gap-1 text-[10px] font-semibold text-mint-400" style={fade(ms, 2200)}>
          <Check className="size-3" /> {t("home.demo.signed")}
        </p>
      </div>
      <div className="flex items-end gap-2" style={up(ms, 2100)}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-terracotta-400 to-majorelle-500 text-[10px] font-bold text-snow">
          {hostName.slice(0, 1)}
        </span>
        <div className="glass-strong rounded-2xl rounded-es-md px-3 py-2 text-[12px]">
          {typingDots ? (
            <span className="flex gap-1 py-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 rounded-full bg-white/70" style={{ opacity: 0.35 + 0.65 * Math.max(0, Math.sin(((ms - d * 150) / 1000) * Math.PI * 2)) }} />
              ))}
            </span>
          ) : message ? (
            <span style={fade(ms, 3200, 300)}>{t("home.demo.hostMessage", { name: hostName.split(" ")[0], city })}</span>
          ) : (
            <span className="opacity-0">…</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 pt-1" style={up(ms, 3700)}>
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#25D366] py-2.5 text-[12px] font-bold text-snow">
          <MessageCircle className="size-4" /> WhatsApp
        </span>
        <span className="glass-subtle flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-bold">
          <KeyRound className="size-4" /> {t("trip.preInspection")}
        </span>
      </div>
    </div>
  );
}
