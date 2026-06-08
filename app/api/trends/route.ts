import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { buildSeries } from "@/lib/trends";
import { computeInsights } from "@/lib/insights";
import type { DashboardData, Snap } from "@/lib/types";

// Projects the user's daily_snapshots into chartable time-series + computed
// insights. Optional ?from=YYYY-MM-DD limits the window to that start onward.
// Mirrors the auth/query shape of app/api/stats/route.ts.
export async function GET(request: Request) {
  const from = new URL(request.url).searchParams.get("from");
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ hasData: false });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ hasData: false });

  let query = supabase
    .from("daily_snapshots")
    .select("date, data")
    .eq("user_id", session.user.id)
    .order("date", { ascending: true });
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("date", from);

  const { data: rows } = await query;

  const snaps: Snap[] = (rows ?? []).map((r) => ({ date: r.date as string, d: r.data as DashboardData }));
  if (snaps.length === 0) return NextResponse.json({ hasData: false, earliestAvailable: from ?? null });

  const series = buildSeries(snaps);
  const insights = computeInsights(snaps);

  return NextResponse.json({ hasData: true, series, insights });
}
