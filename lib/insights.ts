/**
 * Insights engine — turns the raw snapshot history into a small set of
 * honestly-worded observations.
 *
 * Principles baked in here (see the plan / project taste):
 *   • Correlation ≠ causation — copy says "associated with" / "tend to".
 *   • Always show n — every insight carries its sample size.
 *   • Suppress the weak — below MIN_N samples or MIN_R effect, nothing surfaces.
 *
 * Every function is pure and operates on Snap[] (the same shape the stats/trends
 * routes build), so it behaves identically for live data and the mock dataset.
 */
import type { DashboardData, Insight, Snap, TrendMetricKey } from "./types";
import { addDaysISO } from "./dates";

const MIN_N = 14; // need at least two weeks of paired data
const MIN_R = 0.3; // weaker correlations are not worth claiming
const MAX_INSIGHTS = 6;

type Sel = (d: DashboardData) => number | null;

const sel = {
  sleep: (d: DashboardData) => d.sleep.durationHours,
  hrv: (d: DashboardData) => d.recovery.hrvMs,
  rhr: (d: DashboardData) => d.recovery.restingHr,
  recovery: (d: DashboardData) => d.recovery.score,
  strain: (d: DashboardData) => d.strain.dayStrain,
  steps: (d: DashboardData) => d.activity.steps,
} satisfies Record<string, Sel>;

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0);

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx2 += a * a;
    dy2 += b * b;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

