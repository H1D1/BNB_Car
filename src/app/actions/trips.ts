"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorCode, isUuid } from "@/lib/trips";
import { INSPECTION_ANGLES, INSPECTION_CHECKS, type InspectionPhase } from "@/lib/inspection";
import type { ActionState, Booking } from "@/lib/types";

const ACTIONS = ["accept", "decline", "cancel", "start", "complete"] as const;
type TripAction = (typeof ACTIONS)[number];

const revalidateTrip = (id: string) => {
  revalidatePath(`/trips/${id}`);
  revalidatePath("/trips");
};

export async function transitionBooking(_: ActionState, form: FormData): Promise<ActionState> {
  const id = form.get("booking_id");
  const action = String(form.get("action") ?? "") as TripAction;
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500) || null;
  if (!isUuid(id) || !ACTIONS.includes(action)) return { error: "generic" };
  if (!(await getUser())) return { error: "not_authenticated" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_booking", { p_booking_id: id, p_action: action, p_reason: reason });
  if (error) return { error: errorCode(error.message) };
  revalidateTrip(id);
  return { ok: true };
}

export async function submitReview(_: ActionState, form: FormData): Promise<ActionState> {
  const id = form.get("booking_id");
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  if (!isUuid(id)) return { error: "generic" };

  const score = (k: string) => {
    const n = Number(form.get(k));
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const rating = score("rating");
  if (!rating) return { error: "rating_required" };
  const comment = String(form.get("comment") ?? "").trim().slice(0, 2000) || null;

  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("id, car_id, renter_id, host_id, status")
    .eq("id", id)
    .maybeSingle<Pick<Booking, "id" | "car_id" | "renter_id" | "host_id" | "status">>();
  if (!b) return { error: "forbidden" };
  if (b.status !== "completed") return { error: "invalid_transition" };
  const asRenter = b.renter_id === user.id;

  const { error } = await supabase.from("reviews").insert({
    booking_id: b.id,
    car_id: b.car_id,
    author_id: user.id,
    subject_id: asRenter ? b.host_id : b.renter_id,
    direction: asRenter ? "renter_to_host" : "host_to_renter",
    rating,
    cleanliness: asRenter ? score("cleanliness") : null,
    communication: asRenter ? score("communication") : null,
    accuracy: asRenter ? score("accuracy") : null,
    comment,
  });
  if (error) return { error: error.code === "23505" ? "already_reviewed" : "generic" };
  revalidateTrip(b.id);
  revalidatePath(`/cars/${b.car_id}`);
  return { ok: true };
}

export async function acknowledgeInspection(_: ActionState, form: FormData): Promise<ActionState> {
  const inspectionId = form.get("inspection_id");
  const bookingId = form.get("booking_id");
  if (!isUuid(inspectionId) || !isUuid(bookingId)) return { error: "generic" };
  if (!(await getUser())) return { error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_inspection", { p_inspection: inspectionId });
  if (error) return { error: errorCode(error.message) };
  revalidateTrip(bookingId);
  revalidatePath(`/trips/${bookingId}/inspection/pre`);
  revalidatePath(`/trips/${bookingId}/inspection/post`);
  return { ok: true };
}

type InspectionPayload = {
  bookingId: string;
  phase: InspectionPhase;
  odometer: number | null;
  fuel: number;
  checklist: Record<string, boolean>;
  notes: string;
  photos: { angle: string; path: string }[];
};

/** Photos are uploaded from the browser first (storage RLS); this records the inspection. */
export async function submitInspection(p: InspectionPayload): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };
  if (!isUuid(p.bookingId) || (p.phase !== "pre" && p.phase !== "post")) return { error: "generic" };

  const prefix = `${p.bookingId}/${p.phase}/`;
  const photos = (p.photos ?? []).filter(
    (ph) => (INSPECTION_ANGLES as readonly string[]).includes(ph.angle) && typeof ph.path === "string" && ph.path.startsWith(prefix) && !ph.path.includes(".."),
  );
  if (photos.length < 4) return { error: "photos_required" };

  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("id, status").eq("id", p.bookingId).maybeSingle<Pick<Booking, "id" | "status">>();
  if (!b) return { error: "forbidden" };
  const allowed = p.phase === "pre" ? ["confirmed", "active"] : ["active", "completed"];
  if (!allowed.includes(b.status)) return { error: "invalid_transition" };

  const odometer = p.odometer != null && Number.isFinite(p.odometer) && p.odometer >= 0 ? Math.round(p.odometer) : null;
  const fuel = Math.min(100, Math.max(0, Math.round(Number(p.fuel) || 0)));
  const checklist = Object.fromEntries(INSPECTION_CHECKS.map((k) => [k, !!p.checklist?.[k]]));

  const { data: ins, error } = await supabase
    .from("inspections")
    .insert({
      booking_id: b.id,
      phase: p.phase,
      submitted_by: user.id,
      odometer_km: odometer,
      fuel_level: fuel,
      checklist,
      notes: String(p.notes ?? "").trim().slice(0, 2000) || null,
    })
    .select("id")
    .single();
  if (error || !ins) return { error: error?.code === "23505" ? "already_submitted" : "generic" };

  const { error: phErr } = await supabase
    .from("inspection_photos")
    .insert(photos.map((ph) => ({ inspection_id: ins.id, angle: ph.angle, storage_path: ph.path })));
  if (phErr) {
    // Don't leave a photo-less inspection behind (there is no client delete policy).
    await createAdminClient().from("inspections").delete().eq("id", ins.id);
    return { error: "generic" };
  }

  revalidateTrip(b.id);
  revalidatePath(`/trips/${b.id}/inspection/${p.phase}`);
  return { ok: true };
}
