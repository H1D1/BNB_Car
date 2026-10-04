"use client";

import Image from "@/components/ui/SmartImage";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2x2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function CarGallery({ photos, alt }: { photos: { id: string; url: string; credit?: string | null }[]; alt: string }) {
  const { t, dir } = useI18n();
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      const fwd = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd) setOpen((i) => ((i ?? 0) + 1) % photos.length);
      if (e.key === back) setOpen((i) => ((i ?? 0) - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, photos.length, dir]);

  if (photos.length === 0) return <div className="skeleton aspect-[16/9] rounded-[var(--radius-glass)]" />;

  const [first, ...rest] = photos;
  return (
    <>
      <div className="relative grid gap-2 overflow-hidden rounded-[1.75rem] md:grid-cols-[2fr_1fr] md:grid-rows-2">
        <button onClick={() => setOpen(0)} className="relative aspect-[16/10] md:row-span-2 md:aspect-auto md:h-[460px]">
          <Image src={first.url} alt={alt} fill priority sizes="(max-width: 768px) 100vw, 66vw" className="object-cover transition duration-700 hover:scale-[1.02]" />
        </button>
        {rest.slice(0, 2).map((p, i) => (
          <button key={p.id} onClick={() => setOpen(i + 1)} className="relative hidden md:block">
            <Image src={p.url} alt={alt} fill sizes="33vw" className="object-cover transition duration-700 hover:scale-[1.04]" />
          </button>
        ))}
        {photos.length > 1 && (
          <button
            onClick={() => setOpen(0)}
            className="glass-strong absolute end-4 bottom-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
          >
            <Grid2x2 className="size-4" />
            {photos.length}
          </button>
        )}
      </div>

      {open != null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/90 backdrop-blur-xl animate-fade-up" role="dialog" aria-modal>
          <button onClick={() => setOpen(null)} className="glass absolute end-5 top-5 grid size-11 place-items-center rounded-full" aria-label={t("common.close")}>
            <X className="size-5" />
          </button>
          <button
            onClick={() => setOpen((open - 1 + photos.length) % photos.length)}
            className="glass absolute start-5 grid size-12 place-items-center rounded-full"
            aria-label={t("common.back")}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </button>
          <div className="relative h-[80dvh] w-[90vw] max-w-6xl">
            <Image src={photos[open].url} alt={alt} fill sizes="90vw" className="object-contain" />
          </div>
          <button
            onClick={() => setOpen((open + 1) % photos.length)}
            className="glass absolute end-5 grid size-12 place-items-center rounded-full"
            aria-label={t("common.next")}
          >
            <ChevronRight className="size-6 rtl:rotate-180" />
          </button>
          {photos[open].credit && (
            <p className="absolute start-6 bottom-6 text-xs text-snow/60">{photos[open].credit}</p>
          )}
          <div className="absolute bottom-6 flex gap-2">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setOpen(i)}
                className={cn("h-1.5 rounded-full transition-all", i === open ? "w-8 bg-white" : "w-3 bg-white/35")}
                aria-label={String(i + 1)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
