"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Fuel, Loader2, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { INSPECTION_ANGLES, INSPECTION_CHECKS, MIN_INSPECTION_PHOTOS, type InspectionAngle, type InspectionPhase } from "@/lib/inspection";
import { submitInspection } from "@/app/actions/trips";
import { cn } from "@/lib/utils";
import { Alert, Field, Glass, Toggle } from "../ui/primitives";
import { Button } from "../ui/Button";

type Shot = { blob: Blob; preview: string };

export function InspectionForm({ bookingId, phase }: { bookingId: string; phase: InspectionPhase }) {
  const { t } = useI18n();
  const router = useRouter();
  const [shots, setShots] = useState<Partial<Record<InspectionAngle, Shot>>>({});
  const [busyAngle, setBusyAngle] = useState<InspectionAngle | null>(null);
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState(100);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();
  // Object URLs for previews, released on unmount.
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const count = Object.keys(shots).length;

  async function pick(angle: InspectionAngle, file: File | undefined) {
    if (!file) return;
    setBusyAngle(angle);
    try {
      const blob = await compressImage(file);
      const preview = URL.createObjectURL(blob);
      urls.current.add(preview);
      setShots((prev) => ({ ...prev, [angle]: { blob, preview } }));
    } finally {
      setBusyAngle(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (count < MIN_INSPECTION_PHOTOS) {
      setError(t("inspection.photosRequired", { count: MIN_INSPECTION_PHOTOS }));
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const entries = Object.entries(shots) as [InspectionAngle, Shot][];
      const uploaded: { angle: string; path: string }[] = [];
      setProgress({ done: 0, total: entries.length });
      for (const [angle, shot] of entries) {
        const path = `${bookingId}/${phase}/${angle}-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("inspections").upload(path, shot.blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) {
          setProgress(null);
          setError(errorText(t, "upload_failed"));
          return;
        }
        uploaded.push({ angle, path });
        setProgress({ done: uploaded.length, total: entries.length });
      }
      const res = await submitInspection({
        bookingId,
        phase,
        odometer: odometer ? Number(odometer) : null,
        fuel,
        checklist: checks,
        notes,
        photos: uploaded,
      });
      setProgress(null);
      if (res?.error) {
        setError(res.error === "photos_required" ? t("inspection.photosRequired", { count: MIN_INSPECTION_PHOTOS }) : errorText(t, res.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Glass className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{t("inspection.photos")}</h2>
          <span className={cn("text-sm font-semibold", count >= MIN_INSPECTION_PHOTOS ? "text-mint-400" : "text-white/55")}>
            {t("inspection.photosCount", { count, total: INSPECTION_ANGLES.length })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {INSPECTION_ANGLES.map((angle) => {
            const shot = shots[angle];
            return (
              <div key={angle}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  id={`shot-${angle}`}
                  onChange={(e) => {
                    void pick(angle, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor={`shot-${angle}`}
                  className={cn(
                    "group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border text-center text-sm transition",
                    shot ? "border-mint-400/50" : "border-dashed border-white/25 bg-white/5 hover:bg-white/10",
                  )}
                >
                  {shot ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                      <img src={shot.preview} alt={t(`inspection.angles.${angle}`)} className="absolute inset-0 size-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink-950/70 px-2.5 py-1.5 text-xs font-semibold">
                        {t(`inspection.angles.${angle}`)}
                        <span className="flex items-center gap-1 text-white/70">
                          <RefreshCw className="size-3" />
                          {t("inspection.retake")}
                        </span>
                      </span>
                    </>
                  ) : busyAngle === angle ? (
                    <Loader2 className="size-6 animate-spin text-white/60" />
                  ) : (
                    <>
                      <Camera className="size-6 text-saffron-300" />
                      <span className="font-semibold">{t(`inspection.angles.${angle}`)}</span>
                      <span className="text-xs text-white/45">{t("inspection.addPhoto")}</span>
                    </>
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </Glass>

      <Glass className="grid gap-5 p-5 sm:grid-cols-2">
        <Field label={t("inspection.odometer")} htmlFor="odometer">
          <input
            id="odometer"
            type="number"
            inputMode="numeric"
            min={0}
            max={2_000_000}
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            className="field"
            dir="ltr"
          />
        </Field>
        <Field label={`${t("inspection.fuel")} · ${fuel}%`} htmlFor="fuel">
          <div className="flex h-[50px] items-center gap-3">
            <Fuel className="size-5 shrink-0 text-white/50" />
            <input
              id="fuel"
              type="range"
              min={0}
              max={100}
              step={5}
              value={fuel}
              onChange={(e) => setFuel(Number(e.target.value))}
              className="w-full accent-saffron-400"
            />
          </div>
        </Field>
      </Glass>

      <Glass className="p-5">
        <h2 className="mb-4 text-lg font-bold">{t("inspection.checklist")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {INSPECTION_CHECKS.map((k) => (
            <Toggle key={k} label={t(`inspection.checks.${k}`)} checked={!!checks[k]} onChange={(v) => setChecks((c) => ({ ...c, [k]: v }))} />
          ))}
        </div>
      </Glass>

      <Glass className="p-5">
        <Field label={t("inspection.notes")} htmlFor="notes">
          <textarea
            id="notes"
            rows={4}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("inspection.notesPlaceholder")}
            className="field resize-y"
          />
        </Field>
      </Glass>

      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || busyAngle !== null}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {progress ? t("inspection.uploading", { done: progress.done, total: progress.total }) : t("inspection.submit")}
      </Button>
    </form>
  );
}
