"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IdCard, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function AccountNav() {
  const { t } = useI18n();
  const path = usePathname();
  const tabs = [
    { href: "/account", label: t("account.profileTab"), Icon: UserRound },
    { href: "/account/verification", label: t("account.verificationTab"), Icon: IdCard },
  ];
  return (
    <nav aria-label={t("account.title")} className="glass mb-8 inline-flex gap-1 rounded-full p-1">
      {tabs.map(({ href, label, Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
              active ? "bg-white/15 text-white shadow-inner" : "text-white/65 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
