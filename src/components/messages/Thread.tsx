"use client";

import Image from "@/components/ui/SmartImage";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CalendarCheck, Languages, Loader2, MessageCircle, RotateCcw, SendHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { tDyn } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { translateMessage } from "@/app/actions/messages";
import { cn, formatDate, whatsappLink } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { Avatar } from "../ui/primitives";
import { ButtonLink } from "../ui/Button";

type Person = { id: string; full_name: string; avatar_url: string | null };
type UiMessage = Message & { pending?: boolean; failed?: boolean };
type Translation = { loading?: boolean; text?: string; off?: boolean; showOriginal?: boolean };

const QUICK = ["hello", "where", "eta", "docs", "thanks"] as const;

export function Thread({
  conversationId,
  me,
  other,
  car,
  carId,
  bookingId,
  role,
  whatsapp,
  initialMessages,
}: {
  conversationId: string;
  me: string;
  other: Person | null;
  car: { id: string; make: string; model: string; year: number; cover_url: string | null } | null;
  carId: string;
  bookingId: string | null;
  role: "renter" | "host";
  whatsapp: string | null;
  initialMessages: Message[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [, startTranslate] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [supabase] = useState(createClient);

  const markRead = useCallback(async () => {
    await supabase.rpc("mark_conversation_read", { p_conv: conversationId });
  }, [supabase, conversationId]);

  // mark as read on open (refresh so the header badge / list dot update)
  useEffect(() => {
    const hadUnread = initialMessages.some((m) => m.sender_id && m.sender_id !== me && !m.read_at);
    if (hadUnread) markRead().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [conversationId]);

  // realtime: new messages in this conversation
  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((list) => (list.some((m) => m.id === msg.id) ? list.map((m) => (m.id === msg.id ? msg : m)) : [...list, msg]));
          if (msg.sender_id !== me) {
            if (document.visibilityState === "visible") markRead();
            router.refresh();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, me, markRead, router]);

  // auto-scroll to the newest message
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  const send = async (body: string, retryId?: string) => {
    const text = body.trim().slice(0, 4000);
    if (!text) return;
    const id = retryId ?? crypto.randomUUID();
    const optimistic: UiMessage = {
      id,
      conversation_id: conversationId,
      sender_id: me,
      body: text,
      lang: locale,
      translations: {},
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((list) => (retryId ? list.map((m) => (m.id === id ? optimistic : m)) : [...list, optimistic]));
    if (!retryId) setDraft("");
    // client-generated id → the realtime echo is de-duplicated
    const { data, error } = await supabase
      .from("messages")
      .insert({ id, conversation_id: conversationId, sender_id: me, body: text, lang: locale })
      .select("id, conversation_id, sender_id, body, lang, translations, read_at, created_at")
      .single();
    setMessages((list) => list.map((m) => (m.id === id ? (error ? { ...m, pending: false, failed: true } : (data as Message)) : m)));
    if (!error) router.refresh();
  };

  const translate = (m: Message) => {
    const cur = translations[m.id];
    if (cur?.text) {
      setTranslations((s) => ({ ...s, [m.id]: { ...cur, showOriginal: !cur.showOriginal } }));
      return;
    }
    setTranslations((s) => ({ ...s, [m.id]: { loading: true } }));
    startTranslate(async () => {
      const res = await translateMessage(m.id, locale);
      setTranslations((s) => ({ ...s, [m.id]: res.text ? { text: res.text } : { off: true } }));
    });
  };

  const name = other?.full_name ?? "—";
  const carLabel = car ? `${car.make} ${car.model}` : "";
  const waText = t("messages.whatsappPrefill", { name: name.split(" ")[0], car: carLabel });

  return (
    <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-glass)]">
      {/* header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link href="/messages" className="grid size-9 place-items-center rounded-full hover:bg-white/10 md:hidden" aria-label={t("common.back")}>
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        {other ? (
          <Link href={`/users/${other.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar name={name} url={other.avatar_url} size={40} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{name}</span>
              <span className="block text-xs text-white/50">{role === "renter" ? t("nav.hostMode") : t("nav.renterMode")}</span>
            </span>
          </Link>
        ) : (
          <span className="font-bold">{name}</span>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {car && (
            <Link href={`/cars/${carId}`} className="glass-subtle flex items-center gap-2 rounded-full py-1 ps-1 pe-3 text-xs font-semibold hover:bg-white/10">
              {car.cover_url ? (
                <Image src={car.cover_url} alt={carLabel} width={28} height={28} className="size-7 rounded-full object-cover" />
              ) : null}
              <span className="max-w-40 truncate">{t("messages.aboutCar", { car: carLabel })}</span>
            </Link>
          )}
          {bookingId && (
            <ButtonLink href={`/trips/${bookingId}`} variant="secondary" size="sm">
              <CalendarCheck className="size-4" />
              {t("messages.viewTrip")}
            </ButtonLink>
          )}
          {whatsapp && (
            <ButtonLink href={whatsappLink(whatsapp, waText)} variant="success" size="sm">
              <MessageCircle className="size-4" />
              <span className="hidden sm:inline">{t("messages.whatsappJump")}</span>
            </ButtonLink>
          )}
        </div>
      </header>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-6" aria-live="polite">
        {messages.map((m, i) => {
          const day = formatDate(m.created_at, locale, { dateStyle: "medium" });
          const showDay = i === 0 || formatDate(messages[i - 1].created_at, locale, { dateStyle: "medium" }) !== day;
          const time = formatDate(m.created_at, locale, { timeStyle: "short" });
          const dayEl = showDay && (
            <div className="flex justify-center py-2">
              <span className="text-[11px] font-semibold tracking-wide text-white/40 uppercase">{day}</span>
            </div>
          );

          if (!m.sender_id) {
            return (
              <div key={m.id}>
                {dayEl}
                <div className="flex justify-center">
                  <span className="rounded-full border border-saffron-400/25 bg-saffron-500/10 px-3 py-1 text-xs text-saffron-200">
                    {tDyn(t, "messages.system", m.body)} · {time}
                  </span>
                </div>
              </div>
            );
          }

          const mine = m.sender_id === me;
          const tr = translations[m.id];
          const shown = tr?.text && !tr.showOriginal ? tr.text : m.body;
          return (
            <div key={m.id}>
              {dayEl}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] md:max-w-[65%]", mine ? "items-end" : "items-start", "flex flex-col")}>
                  <div
                    dir="auto"
                    className={cn(
                      "rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap",
                      mine
                        ? "rounded-ee-md bg-gradient-to-br from-majorelle-400 to-majorelle-600 text-snow"
                        : "rounded-es-md border border-white/10 bg-white/10 text-white",
                      m.pending && "opacity-70",
                      m.failed && "border border-rose-400/60",
                    )}
                  >
                    {shown}
                  </div>
                  <div className="mt-1 flex items-center gap-2 px-2 text-[11px] text-white/40">
                    <span>{time}</span>
                    {m.pending && <Loader2 className="size-3 animate-spin" />}
                    {m.failed && (
                      <button type="button" onClick={() => send(m.body, m.id)} className="flex items-center gap-1 text-rose-300 hover:underline">
                        <AlertCircle className="size-3" />
                        {t("messages.failed")}
                        <RotateCcw className="size-3" />
                      </button>
                    )}
                    {!mine && (
                      <button type="button" onClick={() => translate(m)} className="flex items-center gap-1 hover:text-white/80" disabled={tr?.loading}>
                        {tr?.loading ? <Loader2 className="size-3 animate-spin" /> : <Languages className="size-3" />}
                        {tr?.loading ? t("messages.translating") : tr?.text && !tr.showOriginal ? t("messages.original") : t("messages.translate")}
                      </button>
                    )}
                  </div>
                  {tr?.off && <p className="mt-0.5 max-w-xs px-2 text-[11px] text-saffron-300/80">{t("messages.translationOff")}</p>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* composer */}
      <div className="border-t border-white/10 p-3">
        <div className="scrollbar-none mb-2 flex gap-2 overflow-x-auto" aria-label={t("messages.quick")}>
          {QUICK.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setDraft(t(`messages.quickReplies.${k}`));
                input.current?.focus();
              }}
              className="glass-subtle shrink-0 rounded-full px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/15 hover:text-white"
            >
              {t(`messages.quickReplies.${k}`)}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            maxLength={4000}
            dir="auto"
            placeholder={t("messages.placeholder")}
            aria-label={t("messages.placeholder")}
            className="field max-h-36 min-h-11 flex-1 resize-none py-2.5"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label={t("common.send")}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-majorelle-400 to-majorelle-600 text-snow transition hover:-translate-y-0.5 disabled:opacity-40"
          >
            <SendHorizontal className="size-5 rtl:rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
}
