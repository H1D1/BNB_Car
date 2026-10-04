"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { replyDispute } from "@/app/actions/disputes";
import { Alert } from "../ui/primitives";
import { SubmitButton } from "../ui/SubmitButton";

export function ReplyForm({ disputeId }: { disputeId: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(replyDispute, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="dispute_id" value={disputeId} />
      <label htmlFor="body" className="label">
        {t("disputes.reply")}
      </label>
      <textarea id="body" name="body" rows={3} required maxLength={4000} placeholder={t("disputes.replyPlaceholder")} className="field resize-y" />
      {state?.error && <Alert tone="error">{errorText(t, state.error)}</Alert>}
      <SubmitButton size="sm">
        <Send className="size-4 rtl:-scale-x-100" />
        {t("common.send")}
      </SubmitButton>
    </form>
  );
}
