import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("messages.title") };
}

export default async function MessagesPage(props: PageProps<"/messages">) {
  const sp = await props.searchParams;
  const booking = typeof sp.booking === "string" && /^[0-9a-f-]{36}$/i.test(sp.booking) ? sp.booking : null;
  if (booking) {
    const user = await getUser();
    const supabase = await createClient();
    // RLS: only booking parties can read the booking / conversation
    const { data: b } = await supabase.from("bookings").select("car_id, renter_id").eq("id", booking).maybeSingle();
    if (b && user) {
      const { data: conv } = await supabase.from("conversations").select("id").eq("car_id", b.car_id).eq("renter_id", b.renter_id).maybeSingle();
      if (conv) redirect(`/messages/${conv.id}`);
    }
  }

  const { t } = await getI18n();
  return (
    <div className="glass flex flex-1 flex-col items-center justify-center rounded-[var(--radius-glass)] p-8 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-white/10 text-saffron-300">
        <MessagesSquare className="size-7" />
      </div>
      <p className="text-lg font-bold">{t("messages.select")}</p>
      <p className="mt-1 max-w-sm text-sm text-white/55">{t("messages.emptyText")}</p>
    </div>
  );
}
