"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Car as CarIcon, Check, Eye, Loader2, MapPin, Rocket, Save, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { publishCar, saveDetails, saveLocation, savePricing, saveVehicle, type WizardResult } from "@/app/actions/host";
import { cn } from "@/lib/utils";
import { Alert, Badge, Glass, type BadgeTone } from "@/components/ui/primitives";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { TKey } from "@/lib/i18n/config";
import type { Car, CarPhoto, CarStatus, Place } from "@/lib/types";
import { VehicleStep } from "./VehicleStep";
import { PricingStep } from "./PricingStep";
import { LocationStep } from "./LocationStep";
import { PhotosStep } from "./PhotosStep";
import { detailsPayload, locationPayload, pricingPayload, toValues, vehiclePayload, type SetValues, type WizardValues } from "./values";

const STEPS = [
  { key: "vehicle", Icon: CarIcon },
  { key: "pricing", Icon: Wallet },
  { key: "location", Icon: MapPin },
  { key: "photos", Icon: Camera },
] as const;

const STATUS_TONE: Record<CarStatus, BadgeTone> = { draft: "neutral", active: "mint", paused: "saffron" };
const BLOCKERS = ["needPhotos", "needDescription", "needVerification"];

export function ListingWizard({
  car,
  photos: initialPhotos,
  places,
  defaultCity,
  userId,
  verified,
  initialStep = 0,
}: {
  car: Car | null;
  photos: CarPhoto[];
  places: Place[];
  defaultCity?: Place;
  userId: string;
  verified: boolean;
  initialStep?: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [carId, setCarId] = useState<string | null>(car?.id ?? null);
  const [status, setStatus] = useState<CarStatus>(car?.status ?? "draft");
  const [step, setStep] = useState(car ? Math.min(Math.max(initialStep, 0), 3) : 0);
  const [v, setV] = useState<WizardValues>(() => toValues(car, defaultCity));
  const [photos, setPhotos] = useState<CarPhoto[]>(initialPhotos);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"save" | "next" | "publish" | null>(null);

  const set: SetValues = (patch) => setV((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  const invalid = (f: string) => fields.includes(f);

  const goto = (i: number, id: string | null = carId) => {
    setStep(i);
    if (id) window.history.replaceState(null, "", `/host/cars/${id}?step=${i + 1}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showError = (res: WizardResult) => {
    setFields(res.fields ?? []);
    setError(
      res.error === "invalid"
        ? t("wizard.invalid")
        : BLOCKERS.includes(res.error ?? "")
          ? (res.fields ?? [res.error!]).map((b) => t(`wizard.${b}` as TKey)).join(" ")
          : errorText(t, res.error),
    );
  };

  const saveCurrent = async (): Promise<WizardResult> => {
    if (step === 0) return saveVehicle(carId, vehiclePayload(v));
    if (!carId) return { error: "generic" };
    if (step === 1) return savePricing(carId, pricingPayload(v));
    if (step === 2) return saveLocation(carId, locationPayload(v));
    return saveDetails(carId, detailsPayload(v));
  };

  /** Saves the current step, then optionally moves to `target`. */
  const run = (kind: "save" | "next" | "publish", target?: number) =>
    start(async () => {
      setAction(kind);
      setError(null);
      setNotice(null);
      const res = await saveCurrent();
      if (res.error) {
        showError(res);
        setAction(null);
        return;
      }
      setFields([]);
      const id = res.carId ?? carId;
      if (!carId && id) setCarId(id);

      if (kind === "publish" && id) {
        const pub = await publishCar(id);
        if (pub.error) showError(pub);
        else {
          setStatus("active");
          setNotice(t("wizard.published"));
          router.refresh();
        }
      } else if (target != null) {
        goto(target, id);
      } else {
        setNotice(t("common.saved"));
        if (!carId && id) window.history.replaceState(null, "", `/host/cars/${id}?step=${step + 1}`);
      }
      setAction(null);
    });

  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/host" className="mb-2 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("host.title")}
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
            {car ? t("wizard.editTitle") : t("wizard.newTitle")}
            {carId && <Badge tone={STATUS_TONE[status]}>{t(`host.status.${status}`)}</Badge>}
          </h1>
          {(v.make || v.model) && (
            <p className="mt-1 text-white/55">
              {v.make} {v.model} {v.year}
            </p>
          )}
        </div>
        {carId && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/host/cars/${carId}/calendar`} variant="secondary" size="sm">
              <CalendarDays className="size-4" />
              {t("host.calendar")}
            </ButtonLink>
            {status === "active" && (
              <ButtonLink href={`/cars/${carId}`} variant="ghost" size="sm">
                <Eye className="size-4" />
                {t("wizard.viewListing")}
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      {/* Stepper */}
      <Glass strong className="sticky top-22 z-30 mb-6 p-2">
        <ol className="grid grid-cols-4 gap-1">
          {STEPS.map(({ key, Icon }, i) => {
            const done = i < step || (carId != null && i === 0 && step > 0);
            const reachable = carId != null || i === 0;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={!reachable || pending || i === step}
                  onClick={() => run("next", i)}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-2xl px-2 py-2.5 text-sm font-semibold transition-all duration-300 md:justify-start md:px-3",
                    i === step ? "bg-gradient-to-br from-majorelle-400/50 to-majorelle-600/50 text-white shadow-inner" : "text-white/60 hover:bg-white/8",
                    !reachable && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs",
                      i === step ? "bg-snow text-majorelle-600" : done ? "bg-mint-500/25 text-mint-400" : "bg-white/10",
                    )}
                  >
                    {done && i !== step ? <Check className="size-4" /> : <Icon className="size-3.5" />}
                  </span>
                  <span className="hidden truncate md:inline">{t(`wizard.steps.${key}`)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Glass>

      <Glass className="p-5 md:p-8">
        <p className="mb-6 text-xs font-semibold tracking-wider text-white/45 uppercase">
          {t("wizard.stepOf", { step: step + 1, total: STEPS.length })} · {t(`wizard.steps.${STEPS[step].key}`)}
        </p>

        {step === 0 && <VehicleStep v={v} set={set} invalid={invalid} />}
        {step === 1 && <PricingStep v={v} set={set} invalid={invalid} carId={carId} places={places} />}
        {step === 2 && <LocationStep v={v} set={set} invalid={invalid} places={places} />}
        {step === 3 && carId && (
          <PhotosStep v={v} set={set} invalid={invalid} carId={carId} userId={userId} photos={photos} setPhotos={setPhotos} verified={verified} />
        )}

        <div className="mt-8 space-y-3">
          {error && <Alert tone="error">{error}</Alert>}
          {notice && (
            <Alert tone="success">
              {notice}
              {status === "active" && last && carId && (
                <span className="ms-2 inline-flex gap-3">
                  <Link href={`/cars/${carId}`} className="font-semibold underline">
                    {t("wizard.viewListing")}
                  </Link>
                  <Link href="/host" className="font-semibold underline">
                    {t("host.title")}
                  </Link>
                </span>
              )}
            </Alert>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
          <Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => run("next", step - 1)}>
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("common.back")}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run("save")}>
              {action === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {status === "draft" ? t("wizard.saveDraft") : t("wizard.update")}
            </Button>
            {!last ? (
              <Button type="button" disabled={pending} onClick={() => run("next", step + 1)}>
                {action === "next" && <Loader2 className="size-4 animate-spin" />}
                {t("wizard.saveContinue")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            ) : (
              status !== "active" && (
                <Button type="button" variant="accent" disabled={pending} onClick={() => run("publish")}>
                  {action === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                  {t("wizard.publish")}
                </Button>
              )
            )}
          </div>
        </div>
      </Glass>
    </div>
  );
}
