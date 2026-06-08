"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardView } from "@/components/DashboardView";
import { DateNav } from "@/components/DateNav";
import { todayISO } from "@/lib/dates";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { DashboardData } from "@/lib/types";

type Status = "loading" | "live" | "empty" | "signin";

export default function DashboardPage() {
  const supabase = getSupabaseBrowser();
  const [d, setD] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [earliest, setEarliest] = useState<string>(todayISO());
  const [allDates, setAllDates] = useState<string[]>([]);
  const today = todayISO();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setStatus("signin"); return; }
      const [res, datesRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/snapshots"),
      ]);
      if (cancelled) return;
      if (res.ok) {
        const json = (await res.json()) as DashboardData;
        setD(json);
        setStatus("live");
      } else {
        setStatus(res.status === 401 ? "signin" : "empty");
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

  if (status !== "live" || !d) {
    return <DashboardEmpty status={status} />;
  }

  return (
    <DashboardView
      data={d}
      headerLeftExtra={<DateNav date={today} earliest={earliest} latest={today} availableDates={allDates} />}
      headerRight={
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          {`Synced ${d.lastSync}`}
        </div>
      }
      footer={
        <footer className="text-xs text-muted text-center pt-4 pb-2">
          Live data from Google Health.
        </footer>
      }
    />
  );
}

function DashboardEmpty({ status }: { status: Status }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="max-w-md">
        {status === "loading" ? (
          <>
            <div className="mx-auto mb-4 h-6 w-6 rounded-full border-2 border-separator border-t-foreground animate-spin" />
            <p className="text-sm text-muted">Loading your dashboard…</p>
          </>
        ) : status === "signin" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to see your data</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Connect your Google Health account to view your recovery, sleep, and activity.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 transition"
            >
              Continue with Google
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">No data yet</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Your metrics will appear here once Google Health has data to sync. You can pull your
              past history from Settings.
            </p>
            <Link
              href="/settings"
              className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-full border border-separator text-foreground font-medium text-sm hover:bg-surface transition"
            >
              Go to Settings
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
