import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Subscribes to a Realtime channel *as the signed-in user*. Postgres-changes events are filtered
 * by RLS, so an anonymous socket silently receives nothing for private tables (messages,
 * bookings). We push the session's access token to the socket first, and keep it fresh.
 * Returns an unsubscribe function.
 */
export function subscribeAsUser(supabase: SupabaseClient, build: (client: SupabaseClient) => RealtimeChannel) {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) supabase.realtime.setAuth(session.access_token);
  });

  (async () => {
    const { data } = await supabase.auth.getSession();
    if (cancelled) return;
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    if (cancelled) return;
    channel = build(supabase).subscribe();
  })();

  return () => {
    cancelled = true;
    auth.subscription.unsubscribe();
    if (channel) supabase.removeChannel(channel);
  };
}
