"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { tDyn } from "@/lib/i18n/config";
import { cn, formatRelative } from "@/lib/utils";
import { Avatar } from "../ui/primitives";

export type ConversationSummary = {
  id: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread: number;
  role: "renter" | "host";
  other: { id: string; full_name: string; avatar_url: string | null } | null;
  car: { make: string; model: string; year: number } | null;
};

export function ConversationList({ items }: { items: ConversationSummary[] }) {
  const { t, locale } = useI18n();
  const path = usePathname();

  return (
    <>
      <div className="border-b border-white/10 px-5 py-4">
        <h1 className="text-xl font-bold">{t("messages.title")}</h1>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/10 text-saffron-300">
            <MessagesSquare className="size-6" />
          </div>
          <p className="font-bold">{t("messages.empty")}</p>
          <p className="mt-1 text-sm text-white/55">{t("messages.emptyText")}</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map((c) => {
            const active = path === `/messages/${c.id}`;
            const preview = c.last_message_preview?.startsWith("booking:")
              ? tDyn(t, "messages.system", c.last_message_preview)
              : c.last_message_preview;
            const name = c.other?.full_name ?? "—";
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl p-3 transition",
                    active ? "bg-white/15" : "hover:bg-white/[0.07]",
                  )}
                >
                  <Avatar name={name} url={c.other?.avatar_url} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", c.unread ? "font-bold" : "font-semibold")}>{name}</span>
                      <span className="shrink-0 text-[11px] text-white/45">{formatRelative(c.last_message_at, locale)}</span>
                    </span>
                    {c.car && (
                      <span className="block truncate text-xs text-saffron-300/80">
                        {c.car.make} {c.car.model} · {c.role === "host" ? t("nav.hostMode") : t("nav.renterMode")}
                      </span>
                    )}
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-xs", c.unread ? "text-white" : "text-white/50")} dir="auto">
                        {preview ?? "…"}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-terracotta-500 px-1.5 text-[10px] leading-5 font-bold text-snow">
                          <span className="sr-only">{t("messages.unread")}</span>
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
