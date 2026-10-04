"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Minimal accessible popover: closes on outside click, Escape and route-link clicks inside. */
export function Popover({
  trigger,
  children,
  align = "end",
  className,
  label,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus-visible:ring-4 focus-visible:ring-majorelle-400/40 focus-visible:outline-none"
      >
        {trigger}
      </button>
      <div
        role="menu"
        onClick={(e) => (e.target as HTMLElement).closest("a") && close()}
        className={cn(
          "glass-menu absolute top-full z-50 mt-2 min-w-56 origin-top rounded-2xl p-2 transition-all duration-300 ease-[var(--ease-liquid)]",
          align === "end" ? "end-0" : "start-0",
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0",
          className,
        )}
      >
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
}

export function MenuItem({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm text-white/85 transition hover:bg-white/10 hover:text-white", className)}
      {...props}
    />
  );
}
