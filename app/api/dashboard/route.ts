import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchTodayDashboard, rawProbe } from "@/lib/google-health";
import { getAccessToken } from "@/lib/google-token";
import type { DashboardData } from "@/lib/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const debug = params.has("debug");
  const refresh = params.has("refresh");
  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 501 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const userId = session.user.id;
  // Prefer a fresh access token minted from the stored refresh token; fall back
  // to the session's provider_token (valid right after login).
  const refreshed = await getAccessToken(userId);
  const freshToken = refreshed ?? (session as { provider_token?: string }).provider_token ?? null;

  // Debug: dump raw Google Health responses so we can calibrate the parser.
  if (debug) {
    return NextResponse.json({
      hasProviderToken: Boolean(freshToken),
      tokenSource: refreshed ? "refresh-token" : "session",
      probe: freshToken ? await rawProbe(freshToken) : "no token available",
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Historical: read a specific past day's real snapshot from the DB only.
  // We never fabricate — if there's no saved snapshot, return 404.
  const requestedDate = params.get("date");
  if (requestedDate && requestedDate !== today) {
    const past = await supabase
      .from("daily_snapshots")
      .select("data")
      .eq("user_id", userId)
      .eq("date", requestedDate)
      .maybeSingle();
    if (past.data) {
      return NextResponse.json(past.data.data as DashboardData, { headers: { "cache-hit": "true" } });
    }
    return NextResponse.json({ error: "no snapshot for date" }, { status: 404 });
  }

  // Cache hit? (skip when ?refresh=1)
  if (!refresh) {
    const cached = await supabase
      .from("daily_snapshots")
      .select("data, fetched_at")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (cached.data) {
      return NextResponse.json(cached.data.data as DashboardData, {
        headers: { "cache-hit": "true" },
      });
    }
  }

  if (!freshToken) {
    return NextResponse.json(
      { error: "no access token — re-auth with Google" },
      { status: 401 },
    );
  }

  let dashboard: DashboardData;
  try {
    dashboard = await fetchTodayDashboard(freshToken);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }

  // Only cache if it actually has data — avoids persisting an empty result
  // (e.g. from an expired provider token).
  const looksEmpty =
    dashboard.sleep.durationHours === 0 &&
    dashboard.activity.steps === 0 &&
    dashboard.body.weightKg === null &&
    dashboard.recovery.restingHr === 0;

  if (!looksEmpty) {
    await supabase.from("daily_snapshots").upsert({
      user_id: userId,
      date: today,
      data: dashboard,
      fetched_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(dashboard, {
    headers: { "cache-hit": "false", "looks-empty": String(looksEmpty) },
  });
}
