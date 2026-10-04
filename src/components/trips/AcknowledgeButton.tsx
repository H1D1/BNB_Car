"use client";

import { useActionState } from "react";
import { CheckCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { acknowledgeInspection } from "@/app/actions/trips";
import { Alert } from "../ui/primitives";
import { SubmitButton } from "../ui/SubmitButton";

export function AcknowledgeButton({ inspectionId, bookingId }: { inspectionId: string; bookingId: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(acknowledgeInspection, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="inspection_id" value={inspectionId} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <SubmitButton variant="success" size="sm">
        <CheckCheck className="size-4" />
        {t("trip.acknowledge")}
      </SubmitButton>
      {state?.error && <Alert tone="error">{errorText(t, state.error)}</Alert>}
    </form>
  );
}
