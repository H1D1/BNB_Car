"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, MessageCircle, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { saveContact, sendOtp, verifyOtp, type OtpState } from "@/app/actions/account";
import { accountError } from "./errors";
import { Alert, Badge, Field } from "../ui/primitives";
import { Button } from "../ui/Button";
import { SubmitButton } from "../ui/SubmitButton";

export function ContactForm({ phone, whatsapp, verified }: { phone: string | null; whatsapp: string | null; verified: boolean }) {
  const { t } = useI18n();
  const [saveState, saveAction] = useActionState(saveContact, null);
  const [verifyState, verifyAction] = useActionState(verifyOtp, null);
  const [otp, setOtp] = useState<OtpState>(null);
  const [sending, start] = useTransition();

  const send = (channel: "sms" | "whatsapp") =>
    start(async () => {
      setOtp(await sendOtp(channel));
    });

  const codeSent = otp?.sent || verifyState?.sent;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/55">{t("account.contactHint")}</p>
        {phone &&
          (verified ? <Badge tone="mint">{t("account.phoneVerified")}</Badge> : <Badge tone="saffron">{t("account.phoneUnverified")}</Badge>)}
      </div>

      {/* key: remount with the normalised numbers after a save */}
      <form key={`${phone}|${whatsapp}`} action={saveAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("account.phone")} htmlFor="phone">
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" defaultValue={phone ?? ""} placeholder={t("account.phonePlaceholder")} className="field" />
          </Field>
          <Field label={t("account.whatsapp")} htmlFor="whatsapp" hint={t("account.whatsappHint")}>
            <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" dir="ltr" defaultValue={whatsapp ?? ""} placeholder={t("account.phonePlaceholder")} className="field" />
          </Field>
        </div>
        {saveState?.error && <Alert tone="error">{accountError(t, saveState.error)}</Alert>}
        {saveState?.ok && <Alert tone="success">{t("common.saved")}</Alert>}
        <SubmitButton variant="secondary" size="sm">
          {t("common.save")}
        </SubmitButton>
      </form>

      {phone && !verified && (
        <div className="glass-subtle space-y-4 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => send("sms")} disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
              {t("account.sendSms")}
            </Button>
            <Button type="button" size="sm" variant="success" onClick={() => send("whatsapp")} disabled={sending}>
              <MessageCircle className="size-4" />
              {t("account.sendWhatsapp")}
            </Button>
          </div>
          {otp?.error && <Alert tone="error">{accountError(t, otp.error)}</Alert>}
          {otp?.sent && otp.phone && <Alert tone="info">{t("account.codeSent", { phone: otp.phone })}</Alert>}
          {otp?.devCode && (
            <Alert tone="warning">
              <span className="font-semibold">{t("account.devCode", { code: otp.devCode })}</span>
            </Alert>
          )}
          {codeSent && (
            <form action={verifyAction} className="flex flex-wrap items-end gap-3">
              <Field label={t("account.code")} htmlFor="code" className="w-44">
                <input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  dir="ltr"
                  className="field text-center font-mono tracking-[0.4em]"
                />
              </Field>
              <SubmitButton size="md">{t("account.verify")}</SubmitButton>
            </form>
          )}
          {verifyState?.error && <Alert tone="error">{accountError(t, verifyState.error)}</Alert>}
        </div>
      )}
      {verifyState?.ok && <Alert tone="success">{t("account.phoneVerified")}</Alert>}
    </div>
  );
}
