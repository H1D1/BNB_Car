"use client";

import { useState } from "react";
import { Loader2, MapPin, Plane } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { distanceKm, nearestCity, reverseGeocode, type GeoResult } from "@/lib/mapbox";
import { placeName } from "@/lib/utils";
import { Field, Toggle } from "@/components/ui/primitives";
import { LocationInput } from "@/components/ui/LocationInput";
import { CarMapLazy } from "@/components/cars/MapLoader";
import type { Place } from "@/lib/types";
import { Chip, Section } from "./ui";
import type { StepProps } from "./values";

export function LocationStep({ v, set, invalid, places }: StepProps & { places: Place[] }) {
  const { t, locale } = useI18n();
  const [mapKey, setMapKey] = useState(0);
  const [resolving, setResolving] = useState(false);
  const cities = places.filter((p) => p.kind === "city");
  const airports = places.filter((p) => p.kind === "airport");

  const pick = async (lat: number, lng: number, result?: GeoResult, recenter = false) => {
    const near = nearestCity(lat, lng, places);
    set({ lat, lng, ...(near ? { city_slug: near.place.slug } : {}) });
    if (recenter) setMapKey((k) => k + 1);
    let r = result ?? null;
    if (!r) {
      setResolving(true);
      r = await reverseGeocode(lat, lng, locale).catch(() => null);
      setResolving(false);
    }
    if (r) {
      const found = r;
      set((p) => ({ address: found.fullAddress, neighborhood: found.neighborhood ?? p.neighborhood }));
    }
  };

  const changeCity = (slug: string) => {
    const c = cities.find((p) => p.slug === slug);
    if (!c) return;
    // Moving to another city: drop the pin on its centre so the host can refine it.
    if (distanceKm(c, { lat: v.lat, lng: v.lng }) > 40) {
      set({ city_slug: slug, lat: c.lat, lng: c.lng, address: "", neighborhood: "" });
      setMapKey((k) => k + 1);
    } else set({ city_slug: slug });
  };

  const toggleAirport = (slug: string) =>
    set((p) => ({ airport_slugs: p.airport_slugs.includes(slug) ? p.airport_slugs.filter((s) => s !== slug) : [...p.airport_slugs, slug] }));

  return (
    <div className="space-y-10">
      <Section title={t("wizard.address")} hint={t("wizard.addressHint")}>
        <LocationInput
          types="address,street,neighborhood,locality,place"
          proximity={{ lat: v.lat, lng: v.lng }}
          placeholder={t("wizard.searchAddress")}
          onSelect={(sel) => {
            if (sel.kind === "point") pick(sel.lat, sel.lng, sel.result, true);
            else pick(sel.place.lat, sel.place.lng, undefined, true);
          }}
        />
        <div className="relative h-80 overflow-hidden rounded-2xl border border-white/10 md:h-96">
          <CarMapLazy key={mapKey} picker pins={[{ id: "pin", lat: v.lat, lng: v.lng }]} onPick={(lat, lng) => pick(lat, lng)} zoom={14} />
          <p className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex items-center gap-2 rounded-xl bg-ink-950/75 px-3 py-2 text-xs text-snow/85 backdrop-blur-md">
            {resolving ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5 text-saffron-300" />}
            {t("wizard.mapHint")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("wizard.city")} htmlFor="city">
            <select id="city" value={v.city_slug} onChange={(e) => changeCity(e.target.value)} aria-invalid={invalid("city_slug")} className="field">
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {placeName(c, locale)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("wizard.neighborhood")} htmlFor="neighborhood">
            <input id="neighborhood" value={v.neighborhood} maxLength={80} onChange={(e) => set({ neighborhood: e.target.value })} className="field" />
          </Field>
          <Field label={t("wizard.address")} htmlFor="address">
            <input id="address" value={v.address} maxLength={200} onChange={(e) => set({ address: e.target.value })} aria-invalid={invalid("address")} className="field" />
          </Field>
        </div>
        {(invalid("lat") || invalid("lng")) && <p className="text-sm text-rose-300">{t("wizard.outsideMorocco")}</p>}
      </Section>

      <Section title={t("wizard.deliveryTitle")}>
        <Toggle label={t("wizard.delivery")} checked={v.delivery_available} onChange={(c) => set({ delivery_available: c })} />
        {v.delivery_available && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("wizard.deliveryFee")} htmlFor="delivery_fee">
              <input
                id="delivery_fee"
                type="number"
                inputMode="numeric"
                min={0}
                max={3000}
                step={10}
                value={v.delivery_fee_mad}
                onChange={(e) => set({ delivery_fee_mad: e.target.value })}
                aria-invalid={invalid("delivery_fee_mad")}
                className="field"
              />
            </Field>
            <Field label={t("wizard.radius")} htmlFor="radius">
              <input
                id="radius"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                value={v.delivery_radius_km}
                onChange={(e) => set({ delivery_radius_km: e.target.value })}
                aria-invalid={invalid("delivery_radius_km")}
                className="field"
              />
            </Field>
          </div>
        )}

        <div>
          <p className="label flex items-center gap-1.5">
            <Plane className="size-3.5" />
            {t("wizard.airports")}
          </p>
          <div className="flex flex-wrap gap-2">
            {airports.map((a) => (
              <Chip key={a.slug} active={v.airport_slugs.includes(a.slug)} onClick={() => toggleAirport(a.slug)}>
                {placeName(a, locale)}
                {a.iata && <span className="text-xs text-white/50">{a.iata}</span>}
              </Chip>
            ))}
          </div>
        </div>
        {v.airport_slugs.length > 0 && (
          <Field label={t("wizard.airportFee")} htmlFor="airport_fee" className="sm:max-w-xs">
            <input
              id="airport_fee"
              type="number"
              inputMode="numeric"
              min={0}
              max={3000}
              step={10}
              value={v.airport_fee_mad}
              onChange={(e) => set({ airport_fee_mad: e.target.value })}
              aria-invalid={invalid("airport_fee_mad")}
              className="field"
            />
          </Field>
        )}
      </Section>
    </div>
  );
}
