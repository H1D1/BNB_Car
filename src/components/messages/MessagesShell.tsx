"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

/** Two panes on desktop; on mobile either the list or the open thread. */
export function MessagesShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const open = useSelectedLayoutSegment() != null;
  return (
    <div className="grid h-[calc(100dvh-7.5rem)] min-h-[520px] gap-4 md:grid-cols-[340px_1fr]">
      <aside className={cn("glass min-h-0 flex-col overflow-hidden rounded-[var(--radius-glass)]", open ? "hidden md:flex" : "flex")}>{list}</aside>
      <section className={cn("min-h-0 min-w-0", open ? "flex flex-col" : "hidden md:flex md:flex-col")}>{children}</section>
    </div>
  );
}
