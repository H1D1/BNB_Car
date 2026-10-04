"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/actions/favorites";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function FavoriteButton({ carId, initial, withLabel }: { carId: string; initial: boolean; withLabel?: boolean }) {
  const { t } = useI18n();
  const [fav, setFav] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? t("carPage.favorited") : t("carPage.favorite")}
      onClick={() =>
        start(async () => {
          setFav(!fav);
          await toggleFavorite(carId);
        })
      }
      className={cn(
        "flex items-center gap-2 rounded-full bg-ink-950/45 backdrop-blur-md transition hover:scale-105 active:scale-95",
        withLabel ? "glass h-10 px-4 text-sm font-semibold" : "size-9 justify-center",
      )}
    >
      <Heart className={cn("size-4.5 transition", fav ? "fill-terracotta-400 text-terracotta-400" : "text-white")} />
      {withLabel && (fav ? t("carPage.favorited") : t("carPage.favorite"))}
    </button>
  );
}
