import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { CAR_CARD_COLUMNS, getPlaces, type CarCard as CarCardData } from "@/lib/data";
import { placeName } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { CarCard } from "@/components/cars/CarCard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("favorites.title") };
}

export default async function FavoritesPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/favorites");
  const supabase = await createClient();
  const [{ t, locale }, places, { data }] = await Promise.all([
    getI18n(),
    getPlaces(),
    supabase.from("favorites").select(`created_at, car:cars(${CAR_CARD_COLUMNS})`).eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  // cars hidden by RLS (paused/draft by their host) come back as null
  const cars = ((data ?? []) as unknown as { car: CarCardData | null }[]).map((f) => f.car).filter((c): c is CarCardData => !!c);
  const cityName = (slug: string) => {
    const p = places.find((x) => x.slug === slug);
    return p ? placeName(p, locale) : undefined;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 md:px-6">
      <PageHeader title={t("favorites.title")} />
      {cars.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title={t("favorites.emptyTitle")}
          text={t("favorites.empty")}
          action={<ButtonLink href="/search">{t("nav.search")}</ButtonLink>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((c, i) => (
            <CarCard key={c.id} car={c} placeLabel={cityName(c.city_slug)} favorite canFavorite priority={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
