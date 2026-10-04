import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getPlaces } from "@/lib/data";
import { ListingWizard } from "@/components/host/wizard/ListingWizard";
import type { Car, CarPhoto } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("wizard.editTitle") };
}

export default async function EditCarPage(props: PageProps<"/host/cars/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=/host/cars/${id}`);

  const supabase = await createClient();
  const [{ data: car }, { data: photos }, places] = await Promise.all([
    supabase.from("cars").select("*").eq("id", id).eq("host_id", profile.id).maybeSingle(),
    supabase.from("car_photos").select("*").eq("car_id", id).order("position").order("created_at"),
    getPlaces(),
  ]);
  if (!car) notFound();

  const step = Number(typeof sp.step === "string" ? sp.step : 1);
  return (
    <ListingWizard
      car={car as Car}
      photos={(photos ?? []) as CarPhoto[]}
      places={places}
      userId={profile.id}
      verified={profile.id_status === "verified" && profile.phone_verified}
      initialStep={Number.isInteger(step) ? step - 1 : 0}
    />
  );
}
