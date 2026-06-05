"use client";

import Link from "next/link";
import { DashboardView } from "@/components/DashboardView";
import { demoDashboard } from "@/lib/demoData";

export default function DemoPage() {
  return (
    <DashboardView
      data={demoDashboard}
      greeting="Match day."
      headerLeftExtra={
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-separator text-xs text-muted">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          Demo · Pro Tennis Player
        </div>
      }
      headerRight={
        <Link
          href="/"
          className="px-3 py-1.5 rounded-full border border-separator text-xs text-muted hover:text-foreground hover:bg-surface transition"
        >
          Exit demo
        </Link>
      }
      footer={
        <footer className="text-xs text-muted text-center pt-4 pb-2">
          Sample data for a professional tennis player. <Link href="/stats" className="underline hover:text-foreground">See the season stats →</Link>
        </footer>
      }
    />
  );
}
