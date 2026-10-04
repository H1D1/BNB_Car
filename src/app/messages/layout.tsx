import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getConversations } from "@/lib/messages";
import { MessagesShell } from "@/components/messages/MessagesShell";
import { ConversationList } from "@/components/messages/ConversationList";

export default async function MessagesLayout({ children }: LayoutProps<"/messages">) {
  const user = await getUser();
  if (!user) redirect("/login?next=/messages");
  const conversations = await getConversations(user.id);
  const items = conversations.map((c) => ({
    id: c.id,
    last_message_at: c.last_message_at,
    last_message_preview: c.last_message_preview,
    unread: c.unread,
    role: c.role,
    other: c.other,
    car: c.car ? { make: c.car.make, model: c.car.model, year: c.car.year } : null,
  }));
  return (
    <div className="mx-auto max-w-7xl px-3 pt-4 pb-4 md:px-6">
      <MessagesShell list={<ConversationList items={items} />}>{children}</MessagesShell>
    </div>
  );
}
