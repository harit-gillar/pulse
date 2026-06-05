"use client";

import { useEffect, useState } from "react";
import { DashboardView } from "@/components/DashboardView";
import { DateNav } from "@/components/DateNav";
import { mockDashboard } from "@/lib/mockData";
import { todayISO } from "@/lib/dates";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const supabase = getSupabaseBrowser();
  const [d, setD] = useState<DashboardData>(mockDashboard);
  const [source, setSource] = useState<"mock" | "live">("mock");
  const [earliest, setEarliest] = useState<string>(todayISO());
  const [allDates, setAllDates] = useState<string[]>([]);
  const today = todayISO();

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const [res, datesRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/snapshots"),
      ]);
      if (cancelled) return;
      if (res.ok) {
        const json = (await res.json()) as DashboardData;
        setD(json);
        setSource("live");
      }

      let dates: string[] = datesRes.ok ? (await datesRes.json()).dates ?? [] : [];
      if (dates.length) { setEarliest(dates[0]); setAllDates(dates); }

      // First connection (≤1 day saved): pull ~30 days of history once.
      if (res.ok && dates.length <= 1) {
        const bf = await fetch("/api/backfill?days=30", { method: "POST" });
        if (!cancelled && bf.ok) {
          const fresh = await fetch("/api/snapshots");
          if (!cancelled && fresh.ok) {
            dates = (await fresh.json()).dates ?? [];
            if (dates.length) { setEarliest(dates[0]); setAllDates(dates); }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <DashboardView
      data={d}
      headerLeftExtra={
        source === "live" ? <DateNav date={today} earliest={earliest} latest={today} availableDates={allDates} /> : undefined
      }
      headerRight={
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          {source === "live" ? `Synced ${d.lastSync}` : "Demo data"}
        </div>
      }
      footer={
        <footer className="text-xs text-muted text-center pt-4 pb-2">
          {source === "live"
            ? "Live data from Google Health."
            : "Showing demo data — sign in with Google to see your real numbers."}
        </footer>
      }
    />
  );
}
