"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-300",
        active ? "border-majorelle-300/60 bg-majorelle-500/35 text-white" : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/10",
        className,
      )}
    >
      {active && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

export function Section({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-white/55">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
