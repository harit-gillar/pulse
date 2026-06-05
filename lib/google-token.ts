import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "@/lib/server-env";

// Persist the user's Google refresh token (captured at sign-in).
export async function storeRefreshToken(userId: string, refreshToken: string) {
  const admin = getSupabaseAdmin();
  if (!admin || !refreshToken) return;
  await admin
    .from("user_tokens")
    .upsert({ user_id: userId, provider_refresh_token: refreshToken, updated_at: new Date().toISOString() });
}

// Exchange the stored refresh token for a fresh Google access token.
// Returns null if we have no refresh token or OAuth isn't configured.
export async function getAccessToken(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;

  const { data } = await admin
    .from("user_tokens")
    .select("provider_refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  const refresh = data?.provider_refresh_token as string | undefined;
  if (!refresh) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}
