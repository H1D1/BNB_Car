"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useMediaQuery, useSaveData } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Place } from "@/lib/types";
import { SearchBar } from "../cars/SearchBar";

const DESKTOP = { src: "/media/hero-desert.mp4", poster: "/media/hero-desert.jpg" };
const MOBILE = { src: "/media/hero-road-vertical.mp4", poster: "/media/hero-road-vertical.jpg" };

/**
 * Full-bleed driving footage behind the headline. The poster is server-rendered (instant, no
 * layout shift); the video is only mounted client-side, picked for the screen shape, skipped
 * entirely for data-saver visitors, and paused when off-screen.
 */
function HeroVideo() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const mobile = useMediaQuery("(max-width: 767px)");
  const saveData = useSaveData();
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const clip = mobile ? MOBILE : DESKTOP;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()));
    io.observe(v);
    return () => io.disconnect();
  }, [clip.src, mounted]);

  return (
    <div className="video-settle absolute inset-0" aria-hidden>
      <picture>
        <source media="(max-width: 767px)" srcSet={MOBILE.poster} />
        <img src={DESKTOP.poster} alt="" className="absolute inset-0 size-full object-cover" fetchPriority="high" />
      </picture>
      {mounted && !saveData && (
        <video
          key={clip.src}
          ref={ref}
          src={clip.src}
          poster={clip.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          onCanPlay={() => setReady(true)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}

export function Hero({ places }: { places: Place[] }) {
  const { t } = useI18n();
  return (
    <section className="relative isolate -mt-[76px] flex min-h-[94svh] flex-col justify-end overflow-hidden pt-28 pb-10 md:pb-14">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <HeroVideo />
        {/* scrims: legible header on top, legible headline at the bottom (both themes) */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-950/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/35 to-ink-950/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/50 via-transparent to-transparent rtl:bg-gradient-to-l" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 text-snow md:px-6">
        <h1 className="max-w-4xl text-[2.6rem] leading-[1.02] font-bold tracking-tight md:text-7xl lg:text-[5.4rem]">
          <span className="reveal-line">
            <span style={{ "--d": "150ms" } as React.CSSProperties}>{t("home.title")}</span>
          </span>
          <span className="reveal-line">
            <span className="font-normal text-snow/80" style={{ "--d": "300ms" } as React.CSSProperties}>
              {t("home.titleAccent")}
            </span>
          </span>
        </h1>
        <p className="rise-in mt-6 max-w-xl text-base text-snow/80 md:text-lg" style={{ "--d": "650ms" } as React.CSSProperties}>
          {t("home.subtitle")}
        </p>
        <div className="rise-in relative z-30 mt-8" style={{ "--d": "850ms" } as React.CSSProperties}>
          <SearchBar places={places} />
        </div>
      </div>
    </section>
  );
}
