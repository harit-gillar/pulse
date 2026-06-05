import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/server-env";

// Service-role client — bypasses RLS. Server-only. Used for the user_tokens
// table so refresh tokens are never reachable from the browser.
export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
