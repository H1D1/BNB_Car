import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, LifeBuoy, Plus } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { DISPUTE_TONE } from "@/lib/trips";
import { formatMAD } from "@/lib/currency";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import type { Dispute } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("disputes.title") };
}

type Row = Pick<Dispute, "id" | "booking_id" | "opened_by" | "against_id" | "type" | "status" | "amount_claimed_mad" | "created_at" | "updated_at"> & {
  booking: { reference: string } | null;
};

export default async function DisputesPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/disputes");
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const { data } = await supabase
    .from("disputes")
    .select("id, booking_id, opened_by, against_id, type, status, amount_claimed_mad, created_at, updated_at, booking:bookings(reference)")
    .or(`opened_by.eq.${user.id},against_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  const ids = [...new Set(rows.flatMap((d) => [d.opened_by, d.against_id]))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <PageHeader
        title={t("disputes.title")}
        subtitle={t("disputes.intro")}
        actions={
          <ButtonLink href="/disputes/new" variant="accent" size="sm">
            <Plus className="size-4" />
            {t("disputes.new")}
          </ButtonLink>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="size-7" />} title={t("disputes.empty")} />
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => {
            const mine = d.opened_by === user.id;
            return (
              <li key={d.id}>
                <Link href={`/disputes/${d.id}`} className="glass liquid flex items-center gap-4 rounded-[var(--radius-glass)] p-4 animate-fade-up">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{t(`disputes.type.${d.type}`)}</h2>
                      <Badge tone={DISPUTE_TONE[d.status]}>{t(`disputes.status.${d.status}`)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-white/60">
                      {mine ? t("disputes.against", { name: names.get(d.against_id) ?? "" }) : t("disputes.openedBy", { name: names.get(d.opened_by) ?? "" })}
                      {d.booking?.reference && (
                        <>
                          {" · "}
                          <span dir="ltr">{d.booking.reference}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {t("disputes.opened", { date: formatDate(d.created_at, locale) })}
                      {d.amount_claimed_mad != null && ` · ${t("disputes.claimed", { amount: formatMAD(Number(d.amount_claimed_mad), locale) })}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-white/40 rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
