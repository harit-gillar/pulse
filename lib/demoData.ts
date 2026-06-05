import type { DashboardData, ActivitySession } from "./types";

// A curated "professional tennis player" demo profile. Deterministic (no
// Math.random) so server and client render identically.

const DEMO_DATE = "2026-06-04";

const hrCurve = (base: number, amp: number, seed = 1, n = 56) =>
  Array.from({ length: n }, (_, i) =>
    Math.round(base + Math.sin((i + seed) / 4) * amp + Math.sin((i + seed) / 1.4) * amp * 0.35),
  );

const trend = (base: number, amp: number, seed = 1, n = 24) =>
  Array.from({ length: n }, (_, i) => +(base + Math.sin((i + seed) / 1.7) * amp).toFixed(1));

export const demoSessions: ActivitySession[] = [
  {
    id: "demo-tennis",
    type: "tennis",
    label: "Tennis Training",
    date: DEMO_DATE,
    startTime: "09:00",
    durationMin: 120,
    calories: 1020,
    strain: 0,
    avgHr: 142,
    maxHr: 181,
    distanceKm: 4.8,
    zones: { zone0Min: 8, zone1Min: 18, zone2Min: 34, zone3Min: 42, zone4Min: 18 },
    hrSeries: hrCurve(144, 30, 3),
  },
  {
    id: "demo-gym",
    type: "strength",
    label: "Strength & Conditioning",
    date: DEMO_DATE,
    startTime: "14:30",
    durationMin: 65,
    calories: 470,
    strain: 0,
    avgHr: 121,
    maxHr: 158,
    zones: { zone0Min: 16, zone1Min: 26, zone2Min: 17, zone3Min: 6, zone4Min: 0 },
    hrSeries: hrCurve(120, 20, 7),
  },
  {
    id: "demo-run",
    type: "running",
    label: "Recovery Run",
    date: DEMO_DATE,
    startTime: "18:00",
    durationMin: 32,
    calories: 360,
    strain: 0,
    avgHr: 134,
    maxHr: 159,
    distanceKm: 6.1,
    paceMinPerKm: 5.25,
    elevationM: 48,
    zones: { zone0Min: 2, zone1Min: 7, zone2Min: 15, zone3Min: 7, zone4Min: 1 },
    hrSeries: hrCurve(133, 16, 11),
  },
];

export const demoDashboard: DashboardData = {
  date: DEMO_DATE,
  lastSync: "just now",
  recovery: {
    score: 86,
    label: "Optimal",
    hrvMs: 94,
    restingHr: 43,
    hrvTrend: trend(90, 6, 5),
    rhrTrend: trend(44, 2, 9),
  },
  strain: { dayStrain: 16.4, trend: trend(9, 4, 13) },
  sleep: {
    performanceScore: 94,
    durationHours: 8.6,
    cycles: 6,
    wakeUps: 2,
    stages: { deep: 1.9, rem: 2.2, light: 4.2, awake: 0.3 },
    thirtyDayAvg: { performance: 90, duration: 8.4, rem: 2.1, deep: 1.8 },
  },
  activity: {
    steps: 14280,
    stepsGoal: 12000,
    activeZoneMinutes: 96,
    calories: 3680,
    caloriesGoal: 3500,
    distanceKm: 11.2,
  },
  body: { weightKg: 78.4, spo2Pct: 98, skinTempDeltaC: 0.1 },
  sessions: demoSessions,
};
