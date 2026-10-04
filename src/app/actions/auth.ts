"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/server";
import type { ActionState } from "@/lib/types";

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "invalidCredentials" };
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")));
}

export async function signup(_: ActionState, form: FormData): Promise<ActionState> {
  const name = String(form.get("full_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (name.length < 2) return { error: "nameRequired" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "invalidEmail" };
  if (password.length < 8) return { error: "weakPassword" };

  // The project has no SMTP provider yet, so accounts are created pre-confirmed server-side.
  // Trust comes from phone OTP + ID/licence verification. Switch to supabase.auth.signUp()
  // once email confirmation is configured.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, locale: await getLocale() },
  });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "emailTaken" : "weakPassword" };

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")) === "/" ? "/account/verification" : safeNext(form.get("next")));
}
