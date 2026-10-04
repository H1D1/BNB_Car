"use client";

import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <span className="glass grid size-20 place-items-center rounded-3xl text-terracotta-300">
        <AlertTriangle className="size-10" />
      </span>
      <p className="mt-6 text-lg">{t("common.error")}</p>
      <Button onClick={reset} className="mt-6">
        {t("common.continue")}
      </Button>
    </div>
  );
}
