import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Logo } from "./Logo";
import { HeaderControls } from "./HeaderControls";
import { ButtonLink } from "../ui/Button";

async function getCounts(userId: string, isHost: boolean) {
  const supabase = await createClient();
  const [{ data: convs }, pending] = await Promise.all([
    supabase.from("conversations").select("id").or(`renter_id.eq.${userId},host_id.eq.${userId}`),
    isHost
      ? supabase.from("bookings").select("id", { count: "exact", head: true }).eq("host_id", userId).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);
  let unread = 0;
  if (convs?.length) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convs.map((c) => c.id))
      .is("read_at", null)
      .not("sender_id", "is", null)
      .neq("sender_id", userId);
    unread = count ?? 0;
  }
  return { unread, pending: pending.count ?? 0 };
}

export async function Header() {
  const { t } = await getI18n();
  const profile = await getProfile();
  const counts = profile ? await getCounts(profile.id, profile.is_host) : { unread: 0, pending: 0 };
  const hostMode = profile?.active_mode === "host";

  const links = hostMode
    ? [
        { href: "/host", label: t("nav.hostDashboard"), badge: counts.pending },
        { href: "/trips?view=host", label: t("nav.trips") },
        { href: "/messages", label: t("nav.messages"), badge: counts.unread },
      ]
    : [
        { href: "/search", label: t("nav.search") },
        ...(profile ? [{ href: "/trips", label: t("nav.trips") }, { href: "/messages", label: t("nav.messages"), badge: counts.unread }] : []),
      ];

  return (
    <header className="no-print sticky top-0 z-40 px-3 pt-3 md:px-6">
      <div className="glass-strong mx-auto flex h-16 max-w-7xl items-center gap-4 rounded-full ps-3 pe-2 md:ps-4">
        <Logo label={t("common.appName")} />
        <nav className="ms-6 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative rounded-full px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              {l.label}
              {!!l.badge && (
                <span className="absolute -top-0.5 end-1 grid min-w-4.5 place-items-center rounded-full bg-terracotta-500 px-1 text-[10px] leading-4.5 text-snow">
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          {!profile && (
            <ButtonLink href="/host/cars/new" variant="ghost" size="sm" className="hidden md:inline-flex">
              {t("nav.becomeHost")}
            </ButtonLink>
          )}
          <HeaderControls
            profile={profile ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, active_mode: profile.active_mode, is_host: profile.is_host } : null}
            links={links}
            counts={counts}
          />
        </div>
      </div>
    </header>
  );
}
