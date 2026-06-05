import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

// Returns the sorted list of dates the user has real saved snapshots for.
// Used to bound the date navigator to days we actually have data.
export async function GET() {
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ dates: [] });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ dates: [] });

  const { data } = await supabase
    .from("daily_snapshots")
    .select("date")
    .eq("user_id", session.user.id)
    .order("date", { ascending: true });

  return NextResponse.json({ dates: (data ?? []).map((r) => r.date as string) });
}
