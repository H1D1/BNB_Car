"use client";

import Image from "@/components/ui/SmartImage";
import Link from "next/link";
import { Fuel, MapPin, Plane, Settings2, Users, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { CarCard as CarCardData } from "@/lib/data";
import { Badge, Rating } from "../ui/primitives";
import { Price } from "../ui/Price";
import { FavoriteButton } from "./FavoriteButton";

export function CarCard({
  car,
  placeLabel,
  favorite,
  canFavorite,
  highlighted,
  onHover,
  query,
  priority,
}: {
  car: CarCardData;
  placeLabel?: string;
  favorite?: boolean;
  canFavorite?: boolean;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
  query?: string;
  priority?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article
      onMouseEnter={() => onHover?.(car.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "glass liquid group overflow-hidden rounded-[var(--radius-glass)] animate-fade-up",
        highlighted && "border-saffron-400/60 -translate-y-1",
      )}
    >
      <Link href={`/cars/${car.id}${query ? `?${query}` : ""}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          {car.cover_url ? (
            <Image
              src={car.cover_url}
              alt={`${car.make} ${car.model}`}
              fill
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 ease-[var(--ease-liquid)] group-hover:scale-105"
            />
          ) : (
            <div className="skeleton absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
          <div className="absolute start-3 top-3 flex gap-1.5">
            {car.instant_book && (
              <Badge tone="saffron" className="border-saffron-300/40 bg-ink-950/55 !text-saffron-300 backdrop-blur-md">
                <Zap className="size-3" />
                {t("car.instant")}
              </Badge>
            )}
            {car.airport_slugs.length > 0 && (
              <Badge tone="neutral" className="border-snow/20 bg-ink-950/55 !text-snow backdrop-blur-md">
                <Plane className="size-3" />
                {car.airport_slugs.map((a) => a.toUpperCase()).join(" · ")}
              </Badge>
            )}
          </div>
          <div className="absolute bottom-3 start-3 end-3 flex items-end justify-between">
            <span className="flex items-center gap-1 text-xs font-semibold text-snow/90">
              <MapPin className="size-3.5" />
              {[car.neighborhood, placeLabel].filter(Boolean).join(", ")}
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-bold">
                {car.make} {car.model}
              </h3>
              <p className="text-sm text-white/50">{car.year}</p>
            </div>
            {car.rating != null ? (
              <Rating value={car.rating} count={car.review_count} />
            ) : (
              <Badge tone="majorelle">{t("car.noReviewsYet")}</Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/60">
            <span className="flex items-center gap-1.5">
              <Settings2 className="size-3.5" />
              {t(`car.transmission.${car.transmission}`)}
            </span>
            <span className="flex items-center gap-1.5">
              <Fuel className="size-3.5" />
              {t(`car.fuel.${car.fuel}`)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {car.seats}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-3">
            <span className="text-xs text-white/45">
              {car.distance_km != null
                ? t("search.awayKm", { km: car.distance_km })
                : car.trip_count > 0
                  ? t("car.trips", { count: car.trip_count })
                  : ""}
            </span>
            <span className="text-end">
              <Price mad={car.daily_price_mad} className="text-lg font-bold" />
              <span className="ms-1 text-xs text-white/50">{t("common.perDay")}</span>
            </span>
          </div>
        </div>
      </Link>
      {canFavorite && (
        <div className="absolute end-3 top-3">
          <FavoriteButton carId={car.id} initial={!!favorite} />
        </div>
      )}
    </article>
  );
}
