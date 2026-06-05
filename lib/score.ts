/**
 * Pulse scoring functions.
 *
 * Google Health API doesn't ship Whoop-style composite scores. These are our
 * own approximations, computed from raw Google Health signals. Every formula
 * is documented in plain English next to the function and surfaced verbatim
 * in the stats page tooltips — no hidden math.
 *
 * Inputs are normalized so each function works whether the source is real
 * Google data or the mock dataset.
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// Recovery (0–100)
// ---------------------------------------------------------------------------
// Weighted blend of four normalized signals, scored against the user's own
// 30-day rolling baselines:
//
//   recovery = 0.50 · hrvScore      (HRV vs 30-day baseline, capped at 130%)
//            + 0.25 · rhrScore      (inverse RHR vs baseline — lower is better)
//            + 0.15 · sleepPerf     (last night's sleep performance, 0–100)
//            + 0.10 · 100·strainAdj (discount if yesterday was hard)
//
// Categorization: ≥ 67 green · 34–66 yellow · < 34 red.

export interface RecoveryInputs {
  hrvMs: number;
  hrvBaselineMs: number;
  restingHr: number;
  restingHrBaseline: number;
  sleepPerformance: number; // 0–100
  yesterdayStrain: number;  // 0–21
}

export function computeRecovery(i: RecoveryInputs): number {
  const hrvScore   = clamp(i.hrvMs / i.hrvBaselineMs, 0, 1.3) * 100;
  const rhrScore   = clamp(2 - i.restingHr / i.restingHrBaseline, 0, 1.3) * 100;
  const sleepScore = clamp(i.sleepPerformance, 0, 100);
  const strainAdj  = clamp(1 - i.yesterdayStrain / 21, 0.5, 1);

  const score =
    0.50 * hrvScore +
    0.25 * rhrScore +
    0.15 * sleepScore +
    0.10 * 100 * strainAdj;

  return Math.round(clamp(score, 0, 100));
}

export function recoveryLabel(score: number): "Optimal" | "Good" | "Moderate" | "Low" {
  if (score >= 67) return "Optimal";
  if (score >= 34) return "Good";
  if (score >= 20) return "Moderate";
  return "Low";
}

// ---------------------------------------------------------------------------
// Strain (0–21, Borg-CR10 derived)
// ---------------------------------------------------------------------------
// Sum minutes in each heart-rate zone, weighted by intensity, then compress
// logarithmically into a 0–21 scale:
//
//   weighted = Σ minutes_in_zone_i · weight_i
//   strain   = clamp(ln(1 + weighted) · 3.5, 0, 21)
//
// Zone weights (% of HR max):
//   Z0 rest <50% = 0
//   Z1 50–60%    = 1
//   Z2 60–70%    = 2
//   Z3 70–80%    = 4
//   Z4 80–90%    = 7
//   Z5 90%+      = 11

export interface ZoneMinutes {
  z0: number; z1: number; z2: number; z3: number; z4: number; z5: number;
}

const ZONE_WEIGHTS: Record<keyof ZoneMinutes, number> = {
  z0: 0, z1: 1, z2: 2, z3: 4, z4: 7, z5: 11,
};

export function computeStrain(zones: ZoneMinutes): number {
  const weighted = (Object.keys(zones) as (keyof ZoneMinutes)[])
    .reduce((s, k) => s + zones[k] * ZONE_WEIGHTS[k], 0);
  const raw = Math.log(1 + weighted) * 3.5;
  return +clamp(raw, 0, 21).toFixed(1);
}

// ---------------------------------------------------------------------------
// Sleep need & debt
// ---------------------------------------------------------------------------
// Sleep need = personal baseline + adjustments:
//
//   need = baselineHours
//        + 0.10 · yesterdayStrain      (hard days require more sleep)
//        + 0.50 · accumulatedDebt      (pay debt back gradually)
//
// Sleep debt for a night:
//
//   nightDebt = max(0, need − got)
//
// Accumulated debt = 14-day rolling sum with linear decay (older days count less).

export function computeSleepNeed(opts: {
  baselineHours: number;
  yesterdayStrain: number;
  accumulatedDebt: number;
}): number {
  return +(opts.baselineHours + 0.10 * opts.yesterdayStrain + 0.5 * opts.accumulatedDebt).toFixed(2);
}

export function computeSleepDebt(needHours: number, gotHours: number): number {
  return +Math.max(0, needHours - gotHours).toFixed(2);
}

// ---------------------------------------------------------------------------
// Sleep performance (0–100)
// ---------------------------------------------------------------------------
//   performance = 70 · (got / need)              capped at 1.0
//               + 15 · (cycles / cyclesNeeded)   capped at 1.0
//               + 15 · (1 − awakeMin / totalMin)
// All terms clamped before summing; result clamped to 0–100.

export interface SleepPerformanceInputs {
  durationGotHours: number;
  durationNeededHours: number;
  cyclesGot: number;
  cyclesNeeded: number;
  awakeMinutes: number;
  totalMinutes: number;
}

export function computeSleepPerformance(i: SleepPerformanceInputs): number {
  const durationTerm = clamp(i.durationGotHours / i.durationNeededHours, 0, 1) * 70;
  const cyclesTerm   = clamp(i.cyclesGot / i.cyclesNeeded, 0, 1) * 15;
  const efficiency   = i.totalMinutes > 0 ? clamp(1 - i.awakeMinutes / i.totalMinutes, 0, 1) : 0;
  const awakeTerm    = efficiency * 15;
  return Math.round(clamp(durationTerm + cyclesTerm + awakeTerm, 0, 100));
}

// ---------------------------------------------------------------------------
// Sleep need baseline — defaults if no personal calibration available yet
// ---------------------------------------------------------------------------
export const DEFAULT_BASELINES = {
  sleepHours: 7.5,
  cycles: 5,
  hrvMs: 60,
  restingHr: 60,
};
