"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTranslator, type TranslateTarget } from "@/lib/integrations/translate";
import { isLocale } from "@/lib/i18n/config";

const UUID = /^[0-9a-f-]{36}$/i;

/** Finds or creates the current renter's conversation about a car, then opens it. */
export async function startConversation(carId: string) {
  if (!UUID.test(carId)) redirect("/messages");
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cars/${carId}`)}`);

  const supabase = await createClient();
  const { data: car } = await supabase.from("cars").select("id, host_id, status").eq("id", carId).maybeSingle();
  if (!car || car.host_id === user.id) redirect("/messages");

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("car_id", carId)
    .eq("renter_id", user.id)
    .maybeSingle();
  if (existing) redirect(`/messages/${existing.id}`);

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ car_id: carId, renter_id: user.id, host_id: car.host_id })
    .select("id")
    .single();
  if (error || !created) {
    // lost a race with a concurrent insert (unique car_id, renter_id) → reuse it
    const { data: again } = await supabase.from("conversations").select("id").eq("car_id", carId).eq("renter_id", user.id).maybeSingle();
    redirect(again ? `/messages/${again.id}` : "/messages");
  }
  revalidatePath("/messages");
  redirect(`/messages/${created.id}`);
}

/** Translates one message for the reader. Returns `off` while no translation provider is configured. */
export async function translateMessage(messageId: string, target: string): Promise<{ text?: string; off?: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  if (!UUID.test(messageId) || !isLocale(target)) return { error: "generic" };

  // RLS: only conversation parties can read the message.
  const supabase = await createClient();
  const { data: msg } = await supabase.from("messages").select("id, body, translations, sender_id").eq("id", messageId).maybeSingle();
  if (!msg || !msg.sender_id) return { error: "forbidden" };
  const cached = (msg.translations as Record<string, string> | null)?.[target];
  if (cached) return { text: cached };

  const text = await getTranslator().translate(msg.body, target as TranslateTarget);
  if (!text) return { off: true };
  // messages have no UPDATE policy; cache the translation with the service role after the read check above
  await createAdminClient()
    .from("messages")
    .update({ translations: { ...((msg.translations as Record<string, string>) ?? {}), [target]: text } })
    .eq("id", msg.id);
  return { text };
}
