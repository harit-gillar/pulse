import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { storeRefreshToken } from "@/lib/google-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await getSupabaseServer();
    if (supabase) {
      const { data } = await supabase.auth.exchangeCodeForSession(code);
      // Persist the Google refresh token so we can keep fetching after the
      // 1-hour access token expires (no re-login required).
      const rt = (data.session as { provider_refresh_token?: string } | null)?.provider_refresh_token;
      if (rt && data.session) await storeRefreshToken(data.session.user.id, rt);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
