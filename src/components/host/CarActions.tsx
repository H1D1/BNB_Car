"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarDays, Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { errorText } from "@/lib/errors";
import { deleteCar, setCarStatus } from "@/app/actions/host";
import type { CarStatus } from "@/lib/types";
import type { TKey } from "@/lib/i18n/config";

const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/12 hover:text-white disabled:opacity-50";

export function CarActions({ carId, status }: { carId: string; status: CarStatus }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const message = (code: string) =>
    ["needPhotos", "needDescription", "needVerification"].includes(code) ? t(`wizard.${code}` as TKey) : errorText(t, code);

  const toggle = () =>
    start(async () => {
      setError(null);
      const res = await setCarStatus(carId, status === "active" ? "paused" : "active");
      if (res.error) setError(message(res.error));
    });

  const remove = () => {
    if (!window.confirm(t("wizard.deleteConfirm"))) return;
    start(async () => {
      setError(null);
      const res = await deleteCar(carId);
      if (res.error) setError(message(res.error));
    });
  };

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <div className="flex flex-wrap gap-2">
        <Link href={`/host/cars/${carId}`} className={pill}>
          <Pencil className="size-3.5" />
          {t("host.edit")}
        </Link>
        <Link href={`/host/cars/${carId}/calendar`} className={pill}>
          <CalendarDays className="size-3.5" />
          {t("host.calendar")}
        </Link>
        <button type="button" onClick={toggle} disabled={pending} className={pill}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {status === "active" ? t("host.pause") : t("host.activate")}
        </button>
        <button type="button" onClick={remove} disabled={pending} className={`${pill} ms-auto text-rose-300 hover:bg-rose-500/20 hover:text-rose-200`}>
          <Trash2 className="size-3.5" />
          {t("common.delete")}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
