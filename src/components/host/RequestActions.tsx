"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { respondToRequest } from "@/app/actions/host";
import { Button } from "@/components/ui/Button";

export function RequestActions({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: "accept" | "decline") => {
    setBusy(action);
    setError(null);
    start(async () => {
      const res = await respondToRequest(bookingId, action);
      if (res?.error) setError(errorText(t, res.error));
      setBusy(null);
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("decline")}>
          {busy === "decline" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          {t("trip.decline")}
        </Button>
        <Button size="sm" variant="success" disabled={pending} onClick={() => run("accept")}>
          {busy === "accept" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {t("trip.accept")}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
