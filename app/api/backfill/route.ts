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
  const params = new URL(request.url).searchParams;
  const days = Math.min(90, Math.max(1, Number(params.get("days")) || 30));

  // `to` = exclusive end of the window (default today). Lets the client walk
  // backwards in 90-day chunks for a deep history sync.
  const toParam = params.get("to");
  const end = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)
    ? new Date(toParam + "T00:00:00")
    : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const start = new Date(end); start.setDate(start.getDate() - days);

  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const token = (await getAccessToken(session.user.id)) ?? (session as { provider_token?: string }).provider_token;
  if (!token) return NextResponse.json({ error: "no access token — re-auth" }, { status: 401 });

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  let history: Awaited<ReturnType<typeof fetchHistory>>;
  try {
    history = await fetchHistory(token, start, end);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "backfill failed" }, { status: 502 });
  }

  if (history.length === 0) {
    return NextResponse.json({ saved: 0, window: { from: fmt(start), to: fmt(end) }, note: "no data in window" });
  }

  const rows = history.map((h) => ({
    user_id: session.user.id,
    date: h.date,
    data: h.data,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("daily_snapshots").upsert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    saved: rows.length,
    from: history[0].date,
    to: history[history.length - 1].date,
    window: { from: fmt(start), to: fmt(end) },
  });
}
