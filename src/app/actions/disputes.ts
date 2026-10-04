"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { DISPUTABLE, isUuid } from "@/lib/trips";
import type { ActionState, Booking, DisputeType } from "@/lib/types";

const TYPES: DisputeType[] = ["late_return", "damage", "mileage", "cleanliness", "fuel", "other"];

export async function createDispute(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  const bookingId = form.get("booking_id");
  const type = String(form.get("type") ?? "") as DisputeType;
  const description = String(form.get("description") ?? "").trim();
  const amountRaw = String(form.get("amount") ?? "").trim().replace(",", ".");
  const amount = amountRaw ? Number(amountRaw) : null;
  let evidence: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get("evidence") ?? "[]"));
    if (Array.isArray(parsed)) evidence = parsed.filter((p): p is string => typeof p === "string");
  } catch {
    evidence = [];
  }

  if (!isUuid(bookingId) || !TYPES.includes(type)) return { error: "generic" };
  if (description.length < 10) return { error: "descTooShort" };
  if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000)) return { error: "generic" };
  evidence = evidence.filter((p) => p.startsWith(`${bookingId}/`) && !p.includes("..")).slice(0, 6);

  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("id, renter_id, host_id, status")
    .eq("id", bookingId)
    .maybeSingle<Pick<Booking, "id" | "renter_id" | "host_id" | "status">>();
  if (!b) return { error: "forbidden" };
  if (!DISPUTABLE.includes(b.status)) return { error: "noEligible" };

  const { data: dispute, error } = await supabase
    .from("disputes")
    .insert({
      booking_id: b.id,
      opened_by: user.id,
      against_id: b.renter_id === user.id ? b.host_id : b.renter_id,
      type,
      amount_claimed_mad: amount,
      description: description.slice(0, 4000),
      evidence_paths: evidence,
    })
    .select("id")
    .single();
  if (error || !dispute) return { error: "generic" };

  // Automatic acknowledgement from support (sender null), in the user's language.
  const { t } = await getI18n();
  await createAdminClient().from("dispute_messages").insert({ dispute_id: dispute.id, sender_id: null, body: t("disputes.supportAuto") });

  revalidatePath("/disputes");
  redirect(`/disputes/${dispute.id}`);
}

export async function replyDispute(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  const disputeId = form.get("dispute_id");
  const body = String(form.get("body") ?? "").trim();
  if (!isUuid(disputeId) || !body) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.from("dispute_messages").insert({ dispute_id: disputeId, sender_id: user.id, body: body.slice(0, 4000) });
  if (error) return { error: "forbidden" };
  revalidatePath(`/disputes/${disputeId}`);
  return { ok: true };
}
