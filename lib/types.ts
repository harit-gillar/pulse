export type SleepStage = "deep" | "rem" | "light" | "awake";

export interface SleepData {
  performanceScore: number;
  durationHours: number;
  cycles: number;
  wakeUps: number;
  stages: Record<SleepStage, number>;
  thirtyDayAvg: {
    performance: number;
    duration: number;
    rem: number;
    deep: number;
  };
}

export interface RecoveryData {
  score: number;
  label: "Optimal" | "Good" | "Moderate" | "Low";
  hrvMs: number;
  restingHr: number;
  hrvTrend: number[];
  rhrTrend: number[];
}

export interface StrainData {
  dayStrain: number;
  trend: number[];
}

export interface ActivityData {
  steps: number;
  stepsGoal: number;
  activeZoneMinutes: number;
  calories: number;
  caloriesGoal: number;
  distanceKm: number;
}

export interface BodyData {
  weightKg: number | null;
  spo2Pct: number | null;
  skinTempDeltaC: number | null;
}

export interface DashboardData {
  date: string;
  lastSync: string;
  recovery: RecoveryData;
  strain: StrainData;
  sleep: SleepData;
  activity: ActivityData;
  body: BodyData;
  sessions?: ActivitySession[];
}

// ---- All-time stats ----

export interface DatedNumber {
  value: number;
  date: string; // ISO yyyy-mm-dd
}

export interface AllTimeStats {
  totalDaysTracked: number;
  firstDayRecorded: string;
  totalHoursSlept: number;
  avgSleepHours: number;
  totalSteps: number;
  avgHrv: number;
  peakHrv: number;
  highestSleepDebt: DatedNumber;
  // Activity totals
  totalDistanceKm: number;
  totalCalories: number;
  totalActiveZoneMin: number;
  totalWorkouts: number;
  totalWorkoutHours: number;
  // Streaks & milestones
  longestSleepStreak: number; // consecutive nights ≥ 7h
  tenKStepDays: number;
  bestWeekSteps: number;
  mostFrequentActivity: string;
  mostFrequentActivityCount: number;
}

export interface PersonalRecords {
  highestHrv: DatedNumber;
  lowestRestingHr: DatedNumber;
  longestSleep: DatedNumber;
  shortestSleep: DatedNumber;
  mostSteps: DatedNumber;
  mostCalories: DatedNumber;
  longestWorkout: DatedNumber; // minutes
  mostActiveDay: DatedNumber; // active zone minutes
}

// ---- Trends & insights ----

// A single day's snapshot as loaded from daily_snapshots — the shared shape the
// stats/trends routes and the insights engine all operate on.
export interface Snap {
  date: string; // ISO yyyy-mm-dd
  d: DashboardData;
}

export type TrendMetricKey =
  | "hrvMs"
  | "restingHr"
  | "recovery"
  | "sleepHours"
  | "sleepPerf"
  | "steps"
  | "calories"
  | "activeZoneMin"
  | "weightKg";

// One charted day. Each metric is null when missing/unreliable so the line
// breaks instead of dipping to zero (see lib/trends.ts).
export type TrendPoint = { date: string } & Partial<Record<TrendMetricKey, number | null>>;

export interface Insight {
  id: string;
  headline: string; // short claim, e.g. "Sleep lifts your next-day HRV"
  detail: string; // plain-English sentence with the number; never says "causes"
  metric: TrendMetricKey; // drives the accent color
  sampleSize: number; // n — always shown
  strength: "strong" | "moderate"; // from |r| or effect size
  direction: "positive" | "negative" | "neutral";
}

// ---- Activities ----

export type ActivityType =
  | "tennis"
  | "walking"
  | "functional-fitness"
  | "dance"
  | "skiing"
  | "activity"
  | "hiking-rucking"
  | "cycling"
  | "rugby"
  | "yoga"
  | "running"
  | "swimming"
  | "strength";

export type Intensity = "Easy" | "Moderate" | "Hard";

export interface HeartRateZones {
  zone0Min: number;
  zone1Min: number;
  zone2Min: number;
  zone3Min: number;
  zone4Min: number;
}

export interface ActivitySession {
  id: string;
  type: ActivityType;
  label?: string; // human display name from the source (e.g. "Rugby", "Strength training")
  date: string;
  startTime?: string;
  durationMin: number;
  calories: number;
  strain: number;
  avgHr: number;
  maxHr: number;
  intensity?: Intensity;
  distanceKm?: number;
  paceMinPerKm?: number;
  elevationM?: number;
  zones?: HeartRateZones;
  hrSeries?: number[]; // downsampled bpm samples across the session, for the HR graph
}

export interface ActivityAggregate {
  type: ActivityType;
  label: string;
  emoji: string;
  count: number;
  longestSessionMin: number;
  avgDurationMin: number;
  mostCaloriesSingleSession: number;
  totalCalories: number;
  peakStrain: number;
  avgStrain: number;
  avgHr: number;
  maxHr: number;
}
