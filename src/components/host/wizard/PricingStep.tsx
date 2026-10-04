"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { marketSuggestion, type MarketSuggestion } from "@/app/actions/host";
import { formatMAD } from "@/lib/currency";
import { placeName } from "@/lib/utils";
import { Field, Toggle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import type { Place } from "@/lib/types";
import { Section } from "./ui";
import type { StepProps } from "./values";

export function PricingStep({ v, set, invalid, carId, places }: StepProps & { carId: string | null; places: Place[] }) {
  const { t, locale } = useI18n();
  const [sugg, setSugg] = useState<{ key: string; value: MarketSuggestion } | null>(null);
  const key = `${v.city_slug}:${v.category}`;

  useEffect(() => {
    let alive = true;
    marketSuggestion(v.city_slug, v.category, carId)
      .then((value) => alive && setSugg({ key: `${v.city_slug}:${v.category}`, value }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [v.city_slug, v.category, carId]);

  const s = sugg?.key === key ? sugg.value : null;
  const city = places.find((p) => p.slug === v.city_slug);

  const num = (id: keyof typeof v, label: string, opts: { min?: number; max?: number; step?: number; hint?: string; placeholder?: string } = {}) => (
    <Field label={label} htmlFor={id} hint={opts.hint}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={opts.min}
        max={opts.max}
        step={opts.step ?? 1}
        placeholder={opts.placeholder}
        value={v[id] as string}
        onChange={(e) => set({ [id]: e.target.value })}
        aria-invalid={invalid(id)}
        className="field"
      />
    </Field>
  );

  return (
    <div className="space-y-10">
      <Section title={t("wizard.daily")}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-end">
          {num("daily_price_mad", t("wizard.daily"), { min: 50, max: 50000, step: 10 })}
          {s && (
            <div className="glass-subtle flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <p className="flex items-start gap-2 text-sm text-white/75">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-saffron-300" />
                <span>
                  {s.scope === "city"
                    ? t("wizard.suggestion", { city: city ? placeName(city, locale) : v.city_slug, min: s.min, max: s.max })
                    : t("wizard.suggestionNational", { min: s.min, max: s.max })}
                </span>
              </p>
              <Button type="button" size="sm" variant="accent" onClick={() => set({ daily_price_mad: String(s.median) })}>
                {t("wizard.useSuggestion", { price: formatMAD(s.median, locale) })}
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {num("hourly_price_mad", t("wizard.hourly"), { min: 10, max: 5000, step: 5, hint: t("wizard.hourlyHint") })}
          {num("weekly_discount_pct", t("wizard.weekly"), { min: 0, max: 60 })}
          {num("monthly_discount_pct", t("wizard.monthly"), { min: 0, max: 70 })}
        </div>
      </Section>

      <Section title={t("wizard.rulesTitle")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {num("deposit_mad", t("wizard.deposit"), { min: 0, max: 100000, step: 500 })}
          {num("min_days", t("wizard.minDays"), { min: 1, max: 30 })}
          {num("km_per_day", t("wizard.kmPerDay"), { min: 50, max: 2000, step: 50 })}
          {num("extra_km_fee_mad", t("wizard.extraKm"), { min: 0, max: 50, step: 0.5 })}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label={t("wizard.instant")} description={t("wizard.instantDesc")} checked={v.instant_book} onChange={(c) => set({ instant_book: c })} />
          <Toggle label={t("wizard.cash")} description={t("wizard.cashDesc")} checked={v.cash_allowed} onChange={(c) => set({ cash_allowed: c })} />
        </div>
      </Section>

      {carId && (
        <Link
          href={`/host/cars/${carId}/calendar`}
          className="glass-subtle flex items-center gap-4 rounded-2xl p-4 transition hover:bg-white/[0.08]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-majorelle-500/25 text-majorelle-300">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("calendar.title")}</span>
            <span className="block text-sm text-white/55">{t("calendar.seasonalHint")}</span>
          </span>
          <ChevronRight className="size-5 text-white/50 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}
