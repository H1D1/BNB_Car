"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useInView } from "@/lib/motion";

/**
 * "From Tangier to Dakhla" as a film (rendered with Remotion from real Mapbox data, see
 * scripts/render-route.mjs). Plain looping video: no controls, no live map loading.
 * The file is only fetched when the section gets close, and pauses off screen.
 */
export function RouteFilm() {
  const { t, locale } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const near = useInView(wrap, { margin: "600px 0px 600px 0px" });
  const visible = useInView(wrap, { once: false, margin: "0px" });

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [visible, near]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20" aria-labelledby="route-title">
      <h2 id="route-title" className="sr-only">
        {t("home.route.title")}
      </h2>
      <div ref={wrap} className="relative aspect-video overflow-hidden rounded-[2rem] border border-white/10 bg-[#efece6] shadow-[var(--glass-shadow-lg)]">
        {near && (
          <video
            ref={video}
            key={locale}
            className="absolute inset-0 size-full object-cover"
            src={`/media/route-journey-${locale}.mp4`}
            poster={`/media/route-journey-${locale}.jpg`}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            aria-label={t("home.route.mapLabel")}
          />
        )}
      </div>
    </section>
  );
}
