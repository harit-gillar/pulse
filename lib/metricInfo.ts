/**
 * Per-metric explanations shown in the InfoTooltip popovers.
 *
 * - `desc`: 1–2 short sentences in plain English
 * - `formula` (optional): the actual calculation, rendered in a mono block
 * - `source`: "Google" (read direct from Google Health) | "Computed" (derived
 *   by us in `lib/score.ts`)
 */
export interface MetricInfo {
  desc: string;
  formula?: string;
  source: "Google" | "Computed";
}

export const METRIC_INFO: Record<string, MetricInfo> = {
  // ─────────── DASHBOARD · TODAY ───────────
  Recovery: {
    desc: "How ready your body is for today, 0–100.",
    formula:
      "0.50·HRV-score + 0.25·RHR-score + 0.15·sleep-perf + 0.10·strain-adj\n(scored vs your 30-day baselines)",
    source: "Computed",
  },
  Strain: {
    desc: "Cardiovascular load today on a 0–21 (Borg-CR10) scale.",
    formula:
      "ln(1 + Σ minutes_in_zone × weight) × 3.5\nweights: Z1=1, Z2=2, Z3=4, Z4=7, Z5=11",
    source: "Computed",
  },
  HRV: {
    desc: "Heart Rate Variability — variation between beats while asleep. Higher usually means more recovered.",
    source: "Google",
  },
  "Resting HR": {
    desc: "Your lowest sustained heart rate during sleep. Lower generally reflects better cardiovascular fitness.",
    source: "Google",
  },

  // ─────────── DASHBOARD · SLEEP ───────────
  Performance: {
    desc: "How well you slept relative to what you needed.",
    formula:
      "70·(got/need) + 15·(cycles/needed) + 15·(1 − awake/total)\nall terms clamped to [0,1], result clamped to 0–100",
    source: "Computed",
  },
  Duration: {
    desc: "Total time asleep last night, excluding awake periods. Compared to your 30-day average.",
    source: "Google",
  },
  REM: {
    desc: "REM stage hours — when most dreaming happens. Important for memory and emotional processing.",
    source: "Google",
  },
  "Deep Sleep": {
    desc: "Slow-wave hours — growth hormone release and physical recovery.",
    source: "Google",
  },

  // ─────────── DASHBOARD · ACTIVITY ───────────
  Steps: { desc: "Step count for the day from the wrist accelerometer. Goal defaults to 10,000.", source: "Google" },
  "Active Zone Min": {
    desc: "Minutes in HR zones 2–5, with zones 3–5 counted double.",
    formula: "Z2_min + 2·(Z3_min + Z4_min + Z5_min)",
    source: "Google",
  },
  "Total Calories Burned": {
    desc: "Total energy burned today — basal metabolism plus all activity.",
    formula: "active-energy-burned + BMR (Mifflin-St Jeor)",
    source: "Google",
  },
  Distance: { desc: "Distance covered today, from GPS or stride-derived.", source: "Google" },

  // ─────────── DASHBOARD · BODY ───────────
  Weight: { desc: "Most recent reading from a connected scale.", source: "Google" },
  "SpO₂": { desc: "Blood oxygen saturation, averaged across last night. Normal 95–100%.", source: "Google" },
  "Skin Temp": { desc: "How far last night's skin temperature deviated from your personal baseline.", source: "Google" },

  // ─────────── STATS · OVERVIEW ───────────
  "Total Days Tracked": {
    desc: "Days the wearable has synced any data.",
    formula: "count(distinct date in daily_snapshots)",
    source: "Google",
  },
  "First Day Recorded": {
    desc: "Earliest day this account has any data for.",
    formula: "min(date) across all dataPoints",
    source: "Google",
  },
  "Green Recovery Days": {
    desc: "Days your computed recovery was ≥ 67. Body well-recovered.",
    formula: "count(day where recovery ≥ 67)",
    source: "Computed",
  },
  "Yellow Recovery Days": {
    desc: "Days your computed recovery was 34–66. Adequately recovered.",
    formula: "count(day where 34 ≤ recovery < 67)",
    source: "Computed",
  },
  "Red Recovery Days": {
    desc: "Days your computed recovery was < 34. Body needs rest.",
    formula: "count(day where recovery < 34)",
    source: "Computed",
  },
  "Current Green Streak": {
    desc: "Most recent run of consecutive green-recovery days.",
    formula: "longest tail run of (recovery ≥ 67) ending today",
    source: "Computed",
  },
  "Longest Green Streak": {
    desc: "The longest run of green-recovery days you've ever strung together.",
    formula: "max consecutive (recovery ≥ 67)",
    source: "Computed",
  },
  "Total Hours Slept": {
    desc: "Sum of every sleep session on record.",
    formula: "Σ sleep.durationHours",
    source: "Google",
  },
  "Total Strain Accumulated": {
    desc: "Cumulative strain across every tracked day.",
    formula: "Σ daily.strain",
    source: "Computed",
  },
  "Highest Sleep Debt": {
    desc: "The biggest gap recorded between sleep needed and sleep gotten.",
    formula:
      "max(need − got)\nneed = 7.5h + 0.10·yesterdayStrain + 0.5·accumulatedDebt",
    source: "Computed",
  },
  "Avg Recovery Score": {
    desc: "Mean recovery score across every tracked day.",
    formula: "mean(daily.recovery)",
    source: "Computed",
  },
  "Peak HRV": {
    desc: "The single highest overnight HRV reading on record.",
    formula: "max(daily-heart-rate-variability)",
    source: "Google",
  },

  // ─────────── STATS · PERSONAL RECORDS ───────────
  "Best Recovery": {
    desc: "Highest computed recovery score on record.",
    formula: "max(daily.recovery)",
    source: "Computed",
  },
  "Worst Recovery": {
    desc: "Lowest computed recovery score on record.",
    formula: "min(daily.recovery)",
    source: "Computed",
  },
  "Highest HRV": {
    desc: "Best single overnight HRV reading.",
    formula: "max(daily-heart-rate-variability)",
    source: "Google",
  },
  "Lowest Resting HR": {
    desc: "Lowest overnight resting heart rate.",
    formula: "min(daily-resting-heart-rate)",
    source: "Google",
  },
  "Best Sleep": {
    desc: "Your highest computed sleep performance score.",
    formula: "max(daily.sleepPerformance)",
    source: "Computed",
  },
  "Worst Sleep": {
    desc: "Lowest computed sleep performance score.",
    formula: "min(daily.sleepPerformance)",
    source: "Computed",
  },
  "Longest Sleep": {
    desc: "Longest single night of sleep recorded.",
    formula: "max(sleep.durationHours)",
    source: "Google",
  },
  "Peak Strain Day": {
    desc: "Hardest day by computed strain.",
    formula: "max(daily.strain)",
    source: "Computed",
  },
};
