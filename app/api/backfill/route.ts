import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchHistory } from "@/lib/google-health";
import { getAccessToken } from "@/lib/google-token";

// POST or GET /api/backfill?days=30 — pulls the last N days from Google Health and
// upserts one snapshot per day into daily_snapshots. Idempotent (upsert).
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const token = (await getAccessToken(session.user.id)) ?? (session as { provider_token?: string }).provider_token;
  if (!token) return NextResponse.json({ error: "no access token — re-auth" }, { status: 401 });

  let history: Awaited<ReturnType<typeof fetchHistory>>;
  try {
    history = await fetchHistory(token, days);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "backfill failed" }, { status: 502 });
  }

  if (history.length === 0) {
    return NextResponse.json({ saved: 0, note: "no historical data returned" });
  }

  const rows = history.map((h) => ({
    user_id: session.user.id,
    date: h.date,
    data: h.data,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("daily_snapshots").upsert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: rows.length, from: history[0].date, to: history[history.length - 1].date });
}
