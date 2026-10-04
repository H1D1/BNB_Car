"use client";

import { useActionState, useState } from "react";
import { Banknote, CreditCard, Landmark, Lock, ScrollText } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { createBooking } from "@/app/actions/booking";
import { rpcErrorMessage } from "@/lib/errors";
import { formatMAD } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { BookingDraft } from "@/lib/booking";
import type { PaymentMethod } from "@/lib/types";
import { Alert, Glass } from "../ui/primitives";
import { SubmitButton } from "../ui/SubmitButton";

const CLAUSES = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] as const;

export function CheckoutForm({
  carId,
  draft,
  total,
  instant,
  cashEligible,
  hostName,
}: {
  carId: string;
  draft: BookingDraft;
  total: number;
  instant: boolean;
  cashEligible: boolean;
  hostName: string;
}) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(createBooking.bind(null, carId), null);
  const [method, setMethod] = useState<PaymentMethod>("cmi");
  const [agree, setAgree] = useState(false);

  const methods: { id: PaymentMethod; icon: typeof CreditCard; disabled?: boolean }[] = [
    { id: "cmi", icon: Landmark },
    { id: "card", icon: CreditCard },
    { id: "cash", icon: Banknote, disabled: !cashEligible },
  ];

  const cta = !instant ? t("checkout.sendRequest") : method === "cash" ? t("checkout.confirmCash") : t("checkout.confirmPay", { amount: formatMAD(total, locale) });

  return (
    <form action={action} className="space-y-6">
      {Object.entries(draft).map(([k, v]) => (v == null ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}

      <Glass className="p-6">
        <h2 className="mb-4 text-lg font-bold">{t("checkout.paymentTitle")}</h2>
        <div className="space-y-2">
          {methods.map(({ id, icon: Icon, disabled }) => (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition",
                method === id ? "border-majorelle-300/60 bg-majorelle-500/20" : "border-white/10 hover:bg-white/5",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input type="radio" name="payment_method" value={id} checked={method === id} disabled={disabled} onChange={() => setMethod(id)} className="sr-only" />
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`checkout.method.${id}`)}</span>
                <span className="block text-sm text-white/55">{disabled ? t("checkout.cashLocked") : t(`checkout.methodDesc.${id}`)}</span>
              </span>
              <span className={cn("mt-1 size-5 shrink-0 rounded-full border-2", method === id ? "border-majorelle-300 bg-majorelle-400 shadow-[inset_0_0_0_3px_rgba(10,15,44,1)]" : "border-white/30")} />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-white/50">
          <Lock className="size-3.5" />
          {["CMI", "VISA", "Mastercard", "3-D Secure"].map((b) => (
            <span key={b} className="glass-subtle rounded-md px-2 py-1">
              {b}
            </span>
          ))}
        </div>
      </Glass>

      <Glass className="p-6">
        <h2 className="mb-3 text-lg font-bold">{t("checkout.messageTitle")}</h2>
        <textarea name="message" rows={4} maxLength={2000} placeholder={t("checkout.messagePlaceholder", { name: hostName.split(" ")[0] })} className="field resize-y" />
      </Glass>

      <Glass className="p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <ScrollText className="size-5 text-saffron-300" />
          {t("checkout.contractTitle")}
        </h2>
        <p className="text-sm text-white/60">{t("checkout.contractText")}</p>
        <details className="group mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-saffron-300 hover:underline">{t("checkout.contractView")}</summary>
          <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-white/70">
            {CLAUSES.map((c) => (
              <li key={c}>{t(`contract.clauses.${c}`)}</li>
            ))}
          </ol>
        </details>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 accent-majorelle-500" />
          <span>{t("checkout.agree")}</span>
        </label>
      </Glass>

      {state?.error && <Alert tone="error">{state.error === "agree" ? t("checkout.mustAgree") : rpcErrorMessage(t, state.error)}</Alert>}

      <SubmitButton size="lg" variant={instant ? "accent" : "primary"} className="w-full" disabled={!agree}>
        {cta}
      </SubmitButton>
      {!instant && <p className="text-center text-sm text-white/55">{t("checkout.requestNote")}</p>}
    </form>
  );
}
