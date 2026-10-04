"use client";

import { startTransition, useActionState, useState } from "react";
import { FileUp, IdCard, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { submitVerification } from "@/app/actions/verification";
import { formatDate, cn } from "@/lib/utils";
import type { TKey } from "@/lib/i18n/config";
import type { DocType, VerificationStatus } from "@/lib/types";
import { accountError } from "./errors";
import { Alert, Badge, Field, Glass, type BadgeTone } from "../ui/primitives";
import { Button } from "../ui/Button";

export type LastDoc = {
  doc_type: DocType;
  status: VerificationStatus;
  document_number: string | null;
  expires_on: string | null;
  rejection_reason: string | null;
  created_at: string;
};

const TYPES = { identity: ["cin", "passport"], license: ["license_ma", "license_intl"] } as const satisfies Record<string, DocType[]>;
const NEEDS_BACK: DocType[] = ["cin", "license_ma", "license_intl"];
export const STATUS_TONE: Record<VerificationStatus, BadgeTone> = { unverified: "neutral", pending: "saffron", verified: "mint", rejected: "rose" };

export function VerificationCard({
  kind,
  userId,
  status,
  lastDoc,
}: {
  kind: "identity" | "license";
  userId: string;
  status: VerificationStatus;
  lastDoc: LastDoc | null;
}) {
  const { t, locale } = useI18n();
  const [state, action, verifying] = useActionState(submitVerification, null);
  const [editing, setEditing] = useState(status === "unverified" || status === "rejected");
  const [docType, setDocType] = useState<DocType>(lastDoc?.doc_type ?? TYPES[kind][0]);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const needsBack = NEEDS_BACK.includes(docType);
  const busy = uploading || verifying;
  const Icon = kind === "identity" ? IdCard : ShieldCheck;

  const upload = async (file: File, side: "front" | "back") => {
    const blob = await compressImage(file);
    const ext = blob.type === "application/pdf" ? "pdf" : "jpg";
    const path = `${userId}/${docType}-${side}-${Date.now()}.${ext}`;
    const { error } = await createClient()
      .storage.from("verification-docs")
      .upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (error) throw error;
    return path;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploadError(null);
    if (!front) return setUploadError("missingFront");
    if (needsBack && !back) return setUploadError("missingBack");
    const fd = new FormData(e.currentTarget);
    setUploading(true);
    try {
      fd.set("front_path", await upload(front, "front"));
      if (needsBack && back) fd.set("back_path", await upload(back, "back"));
    } catch {
      setUploading(false);
      return setUploadError("generic");
    }
    setUploading(false);
    startTransition(() => action(fd));
  };

  // after a successful check, collapse the form
  const justVerified = state?.status === "verified";
  const showForm = editing && !justVerified;
  const shownStatus = state?.status ?? status;

  return (
    <Glass className="p-6 md:p-7">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-majorelle-500/20 text-majorelle-300">
            <Icon className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">{kind === "identity" ? t("verification.identity") : t("verification.license")}</h2>
            <p className="text-sm text-white/55">{kind === "identity" ? t("verification.identityHint") : t("verification.licenseHint")}</p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[shownStatus]}>{t(`verification.status.${shownStatus}`)}</Badge>
      </div>

      {lastDoc && !state && (
        <div className="glass-subtle mb-4 rounded-2xl p-4 text-sm">
          <p className="label mb-1">{t("verification.result")}</p>
          <p className="font-semibold">{t(`verification.docType.${lastDoc.doc_type}`)}</p>
          {lastDoc.document_number && lastDoc.expires_on && (
            <p className="text-white/65" dir="auto">
              {t("verification.extracted", { number: lastDoc.document_number, date: formatDate(lastDoc.expires_on, locale) })}
            </p>
          )}
          {lastDoc.status === "rejected" && lastDoc.rejection_reason && (
            <p className="mt-1 text-rose-300">{t(`verification.reasons.${lastDoc.rejection_reason}` as TKey)}</p>
          )}
        </div>
      )}

      {state?.status === "rejected" && state.reason && <Alert tone="error" className="mb-4">{t(`verification.reasons.${state.reason}`)}</Alert>}
      {justVerified && <Alert tone="success" className="mb-4">{t("verification.status.verified")}</Alert>}
      {state?.error && <Alert tone="error" className="mb-4">{accountError(t, state.error, "verification")}</Alert>}

      {showForm ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="doc_type" value={docType} />
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("verification.docTypeLabel")}>
            {TYPES[kind].map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={docType === d}
                onClick={() => setDocType(d)}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                  docType === d ? "border-majorelle-400/60 bg-majorelle-500/20 text-white" : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]",
                )}
              >
                {t(`verification.docType.${d}`)}
              </button>
            ))}
          </div>

          <div className={cn("grid gap-3", needsBack && "sm:grid-cols-2")}>
            <FilePick label={t("verification.front")} file={front} onPick={setFront} />
            {needsBack && <FilePick label={t("verification.back")} file={back} onPick={setBack} />}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("verification.number")} htmlFor={`${kind}-number`} hint={t(`verification.numberHint.${docType}`)}>
              <input id={`${kind}-number`} name="document_number" required maxLength={40} dir="ltr" autoComplete="off" className="field uppercase" />
            </Field>
            <Field label={t("verification.expiry")} htmlFor={`${kind}-expiry`}>
              <input id={`${kind}-expiry`} name="expires_on" type="date" required dir="ltr" className="field" />
            </Field>
          </div>

          {uploadError && <Alert tone="error">{accountError(t, uploadError, "verification")}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? t("verification.verifying") : t("verification.submit")}
            </Button>
            {status !== "unverified" && status !== "rejected" && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <RotateCcw className="size-4" />
          {t("verification.redo")}
        </Button>
      )}
    </Glass>
  );
}

function FilePick({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  const { t } = useI18n();
  return (
    <label className="glass-subtle flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/20 p-4 transition hover:bg-white/[0.08]">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-saffron-300">
        <FileUp className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-white/50">{file ? file.name : t("verification.choose")}</span>
      </span>
      <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}
