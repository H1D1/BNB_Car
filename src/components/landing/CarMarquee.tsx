import Link from "next/link";
import Image from "@/components/ui/SmartImage";
import { Price } from "@/components/ui/Price";
import type { CarCard } from "@/lib/data";

/** Slow, endless strip of real listings. Pauses on hover/focus; static under reduced motion. */
export function CarMarquee({ cars, cityName, perDay }: { cars: CarCard[]; cityName: Record<string, string>; perDay: string }) {
  const loop = [...cars, ...cars];
  return (
    <div
      className="marquee relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
      style={{ "--marquee-duration": `${cars.length * 5}s` } as React.CSSProperties}
    >
      <ul className="marquee-track flex w-max gap-4 py-2">
        {loop.map((c, i) => (
          <li key={`${c.id}-${i}`} aria-hidden={i >= cars.length} className="w-64 shrink-0">
            <Link href={`/cars/${c.id}`} tabIndex={i >= cars.length ? -1 : undefined} className="group block">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                {c.cover_url && (
                  <Image
                    src={c.cover_url}
                    alt={`${c.make} ${c.model}`}
                    fill
                    sizes="256px"
                    className="object-cover transition-transform duration-700 ease-[var(--ease-liquid)] group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
                <div className="absolute inset-x-3 bottom-3 text-snow">
                  <p className="truncate font-bold">
                    {c.make} {c.model}
                  </p>
                  <p className="flex items-baseline justify-between text-sm text-snow/80">
                    <span>{cityName[c.city_slug]}</span>
                    <span>
                      <Price mad={c.daily_price_mad} showConverted={false} className="font-semibold text-snow" /> {perDay}
                    </span>
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
