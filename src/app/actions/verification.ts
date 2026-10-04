"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getKycProvider, normalizeDocNumber, type KycReason } from "@/lib/integrations/kyc";
import type { ActionState, DocType } from "@/lib/types";

export type VerificationState = (ActionState & { status?: "verified" | "rejected"; reason?: KycReason }) | null;

const KIND_DOCS = { identity: ["cin", "passport"], license: ["license_ma", "license_intl"] } as const;
const NEEDS_BACK: DocType[] = ["cin", "license_ma", "license_intl"];

const validPath = (uid: string, p: string) => p.startsWith(`${uid}/`) && !p.includes("..") && p.length < 300;

/**
 * The browser uploads the files to the private `verification-docs` bucket (RLS: own folder only),
 * then calls this with the storage paths. We re-check the paths, record the document and run the KYC provider.
 */
export async function submitVerification(_: VerificationState, form: FormData): Promise<VerificationState> {
  const user = await getUser();
  if (!user) return { error: "not_authenticated" };

  const kind = String(form.get("kind") ?? "") as keyof typeof KIND_DOCS;
  const docType = String(form.get("doc_type") ?? "") as DocType;
  if (!(kind in KIND_DOCS) || !(KIND_DOCS[kind] as readonly string[]).includes(docType)) return { error: "generic" };

  const frontPath = String(form.get("front_path") ?? "");
  const backPath = String(form.get("back_path") ?? "") || null;
  const number = normalizeDocNumber(String(form.get("document_number") ?? ""));
  const expiresOn = String(form.get("expires_on") ?? "");

  if (!frontPath) return { error: "missingFront" };
  if (NEEDS_BACK.includes(docType) && !backPath) return { error: "missingBack" };
  if (!validPath(user.id, frontPath) || (backPath && !validPath(user.id, backPath))) return { error: "forbidden" };
  if (!number || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return { error: "missingFields" };

  const admin = createAdminClient();
  const statusColumn = kind === "identity" ? "id_status" : "license_status";

  // the files must actually exist in the user's folder
  const folder = await admin.storage.from("verification-docs").list(user.id, { limit: 1000 });
  const names = new Set((folder.data ?? []).map((f) => `${user.id}/${f.name}`));
  if (!names.has(frontPath) || (backPath && !names.has(backPath))) return { error: "missingFront" };

  const { data: profile } = await admin.from("profiles").select("full_name, id_status, license_status").eq("id", user.id).single();
  const wasVerified = profile?.[statusColumn] === "verified";
  const provider = getKycProvider();

  const { data: doc, error } = await admin
    .from("verification_documents")
    .insert({
      user_id: user.id,
      doc_type: docType,
      front_path: frontPath,
      back_path: backPath,
      document_number: number,
      expires_on: expiresOn,
      status: "pending",
      provider: provider.name,
    })
    .select("id")
    .single();
  if (error || !doc) return { error: "generic" };
  if (!wasVerified) await admin.from("profiles").update({ [statusColumn]: "pending" }).eq("id", user.id);

  let result;
  try {
    result = await provider.verify({ docType, frontPath, backPath, number, expiresOn, fullName: profile?.full_name });
  } catch {
    // provider outage: leave the document pending for a retry / manual review
    revalidatePath("/account/verification");
    return { error: "generic" };
  }

  await admin
    .from("verification_documents")
    .update({
      status: result.status,
      provider_result: result,
      document_number: result.extracted.number ?? number,
      expires_on: result.extracted.expiresOn ?? expiresOn,
      full_name_extracted: result.extracted.fullName ?? null,
      rejection_reason: result.reason ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  // A rejected re-upload must not downgrade an earlier, still valid verification.
  const keepVerified = result.status === "rejected" && wasVerified && (await hasVerifiedDoc(user.id, KIND_DOCS[kind]));
  await admin
    .from("profiles")
    .update({ [statusColumn]: keepVerified ? "verified" : result.status })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  return { ok: result.status === "verified", status: result.status, reason: result.reason };
}

async function hasVerifiedDoc(uid: string, types: readonly DocType[]) {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await admin
    .from("verification_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .in("doc_type", types)
    .eq("status", "verified")
    .gt("expires_on", today);
  return (count ?? 0) > 0;
}
