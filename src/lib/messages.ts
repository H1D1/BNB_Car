import "server-only";
import { createClient } from "./supabase/server";
import type { Message } from "./types";

type Person = { id: string; full_name: string; avatar_url: string | null };
type CarMini = { id: string; make: string; model: string; year: number; cover_url: string | null };

export type ConversationRow = {
  id: string;
  car_id: string;
  renter_id: string;
  host_id: string;
  booking_id: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  car: CarMini | null;
  renter: Person | null;
  host: Person | null;
};

export type ConversationListItem = ConversationRow & { other: Person | null; role: "renter" | "host"; unread: number };

const CONVERSATION_COLUMNS =
  "id, car_id, renter_id, host_id, booking_id, last_message_at, last_message_preview, " +
  "car:cars(id, make, model, year, cover_url), " +
  "renter:profiles!conversations_renter_id_fkey(id, full_name, avatar_url), " +
  "host:profiles!conversations_host_id_fkey(id, full_name, avatar_url)";

const withOther = (c: ConversationRow, uid: string) => {
  const role = c.renter_id === uid ? ("renter" as const) : ("host" as const);
  return { ...c, role, other: role === "renter" ? c.host : c.renter };
};

export async function getConversations(uid: string): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .or(`renter_id.eq.${uid},host_id.eq.${uid}`)
    .order("last_message_at", { ascending: false })
    .limit(100);
  const convs = (data ?? []) as unknown as ConversationRow[];
  const unread = new Map<string, number>();
  if (convs.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convs.map((c) => c.id))
      .is("read_at", null)
      .not("sender_id", "is", null)
      .neq("sender_id", uid)
      .limit(1000);
    for (const m of msgs ?? []) unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
  }
  return convs.map((c) => ({ ...withOther(c, uid), unread: unread.get(c.id) ?? 0 }));
}

export async function getConversation(id: string, uid: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null; // RLS: not a party
  const conv = withOther(data as unknown as ConversationRow, uid);
  const [{ data: msgs }, { data: contact }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, lang, translations, read_at, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    conv.other
      ? supabase.rpc("get_contact", { p_user: conv.other.id }).maybeSingle<{ phone: string | null; whatsapp: string | null }>()
      : Promise.resolve({ data: null }),
  ]);
  return {
    conversation: conv,
    messages: ((msgs ?? []) as Message[]).reverse(),
    whatsapp: contact?.whatsapp ?? contact?.phone ?? null,
  };
}
