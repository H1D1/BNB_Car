"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Car,
  ChevronDown,
  Globe,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Scale,
  ShieldCheck,
  User,
  X,
  CalendarDays,
  Search,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { CURRENCIES } from "@/lib/currency";
import { setCurrency, setLocale, setMode } from "@/app/actions/preferences";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/primitives";
import { MenuItem, Popover } from "../ui/Popover";
import { ButtonLink } from "../ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import type { UserMode } from "@/lib/types";

type MiniProfile = { id: string; full_name: string; avatar_url: string | null; active_mode: UserMode; is_host: boolean };

export function HeaderControls({
  profile,
  links,
  counts,
}: {
  profile: MiniProfile | null;
  links: { href: string; label: string; badge?: number }[];
  counts: { unread: number; pending: number };
}) {
  const { t, locale, currency } = useI18n();
  const [pending, start] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  const prefs = (
    <div className="space-y-3 p-1">
      <div>
        <p className="label px-2">{t("nav.language")}</p>
        <div className="grid grid-cols-3 gap-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => start(() => setLocale(l))}
              className={cn(
                "rounded-xl px-2 py-2 text-sm font-semibold transition",
                l === locale ? "bg-majorelle-500 text-snow" : "text-white/70 hover:bg-white/10",
              )}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label px-2">{t("nav.currency")}</p>
        <div className="grid grid-cols-4 gap-1">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => start(() => setCurrency(c))}
              className={cn(
                "rounded-xl px-2 py-2 text-sm font-semibold transition",
                c === currency ? "bg-terracotta-500 text-snow" : "text-white/70 hover:bg-white/10",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const modeSwitch = profile && (
    <div className="glass-subtle flex rounded-full p-1 text-sm font-semibold" role="group" aria-label="mode">
      {(["renter", "host"] as const).map((m) => (
        <button
          key={m}
          disabled={pending}
          onClick={() => m !== profile.active_mode && start(() => setMode(m))}
          className={cn(
            "rounded-full px-3.5 py-1.5 transition-all duration-300",
            profile.active_mode === m ? "bg-snow text-ink-900 shadow" : "text-white/70 hover:text-white",
          )}
        >
          {m === "renter" ? t("nav.renterMode") : t("nav.hostMode")}
        </button>
      ))}
    </div>
  );

  const accountLinks = profile
    ? [
        ...(profile.active_mode === "host"
          ? [
              { href: "/host", label: t("nav.hostDashboard"), icon: LayoutDashboard },
              { href: "/host/cars/new", label: t("host.addCar"), icon: Car },
            ]
          : [
              { href: "/trips", label: t("nav.trips"), icon: CalendarDays },
              { href: "/favorites", label: t("nav.favorites"), icon: Heart },
            ]),
        { href: "/messages", label: t("nav.messages"), icon: MessageCircle },
        { href: "/account", label: t("nav.account"), icon: User },
        { href: "/account/verification", label: t("nav.verification"), icon: ShieldCheck },
        { href: "/disputes", label: t("nav.disputes"), icon: Scale },
        { href: `/users/${profile.id}`, label: t("nav.publicProfile"), icon: User },
      ]
    : [];

  return (
    <>
      <div className="hidden md:block">{modeSwitch}</div>

      <ThemeToggle />

      <Popover
        label={t("nav.language")}
        trigger={
          <span className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white/80 transition hover:bg-white/10">
            <Globe className="size-4" />
            <span className="uppercase">{locale}</span>
            <span className="text-white/40">·</span>
            <span>{currency}</span>
          </span>
        }
        className="w-72"
      >
        {prefs}
      </Popover>

      {profile ? (
        <div className="hidden md:block">
          <Popover
            label={t("nav.account")}
            trigger={
              <span className="flex items-center gap-1.5 rounded-full p-1 pe-2 transition hover:bg-white/10">
                <Avatar name={profile.full_name} url={profile.avatar_url} size={34} />
                <ChevronDown className="size-4 text-white/60" />
              </span>
            }
          >
            <div className="px-3 pt-2 pb-3">
              <p className="font-semibold">{profile.full_name}</p>
            </div>
            {accountLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href + label} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/85 transition hover:bg-white/10">
                <Icon className="size-4 text-white/50" />
                {label}
                {href === "/messages" && counts.unread > 0 && (
                  <span className="ms-auto rounded-full bg-terracotta-500 px-1.5 text-[11px] text-snow">{counts.unread}</span>
                )}
              </Link>
            ))}
            <div className="my-1 h-px bg-white/10" />
            <form action="/auth/logout" method="post">
              <MenuItem type="submit">
                <LogOut className="size-4 text-white/50" />
                {t("nav.logout")}
              </MenuItem>
            </form>
          </Popover>
        </div>
      ) : (
        <div className="hidden items-center gap-1 md:flex">
          <ButtonLink href="/login" variant="ghost" size="sm">
            {t("nav.login")}
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            {t("nav.signup")}
          </ButtonLink>
        </div>
      )}

      <button
        className="grid size-10 place-items-center rounded-full hover:bg-white/10 md:hidden"
        aria-label={t("nav.menu")}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile sheet */}
      <div
        className={cn("fixed inset-0 z-50 transition md:hidden", mobileOpen ? "visible" : "invisible")}
        onClick={(e) => (e.target as HTMLElement).closest("a") && setMobileOpen(false)}
      >
        <div
          className={cn("absolute inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "glass-menu absolute inset-y-3 end-3 flex w-[min(88vw,22rem)] flex-col gap-2 overflow-y-auto rounded-3xl p-4 transition-transform duration-500 ease-[var(--ease-liquid)]",
            mobileOpen ? "translate-x-0" : "translate-x-[110%] rtl:-translate-x-[110%]",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            {profile ? (
              <span className="flex items-center gap-3">
                <Avatar name={profile.full_name} url={profile.avatar_url} size={40} />
                <span className="font-semibold">{profile.full_name}</span>
              </span>
            ) : (
              <span />
            )}
            <button className="grid size-10 place-items-center rounded-full hover:bg-white/10" onClick={() => setMobileOpen(false)} aria-label={t("common.close")}>
              <X className="size-5" />
            </button>
          </div>
          {modeSwitch && <div className="mb-2">{modeSwitch}</div>}
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center justify-between rounded-xl px-3 py-3 font-semibold hover:bg-white/10">
              <span className="flex items-center gap-3">
                {l.href === "/search" && <Search className="size-4 text-white/50" />}
                {l.label}
              </span>
              {!!l.badge && <span className="rounded-full bg-terracotta-500 px-2 text-xs text-snow">{l.badge}</span>}
            </Link>
          ))}
          {accountLinks
            .filter((a) => !links.some((l) => l.href === a.href))
            .map(({ href, label, icon: Icon }) => (
              <Link key={href + label} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-white/85 hover:bg-white/10">
                <Icon className="size-4 text-white/50" />
                {label}
              </Link>
            ))}
          <div className="my-2 h-px bg-white/10" />
          {prefs}
          <div className="mt-auto pt-4">
            {profile ? (
              <form action="/auth/logout" method="post">
                <MenuItem type="submit">
                  <LogOut className="size-4" />
                  {t("nav.logout")}
                </MenuItem>
              </form>
            ) : (
              <div className="grid gap-2">
                <ButtonLink href="/signup">{t("nav.signup")}</ButtonLink>
                <ButtonLink href="/login" variant="secondary">
                  {t("nav.login")}
                </ButtonLink>
                <ButtonLink href="/host/cars/new" variant="ghost">
                  {t("nav.becomeHost")}
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
