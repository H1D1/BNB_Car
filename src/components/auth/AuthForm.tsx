"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { login, signup } from "@/app/actions/auth";
import type { TKey } from "@/lib/i18n/config";
import { Alert, Field, Glass } from "../ui/primitives";
import { SubmitButton } from "../ui/SubmitButton";
import { GoogleButton } from "./GoogleButton";

export function AuthForm({ mode, next, oauthError }: { mode: "login" | "signup"; next?: string; oauthError?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(mode === "login" ? login : signup, null);
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <Glass strong className="w-full max-w-md p-8 animate-fade-up">
      <h1 className="text-2xl font-bold">{mode === "login" ? t("auth.loginTitle") : t("auth.signupTitle")}</h1>
      <p className="mt-1 text-sm text-white/60">{mode === "login" ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}</p>

      <div className="mt-7">
        <GoogleButton next={next} />
        {oauthError && (
          <Alert tone="error" className="mt-3">
            {t("auth.oauthError")}
          </Alert>
        )}
      </div>
      <div className="my-6 flex items-center gap-3 text-xs font-semibold tracking-wider text-white/40 uppercase">
        <span className="h-px flex-1 bg-white/15" />
        {t("auth.orEmail")}
        <span className="h-px flex-1 bg-white/15" />
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        {mode === "signup" && (
          <Field label={t("auth.fullName")} htmlFor="full_name">
            <input id="full_name" name="full_name" autoComplete="name" required className="field" />
          </Field>
        )}
        <Field label={t("auth.email")} htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </Field>
        <Field label={t("auth.password")} htmlFor="password" hint={mode === "signup" ? t("auth.weakPassword") : undefined}>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
            className="field"
          />
        </Field>
        {state?.error && <Alert tone="error">{t(`auth.${state.error}` as TKey)}</Alert>}
        <SubmitButton className="w-full" size="lg">
          {mode === "login" ? t("auth.login") : t("auth.signup")}
        </SubmitButton>
        {mode === "signup" && <p className="text-xs text-white/45">{t("auth.terms")}</p>}
      </form>

      <p className="mt-6 text-center text-sm text-white/60">
        {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <Link href={(mode === "login" ? "/signup" : "/login") + q} className="font-semibold text-saffron-300 hover:underline">
          {mode === "login" ? t("auth.signup") : t("auth.login")}
        </Link>
      </p>

      {mode === "login" && (
        <Alert tone="info" className="mt-6">
          <strong className="block">{t("auth.demo")}</strong>
          <span className="text-xs">{t("auth.demoText")}</span>
        </Alert>
      )}
    </Glass>
  );
}
