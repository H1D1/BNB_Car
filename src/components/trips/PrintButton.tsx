"use client";

import { Printer } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "../ui/Button";

export function PrintButton() {
  const { t } = useI18n();
  return (
    <Button type="button" variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
      <Printer className="size-4" />
      {t("common.print")}
    </Button>
  );
}
