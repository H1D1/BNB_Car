"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CURRENCIES } from "@/lib/currency";
import { CURRENCY_COOKIE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { createClient, getUser } from "@/lib/supabase/server";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: YEAR, path: "/", sameSite: "lax" });
  const user = await getUser();
  if (user) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ preferred_locale: locale }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
}

export async function setCurrency(currency: string) {
  if (!(CURRENCIES as readonly string[]).includes(currency)) return;
  (await cookies()).set(CURRENCY_COOKIE, currency, { maxAge: YEAR, path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setMode(mode: "renter" | "host") {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  await supabase.from("profiles").update({ active_mode: mode }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect(mode === "host" ? "/host" : "/search");
}
