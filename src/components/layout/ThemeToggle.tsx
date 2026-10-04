"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ withLabel, className }: { withLabel?: boolean; className?: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const next = theme === "light" ? "dark" : "light";
  const label = next === "light" ? t("nav.lightMode") : t("nav.darkMode");

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white/80 transition hover:bg-white/10",
        className,
      )}
    >
      <span className="relative grid size-5 place-items-center">
        <Sun className={cn("absolute size-[18px] transition-all duration-500", theme === "light" ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")} />
        <Moon className={cn("absolute size-[18px] transition-all duration-500", theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0")} />
      </span>
      {withLabel && <span>{label}</span>}
    </button>
  );
}
