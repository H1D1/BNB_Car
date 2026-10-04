"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Floating } from "./Floating";

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
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
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
    <div className="relative">
      <button
        ref={anchor}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus-visible:ring-4 focus-visible:ring-majorelle-400/40 focus-visible:outline-none"
      >
        {trigger}
      </button>
      <Floating
        ref={panel}
        anchor={anchor}
        open={open}
        align={align}
        offset={12}
        role="menu"
        onClick={(e) => (e.target as HTMLElement).closest("a") && close()}
        className={cn("min-w-56 rounded-2xl p-2 animate-fade-up", className)}
        style={{ animationDuration: "0.3s" }}
      >
        {typeof children === "function" ? children(close) : children}
      </Floating>
    </div>
  );
}

export function MenuItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm text-white/85 transition hover:bg-white/10 hover:text-white", className)}
      {...props}
    />
  );
}
