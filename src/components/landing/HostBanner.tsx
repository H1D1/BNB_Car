"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useInView, useReducedMotion, useSaveData } from "@/lib/motion";
import { formatMAD } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { ButtonLink } from "../ui/Button";

// A host's month, roughly: earnings accumulating trip by trip.
const EARNINGS = [0, 450, 450, 1100, 1650, 1650, 2300, 2950, 3400, 3400, 4200, 4900, 5600, 6000];

export function HostBanner() {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref);
  const reduced = useReducedMotion();
  const saveData = useSaveData();
  const playVideo = inView && !reduced && !saveData;

  useEffect(() => {
    if (playVideo) video.current?.play().catch(() => {});
  }, [playVideo]);

  const max = EARNINGS[EARNINGS.length - 1];
  const pts = EARNINGS.map((v, i) => `${(i / (EARNINGS.length - 1)) * 300},${110 - (v / max) * 100}`).join(" ");

  return (
    <div ref={ref} className={cn("relative isolate overflow-hidden rounded-[2rem] text-snow", inView && "in-view")}>
      <div className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- poster for the background loop */}
        <img src="/media/atlas-sunset.jpg" alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        {!reduced && !saveData && (
          <video
            ref={video}
            src="/media/atlas-sunset.mp4"
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 size-full object-cover"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-950/55 to-terracotta-600/30 rtl:bg-gradient-to-l" />
      </div>

      <div className="grid items-center gap-10 p-8 md:grid-cols-[1.2fr_1fr] md:p-14">
        <div>
          <h2 className="max-w-lg text-3xl leading-tight font-bold tracking-tight md:text-5xl">
            {t("home.hostTitle", { amount: formatMAD(6000, locale) })}
          </h2>
          <p className="mt-4 max-w-md text-snow/80">{t("home.hostText")}</p>
          <ButtonLink href="/host/cars/new" variant="accent" size="lg" className="mt-8">
            {t("home.hostCta")}
          </ButtonLink>
        </div>

        <div className="rounded-3xl border border-snow/15 bg-ink-950/35 p-5 backdrop-blur-md">
          <p className="text-sm text-snow/70">{t("home.hostChartLabel")}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums" dir="ltr">
            {formatMAD(max, locale)}
          </p>
          <svg viewBox="0 0 300 120" className="mt-4 w-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="earn-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--color-saffron-400)" stopOpacity="0.35" />
                <stop offset="1" stopColor="var(--color-saffron-400)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,110 ${pts} 300,110`}
              fill="url(#earn-fill)"
              className={cn("transition-opacity delay-700 duration-1000", inView ? "opacity-100" : "opacity-0")}
            />
            <polyline
              points={pts}
              fill="none"
              stroke="var(--color-saffron-400)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              className="draw-on-view"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
