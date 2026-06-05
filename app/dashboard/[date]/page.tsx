"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DashboardView } from "@/components/DashboardView";
import { DateNav } from "@/components/DateNav";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { todayISO, fmtLongDate } from "@/lib/dates";
import type { DashboardData } from "@/lib/types";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
type Status = "loading" | "ready" | "empty" | "invalid";

export default function HistoricalDashboardPage() {
  const params = useParams<{ date: string }>();
  const date = params?.date ?? "";
  const supabase = getSupabaseBrowser();

  const [data, setData] = useState<DashboardData | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const today = todayISO();

  useEffect(() => {
    if (!ISO_RE.test(date) || date > today) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      const [snapRes, datesRes] = await Promise.all([
        fetch(`/api/dashboard?date=${date}`),
        fetch(`/api/snapshots`),
      ]);
      if (cancelled) return;
      if (datesRes.ok) setDates((await datesRes.json()).dates ?? []);
      if (snapRes.ok) {
        setData((await snapRes.json()) as DashboardData);
        setStatus("ready");
      } else {
        setStatus("empty");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, today]);

  const earliest = dates[0] ?? today;

  if (status === "invalid") {
    return <Shell><Empty title="Invalid date" body="That date isn't valid." today={today} earliest={earliest} date={today} /></Shell>;
  }
  if (status === "loading") {
    return <Shell><div className="text-sm text-muted py-20 text-center">Loading…</div></Shell>;
  }
  if (status === "empty" || !data) {
    return (
      <Shell>
        <Empty
          title="No data for this day"
          body={`Pulse has no saved snapshot for ${fmtLongDate(date)}. We only have data from when you connected onward — history fills in each day you open the dashboard.`}
          today={today}
          earliest={earliest}
          date={date}
        />
      </Shell>
    );
  }

  return (
    <DashboardView
      data={data}
      headerLeftExtra={<DateNav date={date} earliest={earliest} latest={today} availableDates={dates} />}
      footer={
        <footer className="text-xs text-muted text-center pt-4 pb-2">
          Saved snapshot from {fmtLongDate(date)}.
        </footer>
      }
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[1200px] px-6 py-8 sm:py-10 w-full">{children}</main>;
}

function Empty({
  title, body, today, earliest, date,
}: { title: string; body: string; today: string; earliest: string; date: string }) {
  return (
    <>
      <div className="mb-10">
        <DateNav date={ISO_RE.test(date) ? date : today} earliest={earliest} latest={today} />
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">{title}</h1>
      </div>
      <div className="tile p-8 text-center">
        <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">{body}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center mt-5 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition"
        >
          Back to today
        </Link>
      </div>
    </>
  );
}
