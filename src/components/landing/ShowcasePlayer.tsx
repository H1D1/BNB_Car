"use client";

import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useI18n } from "@/lib/i18n/client";
import { useInView, useMediaQuery } from "@/lib/motion";
import { AppShowcase, SHOWCASE_FPS, SHOWCASE_FRAMES, type ShowcaseCar } from "@/remotion/showcase/AppShowcase";

/**
 * The app's motion-graphics film (Remotion composition), played live in the page: frame-exact,
 * localized, theme-aware, nothing to download. Loops continuously with no controls; it only
 * pauses while off screen to save battery.
 */
export function ShowcasePlayer({ cars, city, hostName }: { cars: ShowcaseCar[]; city: string; hostName: string }) {
  const { t, locale } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerRef>(null);
  const visible = useInView(wrap, { once: false, margin: "0px" });
  const tall = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __showcase?: PlayerRef | null }).__showcase = player.current;
  });

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (visible) p.play();
    else p.pause();
  }, [visible, tall]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24" aria-labelledby="showcase-title">
      <h2 id="showcase-title" className="sr-only">
        {t("home.howTitle")}
      </h2>
      <ol className="sr-only">
        <li>{t("home.demo.act1Title")} — {t("home.demo.act1Text")}</li>
        <li>{t("home.demo.act2Title")} — {t("home.demo.act2Text")}</li>
        <li>{t("home.demo.act3Title")} — {t("home.demo.act3Text")}</li>
      </ol>
      <div ref={wrap} className="overflow-hidden rounded-[2rem] border border-white/10 shadow-[var(--glass-shadow-lg)]">
        <Player
          key={tall ? "tall" : "wide"}
          ref={player}
          component={AppShowcase}
          inputProps={{ locale, cars, city, hostName, layout: tall ? "tall" : "wide" }}
          durationInFrames={SHOWCASE_FRAMES}
          fps={SHOWCASE_FPS}
          compositionWidth={tall ? 1080 : 1920}
          compositionHeight={tall ? 1350 : 1080}
          style={{ width: "100%" }}
          loop
          autoPlay
          initiallyMuted
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense
        />
      </div>
    </section>
  );
}
