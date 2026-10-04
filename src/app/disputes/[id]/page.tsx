import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, FileText, LifeBuoy } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { DISPUTE_TONE, isUuid } from "@/lib/trips";
import { formatMAD } from "@/lib/currency";
import { cn, formatDateTime } from "@/lib/utils";
import { Alert, Avatar, Badge, Glass } from "@/components/ui/primitives";
import { ReplyForm } from "@/components/disputes/ReplyForm";
import type { Dispute } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("disputes.title") };
}

type Msg = { id: string; sender_id: string | null; body: string; created_at: string };

export default async function DisputePage(props: PageProps<"/disputes/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const user = await getUser();
  if (!user) redirect(`/login?next=/disputes/${id}`);
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const { data } = await supabase
    .from("disputes")
    .select("*, booking:bookings(id, reference)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const d = data as Dispute & { booking: { id: string; reference: string } | null };

  const [{ data: msgs }, { data: people }, evidence] = await Promise.all([
    supabase.from("dispute_messages").select("id, sender_id, body, created_at").eq("dispute_id", d.id).order("created_at"),
    supabase.from("profiles").select("id, full_name, avatar_url").in("id", [d.opened_by, d.against_id]),
    d.evidence_paths.length
      ? supabase.storage.from("dispute-evidence").createSignedUrls(d.evidence_paths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string | null }[] }),
  ]);
  const messages = (msgs ?? []) as Msg[];
  const byId = new Map((people ?? []).map((p) => [p.id as string, p as { id: string; full_name: string; avatar_url: string | null }]));
  const files = (evidence.data ?? []).flatMap((e) => (e.signedUrl ? [{ path: e.path ?? e.signedUrl, signedUrl: e.signedUrl }] : []));
  const open = d.status === "open" || d.status === "under_review";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <Link href="/disputes" className="mb-4 inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
        <ChevronRight className="size-4 rotate-180 rtl:rotate-0" />
        {t("disputes.title")}
      </Link>

      <Glass strong className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{t(`disputes.type.${d.type}`)}</h1>
            <p className="mt-1 text-sm text-white/60">
              {t("disputes.openedBy", { name: byId.get(d.opened_by)?.full_name ?? "" })} ·{" "}
              {t("disputes.against", { name: byId.get(d.against_id)?.full_name ?? "" })}
            </p>
            <p className="mt-1 text-xs text-white/45">{t("disputes.opened", { date: formatDateTime(d.created_at, locale) })}</p>
          </div>
          <Badge tone={DISPUTE_TONE[d.status]} className="text-sm">
            {t(`disputes.status.${d.status}`)}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {d.booking && (
            <div>
              <p className="label">{t("disputes.booking")}</p>
              <Link href={`/trips/${d.booking.id}`} className="font-semibold text-saffron-300 hover:underline" dir="ltr">
                {d.booking.reference}
              </Link>
            </div>
          )}
          {d.amount_claimed_mad != null && (
            <div>
              <p className="label">{t("disputes.amount")}</p>
              <p className="font-semibold">{formatMAD(Number(d.amount_claimed_mad), locale)}</p>
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="label">{t("disputes.description")}</p>
          <p className="text-sm whitespace-pre-line text-white/85" dir="auto">
            {d.description}
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-5">
            <p className="label">{t("disputes.evidence")}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {files.map((f) =>
                f.path.toLowerCase().endsWith(".pdf") ? (
                  <a
                    key={f.path}
                    href={f.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-subtle flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-xs"
                  >
                    <FileText className="size-6" />
                    PDF
                  </a>
                ) : (
                  <a key={f.path} href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket */}
                    <img src={f.signedUrl} alt={t("disputes.evidence")} className="size-full object-cover" loading="lazy" />
                  </a>
                ),
              )}
            </div>
          </div>
        )}

        {(d.resolution || d.resolved_amount_mad != null) && (
          <Alert tone={d.status === "resolved" ? "success" : "info"} className="mt-5">
            <strong className="block">{t("disputes.resolution")}</strong>
            {d.resolution && (
              <span className="whitespace-pre-line" dir="auto">
                {d.resolution}
              </span>
            )}
            {d.resolved_amount_mad != null && <span className="block font-semibold">{formatMAD(Number(d.resolved_amount_mad), locale)}</span>}
          </Alert>
        )}
      </Glass>

      <Glass className="mt-6 p-5 md:p-6">
        <h2 className="mb-4 text-lg font-bold">{t("disputes.thread")}</h2>
        <ol className="space-y-4">
          {messages.map((m) => {
            const mine = m.sender_id === user.id;
            const sender = m.sender_id ? byId.get(m.sender_id) : null;
            return (
              <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                {m.sender_id ? (
                  <Avatar name={sender?.full_name ?? "?"} url={sender?.avatar_url} size={36} />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-saffron-300 to-terracotta-400 text-ink-950">
                    <LifeBuoy className="size-5" />
                  </span>
                )}
                <div className={cn("max-w-[80%] rounded-2xl px-4 py-3", mine ? "bg-majorelle-500/30" : m.sender_id ? "glass-subtle" : "border border-saffron-400/30 bg-saffron-500/10")}>
                  <p className="text-xs font-semibold text-white/70">
                    {m.sender_id ? (mine ? t("messages.you") : (sender?.full_name ?? "")) : t("disputes.support")}
                    <span className="ms-2 font-normal text-white/40">{formatDateTime(m.created_at, locale)}</span>
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line" dir="auto">
                    {m.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 border-t border-white/10 pt-5">{open ? <ReplyForm disputeId={d.id} /> : <p className="text-sm text-white/55">{t("disputes.closed")}</p>}</div>
      </Glass>
    </div>
  );
}
