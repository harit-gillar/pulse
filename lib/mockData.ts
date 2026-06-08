import type {
  ActivityAggregate,
  ActivitySession,
  ActivityType,
  AllTimeStats,
  DashboardData,
  Insight,
  PersonalRecords,
  Snap,
  TrendPoint,
} from "./types";
import { activityEmoji } from "./activityVisuals";
import { buildSeries } from "./trends";
import { computeInsights } from "./insights";

const wiggle = (base: number, amp: number, n: number, seed = 1) =>
  Array.from({ length: n }, (_, i) =>
    +(base + Math.sin((i + seed) / 1.6) * amp + (mulberry32(seed * 31 + i)() - 0.5) * amp * 0.4).toFixed(2),
  );

// Deterministic PRNG so the mock data is identical across server + client renders.
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAY = "2026-05-27";
const FIRST_DAY = "2024-01-20";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000);

const TOTAL_DAYS = daysBetween(FIRST_DAY, TODAY) + 1; // 494 days — but the user's reference shows 257; we use that count below

// ---------- Dashboard for any day ----------

export function mockDashboardForDate(date: string): DashboardData {
  const seed = Number(date.replace(/-/g, ""));
  const rand = mulberry32(seed);
  const score = Math.round(40 + rand() * 60);
  const label = score >= 67 ? "Optimal" : score >= 34 ? "Good" : "Low";
  const hrv = Math.round(45 + rand() * 50);
  const rhr = Math.round(48 + rand() * 14);
  const strain = +(rand() * 18 + 1).toFixed(1);
  const sleepHours = +(5 + rand() * 5).toFixed(1);
  const performance = Math.round(40 + rand() * 60);
  const stages = {
    deep: +(sleepHours * (0.13 + rand() * 0.1)).toFixed(1),
    rem: +(sleepHours * (0.18 + rand() * 0.08)).toFixed(1),
    light: 0,
    awake: +(sleepHours * (0.04 + rand() * 0.05)).toFixed(1),
  };
  stages.light = +(sleepHours - stages.deep - stages.rem - stages.awake).toFixed(1);

  return {
    date,
    lastSync: "2 min ago",
    recovery: {
      score,
      label: label as DashboardData["recovery"]["label"],
      hrvMs: hrv,
      restingHr: rhr,
      hrvTrend: wiggle(hrv, 2, 24, seed),
      rhrTrend: wiggle(rhr, 1.2, 24, seed + 7),
    },
    strain: { dayStrain: strain, trend: wiggle(strain * 0.55, 1.8, 24, seed + 13) },
    sleep: {
      performanceScore: performance,
      durationHours: sleepHours,
      cycles: Math.round(4 + rand() * 6),
      wakeUps: Math.round(rand() * 20),
      stages,
      thirtyDayAvg: { performance: 84, duration: 8.1, rem: 1.5, deep: 1.9 },
    },
    activity: {
      steps: Math.round(3000 + rand() * 12000),
      stepsGoal: 10000,
      activeZoneMinutes: Math.round(rand() * 90),
      calories: Math.round(1800 + rand() * 1200),
      caloriesGoal: 2800,
      distanceKm: +(rand() * 12).toFixed(1),
    },
    body: {
      weightKg: +(72 + rand() * 4).toFixed(1),
      spo2Pct: Math.round(95 + rand() * 4),
      skinTempDeltaC: +((rand() - 0.5) * 1).toFixed(1),
    },
  };
}

// Today's mock — keep the curated nice-looking version for the dashboard hero.
export const mockDashboard: DashboardData = {
  ...mockDashboardForDate(TODAY),
  recovery: {
    score: 90,
    label: "Optimal",
    hrvMs: 68,
    restingHr: 54,
    hrvTrend: wiggle(66, 2, 24, 99),
    rhrTrend: wiggle(54, 1.2, 24, 33),
  },
  strain: { dayStrain: 4.0, trend: wiggle(2.2, 1.8, 24, 77) },
  sleep: {
    performanceScore: 92,
    durationHours: 9.4,
    cycles: 8,
    wakeUps: 16,
    stages: { deep: 1.8, rem: 1.8, light: 5.3, awake: 0.6 },
    thirtyDayAvg: { performance: 84, duration: 8.1, rem: 1.5, deep: 1.9 },
  },
  activity: {
    steps: 8420,
    stepsGoal: 10000,
    activeZoneMinutes: 32,
    calories: 2410,
    caloriesGoal: 2800,
    distanceKm: 6.3,
  },
  body: { weightKg: 74.2, spo2Pct: 97, skinTempDeltaC: -0.1 },
};

export const TODAY_ISO = TODAY;
export const FIRST_DAY_ISO = FIRST_DAY;

// ---------- All-time stats ----------

