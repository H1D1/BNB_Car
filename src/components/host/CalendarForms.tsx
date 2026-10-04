"use client";

import { useActionState, useEffect, useRef } from "react";
import { CalendarX2, Tag } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { addBlockedDates, addSeasonalPrice } from "@/app/actions/host";
import { Alert, Field } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { TKey } from "@/lib/i18n/config";
import type { ActionState } from "@/lib/types";

const CAL_ERRORS = ["invalidRange", "pastRange", "labelRequired", "invalidPrice"];

function useMessage(state: ActionState) {
  const { t } = useI18n();
  if (!state?.error) return null;
  return CAL_ERRORS.includes(state.error) ? t(`calendar.errors.${state.error}` as TKey) : errorText(t, state.error);
}

/** Resets the form after a successful submit. */
function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function BlockForm({ carId, today }: { carId: string; today: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(addBlockedDates.bind(null, carId), null);
  const message = useMessage(state);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("calendar.start")} htmlFor="b-start">
          <input id="b-start" name="start" type="date" min={today} required className="field" />
        </Field>
        <Field label={t("calendar.end")} htmlFor="b-end">
          <input id="b-end" name="end" type="date" min={today} required className="field" />
        </Field>
      </div>
      <Field label={`${t("calendar.note")} (${t("common.optional")})`} htmlFor="b-note">
        <input id="b-note" name="note" maxLength={140} className="field" />
      </Field>
      {message && <Alert tone="error">{message}</Alert>}
      <SubmitButton variant="secondary" size="sm" className="w-full">
        <CalendarX2 className="size-4" />
        {t("calendar.addBlock")}
      </SubmitButton>
    </form>
  );
}

export function SeasonForm({ carId, today, basePrice }: { carId: string; today: string; basePrice: number }) {
  const { t } = useI18n();
  const [state, action] = useActionState(addSeasonalPrice.bind(null, carId), null);
  const message = useMessage(state);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label={t("calendar.label")} htmlFor="s-label">
        <input id="s-label" name="label" maxLength={60} required placeholder={t("calendar.labelPlaceholder")} className="field" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("calendar.start")} htmlFor="s-start">
          <input id="s-start" name="start" type="date" min={today} required className="field" />
        </Field>
        <Field label={t("calendar.end")} htmlFor="s-end">
          <input id="s-end" name="end" type="date" min={today} required className="field" />
        </Field>
      </div>
      <Field label={`${t("calendar.price")} (MAD)`} htmlFor="s-price">
        <input
          id="s-price"
          name="price"
          type="number"
          inputMode="numeric"
          min={50}
          max={50000}
          step={10}
          required
          defaultValue={Math.round((basePrice * 1.3) / 10) * 10}
          className="field"
        />
      </Field>
      {message && <Alert tone="error">{message}</Alert>}
      <SubmitButton variant="secondary" size="sm" className="w-full">
        <Tag className="size-4" />
        {t("calendar.addSeason")}
      </SubmitButton>
    </form>
  );
}
