"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

export async function toggleFavorite(carId: string) {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("car_id").eq("user_id", user.id).eq("car_id", carId).maybeSingle();
  if (data) await supabase.from("favorites").delete().eq("user_id", user.id).eq("car_id", carId);
  else await supabase.from("favorites").insert({ user_id: user.id, car_id: carId });
  revalidatePath("/favorites");
  return { ok: true };
}