export const mockAllTimeStats: AllTimeStats = {
  totalDaysTracked: 257,
  firstDayRecorded: FIRST_DAY,
  totalHoursSlept: 2007,
  avgSleepHours: 7.8,
  totalSteps: 2847913,
  avgHrv: 62,
  peakHrv: 93,
  highestSleepDebt: { value: 2.1, date: "2026-03-29" },
  totalDistanceKm: 1843.6,
  totalCalories: 612430,
  totalActiveZoneMin: 8120,
  totalWorkouts: 207,
  totalWorkoutHours: 241.5,
  longestSleepStreak: 22,
  tenKStepDays: 96,
  bestWeekSteps: 112480,
  mostFrequentActivity: "Tennis",
  mostFrequentActivityCount: 41,
};

export const mockPersonalRecords: PersonalRecords = {
  highestHrv: { value: 93, date: "2024-02-11" },
  lowestRestingHr: { value: 52, date: "2024-02-11" },
  longestSleep: { value: 11, date: "2024-05-15" },
  shortestSleep: { value: 3.2, date: "2024-01-31" },
  mostSteps: { value: 24783, date: "2024-07-04" },
  mostCalories: { value: 4120, date: "2024-10-26" },
  longestWorkout: { value: 189, date: "2024-08-12" },
  mostActiveDay: { value: 142, date: "2024-10-26" },
};

// ---------- Activities ----------

const ACTIVITY_META: Record<ActivityType, { label: string; emoji: string }> = {
  tennis: { label: "Tennis", emoji: "🎾" },
  walking: { label: "Walking", emoji: "🚶" },
  "functional-fitness": { label: "Functional Fitness", emoji: "💪" },
  dance: { label: "Dance", emoji: "💃" },
  skiing: { label: "Skiing", emoji: "⛷️" },
  activity: { label: "Activity", emoji: "🏋️" },
  "hiking-rucking": { label: "Hiking Rucking", emoji: "🥾" },
  cycling: { label: "Cycling", emoji: "🚴" },
  rugby: { label: "Rugby", emoji: "🏉" },
  yoga: { label: "Yoga", emoji: "🧘" },
  running: { label: "Running", emoji: "🏃" },
  swimming: { label: "Swimming", emoji: "🏊" },
  strength: { label: "Strength", emoji: "🏋️‍♂️" },
};

const ACTIVITY_COUNTS: [ActivityType, number][] = [
  ["tennis", 41],
  ["walking", 32],
  ["functional-fitness", 29],
  ["dance", 23],
  ["skiing", 21],
  ["activity", 13],
  ["hiking-rucking", 11],
  ["cycling", 5],
  ["rugby", 5],
  ["yoga", 5],
  ["running", 12],
  ["swimming", 6],
  ["strength", 4],
];

function generateSessions(): ActivitySession[] {
  const out: ActivitySession[] = [];
  let id = 0;
  for (const [type, count] of ACTIVITY_COUNTS) {
    for (let i = 0; i < count; i++) {
      const rand = mulberry32(id * 7919 + 13);
      const day = Math.floor(rand() * TOTAL_DAYS);
      const duration = Math.round(20 + rand() * 170);
      const calories = Math.round(duration * (5 + rand() * 6));
      const strain = +(2 + rand() * 16).toFixed(1);
      const avgHr = Math.round(95 + rand() * 50);
      const maxHr = Math.round(avgHr + 20 + rand() * 40);
      out.push({
        id: String(id++),
        type,
        date: addDays(FIRST_DAY, day),
        durationMin: duration,
        calories,
        strain,
        avgHr,
        maxHr,
      });
    }
  }
  return out;
}

// Curated rich sessions for "today" so the dashboard's Today's Activities section
// has interesting data to show.
const TODAY_SESSIONS: ActivitySession[] = [
  {
    id: "today-1",
    type: "hiking-rucking",
    date: TODAY,
    startTime: "06:23",
    durationMin: 171,
    calories: 591,
    strain: 9.6,
    avgHr: 99,
    maxHr: 164,
    intensity: "Easy",
    distanceKm: 4.97,
    paceMinPerKm: 34.32,
    elevationM: 374,
    zones: { zone0Min: 102, zone1Min: 57, zone2Min: 10, zone3Min: 1, zone4Min: 0 },
    hrSeries: wiggle(105, 22, 56, 5).map((v) => Math.round(v)),
  },
  {
    id: "today-2",
    type: "tennis",
    date: TODAY,
    startTime: "17:45",
    durationMin: 82,
    calories: 612,
    strain: 11.2,
    avgHr: 128,
    maxHr: 172,
    intensity: "Moderate",
    zones: { zone0Min: 8, zone1Min: 22, zone2Min: 28, zone3Min: 20, zone4Min: 4 },
    hrSeries: wiggle(135, 30, 56, 9).map((v) => Math.round(v)),
  },
];

