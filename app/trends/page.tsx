"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Calendar } from "@/components/Calendar";
import { TrendChart } from "@/components/TrendChart";
import { InsightCard } from "@/components/InsightCard";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { todayISO, addDaysISO } from "@/lib/dates";
import { loadSettings, useSettings } from "@/lib/useSettings";
import { METRICS } from "@/lib/trends";
import type { Insight, TrendMetricKey, TrendPoint } from "@/lib/types";

type Status = "loading" | "live" | "empty" | "signin";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const fmtShort = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};

const PRESETS: { label: string; days: number | null }[] = [
  { label: "All time", days: null },
  { label: "90d", days: 90 },
  { label: "30d", days: 30 },
  { label: "7d", days: 7 },
];

// Last non-null reading for a metric.
function lastVal(series: TrendPoint[], key: TrendMetricKey): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i][key];
    if (v != null) return v;
  }
  return null;
}

// Average + recent-vs-prior-half % change for the header chips.
function summarize(series: TrendPoint[], key: TrendMetricKey): { avg: number | null; delta: number | null } {
  const vals = series.map((p) => p[key]).filter((v): v is number => v != null);
  if (!vals.length) return { avg: null, delta: null };
  const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
  const half = Math.floor(vals.length / 2);
  if (half < 2) return { avg, delta: null };
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const pm = mean(vals.slice(0, half));
  const rm = mean(vals.slice(half));
  const delta = pm !== 0 ? ((rm - pm) / Math.abs(pm)) * 100 : null;
  return { avg, delta };
}

function fmtVal(key: TrendMetricKey, v: number | null, decimals: number): string {
  if (v == null) return "—";
  if (key === "steps" || key === "calories") return Math.round(v).toLocaleString();
  return v.toFixed(decimals);
}

