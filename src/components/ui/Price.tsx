"use client";

import { useI18n } from "@/lib/i18n/client";
import { formatConverted, formatMAD } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** MAD amount with an optional "≈ €x" hint in the visitor's display currency. */
export function Price({
  mad,
  className,
  showConverted = true,
  decimals,
  convertedClassName,
}: {
  mad: number;
  className?: string;
  showConverted?: boolean;
  decimals?: boolean;
  convertedClassName?: string;
}) {
  const { locale, currency, t } = useI18n();
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span dir="ltr" className="tabular-nums">{formatMAD(mad, locale, { decimals })}</span>
      {showConverted && currency !== "MAD" && (
        <span className={cn("text-[0.8em] font-normal text-white/50", convertedClassName)}>
          {t("common.approx", { amount: formatConverted(mad, currency, locale) })}
        </span>
      )}
    </span>
  );
}
