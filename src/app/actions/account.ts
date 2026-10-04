"use server";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOtpSender, normalizePhone, type OtpChannel } from "@/lib/integrations/sms";
import { isLocale } from "@/lib/i18n/config";
import { setLocale } from "./preferences";
import type { ActionState } from "@/lib/types";

export type OtpState = (ActionState & { devCode?: string; phone?: string; sent?: boolean }) | null;

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_PER_HOUR = 5;

// Codes are stored as HMAC-SHA256 (keyed with a server secret) so a DB leak doesn't reveal 6-digit codes.
const hashCode = (userId: string, phone: string, code: string) =>
  createHmac("sha256", process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev")
    .update(`${userId}:${phone}:${code}`)
    .digest("hex");

type Contact = { phone: string | null; whatsapp: string | null };

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  const fullName = String(form.get("full_name") ?? "").trim().slice(0, 80);
  const bio = String(form.get("bio") ?? "").trim().slice(0, 600);
  const city = String(form.get("city_slug") ?? "").trim();
  const locale = String(form.get("preferred_locale") ?? "");
  if (fullName.length < 2) return { error: "nameRequired" };

  const supabase = await createClient();
  if (city) {
    const { data: place } = await supabase.from("places").select("slug").eq("slug", city).eq("kind", "city").maybeSingle();
    if (!place) return { error: "generic" };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, bio: bio || null, city_slug: city || null })
    .eq("id", user.id);
  if (error) return { error: "generic" };
  if (isLocale(locale)) await setLocale(locale); // cookie + profiles.preferred_locale, revalidates the layout
  revalidatePath("/account");
  revalidatePath(`/users/${user.id}`);
  return { ok: true };
}

/** Called after the browser uploaded the (compressed) avatar to the public `avatars` bucket. */
export async function setAvatar(path: string): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  if (typeof path !== "string" || !path.startsWith(`${user.id}/`) || path.includes("..")) return { error: "forbidden" };
  const supabase = await createClient();
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveContact(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  const phoneRaw = String(form.get("phone") ?? "").trim();
  const waRaw = String(form.get("whatsapp") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const whatsapp = waRaw ? normalizePhone(waRaw) : null;
  if ((phoneRaw && !phone) || (waRaw && !whatsapp)) return { error: "invalidPhone" };

  const supabase = await createClient();
  // The guard trigger resets phone_verified when the number changes.
  const { error } = await supabase.from("profiles").update({ phone, whatsapp }).eq("id", user.id);
  if (error) return { error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function sendOtp(channel: OtpChannel): Promise<OtpState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  if (channel !== "sms" && channel !== "whatsapp") return { error: "generic" };

  const supabase = await createClient();
  const { data: contact } = await supabase.rpc("get_my_contact").maybeSingle<Contact>();
  if (!contact?.phone) return { error: "savePhoneFirst" };
  // Both channels go to the mobile number being verified (WhatsApp on that same number), so the code proves ownership of it.
  const target = contact.phone;

  const admin = createAdminClient();
  const { data: recent } = await admin
    .from("phone_verifications")
    .select("created_at")
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
    .order("created_at", { ascending: false });
  if (recent?.length && Date.now() - new Date(recent[0].created_at).getTime() < OTP_RESEND_MS) return { error: "otpWait" };
  if ((recent?.length ?? 0) >= OTP_MAX_PER_HOUR) return { error: "tooMany" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await admin.from("phone_verifications").insert({
    user_id: user.id,
    phone: contact.phone,
    code_hash: hashCode(user.id, contact.phone, code),
    channel,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) return { error: "generic" };

  const result = await getOtpSender().send(target, code, channel);
  return { ok: true, sent: true, phone: target, devCode: result.devCode };
}

export async function verifyOtp(_: OtpState, form: FormData): Promise<OtpState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "invalidCode", sent: true };

  const supabase = await createClient();
  const { data: contact } = await supabase.rpc("get_my_contact").maybeSingle<Contact>();
  if (!contact?.phone) return { error: "savePhoneFirst" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("phone_verifications")
    .select("id, phone, code_hash, attempts, expires_at")
    .eq("user_id", user.id)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || row.phone !== contact.phone || new Date(row.expires_at).getTime() < Date.now()) return { error: "invalidCode", sent: true };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { error: "tooMany" };

  await admin.from("phone_verifications").update({ attempts: row.attempts + 1 }).eq("id", row.id);
  const expected = Buffer.from(row.code_hash, "hex");
  const got = Buffer.from(hashCode(user.id, contact.phone, code), "hex");
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return row.attempts + 1 >= OTP_MAX_ATTEMPTS ? { error: "tooMany" } : { error: "invalidCode", sent: true };
  }

  await admin.from("phone_verifications").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
  const { error } = await admin.from("profiles").update({ phone_verified: true }).eq("id", user.id).eq("phone", contact.phone);
  if (error) return { error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}