export const mockSessions: ActivitySession[] = [...TODAY_SESSIONS, ...generateSessions()];

export function getSessionsForDate(date: string): ActivitySession[] {
  return mockSessions
    .filter((s) => s.date === date)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

export function aggregateActivities(sessions: ActivitySession[]): ActivityAggregate[] {
  // Group by the workout's real display name when present, else by our type enum's label.
  const groupKey = (s: ActivitySession) => s.label ?? ACTIVITY_META[s.type].label;
  const byName = new Map<string, ActivitySession[]>();
  for (const s of sessions) {
    const k = groupKey(s);
    const arr = byName.get(k) ?? [];
    arr.push(s);
    byName.set(k, arr);
  }
  const out: ActivityAggregate[] = [];
  for (const [name, list] of byName) {
    const total = list.length;
    const type = list[0].type;
    const sum = (sel: (s: ActivitySession) => number) => list.reduce((a, s) => a + sel(s), 0);
    out.push({
      type,
      label: name,
      emoji: activityEmoji(name),
      count: total,
      longestSessionMin: Math.max(...list.map((s) => s.durationMin)),
      avgDurationMin: Math.round(sum((s) => s.durationMin) / total),
      mostCaloriesSingleSession: Math.max(...list.map((s) => s.calories)),
      totalCalories: sum((s) => s.calories),
      peakStrain: +Math.max(...list.map((s) => s.strain)).toFixed(1),
      avgStrain: +(sum((s) => s.strain) / total).toFixed(1),
      avgHr: Math.round(sum((s) => s.avgHr) / total),
      maxHr: Math.max(...list.map((s) => s.maxHr)),
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

export const mockActivityAggregates = aggregateActivities(mockSessions);

// Demo dashboard shows the curated today sessions in its activities section.
mockDashboard.sessions = getSessionsForDate(TODAY);

// ---------- Trends + insights ----------
//
// Generate a deterministic stretch of recent history with *real* relationships
// baked in (last night's sleep nudges next-day HRV/RHR, yesterday's strain
// nudges recovery, weekends differ, HRV drifts up over time). We then run the
// exact same buildSeries/computeInsights pipeline the live route uses, so the
// demo exercises the real engine rather than hand-written copy.

const MOCK_TREND_DAYS = 180;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function buildMockSnapshots(): Snap[] {
  const snaps: Snap[] = [];
  const start = addDays(TODAY, -(MOCK_TREND_DAYS - 1));
  let prevSleep = 7.5;
  let prevStrain = 8;
  for (let i = 0; i < MOCK_TREND_DAYS; i++) {
    const date = addDays(start, i);
    const rand = mulberry32(Number(date.replace(/-/g, "")) + 7);
    const dow = new Date(date + "T00:00:00").getDay();
    const weekend = dow === 0 || dow === 6;

    const sleep = +clamp(6.6 + (weekend ? 0.9 : 0) + (rand() - 0.5) * 2.2, 4, 10).toFixed(1);
    const strain = +clamp(4 + rand() * 12, 0, 21).toFixed(1);

    // Today's body reflects yesterday's behaviour, plus a gentle upward HRV drift.
    const hrv = Math.round(clamp(54 + i * 0.09 + (prevSleep - 7.5) * 6 + (rand() - 0.5) * 9, 30, 110));
    const rhr = Math.round(clamp(56 - (prevSleep - 7.5) * 3 + (rand() - 0.5) * 5, 42, 75));
    const recovery = Math.round(clamp(72 - (prevStrain - 8) * 3.2 + (rand() - 0.5) * 14, 5, 99));
    const performance = Math.round(clamp(sleep / 8 * 80 + (rand() - 0.5) * 14, 20, 100));
    const steps = Math.round(clamp((weekend ? 12500 : 8200) + (rand() - 0.5) * 5000, 1500, 26000));

    const base = mockDashboardForDate(date);
    const d: DashboardData = {
      ...base,
      recovery: {
        ...base.recovery,
        score: recovery,
        label: (recovery >= 67 ? "Optimal" : recovery >= 34 ? "Good" : "Low") as DashboardData["recovery"]["label"],
        hrvMs: hrv,
        restingHr: rhr,
      },
      strain: { ...base.strain, dayStrain: strain },
      sleep: { ...base.sleep, durationHours: sleep, performanceScore: performance },
      activity: { ...base.activity, steps },
    };
    snaps.push({ date, d });

    prevSleep = sleep;
    prevStrain = strain;
  }
  return snaps;
}

const mockSnapshots = buildMockSnapshots();
export const mockTrendSeries: TrendPoint[] = buildSeries(mockSnapshots);
export const mockInsights: Insight[] = computeInsights(mockSnapshots);
