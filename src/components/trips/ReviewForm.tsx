"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { submitReview } from "@/app/actions/trips";
import { Alert, Field, Glass } from "../ui/primitives";
import { SubmitButton } from "../ui/SubmitButton";

function StarPicker({ name, label, required }: { name: string; label: string; required?: boolean }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <input type="hidden" name={name} value={value || ""} />
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={label} aria-required={required}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} / 5`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(0)}
            onClick={() => setValue(i)}
            className="rounded-md p-0.5 transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-saffron-400/60 focus-visible:outline-none"
          >
            <Star className={cn("size-7", i <= shown ? "fill-saffron-400 text-saffron-400" : "text-white/25")} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ bookingId, subjectName, asRenter }: { bookingId: string; subjectName: string; asRenter: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(submitReview, null);

  if (state?.ok) {
    return <Alert tone="success">{t("trip.reviewDone")}</Alert>;
  }

  return (
    <Glass className="p-5 md:p-6">
      <h2 className="text-lg font-bold">{t("trip.reviewTitle")}</h2>
      <p className="mt-1 text-sm text-white/60">{t("trip.reviewOf", { name: subjectName })}</p>
      <form action={action} className="mt-5 space-y-5">
        <input type="hidden" name="booking_id" value={bookingId} />
        <StarPicker name="rating" label={t("trip.overall")} required />
        {asRenter && (
          <div className="grid gap-5 sm:grid-cols-3">
            <StarPicker name="cleanliness" label={t("trip.cleanliness")} />
            <StarPicker name="communication" label={t("trip.communication")} />
            <StarPicker name="accuracy" label={t("trip.accuracy")} />
          </div>
        )}
        <Field label={t("trip.comment")} htmlFor="comment">
          <textarea id="comment" name="comment" rows={4} maxLength={2000} className="field resize-y" />
        </Field>
        {state?.error && <Alert tone="error">{errorText(t, state.error)}</Alert>}
        <SubmitButton>{t("trip.submitReview")}</SubmitButton>
      </form>
    </Glass>
  );
}
