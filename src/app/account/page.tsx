import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Car, ChevronRight, Crown, IdCard, Phone, ShieldCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { badgesOf, getPlaces } from "@/lib/data";
import { cn, placeName } from "@/lib/utils";
import type { TKey } from "@/lib/i18n/config";
import { Glass, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import { ProfileForm } from "@/components/account/ProfileForm";
import { ContactForm } from "@/components/account/ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("account.title") };
}

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");
  const supabase = await createClient();
  const [{ t, locale }, places, { data: contact }] = await Promise.all([
    getI18n(),
    getPlaces(),
    supabase.rpc("get_my_contact").maybeSingle<{ phone: string | null; whatsapp: string | null }>(),
  ]);
  const cities = places.filter((p) => p.kind === "city").map((p) => ({ slug: p.slug, name: placeName(p, locale) }));
  const badges = badgesOf(profile);

  const trust: { key: keyof typeof badges; Icon: typeof BadgeCheck; href: string }[] = [
    { key: "phoneVerified", Icon: Phone, href: "#contact" },
    { key: "idVerified", Icon: IdCard, href: "/account/verification" },
    { key: "licenseVerified", Icon: ShieldCheck, href: "/account/verification" },
    { key: "verifiedHost", Icon: Car, href: profile.is_host ? "/host" : "/host/cars/new" },
    { key: "superDriver", Icon: Crown, href: "/search" },
  ];

  return (
    <>
      <PageHeader
        title={t("account.title")}
        actions={
          <ButtonLink href={`/users/${profile.id}`} variant="secondary" size="sm">
            {t("nav.publicProfile")}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Glass className="p-6 md:p-8">
            <h2 className="mb-5 text-lg font-bold">{t("account.personal")}</h2>
            <div className="mb-6">
              <AvatarUpload userId={profile.id} name={profile.full_name} url={profile.avatar_url} />
            </div>
            <ProfileForm profile={profile} cities={cities} />
          </Glass>
          <Glass id="contact" className="scroll-mt-28 p-6 md:p-8">
            <h2 className="mb-2 text-lg font-bold">{t("account.contact")}</h2>
            <ContactForm phone={contact?.phone ?? null} whatsapp={contact?.whatsapp ?? null} verified={profile.phone_verified} />
          </Glass>
        </div>

        <aside>
          <Glass className="p-6 lg:sticky lg:top-24">
            <h2 className="mb-1 text-lg font-bold">{t("account.trust")}</h2>
            <p className="mb-4 text-sm text-white/55">{t("account.trustHint")}</p>
            <ul className="space-y-2">
              {trust.map(({ key, Icon, href }) => {
                const on = badges[key];
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 transition hover:bg-white/[0.08]",
                        on ? "border-mint-400/30 bg-mint-500/10" : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", on ? "bg-mint-500/20 text-mint-400" : "bg-white/10 text-white/50")}>
                        <Icon className="size-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{t(`badges.${key}`)}</span>
                        <span className="block text-xs text-white/50">
                          {on ? t("common.verified") : t(`account.badgeHints.${key}` as TKey)}
                        </span>
                      </span>
                      {on ? <BadgeCheck className="size-5 text-mint-400" /> : <ChevronRight className="size-4 text-white/40 rtl:rotate-180" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Glass>
        </aside>
      </div>
    </>
  );
}
