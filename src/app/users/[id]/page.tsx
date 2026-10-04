import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Car, MapPin, MessageSquareQuote, Route } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { badgesOf, CAR_CARD_COLUMNS, getFavoriteIds, getPlaces, PUBLIC_PROFILE_COLUMNS, type CarCard as CarCardData, type PublicProfile } from "@/lib/data";
import { formatDate, placeName } from "@/lib/utils";
import { Avatar, Badge, EmptyState, Glass, Rating, Stars } from "@/components/ui/primitives";
import { CarCard } from "@/components/cars/CarCard";

type ReviewRow = {
  id: string;
  direction: "renter_to_host" | "host_to_renter";
  rating: number;
  comment: string | null;
  created_at: string;
  author: { id: string; full_name: string; avatar_url: string | null } | null;
  car: { make: string; model: string } | null;
};

const getPublicProfile = async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", id).maybeSingle();
  return data as PublicProfile | null;
};

export async function generateMetadata(props: PageProps<"/users/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const profile = await getPublicProfile(id);
  return { title: profile?.full_name ?? "—" };
}

export default async function UserPage(props: PageProps<"/users/[id]">) {
  const { id } = await props.params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const supabase = await createClient();
  const [{ t, locale }, places, user, { data: cars }, { data: reviews }] = await Promise.all([
    getI18n(),
    getPlaces(),
    getUser(),
    supabase.from("cars").select(CAR_CARD_COLUMNS).eq("host_id", id).eq("status", "active").order("trip_count", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, direction, rating, comment, created_at, author:profiles!reviews_author_id_fkey(id, full_name, avatar_url), car:cars(make, model)")
      .eq("subject_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const favorites = await getFavoriteIds(user?.id);
  const carList = (cars ?? []) as CarCardData[];
  const reviewList = (reviews ?? []) as unknown as ReviewRow[];
  const city = places.find((p) => p.slug === profile.city_slug);
  const cityName = (slug: string) => {
    const p = places.find((x) => x.slug === slug);
    return p ? placeName(p, locale) : undefined;
  };
  const badges = badgesOf(profile);
  const badgeTone = { verifiedHost: "majorelle", superDriver: "saffron", idVerified: "mint", licenseVerified: "mint", phoneVerified: "mint" } as const;
  const fromRenters = reviewList.filter((r) => r.direction === "renter_to_host");
  const fromHosts = reviewList.filter((r) => r.direction === "host_to_renter");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 md:px-6">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Glass strong className="p-6 text-center lg:sticky lg:top-24">
            <Avatar name={profile.full_name} url={profile.avatar_url} size={112} className="mx-auto" />
            <h1 className="mt-4 text-2xl font-bold">{profile.full_name}</h1>
            <p className="mt-1 text-sm text-white/55">{t("profile.memberSince", { date: formatDate(profile.created_at, locale, { month: "long", year: "numeric" }) })}</p>
            {city && (
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-white/65">
                <MapPin className="size-3.5" />
                {placeName(city, locale)}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {(Object.keys(badges) as (keyof typeof badges)[])
                .filter((k) => badges[k])
                .map((k) => (
                  <Badge key={k} tone={badgeTone[k]}>
                    {t(`badges.${k}`)}
                  </Badge>
                ))}
            </div>
            {profile.bio && (
              <p className="mt-5 border-t border-white/10 pt-5 text-start text-sm leading-relaxed whitespace-pre-line text-white/75" dir="auto">
                {profile.bio}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-start">
              {profile.is_host && (
                <div className="glass-subtle rounded-2xl p-3">
                  <p className="label mb-1">{t("profile.asHost")}</p>
                  {profile.host_rating != null ? (
                    <Rating value={profile.host_rating} count={profile.host_review_count} />
                  ) : (
                    <span className="text-sm text-white/50">{t("common.new")}</span>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/55">
                    <Car className="size-3.5" />
                    {t("profile.carsCount", { count: carList.length })}
                  </p>
                </div>
              )}
              <div className="glass-subtle rounded-2xl p-3">
                <p className="label mb-1">{t("profile.asRenter")}</p>
                {profile.renter_rating != null ? (
                  <Rating value={profile.renter_rating} count={profile.renter_review_count} />
                ) : (
                  <span className="text-sm text-white/50">{t("common.new")}</span>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-white/55">
                  <Route className="size-3.5" />
                  {t("profile.trips", { count: profile.trips_completed })}
                </p>
              </div>
            </div>
          </Glass>
        </aside>

        <div className="min-w-0 space-y-10">
          {carList.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-bold">{t("profile.cars", { name: profile.full_name.split(" ")[0] })}</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {carList.map((c) => (
                  <CarCard key={c.id} car={c} placeLabel={cityName(c.city_slug)} favorite={favorites.has(c.id)} canFavorite={!!user && user.id !== id} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-xl font-bold">{t("profile.reviewsAbout")}</h2>
            {reviewList.length === 0 ? (
              <EmptyState icon={<MessageSquareQuote className="size-6" />} title={t("profile.noReviews")} />
            ) : (
              <div className="space-y-8">
                {[
                  { title: t("reviews.fromRenters"), list: fromRenters },
                  { title: t("reviews.fromHosts"), list: fromHosts },
                ]
                  .filter((g) => g.list.length > 0)
                  .map((g) => (
                    <div key={g.title}>
                      <h3 className="mb-3 text-sm font-semibold tracking-wide text-white/55 uppercase">{g.title}</h3>
                      <ul className="grid gap-3 md:grid-cols-2">
                        {g.list.map((r) => (
                          <li key={r.id} className="glass rounded-[var(--radius-glass)] p-5">
                            <div className="flex items-center gap-3">
                              <Avatar name={r.author?.full_name ?? "?"} url={r.author?.avatar_url} size={40} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {t("reviews.by", { name: r.author?.full_name ?? "—", date: formatDate(r.created_at, locale, { month: "long", year: "numeric" }) })}
                                </p>
                                <Stars value={r.rating} size={12} />
                              </div>
                            </div>
                            {r.comment && (
                              <p className="mt-3 text-sm leading-relaxed text-white/75" dir="auto">
                                {r.comment}
                              </p>
                            )}
                            {r.car && (
                              <p className="mt-2 text-xs text-white/40">
                                {r.car.make} {r.car.model}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
