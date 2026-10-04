import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses RLS — only use in server actions after checking authorisation. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
