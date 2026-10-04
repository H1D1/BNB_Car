"use client";

import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Renders a floating panel in a portal on <body>, anchored to an element.
 *
 * Why a portal: `backdrop-filter` on an ancestor (header pill, search bar) becomes the
 * panel's "backdrop root", so a nested panel can't blur the page behind it — it ends up
 * see-through instead of frosted. Portalling keeps real liquid glass for menus.
 */
export const Floating = forwardRef<
  HTMLDivElement,
  {
    anchor: React.RefObject<HTMLElement | null>;
    open: boolean;
    align?: "start" | "end" | "center";
    offset?: number;
    matchWidth?: boolean;
    minWidth?: number;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
    role?: string;
    id?: string;
    "aria-label"?: string;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
  }
>(function Floating({ anchor, open, align = "start", offset = 8, matchWidth, minWidth, className, style, children, ...rest }, ref) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width?: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const place = () => {
      const a = anchor.current;
      const p = inner.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const rtl = document.documentElement.dir === "rtl";
      const width = matchWidth ? Math.max(r.width, minWidth ?? 0) : undefined;
      const pw = width ?? p?.offsetWidth ?? 0;
      const side = align === "center" ? "center" : (align === "start") !== rtl ? "left" : "right";
      let left = side === "left" ? r.left : side === "right" ? r.right - pw : r.left + r.width / 2 - pw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      setPos({ top: r.bottom + offset, left, width });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    place();
    // second pass once the panel has its real width
    raf = requestAnimationFrame(place);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [open, anchor, align, offset, matchWidth, minWidth]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      {...rest}
      className={cn("glass-menu fixed z-[100]", className)}
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: pos?.width,
        visibility: pos ? "visible" : "hidden",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
});
