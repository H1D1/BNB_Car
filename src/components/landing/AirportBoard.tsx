"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plane } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatMAD } from "@/lib/currency";
import { useInView, useMediaQuery } from "@/lib/motion";
import { TZ } from "@/lib/utils";

export type BoardRow = { slug: string; iata: string; name: string; city: string; count: number; from: number | null };

/** One split-flap tile per character (whole-word tile for Arabic, which must stay joined). */
function Flap({ text, width, rtl, tone = "amber" }: { text: string; width: number; rtl: boolean; tone?: "amber" | "white" | "green" }) {
  const color = tone === "green" ? "#5fd3a2" : tone === "white" ? "#eef0ff" : "#ffd166";
  if (rtl) {
    return (
      <span key={text} className="flap flap-word" style={{ color }}>
        {text}
      </span>
    );
  }
  const chars = text.toUpperCase().padEnd(width).slice(0, width).split("");
  return (
    <span key={text} className="flex gap-[2px]" dir="ltr">
      {chars.map((c, i) => (
        <span key={i} className="flap" style={{ color, animationDelay: `${i * 32}ms` }}>
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

function useCasablancaClock(active: boolean) {
  const fmt = () => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date());
  const [now, setNow] = useState(fmt);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(fmt()), 15_000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Airport arrivals board (split-flap motion): each row flips between how many cars deliver to
 * that airport and the lowest daily price, every 3 s while on screen. Rows link to search.
 */
export function AirportBoard({ rows }: { rows: BoardRow[] }) {
  const { t, locale } = useI18n();
  const rtl = locale === "ar";
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: false, margin: "0px" });
  const [phase, setPhase] = useState(0);
  const clock = useCasablancaClock(visible);
  const compact = useMediaQuery("(max-width: 480px)"); // fewer tiles so the board fits a phone

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setPhase((p) => p + 1), 3000);
    return () => clearInterval(id);
  }, [visible]);

  const info = (r: BoardRow) =>
    phase % 2 === 0
      ? t("home.board.cars", { count: r.count })
      : r.from == null
        ? "—"
        : compact
          ? formatMAD(r.from, locale)
          : `${t("home.board.from")} ${formatMAD(r.from, locale)}`;

  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl bg-[#0b0f2e] p-3 text-[#eef0ff] sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_-20px_rgba(5,8,22,0.8)] md:p-5">
      {/* a plane crossing now and then */}
      <Plane className="board-plane absolute top-3 size-4 text-snow/50" aria-hidden />

      <div className="mb-4 flex items-center justify-between border-b border-snow/10 pb-3">
        <span className="flex items-center gap-2 text-sm font-bold tracking-[0.2em] text-[#ffd166]">
          <Plane className="size-4 rotate-45" />
          {t("home.board.title")}
        </span>
        <span className="font-semibold text-snow/70 tabular-nums" dir="ltr">
          {clock}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-2.5 text-[10px] sm:gap-x-3 sm:text-[13px]">
        <span className="text-[10px] font-semibold tracking-wider text-snow/40">{t("home.board.code")}</span>
        <span className="text-[10px] font-semibold tracking-wider text-snow/40">{t("home.board.city")}</span>
        <span className="text-end text-[10px] font-semibold tracking-wider text-snow/40">{t("home.board.info")}</span>
        {rows.map((r) => (
          <Link key={r.slug} href={`/search?place=${r.slug}`} className="contents" aria-label={`${r.name} — ${t("home.board.cars", { count: r.count })}`}>
            <Flap text={r.iata} width={3} rtl={false} tone="white" />
            {compact ? (
              <span className="self-center truncate text-[11px] font-semibold text-[#ffd166]">{r.city}</span>
            ) : (
              <Flap text={r.city} width={10} rtl={rtl} />
            )}
            <span className="justify-self-end">
              <Flap key={phase} text={info(r)} width={compact ? 11 : 13} rtl={rtl} tone={phase % 2 === 0 ? "green" : "amber"} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