/** Pairs day t's X with day t+1's Y, for date-consecutive days only. */
function laggedPairs(snaps: Snap[], selX: Sel, selY: Sel): { xs: number[]; ys: number[] } {
  const byDate = new Map(snaps.map((s) => [s.date, s]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of snaps) {
    const next = byDate.get(addDaysISO(s.date, 1));
    if (!next) continue;
    const x = selX(s.d);
    const y = selY(next.d);
    if (x != null && x > 0 && y != null && y > 0) {
      xs.push(x);
      ys.push(y);
    }
  }
  return { xs, ys };
}

/** Contrast the high half of X against the low half (by median), in terms of Y. */
function medianContrast(xs: number[], ys: number[]): { loMean: number; hiMean: number; pct: number } {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const half = Math.floor(order.length / 2);
  const lo = order.slice(0, half).map((i) => ys[i]);
  const hi = order.slice(order.length - half).map((i) => ys[i]);
  const loMean = mean(lo);
  const hiMean = mean(hi);
  const pct = loMean !== 0 ? ((hiMean - loMean) / Math.abs(loMean)) * 100 : 0;
  return { loMean, hiMean, pct };
}

/** Recent-window mean vs the immediately-prior window mean (by calendar date). */
function windowDelta(
  snaps: Snap[],
  s: Sel,
  recentDays: number,
  priorDays: number,
): { recentMean: number; priorMean: number; pct: number; recentN: number; priorN: number } {
  if (snaps.length === 0) return { recentMean: 0, priorMean: 0, pct: 0, recentN: 0, priorN: 0 };
  const latest = snaps[snaps.length - 1].date;
  const recentStart = addDaysISO(latest, -(recentDays - 1));
  const priorStart = addDaysISO(recentStart, -priorDays);
  const recent: number[] = [];
  const prior: number[] = [];
  for (const snap of snaps) {
    const v = s(snap.d);
    if (v == null || v <= 0) continue;
    if (snap.date >= recentStart) recent.push(v);
    else if (snap.date >= priorStart) prior.push(v);
  }
  const recentMean = mean(recent);
  const priorMean = mean(prior);
  const pct = priorMean !== 0 ? ((recentMean - priorMean) / Math.abs(priorMean)) * 100 : 0;
  return { recentMean, priorMean, pct, recentN: recent.length, priorN: prior.length };
}

/** Average of a metric grouped by weekday, plus the overall average. */
function byWeekday(snaps: Snap[], s: Sel): { best: number; bestMean: number; overall: number; n: number } {
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  let total = 0;
  let totalN = 0;
  for (const snap of snaps) {
    const v = s(snap.d);
    if (v == null || v <= 0) continue;
    const dow = new Date(snap.date + "T00:00:00").getDay();
    sums[dow] += v;
    counts[dow] += 1;
    total += v;
    totalN += 1;
  }
  let best = -1;
  let bestMean = -Infinity;
  for (let i = 0; i < 7; i++) {
    if (counts[i] < 3) continue; // need a few samples per weekday to claim anything
    const m = sums[i] / counts[i];
    if (m > bestMean) {
      bestMean = m;
      best = i;
    }
  }
  return { best, bestMean, overall: totalN ? total / totalN : 0, n: totalN };
}

const strengthOf = (absR: number): Insight["strength"] => (absR >= 0.5 ? "strong" : "moderate");

interface Scored extends Insight {
  _score: number;
}

/** Build the ranked list of insights from the snapshot history. */
export function computeInsights(snaps: Snap[]): Insight[] {
  const out: Scored[] = [];

  // ── Lagged correlations: yesterday's behaviour → today's body ──
  const lagged: {
    selX: Sel;
    selY: Sel;
    metric: TrendMetricKey;
    build: (pct: number, n: number, dir: Insight["direction"]) => { headline: string; detail: string };
  }[] = [
    {
      selX: sel.sleep,
      selY: sel.hrv,
      metric: "hrvMs",
      build: (pct, n, dir) => ({
        headline: dir === "positive" ? "Sleep lifts your next-day HRV" : "More sleep, lower next-day HRV",
        detail:
          dir === "positive"
            ? `On your better-rested nights, next-day HRV runs about ${Math.abs(Math.round(pct))}% higher than after your shorter nights (n=${n}).`
            : `Curiously, longer nights are associated with ~${Math.abs(Math.round(pct))}% lower next-day HRV (n=${n}).`,
      }),
    },
    {
      selX: sel.sleep,
      selY: sel.rhr,
      metric: "restingHr",
      build: (pct, n, dir) => ({
        headline: dir === "negative" ? "Sleep calms your resting heart rate" : "Sleep and resting HR move together",
        detail:
          dir === "negative"
            ? `After your longer nights, resting heart rate sits about ${Math.abs(Math.round(pct))}% lower (n=${n}).`
            : `Longer nights are associated with ~${Math.abs(Math.round(pct))}% higher next-day resting HR (n=${n}).`,
      }),
    },
    {
      selX: sel.strain,
      selY: sel.recovery,
      metric: "recovery",
      build: (pct, n, dir) => ({
        headline: dir === "negative" ? "Hard days cost you the next morning" : "You bounce back after hard days",
        detail:
          dir === "negative"
            ? `After your most strenuous days, next-day recovery is about ${Math.abs(Math.round(pct))}% lower (n=${n}).`
            : `Your higher-strain days are associated with ~${Math.abs(Math.round(pct))}% higher next-day recovery (n=${n}).`,
      }),
    },
  ];

  for (const spec of lagged) {
    const { xs, ys } = laggedPairs(snaps, spec.selX, spec.selY);
    if (xs.length < MIN_N) continue;
    const r = pearson(xs, ys);
    if (Math.abs(r) < MIN_R) continue;
    const { pct } = medianContrast(xs, ys);
    if (!isFinite(pct) || Math.abs(pct) < 1) continue;
    const direction: Insight["direction"] = pct > 0 ? "positive" : "negative";
    const copy = spec.build(pct, xs.length, direction);
    out.push({
      id: `lag-${spec.metric}`,
      metric: spec.metric,
      sampleSize: xs.length,
      strength: strengthOf(Math.abs(r)),
      direction,
      ...copy,
      _score: Math.abs(r) * Math.sqrt(xs.length),
    });
  }

  // ── Recent-vs-prior 30-day trends ──
  const trends: { s: Sel; metric: TrendMetricKey; label: string; goodWhenUp: boolean }[] = [
    { s: sel.hrv, metric: "hrvMs", label: "HRV", goodWhenUp: true },
    { s: sel.rhr, metric: "restingHr", label: "resting heart rate", goodWhenUp: false },
    { s: sel.sleep, metric: "sleepHours", label: "sleep", goodWhenUp: true },
  ];
  for (const t of trends) {
    const { pct, recentN, priorN } = windowDelta(snaps, t.s, 30, 30);
    if (recentN < 7 || priorN < 7) continue;
    if (!isFinite(pct) || Math.abs(pct) < 5) continue;
    const up = pct > 0;
    const good = up === t.goodWhenUp;
    const arrow = up ? "up" : "down";
    out.push({
      id: `trend-${t.metric}`,
      metric: t.metric,
      sampleSize: recentN + priorN,
      strength: Math.abs(pct) >= 12 ? "strong" : "moderate",
      direction: good ? "positive" : "negative",
      headline: `Your ${t.label} is trending ${arrow}`,
      detail: `Over the last 30 days your ${t.label} is ${arrow} about ${Math.abs(Math.round(pct))}% versus the prior month (n=${recentN + priorN}).`,
      _score: (Math.abs(pct) / 10) * Math.sqrt(recentN + priorN),
    });
  }

  // ── Best weekday patterns ──
  const weekdaySpecs: { s: Sel; metric: TrendMetricKey; label: string }[] = [
    { s: sel.sleep, metric: "sleepHours", label: "sleep" },
    { s: sel.steps, metric: "steps", label: "steps" },
  ];
  for (const w of weekdaySpecs) {
    const { best, bestMean, overall, n } = byWeekday(snaps, w.s);
    if (best < 0 || n < MIN_N || overall <= 0) continue;
    const lift = ((bestMean - overall) / overall) * 100;
    if (lift < 8) continue; // only worth saying if the best day clearly stands out
    out.push({
      id: `dow-${w.metric}`,
      metric: w.metric,
      sampleSize: n,
      strength: lift >= 15 ? "strong" : "moderate",
      direction: "neutral",
      headline: `${DOW[best]} is your best day for ${w.label}`,
      detail: `Your ${w.label} on ${DOW[best]}s runs about ${Math.round(lift)}% above your weekly average (n=${n}).`,
      _score: (lift / 10) * Math.sqrt(n),
    });
  }

  return out
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_INSIGHTS)
    .map(
      (s): Insight => ({
        id: s.id,
        headline: s.headline,
        detail: s.detail,
        metric: s.metric,
        sampleSize: s.sampleSize,
        strength: s.strength,
        direction: s.direction,
      }),
    );
}
