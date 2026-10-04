"use client";

import { startTransition, useActionState, useState } from "react";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { createDispute } from "@/app/actions/disputes";
import type { DisputeType } from "@/lib/types";
import { Alert, Field, Glass } from "../ui/primitives";
import { Button } from "../ui/Button";

const TYPES: DisputeType[] = ["damage", "late_return", "mileage", "cleanliness", "fuel", "other"];
const MAX_FILES = 6;

export function DisputeForm({ bookingId, userId }: { bookingId: string; userId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(createDispute, null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const serverError =
    state?.error === "descTooShort" || state?.error === "noEligible" ? t(`disputes.${state.error}`) : state?.error ? errorText(t, state.error) : null;
  const error = localError ?? serverError;
  const busy = uploading || pending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const form = new FormData(e.currentTarget);
    if (String(form.get("description") ?? "").trim().length < 10) {
      setLocalError(t("disputes.descTooShort"));
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const paths: string[] = [];
      for (const [i, file] of files.entries()) {
        const blob = await compressImage(file);
        const isPdf = file.type === "application/pdf";
        const path = `${bookingId}/${userId}-${Date.now()}-${i}.${isPdf ? "pdf" : "jpg"}`;
        const { error: upErr } = await supabase.storage
          .from("dispute-evidence")
          .upload(path, blob, { contentType: isPdf ? "application/pdf" : "image/jpeg", upsert: false });
        if (upErr) {
          setLocalError(errorText(t, "upload_failed"));
          return;
        }
        paths.push(path);
      }
      form.set("evidence", JSON.stringify(paths));
    } finally {
      setUploading(false);
    }
    startTransition(() => action(form));
  }

  return (
    <Glass className="p-5 md:p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <input type="hidden" name="booking_id" value={bookingId} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("disputes.typeLabel")} htmlFor="type">
            <select id="type" name="type" className="field" defaultValue="damage">
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`disputes.type.${ty}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`${t("disputes.amount")} (${t("common.optional")})`} htmlFor="amount">
            <input id="amount" name="amount" type="number" min={0} step="0.01" inputMode="decimal" className="field" dir="ltr" />
          </Field>
        </div>
        <Field label={t("disputes.description")} htmlFor="description">
          <textarea
            id="description"
            name="description"
            rows={6}
            minLength={10}
            maxLength={4000}
            required
            placeholder={t("disputes.descriptionPlaceholder")}
            className="field resize-y"
          />
        </Field>

        <Field label={t("disputes.evidence")} hint={t("disputes.evidenceHint")}>
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="glass-subtle inline-flex max-w-[14rem] items-center gap-2 rounded-xl px-3 py-2 text-xs">
                {f.type === "application/pdf" ? <FileText className="size-4 shrink-0" /> : <ImagePlus className="size-4 shrink-0" />}
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={t("common.remove")}
                  onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                  className="text-white/50 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {files.length < MAX_FILES && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/25 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
                <ImagePlus className="size-4" />
                {t("common.upload")}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setFiles((list) => [...list, ...picked].slice(0, MAX_FILES));
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </Field>

        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {uploading ? t("disputes.uploading") : t("disputes.submit")}
        </Button>
      </form>
    </Glass>
  );
}