export default function TrendsPage() {
  const supabase = getSupabaseBrowser();
  const { update } = useSettings();

  const [series, setSeries] = useState<TrendPoint[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const today = todayISO();
  const [from, setFrom] = useState<string>(""); // "" = all time
  const [earliest, setEarliest] = useState<string>("2024-01-01");
  const [pickerOpen, setPickerOpen] = useState(false);

  const setAndSaveFrom = (d: string) => { setFrom(d); update({ statsFrom: d }); };

  // Apply the saved default window + fetch the available date range for the picker.
  useEffect(() => {
    const saved = loadSettings().statsFrom;
    if (saved) setFrom(saved);
    if (!supabase) return;
    fetch("/api/snapshots").then((r) => r.json()).then((d) => {
      if (d.dates?.length) setEarliest(d.dates[0]);
    }).catch(() => {});
  }, [supabase]);

  // Refetch whenever the window changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setStatus("signin"); return; }
      const res = await fetch(`/api/trends${from ? `?from=${from}` : ""}`);
      if (cancelled) return;
      if (!res.ok) { setStatus(res.status === 401 ? "signin" : "empty"); return; }
      const json = await res.json();
      if (json.hasData) {
        setSeries(json.series ?? []);
        setInsights(json.insights ?? []);
        setStatus("live");
      } else {
        setSeries([]);
        setInsights([]);
        setStatus("empty");
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, from]);

  const activePresetDays = (() => {
    if (!from) return null;
    for (const preset of PRESETS) if (preset.days && addDaysISO(today, -preset.days) === from) return preset.days;
    return "custom" as const;
  })();

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8 sm:py-10 w-full">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Your trends.</h1>
        <p className="text-sm text-muted mt-1">
          How your metrics move over time, and what we noticed.
        </p>

        {status === "live" && (
          <div className="relative mt-4 flex items-center gap-2 flex-wrap">
            {PRESETS.map((preset) => {
              const isActive = preset.days === null ? !from : activePresetDays === preset.days;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    setPickerOpen(false);
                    if (preset.days === null) setAndSaveFrom("");
                    else setFrom(addDaysISO(today, -preset.days));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                    ${isActive ? "bg-foreground text-background border-foreground" : "border-separator text-muted hover:text-foreground hover:bg-surface"}`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              onClick={() => setPickerOpen((o) => !o)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                ${activePresetDays === "custom" ? "bg-foreground text-background border-foreground" : "border-separator text-muted hover:text-foreground hover:bg-surface"}`}
            >
              {activePresetDays === "custom" ? `From ${fmtShort(from)}` : "Custom start…"}
            </button>
            <AnimatePresence>
              {pickerOpen && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setPickerOpen(false)} />
                  <Calendar
                    selected={from || earliest}
                    earliest={earliest}
                    latest={today}
                    onPick={(d) => { setAndSaveFrom(d); setPickerOpen(false); }}
                    className="absolute top-full left-0 mt-2"
                  />
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.header>

      {status !== "live" ? (
        <TrendsEmpty status={status} />
      ) : (
        <>
          {/* WHAT WE NOTICED */}
          <section className="mb-10">
            <div className="section-label mb-3">What we noticed</div>
            {insights.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((ins, i) => (
                  <InsightCard key={ins.id} insight={ins} delay={0.02 * i} />
                ))}
              </div>
            ) : (
              <div className="tile p-8 text-center">
                <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
                  Keep logging — insights appear once there&apos;s enough history to spot a reliable pattern (about two weeks).
                </p>
              </div>
            )}
          </section>

          {/* CHARTS */}
          <section className="mb-10">
            <div className="section-label mb-3">Over time</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {METRICS.map((m, i) => {
                const decimals = m.decimals ?? 0;
                const { avg, delta } = summarize(series, m.key);
                const current = lastVal(series, m.key);
                const hasAny = series.some((p) => p[m.key] != null);
                return (
                  <motion.div
                    key={m.key}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.02 * i, ease: [0.22, 1, 0.36, 1] }}
                    className="tile p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="section-label">{m.label}</div>
                        <div className="mt-1.5 flex items-baseline gap-1.5">
                          <span className="text-3xl font-semibold tracking-tight tile-tabular" style={{ color: m.color }}>
                            {fmtVal(m.key, current, decimals)}
                          </span>
                          {m.unit && current != null && <span className="text-muted text-sm font-medium">{m.unit}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted tile-tabular">
                        {avg != null && <div>avg {fmtVal(m.key, avg, decimals)}{m.unit ? ` ${m.unit}` : ""}</div>}
                        {delta != null && Math.abs(delta) >= 1 && (
                          <div className="mt-0.5">
                            {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}% vs earlier
                          </div>
                        )}
                      </div>
                    </div>
                    {hasAny ? (
                      <TrendChart data={series} metricKey={m.key} color={m.color} unit={m.unit} decimals={decimals} />
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-sm text-muted">
                        No {m.label.toLowerCase()} data in this window.
                      </div>
                    )}
                    {!m.reliableInBackfill && hasAny && (
                      <p className="mt-2 text-[11px] text-muted">
                        Gaps are days before this metric synced — the line breaks rather than showing a false zero.
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>

          <footer className="text-xs text-muted text-center pt-4 pb-2">
            Computed from your real Google Health history. Associations are correlations, not proof of cause.
          </footer>
        </>
      )}
    </main>
  );
}

function TrendsEmpty({ status }: { status: Status }) {
  if (status === "loading") {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <div className="mb-4 h-6 w-6 rounded-full border-2 border-separator border-t-foreground animate-spin" />
        <p className="text-sm text-muted">Loading your trends…</p>
      </div>
    );
  }
  if (status === "signin") {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in to see your trends</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Connect Google Health and these charts fill with your real history.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 transition"
        >
          Continue with Google
        </Link>
      </div>
    );
  }
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <h2 className="text-2xl font-semibold tracking-tight">Not enough history yet</h2>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        Trends and insights appear once you&apos;ve accumulated a couple of weeks of data. Pull your
        past history from Settings to get started.
      </p>
      <Link
        href="/settings"
        className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-full border border-separator text-foreground font-medium text-sm hover:bg-surface transition"
      >
        Go to Settings
      </Link>
    </div>
  );
}
