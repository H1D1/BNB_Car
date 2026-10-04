"use client";

import { useState, useTransition } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { lookupPlate } from "@/app/actions/host";
import { CAR_FEATURES, CATEGORIES, FUELS, POPULAR_MAKES, TRANSMISSIONS } from "@/lib/listing";
import { Alert, Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Chip, Section } from "./ui";
import type { StepProps } from "./values";

export function VehicleStep({ v, set, invalid }: StepProps) {
  const { t } = useI18n();
  const [looking, startLookup] = useTransition();
  const [lookup, setLookup] = useState<{ found: boolean; text: string } | null>(null);
  const maxYear = new Date().getFullYear() + 1;

  const doLookup = () =>
    startLookup(async () => {
      const { vehicle } = await lookupPlate(v.plate);
      if (!vehicle) {
        setLookup({ found: false, text: t("wizard.lookupNone") });
        return;
      }
      set({
        make: vehicle.make,
        model: vehicle.model,
        year: String(vehicle.year),
        transmission: vehicle.transmission,
        fuel: vehicle.fuel,
        category: vehicle.category,
        seats: String(vehicle.seats),
        doors: String(vehicle.doors),
      });
      setLookup({ found: true, text: t("wizard.lookupFound", { car: `${vehicle.make} ${vehicle.model} ${vehicle.year}` }) });
    });

  const toggleFeature = (f: string) =>
    set((p) => ({ features: p.features.includes(f) ? p.features.filter((x) => x !== f) : [...p.features, f] }));

  return (
    <div className="space-y-10">
      <Section title={t("wizard.plate")} hint={t("wizard.lookupHint")}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="plate"
            value={v.plate}
            onChange={(e) => set({ plate: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (v.plate.trim()) doLookup();
              }
            }}
            placeholder={t("wizard.platePlaceholder")}
            dir="ltr"
            maxLength={24}
            aria-invalid={invalid("plate")}
            className="field font-mono tracking-wider sm:max-w-xs"
          />
          <Button type="button" variant="secondary" onClick={doLookup} disabled={looking || !v.plate.trim()}>
            {looking ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
            {t("wizard.lookup")}
          </Button>
        </div>
        {lookup && <Alert tone={lookup.found ? "success" : "warning"}>{lookup.text}</Alert>}
      </Section>

      <Section title={t("wizard.make")}>
        <div>
          <p className="label">{t("wizard.popular")}</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_MAKES.map((m) => (
              <Chip key={m} active={v.make === m} onClick={() => set({ make: m })}>
                {m}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("wizard.make")} htmlFor="make">
            <input id="make" value={v.make} onChange={(e) => set({ make: e.target.value })} maxLength={40} aria-invalid={invalid("make")} className="field" required />
          </Field>
          <Field label={t("wizard.model")} htmlFor="model">
            <input id="model" value={v.model} onChange={(e) => set({ model: e.target.value })} maxLength={60} aria-invalid={invalid("model")} className="field" required />
          </Field>
          <Field label={t("wizard.year")} htmlFor="year">
            <input
              id="year"
              type="number"
              inputMode="numeric"
              min={1990}
              max={maxYear}
              value={v.year}
              onChange={(e) => set({ year: e.target.value })}
              aria-invalid={invalid("year")}
              className="field"
            />
          </Field>
        </div>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title={t("wizard.transmission")}>
          <div className="flex flex-wrap gap-2">
            {TRANSMISSIONS.map((x) => (
              <Chip key={x} active={v.transmission === x} onClick={() => set({ transmission: x })}>
                {t(`car.transmission.${x}`)}
              </Chip>
            ))}
          </div>
        </Section>
        <Section title={t("wizard.fuel")}>
          <div className="flex flex-wrap gap-2">
            {FUELS.map((x) => (
              <Chip key={x} active={v.fuel === x} onClick={() => set({ fuel: x })}>
                {t(`car.fuel.${x}`)}
              </Chip>
            ))}
          </div>
        </Section>
      </div>

      <Section title={t("wizard.category")}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={v.category === c}
              onClick={() => set({ category: c })}
              className={cn(
                "rounded-2xl border p-4 text-start transition-all duration-300",
                v.category === c ? "border-majorelle-300/60 bg-majorelle-500/25" : "border-white/12 bg-white/[0.04] hover:bg-white/10",
              )}
            >
              <span className="block font-semibold">{t(`car.category.${c}`)}</span>
              <span className="mt-0.5 block text-xs text-white/50">{t(`car.categoryHint.${c}`)}</span>
            </button>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("wizard.seats")} htmlFor="seats">
          <select id="seats" value={v.seats} onChange={(e) => set({ seats: e.target.value })} aria-invalid={invalid("seats")} className="field">
            {[2, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("wizard.doors")} htmlFor="doors">
          <select id="doors" value={v.doors} onChange={(e) => set({ doors: e.target.value })} aria-invalid={invalid("doors")} className="field">
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("wizard.mileage")} htmlFor="mileage">
          <input
            id="mileage"
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            value={v.mileage_km}
            onChange={(e) => set({ mileage_km: e.target.value })}
            aria-invalid={invalid("mileage_km")}
            className="field"
          />
        </Field>
      </div>

      <Section title={t("wizard.features")}>
        <div className="flex flex-wrap gap-2">
          {CAR_FEATURES.map((f) => (
            <Chip key={f} active={v.features.includes(f)} onClick={() => toggleFeature(f)}>
              {t(`car.features.${f}`)}
            </Chip>
          ))}
        </div>
      </Section>
    </div>
  );
}
