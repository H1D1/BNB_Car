import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { Logo } from "./Logo";

export async function Footer() {
  const { t } = await getI18n();
  const cols = [
    {
      title: t("footer.explore"),
      links: [
        { href: "/search?place=casablanca", label: "Casablanca" },
        { href: "/search?place=marrakech", label: "Marrakech" },
        { href: "/search?place=tangier", label: "Tanger" },
        { href: "/search?place=rak", label: "Menara (RAK)" },
      ],
    },
    {
      title: t("footer.hosting"),
      links: [
        { href: "/host/cars/new", label: t("nav.becomeHost") },
        { href: "/host", label: t("nav.hostDashboard") },
      ],
    },
    {
      title: t("footer.support"),
      links: [
        { href: "/disputes", label: t("nav.disputes") },
        { href: "/account/verification", label: t("footer.trust") },
      ],
    },
  ];
  return (
    <footer className="no-print mt-24 px-3 pb-6 md:px-6">
      <div className="glass mx-auto grid max-w-7xl gap-10 rounded-[2rem] p-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:p-10">
        <div>
          <Logo label={t("common.appName")} />
          <p className="mt-4 max-w-xs text-sm text-white/55">{t("footer.about")}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-bold text-white/70">
            {["CMI", "VISA", "Mastercard", "WhatsApp"].map((b) => (
              <span key={b} className="glass-subtle rounded-lg px-2.5 py-1.5">
                {b}
              </span>
            ))}
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="label">{c.title}</h3>
            <ul className="mt-3 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/70 transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="border-t border-white/10 pt-6 text-xs text-white/40 md:col-span-4">{t("footer.rights", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
