import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getUser } from "@/lib/supabase/server";
import { getConversation } from "@/lib/messages";
import { Thread } from "@/components/messages/Thread";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("messages.title") };
}

export default async function ConversationPage(props: PageProps<"/messages/[id]">) {
  const { id } = await props.params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/messages/${id}`);
  const data = await getConversation(id, user.id);
  if (!data) notFound();
  const { conversation: c, messages, whatsapp } = data;

  return (
    <Thread
      key={c.id}
      conversationId={c.id}
      me={user.id}
      other={c.other}
      car={c.car ? { id: c.car.id, make: c.car.make, model: c.car.model, year: c.car.year, cover_url: c.car.cover_url } : null}
      carId={c.car_id}
      bookingId={c.booking_id}
      role={c.role}
      whatsapp={whatsapp}
      initialMessages={messages}
    />
  );
}
