/**
 * Trend metric registry — the single source of truth shared by the trends API
 * and the trends page so labels/colors/units never drift apart.
 *
 * `accessor` is only invoked server-side (in buildSeries); the client imports
 * the registry purely for its label/color/unit metadata.
 *
 * `reliableInBackfill` flags metrics that the history backfill cannot populate
 * accurately (recovery + sleep quality are approximated from default baselines
 * for historical days). For those, buildSeries emits `null` on empty days so the
 * chart line *breaks* rather than dipping to a misleading zero.
 */
import type { DashboardData, Snap, TrendMetricKey, TrendPoint } from "./types";

export interface TrendMetric {
  key: TrendMetricKey;
  label: string;
  unit: string;
  color: string; // CSS var, e.g. "var(--blue)"
  accessor: (d: DashboardData) => number | null;
  reliableInBackfill: boolean;
  /** Decimal places for display (charts/values). */
  decimals?: number;
}

export const METRICS: TrendMetric[] = [
  { key: "hrvMs",         label: "HRV",             unit: "ms",   color: "var(--blue)",   accessor: (d) => d.recovery.hrvMs,             reliableInBackfill: true },
  { key: "restingHr",     label: "Resting HR",      unit: "bpm",  color: "var(--red)",    accessor: (d) => d.recovery.restingHr,         reliableInBackfill: true },
  { key: "recovery",      label: "Recovery",        unit: "",     color: "var(--accent)", accessor: (d) => d.recovery.score,             reliableInBackfill: false },
  { key: "sleepHours",    label: "Sleep",           unit: "hrs",  color: "var(--blue)",   accessor: (d) => d.sleep.durationHours,        reliableInBackfill: true,  decimals: 1 },
  { key: "sleepPerf",     label: "Sleep Quality",   unit: "",     color: "var(--purple)", accessor: (d) => d.sleep.performanceScore,     reliableInBackfill: false },
  { key: "steps",         label: "Steps",           unit: "",     color: "var(--accent)", accessor: (d) => d.activity.steps,             reliableInBackfill: true },
  { key: "calories",      label: "Calories",        unit: "kcal", color: "var(--orange)", accessor: (d) => d.activity.calories,          reliableInBackfill: true },
  { key: "activeZoneMin", label: "Active Zone Min", unit: "min",  color: "var(--pink)",   accessor: (d) => d.activity.activeZoneMinutes, reliableInBackfill: true },
  { key: "weightKg",      label: "Weight",          unit: "kg",   color: "var(--purple)", accessor: (d) => d.body.weightKg,              reliableInBackfill: true,  decimals: 1 },
];

export const METRIC_BY_KEY: Record<TrendMetricKey, TrendMetric> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
) as Record<TrendMetricKey, TrendMetric>;

/**
 * Project the snapshots into one charted point per day. A non-positive reading
 * is treated as "no data" → null, which the chart renders as a gap.
 */
export function buildSeries(snaps: Snap[]): TrendPoint[] {
  return snaps.map((s) => {
    const point: TrendPoint = { date: s.date };
    for (const m of METRICS) {
      const raw = m.accessor(s.d);
      point[m.key] = raw != null && raw > 0 ? raw : null;
    }
    return point;
  });
}
