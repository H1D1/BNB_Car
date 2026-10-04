import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getProfile } from "@/lib/supabase/server";
import { getPlaces } from "@/lib/data";
import { ListingWizard } from "@/components/host/wizard/ListingWizard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("wizard.newTitle") };
}

export default async function NewCarPage() {
  const [profile, places] = await Promise.all([getProfile(), getPlaces()]);
  if (!profile) redirect("/login?next=/host/cars/new");
  const cities = places.filter((p) => p.kind === "city");
  const defaultCity = cities.find((p) => p.slug === profile.city_slug) ?? cities.find((p) => p.slug === "casablanca") ?? cities[0];
  return (
    <ListingWizard
      car={null}
      photos={[]}
      places={places}
      defaultCity={defaultCity}
      userId={profile.id}
      verified={profile.id_status === "verified" && profile.phone_verified}
    />
  );
}
