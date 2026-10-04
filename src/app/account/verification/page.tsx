import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, PartyPopper } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { VerificationCard, type LastDoc } from "@/components/account/VerificationCard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("verification.title") };
}

const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : undefined);

export default async function VerificationPage(props: PageProps<"/account/verification">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent("/account/verification" + (next ? `?next=${encodeURIComponent(next)}` : ""))}`);

  const supabase = await createClient();
  const [{ t }, { data: docs }] = await Promise.all([
    getI18n(),
    supabase
      .from("verification_documents")
      .select("doc_type, status, document_number, expires_on, rejection_reason, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const list = (docs ?? []) as LastDoc[];
  const lastId = list.find((d) => d.doc_type === "cin" || d.doc_type === "passport") ?? null;
  const lastLicense = list.find((d) => d.doc_type === "license_ma" || d.doc_type === "license_intl") ?? null;
  const done = profile.id_status === "verified" && profile.license_status === "verified";

  return (
    <>
      <PageHeader title={t("verification.title")} subtitle={t("verification.intro")} />
      {done && (
        <Alert tone="success" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <PartyPopper className="size-4" />
              {t("verification.done")}
            </span>
            {next && (
              <ButtonLink href={next} size="sm">
                {t("common.continue")}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </ButtonLink>
            )}
          </div>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <VerificationCard kind="identity" userId={profile.id} status={profile.id_status} lastDoc={lastId} />
        <VerificationCard kind="license" userId={profile.id} status={profile.license_status} lastDoc={lastLicense} />
      </div>
      <p className="mt-6 text-center text-xs text-white/45">{t("verification.providerNote")}</p>
    </>
  );
}
