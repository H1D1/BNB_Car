"use client";

import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { updateProfile } from "@/app/actions/account";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { accountError } from "./errors";
import { Alert, Field } from "../ui/primitives";
import { SubmitButton } from "../ui/SubmitButton";

export function ProfileForm({
  profile,
  cities,
}: {
  profile: { full_name: string; bio: string | null; city_slug: string | null; preferred_locale: string };
  cities: { slug: string; name: string }[];
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <Field label={t("account.fullName")} htmlFor="full_name">
        <input id="full_name" name="full_name" defaultValue={profile.full_name} required minLength={2} maxLength={80} autoComplete="name" className="field" />
      </Field>
      <Field label={t("account.bio")} htmlFor="bio" hint={t("common.optional")}>
        <textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} rows={4} maxLength={600} placeholder={t("account.bioPlaceholder")} className="field min-h-28 resize-y py-3" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("account.city")} htmlFor="city_slug">
          <select id="city_slug" name="city_slug" defaultValue={profile.city_slug ?? ""} className="field">
            <option value="">{t("account.noCity")}</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("account.language")} htmlFor="preferred_locale">
          <select id="preferred_locale" name="preferred_locale" defaultValue={profile.preferred_locale} className="field">
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {state?.error && <Alert tone="error">{accountError(t, state.error)}</Alert>}
      {state?.ok && <Alert tone="success">{t("common.saved")}</Alert>}
      <SubmitButton>{t("account.saveProfile")}</SubmitButton>
    </form>
  );
}
