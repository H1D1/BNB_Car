"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Landmark, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { payBooking } from "@/app/actions/booking";
import { formatMAD } from "@/lib/currency";
import { rpcErrorMessage } from "@/lib/errors";
import { Alert, Field, Glass } from "../ui/primitives";
import { Button } from "../ui/Button";

const fmtCard = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
const fmtExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function PayButton({ label }: { label: string }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
      {pending ? t("pay.processing") : label}
    </Button>
  );
}

export function PaymentForm({
  bookingId,
  reference,
  method,
  total,
  deposit,
  description,
}: {
  bookingId: string;
  reference: string;
  method: "cmi" | "card";
  total: number;
  deposit: number;
  description: string;
}) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(payBooking.bind(null, bookingId), null);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");

  const error =
    state?.error === "declined" ? t("pay.declined") : state?.error === "invalidCard" ? t("pay.invalidCard") : state?.error ? rpcErrorMessage(t, state.error) : null;

  return (
    <Glass strong className="w-full max-w-md overflow-hidden animate-fade-up">
      <div className={method === "cmi" ? "bg-gradient-to-br from-[#0b5a9c] to-[#083c6b] p-6 text-snow" : "bg-gradient-to-br from-majorelle-500 to-majorelle-600 p-6 text-snow"}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-white/15">
            <Landmark className="size-6" />
          </span>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase opacity-80">{method === "cmi" ? "CMI" : "Visa · Mastercard"}</p>
            <p className="font-bold">{method === "cmi" ? t("pay.gateway") : t("pay.gatewayCard")}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="opacity-75">{t("pay.merchant")}</dt>
          <dd className="text-end font-semibold">CarShare Morocco</dd>
          <dt className="opacity-75">{t("pay.reference")}</dt>
          <dd className="text-end font-semibold" dir="ltr">
            {reference}
          </dd>
          <dt className="opacity-75">{description}</dt>
          <dd />
          <dt className="opacity-75">{t("pay.amount")}</dt>
          <dd className="text-end text-xl font-bold" dir="ltr">
            {formatMAD(total, locale, { decimals: true })}
          </dd>
        </dl>
      </div>

      <form action={action} className="space-y-4 p-6">
        <Alert tone="warning">{t("pay.testMode")}</Alert>
        <Field label={t("pay.holder")} htmlFor="holder">
          <input id="holder" name="holder" autoComplete="cc-name" required className="field" />
        </Field>
        <Field label={t("pay.cardNumber")} htmlFor="number">
          <input
            id="number"
            name="number"
            inputMode="numeric"
            autoComplete="cc-number"
            dir="ltr"
            required
            value={number}
            onChange={(e) => setNumber(fmtCard(e.target.value))}
            placeholder="4242 4242 4242 4242"
            className="field font-mono tracking-wider"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("pay.expiry")} htmlFor="expiry">
            <input
              id="expiry"
              name="expiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              dir="ltr"
              required
              value={expiry}
              onChange={(e) => setExpiry(fmtExpiry(e.target.value))}
              placeholder="12/29"
              className="field font-mono"
            />
          </Field>
          <Field label={t("pay.cvc")} htmlFor="cvc">
            <input id="cvc" name="cvc" inputMode="numeric" autoComplete="cc-csc" dir="ltr" required maxLength={4} placeholder="123" className="field font-mono" />
          </Field>
        </div>
        {deposit > 0 && <p className="text-xs text-white/55">{t("pay.depositHold", { amount: formatMAD(deposit, locale) })}</p>}
        {error && <Alert tone="error">{error}</Alert>}
        <PayButton label={t("pay.pay", { amount: formatMAD(total, locale) })} />
        <p className="flex items-center justify-center gap-1.5 text-xs text-white/45">
          <ShieldCheck className="size-3.5" />
          {t("pay.secured")}
        </p>
      </form>
    </Glass>
  );
}
