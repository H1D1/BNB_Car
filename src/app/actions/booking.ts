"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDraft } from "@/lib/booking";
import { casablancaLocalToISO } from "@/lib/utils";
import { getPaymentGateway } from "@/lib/integrations/payments";
import type { ActionState, PaymentMethod } from "@/lib/types";

export async function createBooking(carId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  if (form.get("agree") !== "on") return { error: "agree" };

  const draft = parseDraft(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
  if (!draft) return { error: "invalid_dates" };
  const method = String(form.get("payment_method")) as PaymentMethod;
  if (!["cmi", "card", "cash"].includes(method)) return { error: "generic" };

  const supabase = await createClient();
  const { data: bookingId, error } = await supabase.rpc("create_booking", {
    p_car_id: carId,
    p_start: casablancaLocalToISO(draft.start),
    p_end: casablancaLocalToISO(draft.end),
    p_rental_type: draft.type,
    p_delivery: draft.delivery,
    p_delivery_address: draft.delivery === "address" ? (draft.address ?? null) : null,
    p_airport_slug: draft.delivery === "airport" ? (draft.airport ?? null) : null,
    p_insurance: draft.insurance,
    p_payment_method: method,
    p_message: String(form.get("message") ?? "").slice(0, 2000),
  });
  if (error) return { error: error.message };

  const { data: booking } = await supabase.from("bookings").select("status").eq("id", bookingId).single();
  revalidatePath("/trips");
  // Instant bookings paid by card go straight to the gateway; requests are paid once accepted.
  if (booking?.status === "confirmed" && method !== "cash") redirect(`/pay/${bookingId}`);
  redirect(`/trips/${bookingId}`);
}

export async function payBooking(bookingId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("id, renter_id, status, payment_status, payment_method, total_mad, deposit_mad")
    .eq("id", bookingId)
    .single();
  if (!b || b.renter_id !== user.id) return { error: "forbidden" };
  if (b.payment_status === "paid") redirect(`/trips/${bookingId}`);
  if (b.status !== "confirmed" || b.payment_method === "cash") return { error: "invalid_transition" };

  const card = {
    number: String(form.get("number") ?? ""),
    expiry: String(form.get("expiry") ?? ""),
    cvc: String(form.get("cvc") ?? ""),
    holder: String(form.get("holder") ?? ""),
  };
  const gateway = getPaymentGateway();
  const method = b.payment_method as "cmi" | "card";
  const result = await gateway.charge({ bookingId, amountMad: Number(b.total_mad), method, card });

  const admin = createAdminClient();
  if (result.status === "failed") {
    await admin.from("payments").insert({ booking_id: bookingId, provider: "mock", method, amount_mad: b.total_mad, status: "failed" });
    return { error: result.reason === "declined" ? "declined" : "invalidCard" };
  }

  const hold = await gateway.holdDeposit({ bookingId, amountMad: Number(b.deposit_mad), card });
  await admin.from("payments").insert([
    {
      booking_id: bookingId,
      provider: "mock",
      method,
      kind: "charge",
      amount_mad: b.total_mad,
      status: "paid",
      provider_ref: result.providerRef,
      card_last4: result.last4,
      card_brand: result.brand,
    },
    ...(hold && Number(b.deposit_mad) > 0
      ? [{ booking_id: bookingId, provider: "mock", method, kind: "deposit_hold", amount_mad: b.deposit_mad, status: "authorized", provider_ref: hold.providerRef, card_last4: result.last4, card_brand: result.brand }]
      : []),
  ]);
  await admin.from("bookings").update({ payment_status: "paid" }).eq("id", bookingId).eq("payment_status", "unpaid");

  revalidatePath(`/trips/${bookingId}`);
  redirect(`/trips/${bookingId}?paid=1`);
}
