"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "../ui/Button";

const TRANSMISSIONS = ["manual", "automatic"] as const;
const FUELS = ["diesel", "gasoline", "hybrid", "electric"] as const;
const CATEGORIES = ["city", "compact", "sedan", "suv", "luxury", "van"] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-300",
        active ? "border-majorelle-300/60 bg-majorelle-500/35 text-white" : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/10",
      )}
    >
      {active && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

export function FilterPanel({ className, mode }: { className?: string; mode: "sidebar" | "sheet" }) {
  const { t } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const getList = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);

  const update = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mutate(p);
    start(() => router.replace(`/search?${p.toString()}`, { scroll: false }));
  };

  const toggleList = (k: string, v: string) =>
    update((p) => {
      const cur = new Set(getList(k));
      if (cur.has(v)) cur.delete(v);
      else cur.add(v);
      if (cur.size) p.set(k, [...cur].join(","));
      else p.delete(k);
    });

  const setOne = (k: string, v: string | null) => update((p) => (v ? p.set(k, v) : p.delete(k)));

  const activeCount =
    ["transmission", "fuel", "category"].reduce((n, k) => n + getList(k).length, 0) +
    ["min", "max", "booking", "delivery", "seats"].filter((k) => sp.get(k)).length;

  const clear = () =>
    update((p) => {
      for (const k of ["transmission", "fuel", "category", "min", "max", "booking", "delivery", "seats"]) p.delete(k);
    });

  const body = (
    <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")}>
      <section>
        <h3 className="label">{t("search.transmission")}</h3>
        <div className="flex flex-wrap gap-2">
          {TRANSMISSIONS.map((v) => (
            <Chip key={v} active={getList("transmission").includes(v)} onClick={() => toggleList("transmission", v)}>
              {t(`car.transmission.${v}`)}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h3 className="label">{t("search.fuel")}</h3>
        <div className="flex flex-wrap gap-2">
          {FUELS.map((v) => (
            <Chip key={v} active={getList("fuel").includes(v)} onClick={() => toggleList("fuel", v)}>
              {t(`car.fuel.${v}`)}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h3 className="label">{t("search.category")}</h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((v) => (
            <Chip key={v} active={getList("category").includes(v)} onClick={() => toggleList("category", v)}>
              {t(`car.category.${v}`)}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h3 className="label">{t("search.price")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            placeholder={t("search.minPrice")}
            defaultValue={sp.get("min") ?? ""}
            onBlur={(e) => setOne("min", e.target.value || null)}
            onKeyDown={(e) => e.key === "Enter" && setOne("min", (e.target as HTMLInputElement).value || null)}
            className="field"
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            placeholder={t("search.maxPrice")}
            defaultValue={sp.get("max") ?? ""}
            onBlur={(e) => setOne("max", e.target.value || null)}
            onKeyDown={(e) => e.key === "Enter" && setOne("max", (e.target as HTMLInputElement).value || null)}
            className="field"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            [null, "300"],
            [null, "500"],
            ["500", "1000"],
            ["1000", null],
          ].map(([min, max]) => (
            <Chip
              key={`${min}-${max}`}
              active={(sp.get("min") ?? null) === min && (sp.get("max") ?? null) === max}
              onClick={() =>
                update((p) => {
                  if (min) p.set("min", min);
                  else p.delete("min");
                  if (max) p.set("max", max);
                  else p.delete("max");
                })
              }
            >
              {min && max ? `${min}–${max}` : max ? `< ${max}` : `${min}+`}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h3 className="label">{t("search.bookingType")}</h3>
        <div className="flex flex-wrap gap-2">
          <Chip active={sp.get("booking") === "instant"} onClick={() => setOne("booking", sp.get("booking") === "instant" ? null : "instant")}>
            {t("search.instantOnly")}
          </Chip>
          <Chip active={sp.get("booking") === "request"} onClick={() => setOne("booking", sp.get("booking") === "request" ? null : "request")}>
            {t("search.requestOnly")}
          </Chip>
        </div>
      </section>
      <section>
        <h3 className="label">{t("search.delivery")}</h3>
        <Chip active={sp.get("delivery") === "1"} onClick={() => setOne("delivery", sp.get("delivery") === "1" ? null : "1")}>
          {t("search.deliveryOnly")}
        </Chip>
      </section>
      <section>
        <h3 className="label">{t("search.seats")}</h3>
        <div className="flex flex-wrap gap-2">
          {[null, "4", "5", "7"].map((s) => (
            <Chip key={s ?? "any"} active={(sp.get("seats") ?? null) === s} onClick={() => setOne("seats", s)}>
              {s ? `${s}+` : t("search.any")}
            </Chip>
          ))}
        </div>
      </section>
    </div>
  );

  if (mode === "sidebar")
    return (
      <aside className={cn("glass hidden h-fit rounded-[var(--radius-glass)] p-5 lg:block", className)}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <SlidersHorizontal className="size-4" />
            {t("search.filters")}
          </h2>
          {activeCount > 0 && (
            <button onClick={clear} className="text-sm font-semibold text-saffron-300 hover:underline">
              {t("search.clear")}
            </button>
          )}
        </div>
        {body}
      </aside>
    );

  return (
    <>
      <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" />
        {t("search.filters")}
        {activeCount > 0 && <span className="rounded-full bg-terracotta-500 px-1.5 text-xs">{activeCount}</span>}
      </Button>
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "visible" : "invisible")}>
        <div className={cn("absolute inset-0 bg-ink-950/70 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div
          className={cn(
            "glass-strong absolute inset-x-2 bottom-2 max-h-[85dvh] overflow-y-auto rounded-3xl p-5 transition-transform duration-500 ease-[var(--ease-liquid)]",
            open ? "translate-y-0" : "translate-y-[110%]",
          )}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("search.filters")}</h2>
            <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label={t("common.close")}>
              <X className="size-5" />
            </button>
          </div>
          {body}
          <div className="sticky bottom-0 mt-6 flex gap-2 pt-2">
            <Button variant="ghost" onClick={clear} className="flex-1">
              {t("search.clear")}
            </Button>
            <Button onClick={() => setOpen(false)} className="flex-[2]">
              {t("search.apply")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
