"use client";

import { useActionState, useState } from "react";
import { Check, KeyRound, Flag, X, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { formatMAD } from "@/lib/currency";
import { transitionBooking } from "@/app/actions/trips";
import type { BookingStatus } from "@/lib/types";
import { Alert, Field } from "../ui/primitives";
import { Button } from "../ui/Button";
import { SubmitButton } from "../ui/SubmitButton";

type Confirming = "cancel" | "decline" | null;

export function TripActions({
  bookingId,
  role,
  status,
  refund,
  startBlocked,
}: {
  bookingId: string;
  role: "renter" | "host";
  status: BookingStatus;
  /** Refund estimate if the current user cancels now (MAD). */
  refund: number;
  /** Reason the host can't start yet, shown as a hint (server still enforces it). */
  startBlocked?: string;
}) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(transitionBooking, null);
  const [confirming, setConfirming] = useState<Confirming>(null);

  const canAccept = role === "host" && status === "pending";
  const canStart = role === "host" && status === "confirmed";
  const canComplete = role === "host" && status === "active";
  const canCancel = (role === "renter" && (status === "pending" || status === "confirmed")) || (role === "host" && status === "confirmed");
  if (!canAccept && !canStart && !canComplete && !canCancel) return null;

  const hidden = (a: string) => (
    <>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="action" value={a} />
    </>
  );

  return (
    <div className="space-y-3">
      {state?.error && <Alert tone="error">{errorText(t, state.error)}</Alert>}

      {confirming ? (
        <form action={action} className="glass-subtle space-y-3 rounded-2xl p-4">
          {hidden(confirming)}
          {confirming === "cancel" && (
            <p className="text-sm text-white/80">{t("trip.cancelConfirm", { amount: formatMAD(refund, locale) })}</p>
          )}
          <Field label={t("trip.cancelReason")} htmlFor="reason">
            <textarea id="reason" name="reason" rows={2} maxLength={500} className="field resize-none" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="danger" size="sm">
              <XCircle className="size-4" />
              {t("common.confirm")}
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              {t("trip.keep")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canAccept && (
            <form action={action}>
              {hidden("accept")}
              <SubmitButton variant="success" size="sm">
                <Check className="size-4" />
                {t("trip.accept")}
              </SubmitButton>
            </form>
          )}
          {canAccept && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming("decline")}>
              <X className="size-4" />
              {t("trip.decline")}
            </Button>
          )}
          {canStart && (
            <form action={action}>
              {hidden("start")}
              <SubmitButton variant="primary" size="sm">
                <KeyRound className="size-4" />
                {t("trip.start")}
              </SubmitButton>
            </form>
          )}
          {canComplete && (
            <form action={action}>
              {hidden("complete")}
              <SubmitButton variant="success" size="sm">
                <Flag className="size-4" />
                {t("trip.complete")}
              </SubmitButton>
            </form>
          )}
          {canCancel && (
            <Button type="button" variant="ghost" size="sm" className="text-rose-300 hover:text-rose-200" onClick={() => setConfirming("cancel")}>
              <XCircle className="size-4" />
              {t("trip.cancel")}
            </Button>
          )}
        </div>
      )}
      {canStart && startBlocked && !confirming && <p className="text-xs text-white/50">{startBlocked}</p>}
    </div>
  );
}
