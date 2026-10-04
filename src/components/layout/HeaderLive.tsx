"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeAsUser } from "@/lib/supabase/realtime";

/**
 * Keeps the header badges (unread messages, pending booking requests) live: listens to Supabase
 * Realtime and refreshes the server-rendered counts when something relevant changes. RLS limits
 * the events to this user's own conversations and bookings.
 */
export function HeaderLive({ userId }: { userId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // coalesce bursts (e.g. a system message + a booking update) into one refresh
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 500);
    };
    const unsubscribe = subscribeAsUser(supabase, (client) =>
      client
        .channel(`header-live:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          if ((payload.new as { sender_id: string | null }).sender_id !== userId) refresh();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `host_id=eq.${userId}` }, refresh),
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
      unsubscribe();
    };
  }, [userId, router]);

  return null;
}
