import type { DashboardData, ActivitySession, ActivityType } from "./types";
import {
  computeRecovery,
  computeStrain,
  computeSleepPerformance,
  recoveryLabel,
  DEFAULT_BASELINES,
  type ZoneMinutes,
} from "./score";

const BASE = "https://health.googleapis.com/v4";

/**
 * Debug helper: hit a handful of data types and the profile endpoint, returning
 * the raw status + body for each so we can calibrate the parser against the
 * real Google Health response shapes. Never throws — collects errors inline.
 */
type Shape = "session" | "interval" | "sample" | "daily";

const PROBE_TYPES: { kebab: string; snake: string; shape: Shape }[] = [
  { kebab: "sleep", snake: "sleep", shape: "session" },
  { kebab: "steps", snake: "steps", shape: "interval" },
  { kebab: "heart-rate", snake: "heart_rate", shape: "sample" },
  { kebab: "weight", snake: "weight", shape: "sample" },
  { kebab: "oxygen-saturation", snake: "oxygen_saturation", shape: "sample" },
  { kebab: "daily-resting-heart-rate", snake: "daily_resting_heart_rate", shape: "daily" },
  { kebab: "daily-heart-rate-variability", snake: "daily_heart_rate_variability", shape: "daily" },
  { kebab: "exercise", snake: "exercise", shape: "session" },
];

const isoNoMillis = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

export function buildFilter(snake: string, shape: Shape, startTs: string, endTs: string, startDate: string, endDate: string): string {
  switch (shape) {
    case "session":
      return `${snake}.interval.end_time >= "${startTs}" AND ${snake}.interval.end_time < "${endTs}"`;
    case "interval":
      return `${snake}.interval.start_time >= "${startTs}" AND ${snake}.interval.start_time < "${endTs}"`;
    case "sample":
      return `${snake}.sample_time.physical_time >= "${startTs}" AND ${snake}.sample_time.physical_time < "${endTs}"`;
    case "daily":
      // .date only supports >= and < (not <=), so endDate must be exclusive (tomorrow).
      return `${snake}.date >= "${startDate}" AND ${snake}.date < "${endDate}"`;
  }
}

export async function rawProbe(accessToken: string) {
  // Wide window (last 7 days) so we definitely capture data points to inspect shapes.
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 7);
  const future = new Date(now);
  future.setDate(future.getDate() + 1);

  const startTs = isoNoMillis(past);
  const endTs = isoNoMillis(future);
  const startDate = dateOnly(past);
  const endDate = dateOnly(now);

  const out: Record<string, unknown> = {};

  for (const path of ["users/me/profile", "users/me/identity"]) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      out[path] = { status: res.status, body: await res.json().catch(() => res.statusText) };
    } catch (e) {
      out[path] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Civil timestamps (local wall-clock, no Z) for exercise.interval.civil_start_time.
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const civil = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

  for (const t of PROBE_TYPES) {
    // exercise filters on civil_start_time (start_time/end_time are rejected).
    const filter = t.kebab === "exercise"
      ? `exercise.interval.civil_start_time >= "${civil(past)}" AND exercise.interval.civil_start_time < "${civil(future)}"`
      : buildFilter(t.snake, t.shape, startTs, endTs, startDate, endDate);
    const url = new URL(`${BASE}/users/me/dataTypes/${t.kebab}/dataPoints`);
    url.searchParams.set("filter", filter);
    url.searchParams.set("pageSize", "3"); // just need a sample of the shape
    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      out[t.kebab] = {
        status: res.status,
        filter,
        body: await res.json().catch(() => res.statusText),
      };
    } catch (e) {
      out[t.kebab] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return out;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

// ── Real-shape types (from observed Google Health responses) ──
interface RawDataPoint {
  [k: string]: unknown;
}

const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
});

const isoNoMs = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** GET dataPoints for a kebab type with a fully-formed filter, following pages up to a cap. */
async function listDataPoints(
  token: string,
  kebab: string,
  filter: string,
  maxPages = 6,
  pageSize = 100,
): Promise<RawDataPoint[]> {
  const points: RawDataPoint[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const url = new URL(`${BASE}/users/me/dataTypes/${kebab}/dataPoints`);
    url.searchParams.set("filter", filter);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), { headers: HEADERS(token), cache: "no-store" });
    if (!res.ok) break;
    const json = (await res.json()) as { dataPoints?: RawDataPoint[]; nextPageToken?: string };
    if (json.dataPoints) points.push(...json.dataPoints);
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return points;
}

interface CivilDateTime {
  date: { year: number; month: number; day: number };
  time?: { hours?: number; minutes?: number; seconds?: number };
}
const civil = (d: Date): CivilDateTime => ({
  date: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
  time: { hours: 0, minutes: 0, seconds: 0 },
});

/** POST :dailyRollUp to get a daily aggregate (e.g. steps count_sum). */
async function dailyRollUp(token: string, kebab: string, start: Date, end: Date): Promise<RawDataPoint[]> {
  const res = await fetch(`${BASE}/users/me/dataTypes/${kebab}/dataPoints:dailyRollUp`, {
    method: "POST",
    headers: { ...HEADERS(token), "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ range: { start: civil(start), end: civil(end) }, windowSizeDays: 1 }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { rollupDataPoints?: RawDataPoint[] };
  return json.rollupDataPoints ?? [];
}

// Recursively find the first plausible numeric leaf whose key hints at the metric.
function findNumberByKeyHint(obj: unknown, hints: string[]): number | null {
  if (obj == null || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const kl = k.toLowerCase();
    if (hints.some((h) => kl.includes(h)) && (typeof v === "number" || typeof v === "string")) {
      const n = num(v);
      if (n) return n;
    }
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const found = findNumberByKeyHint(v, hints);
      if (found != null) return found;
    }
  }
  return null;
}

const STAGE_MAP: Record<string, "deep" | "rem" | "light" | "awake"> = {
  DEEP: "deep",
  REM: "rem",
  LIGHT: "light",
  AWAKE: "awake",
  WAKE: "awake",
};

/** Heart-rate samples → zone minutes, integrating the gap between consecutive samples. */
function zoneMinutesFromHr(samples: { t: number; bpm: number }[], maxHr: number): ZoneMinutes {
  const z: ZoneMinutes = { z0: 0, z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const gapMin = next ? Math.min((next.t - cur.t) / 60000, 2) : 0.5; // cap gaps at 2 min
    const pct = cur.bpm / maxHr;
    const zone = pct < 0.5 ? "z0" : pct < 0.6 ? "z1" : pct < 0.7 ? "z2" : pct < 0.8 ? "z3" : pct < 0.9 ? "z4" : "z5";
    z[zone] += gapMin;
  }
  return z;
}

/**
 * Fetch the user's latest metrics from Google Health and normalize to DashboardData.
 * Calibrated against real Fitbit-sourced responses. Each metric is independently
 * fail-safe — one missing data type won't break the rest.
 */
export async function fetchTodayDashboard(accessToken: string): Promise<DashboardData> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);
  const back = (days: number) => { const d = new Date(todayStart); d.setDate(d.getDate() - days); return d; };

  const ts = (d: Date) => isoNoMs(d);
  const dateStr = (d: Date) => d.toISOString().slice(0, 10); // UTC — fine for range filters
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Civil timestamp (local wall-clock, no timezone) — required by exercise.interval.civil_start_time.
  const civilTs = (d: Date) => `${localDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  // Profile (for age → maxHR), and all data types in parallel.
  const [profile, sleepPts, hrPts, weightPts, spo2Pts, dailyRhrPts, dailyHrvPts, stepsRollup, caloriesRollup, distanceRollup, azmRollup, exercisePts] = await Promise.all([
    fetch(`${BASE}/users/me/profile`, { headers: HEADERS(accessToken), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<{ age?: number } | null>,
    listDataPoints(accessToken, "sleep", `sleep.interval.end_time >= "${ts(back(2))}" AND sleep.interval.end_time < "${ts(tomorrow)}"`),
    listDataPoints(accessToken, "heart-rate", `heart_rate.sample_time.physical_time >= "${ts(todayStart)}" AND heart_rate.sample_time.physical_time < "${ts(tomorrow)}"`, 12),
    listDataPoints(accessToken, "weight", `weight.sample_time.physical_time >= "${ts(back(30))}" AND weight.sample_time.physical_time < "${ts(tomorrow)}"`),
    listDataPoints(accessToken, "oxygen-saturation", `oxygen_saturation.sample_time.physical_time >= "${ts(back(1))}" AND oxygen_saturation.sample_time.physical_time < "${ts(tomorrow)}"`),
    listDataPoints(accessToken, "daily-resting-heart-rate", `daily_resting_heart_rate.date >= "${dateStr(back(14))}" AND daily_resting_heart_rate.date < "${dateStr(tomorrow)}"`),
    listDataPoints(accessToken, "daily-heart-rate-variability", `daily_heart_rate_variability.date >= "${dateStr(back(14))}" AND daily_heart_rate_variability.date < "${dateStr(tomorrow)}"`),
    dailyRollUp(accessToken, "steps", todayStart, tomorrow),
    dailyRollUp(accessToken, "total-calories", todayStart, tomorrow),
    dailyRollUp(accessToken, "distance", todayStart, tomorrow),
    dailyRollUp(accessToken, "active-zone-minutes", todayStart, tomorrow),
    listDataPoints(accessToken, "exercise", `exercise.interval.civil_start_time >= "${civilTs(todayStart)}" AND exercise.interval.civil_start_time < "${civilTs(tomorrow)}"`, 4),
  ]);

  const age = profile?.age ?? 30;
  const maxHr = 220 - age;

  // ── Sleep — use the most recent session's summary ──
  const stages = { deep: 0, rem: 0, light: 0, awake: 0 };
  let minutesAsleep = 0, minutesAwake = 0, wakeUps = 0, cycles = 0;
  if (sleepPts.length) {
    const latest = sleepPts
      .map((p) => (p as { sleep?: Record<string, unknown> }).sleep)
      .filter(Boolean)
      .sort((a, b) => {
        const ae = (a as { interval?: { endTime?: string } }).interval?.endTime ?? "";
        const be = (b as { interval?: { endTime?: string } }).interval?.endTime ?? "";
        return be.localeCompare(ae);
      })[0] as { summary?: { stagesSummary?: { type: string; minutes: string; count: string }[]; minutesAsleep?: string; minutesAwake?: string } } | undefined;
    const summary = latest?.summary;
    if (summary?.stagesSummary) {
      for (const s of summary.stagesSummary) {
        const key = STAGE_MAP[s.type?.toUpperCase()];
        if (key) stages[key] += num(s.minutes);
        if (key === "awake") wakeUps += num(s.count);
        if (key === "rem") cycles += num(s.count); // REM episodes ≈ sleep cycles
      }
    }
    minutesAsleep = num(summary?.minutesAsleep) || stages.deep + stages.rem + stages.light;
    minutesAwake = num(summary?.minutesAwake) || stages.awake;
  }
  const stagesHours = {
    deep: +(stages.deep / 60).toFixed(2),
    rem: +(stages.rem / 60).toFixed(2),
    light: +(stages.light / 60).toFixed(2),
    awake: +(stages.awake / 60).toFixed(2),
  };
  const durationHours = +(minutesAsleep / 60).toFixed(1);
  const totalMinutes = minutesAsleep + minutesAwake;
  const sleepPerformance = computeSleepPerformance({
    durationGotHours: minutesAsleep / 60,
    durationNeededHours: DEFAULT_BASELINES.sleepHours,
    cyclesGot: cycles || 4,
    cyclesNeeded: DEFAULT_BASELINES.cycles,
    awakeMinutes: minutesAwake,
    totalMinutes: totalMinutes || 1,
  });

  // ── Heart rate samples ──
  const hrSamples = hrPts
    .map((p) => {
      const hr = (p as { heartRate?: { beatsPerMinute?: string; sampleTime?: { physicalTime?: string } } }).heartRate;
      return { t: new Date(hr?.sampleTime?.physicalTime ?? 0).getTime(), bpm: num(hr?.beatsPerMinute) };
    })
    .filter((s) => s.bpm > 0 && s.t > 0);

  // ── Daily resting HR & HRV series (sorted by date so "latest" is truly latest) ──
  const rhrSeries = [...dailyRhrPts]
    .sort((a, b) => dailyDateKey(a).localeCompare(dailyDateKey(b)))
    .map((p) => findNumberByKeyHint(p, ["bpm", "beats", "rate", "value"]))
    .filter((n): n is number => n != null && n > 20 && n < 200);
  const hrvSeries = [...dailyHrvPts]
    .sort((a, b) => dailyDateKey(a).localeCompare(dailyDateKey(b)))
    .map((p) => findNumberByKeyHint(p, ["milli", "ms", "rmssd", "variability", "value"]))
    .filter((n): n is number => n != null && n > 0 && n < 400);

  const restingHr = rhrSeries.length
    ? Math.round(rhrSeries[rhrSeries.length - 1])
    : hrSamples.length ? Math.round(Math.min(...hrSamples.map((s) => s.bpm))) : 0;
  const hrvMs = hrvSeries.length ? Math.round(hrvSeries[hrvSeries.length - 1]) : 0;

  // ── Strain from HR zone minutes ──
  const zones = zoneMinutesFromHr(hrSamples, maxHr);
  const dayStrain = computeStrain(zones);

  // ── Recovery (computed) ──
  const recoveryScore = computeRecovery({
    hrvMs: hrvMs || DEFAULT_BASELINES.hrvMs,
    hrvBaselineMs: DEFAULT_BASELINES.hrvMs,
    restingHr: restingHr || DEFAULT_BASELINES.restingHr,
    restingHrBaseline: DEFAULT_BASELINES.restingHr,
    sleepPerformance,
    yesterdayStrain: 0,
  });

  // ── Body ──
  const latestWeightG = weightPts.length
    ? findNumberByKeyHint(weightPts.sort((a, b) => sampleTime(b).localeCompare(sampleTime(a)))[0], ["grams"])
    : null;
  const weightKg = latestWeightG ? +(latestWeightG / 1000).toFixed(1) : null;

  const spo2Vals = spo2Pts
    .map((p) => findNumberByKeyHint(p, ["percentage", "percent"]))
    .filter((n): n is number => n != null && n > 70 && n <= 100); // filter obvious bad readings
  const spo2Pct = spo2Vals.length ? Math.round(spo2Vals.reduce((a, b) => a + b, 0) / spo2Vals.length) : null;

  // ── Activity (real daily rollups) ──
  const steps = stepsRollup.length ? num(findNumberByKeyHint(stepsRollup[0], ["count_sum", "count", "sum"])) : 0;
  const calories = caloriesRollup.length ? Math.round(num(findNumberByKeyHint(caloriesRollup[0], ["calorie", "energy", "kcal", "sum", "value"]))) : 0;
  // Google reports distance in millimeters (consistent with mm stride lengths in the profile).
  const distanceMm = distanceRollup.length ? num(findNumberByKeyHint(distanceRollup[0], ["meter", "distance", "sum", "value"])) : 0;
  const distanceKm = +(distanceMm / 1_000_000).toFixed(1);
  const azmReal = azmRollup.length ? Math.round(num(findNumberByKeyHint(azmRollup[0], ["minute", "azm", "sum", "value"]))) : 0;
  const activeZoneMinutes = azmReal || Math.round(zones.z2 + zones.z3 + zones.z4 + zones.z5);

  // ── Exercise sessions (real) ──
  const sessions = parseExerciseSessions(exercisePts, localDateStr(todayStart));

  // Attach a per-session HR graph (and derive true max/avg HR) from heart-rate samples in each window.
  await Promise.all(
    sessions.slice(0, 3).map(async (s) => {
      if (!s.startTime) return;
      const start = new Date(`${s.date}T${s.startTime}:00`);
      const end = new Date(start.getTime() + s.durationMin * 60000);
      const pts = await listDataPoints(
        accessToken,
        "heart-rate",
        `heart_rate.sample_time.physical_time >= "${ts(start)}" AND heart_rate.sample_time.physical_time < "${ts(end)}"`,
        6,
        1000,
      );
      const samples = pts
        .map((p) => {
          const hr = (p as { heartRate?: { beatsPerMinute?: string; sampleTime?: { physicalTime?: string } } }).heartRate;
          return { t: new Date(hr?.sampleTime?.physicalTime ?? 0).getTime(), bpm: num(hr?.beatsPerMinute) };
        })
        .filter((x) => x.bpm > 0 && x.t > 0)
        .sort((a, b) => a.t - b.t);
      if (samples.length) {
        s.hrSeries = downsample(samples.map((x) => x.bpm), 60);
        if (!s.avgHr) s.avgHr = Math.round(samples.reduce((a, x) => a + x.bpm, 0) / samples.length);
        s.maxHr = Math.max(...samples.map((x) => x.bpm));
      }
    }),
  );

  // Downsample HR to ~24 points for the sparkline.
  const rhrTrend = rhrSeries.slice(-24);
  const hrvTrend = hrvSeries.slice(-24);

  return {
    date: localDateStr(todayStart),
    lastSync: "just now",
    recovery: {
      score: recoveryScore,
      label: recoveryLabel(recoveryScore),
      hrvMs,
      restingHr,
      hrvTrend: hrvTrend.length ? hrvTrend : [hrvMs],
      rhrTrend: rhrTrend.length ? rhrTrend : [restingHr],
    },
    strain: { dayStrain, trend: downsample(hrSamples.map((s) => s.bpm), 24) },
    sleep: {
      performanceScore: sleepPerformance,
      durationHours,
      cycles: cycles || 0,
      wakeUps,
      stages: stagesHours,
      thirtyDayAvg: { performance: sleepPerformance, duration: durationHours, rem: stagesHours.rem, deep: stagesHours.deep },
    },
    activity: {
      steps,
      stepsGoal: 10000,
      activeZoneMinutes,
      calories,
      caloriesGoal: 2800,
      distanceKm,
    },
    body: { weightKg, spo2Pct, skinTempDeltaC: null },
    sessions,
  };
}

/** Find a {year,month,day} object anywhere in a daily data point → "YYYY-MM-DD". */
function dailyDateKey(p: RawDataPoint): string {
  let key = "";
  const walk = (o: unknown) => {
    if (key || !o || typeof o !== "object") return;
    const r = o as Record<string, unknown>;
    if (typeof r.year === "number" && typeof r.month === "number" && typeof r.day === "number") {
      key = `${r.year}-${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`;
      return;
    }
    for (const v of Object.values(r)) walk(v);
  };
  walk(p);
  return key;
}

/**
 * Backfill: bulk-fetch the last `days` days of daily-aggregate data from Google Health
 * and assemble one DashboardData snapshot per day. Uses lightweight daily endpoints
 * (no raw 1Hz heart rate), so a 30-day pull is a handful of requests, not millions of points.
 * Returns only days that actually have data.
 */
export async function fetchHistory(
  token: string,
  startDate: Date,
  endDate: Date,
): Promise<{ date: string; data: DashboardData }[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  const start = new Date(startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(endDate); end.setHours(0, 0, 0, 0); // exclusive
  const numDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const tsStart = isoNoMs(start), tsEnd = isoNoMs(end);
  const dStart = localKey(start), dEnd = localKey(end);
  const civilTs = (d: Date) => `${localKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  const profile = (await fetch(`${BASE}/users/me/profile`, { headers: HEADERS(token), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { age?: number } | null;

  const [sleepPts, rhrPts, hrvPts, weightPts, spo2Pts, stepsRollup, caloriesRollup, distanceRollup, azmRollup, exercisePts] = await Promise.all([
    listDataPoints(token, "sleep", `sleep.interval.end_time >= "${tsStart}" AND sleep.interval.end_time < "${tsEnd}"`, 40),
    listDataPoints(token, "daily-resting-heart-rate", `daily_resting_heart_rate.date >= "${dStart}" AND daily_resting_heart_rate.date < "${dEnd}"`),
    listDataPoints(token, "daily-heart-rate-variability", `daily_heart_rate_variability.date >= "${dStart}" AND daily_heart_rate_variability.date < "${dEnd}"`),
    listDataPoints(token, "weight", `weight.sample_time.physical_time >= "${tsStart}" AND weight.sample_time.physical_time < "${tsEnd}"`),
    listDataPoints(token, "oxygen-saturation", `oxygen_saturation.sample_time.physical_time >= "${tsStart}" AND oxygen_saturation.sample_time.physical_time < "${tsEnd}"`, 40),
    dailyRollUp(token, "steps", start, end),
    dailyRollUp(token, "total-calories", start, end),
    dailyRollUp(token, "distance", start, end),
    dailyRollUp(token, "active-zone-minutes", start, end),
    listDataPoints(token, "exercise", `exercise.interval.civil_start_time >= "${civilTs(start)}" AND exercise.interval.civil_start_time < "${civilTs(end)}"`, 20),
  ]);

  // Workouts, bucketed by their own start date.
  const sessionsByDate = new Map<string, ActivitySession[]>();
  for (const s of parseExerciseSessions(exercisePts, dStart)) {
    const arr = sessionsByDate.get(s.date) ?? [];
    arr.push(s);
    sessionsByDate.set(s.date, arr);
  }

  // ── Bucket by local date ──
  const sleepByDate = new Map<string, RawDataPoint>();
  for (const p of sleepPts) {
    const sleep = (p as { sleep?: { interval?: { endTime?: string }; summary?: { minutesAsleep?: string } } }).sleep;
    const end = sleep?.interval?.endTime;
    if (!end) continue;
    const key = localKey(new Date(end));
    const existing = sleepByDate.get(key) as { sleep?: { summary?: { minutesAsleep?: string } } } | undefined;
    if (!existing || num(sleep?.summary?.minutesAsleep) > num(existing.sleep?.summary?.minutesAsleep)) {
      sleepByDate.set(key, p);
    }
  }
  const mapNum = (pts: RawDataPoint[], hints: string[], lo: number, hi: number) => {
    const m = new Map<string, number>();
    for (const p of pts) {
      const k = dailyDateKey(p);
      const v = findNumberByKeyHint(p, hints);
      if (k && v != null && v > lo && v < hi) m.set(k, v);
    }
    return m;
  };
  const rhrByDate = mapNum(rhrPts, ["bpm", "beats", "rate", "value"], 20, 200);
  const hrvByDate = mapNum(hrvPts, ["milli", "ms", "rmssd", "variability", "value"], 0, 400);
  const stepsByDate = mapNum(stepsRollup, ["count_sum", "count", "sum", "steps"], -1, 1e6);
  const caloriesByDate = mapNum(caloriesRollup, ["calorie", "energy", "kcal", "sum", "value"], -1, 1e6);
  // Distance arrives in millimeters (same as the live dashboard); /1e6 → km below.
  const distanceMmByDate = mapNum(distanceRollup, ["meter", "distance", "sum", "value"], -1, 1e10);
  const azmByDate = mapNum(azmRollup, ["minutes", "azm", "sum", "value"], -1, 100000);
  const weightByDate = mapNum(weightPts, ["grams"], 1000, 500000);
  const spo2ByDate = new Map<string, number[]>();
  for (const p of spo2Pts) {
    const k = dailyDateKey(p);
    const v = findNumberByKeyHint(p, ["percentage", "percent"]);
    if (k && v != null && v > 70 && v <= 100) { const a = spo2ByDate.get(k) ?? []; a.push(v); spo2ByDate.set(k, a); }
  }

  const out: { date: string; data: DashboardData }[] = [];
  let lastWeightG: number | null = null;
  let prevStrain = 0;

  for (let i = 0; i < numDays; i++) {
    const day = addDays(start, i);
    const key = localKey(day);

    const sleepP = sleepByDate.get(key) as
      | { sleep?: { summary?: { stagesSummary?: { type: string; minutes: string; count: string }[]; minutesAsleep?: string; minutesAwake?: string } } }
      | undefined;
    const summary = sleepP?.sleep?.summary;

    const rhr = rhrByDate.get(key) ?? 0;
    const hrv = hrvByDate.get(key) ?? 0;
    const steps = stepsByDate.get(key) ?? 0;
    const calories = caloriesByDate.has(key) ? Math.round(caloriesByDate.get(key)!) : 0;
    const distanceKm = distanceMmByDate.has(key) ? +(distanceMmByDate.get(key)! / 1_000_000).toFixed(1) : 0;
    const azm = azmByDate.get(key) ?? 0;
    if (weightByDate.has(key)) lastWeightG = weightByDate.get(key)!;
    const spo2Arr = spo2ByDate.get(key);
    const daySessions = sessionsByDate.get(key) ?? [];

    const hasData = !!summary || rhr > 0 || steps > 0 || calories > 0 || daySessions.length > 0;
    if (!hasData) continue;

    const stages = { deep: 0, rem: 0, light: 0, awake: 0 };
    let minutesAsleep = 0, minutesAwake = 0, wakeUps = 0, cycles = 0;
    if (summary?.stagesSummary) {
      for (const s of summary.stagesSummary) {
        const sk = STAGE_MAP[s.type?.toUpperCase()];
        if (sk) stages[sk] += num(s.minutes);
        if (sk === "awake") wakeUps += num(s.count);
        if (sk === "rem") cycles += num(s.count);
      }
      minutesAsleep = num(summary.minutesAsleep) || stages.deep + stages.rem + stages.light;
      minutesAwake = num(summary.minutesAwake) || stages.awake;
    }
    const durationHours = +(minutesAsleep / 60).toFixed(1);
    const sleepPerformance = minutesAsleep
      ? computeSleepPerformance({
          durationGotHours: minutesAsleep / 60,
          durationNeededHours: DEFAULT_BASELINES.sleepHours,
          cyclesGot: cycles || 4,
          cyclesNeeded: DEFAULT_BASELINES.cycles,
          awakeMinutes: minutesAwake,
          totalMinutes: minutesAsleep + minutesAwake || 1,
        })
      : 0;

    const dayStrain = +Math.min(21, Math.log(1 + azm) * 3.2).toFixed(1);
    const recoveryScore = computeRecovery({
      hrvMs: hrv || DEFAULT_BASELINES.hrvMs,
      hrvBaselineMs: DEFAULT_BASELINES.hrvMs,
      restingHr: rhr || DEFAULT_BASELINES.restingHr,
      restingHrBaseline: DEFAULT_BASELINES.restingHr,
      sleepPerformance,
      yesterdayStrain: prevStrain,
    });
    prevStrain = dayStrain;

    out.push({
      date: key,
      data: {
        date: key,
        lastSync: "backfilled",
        recovery: {
          score: recoveryScore,
          label: recoveryLabel(recoveryScore),
          hrvMs: hrv ? Math.round(hrv) : 0,
          restingHr: rhr ? Math.round(rhr) : 0,
          hrvTrend: [],
          rhrTrend: [],
        },
        strain: { dayStrain, trend: [] },
        sleep: {
          performanceScore: sleepPerformance,
          durationHours,
          cycles,
          wakeUps,
          stages: {
            deep: +(stages.deep / 60).toFixed(2),
            rem: +(stages.rem / 60).toFixed(2),
            light: +(stages.light / 60).toFixed(2),
            awake: +(stages.awake / 60).toFixed(2),
          },
          thirtyDayAvg: { performance: sleepPerformance, duration: durationHours, rem: +(stages.rem / 60).toFixed(2), deep: +(stages.deep / 60).toFixed(2) },
        },
        activity: {
          steps,
          stepsGoal: 10000,
          activeZoneMinutes: Math.round(azm),
          calories,
          caloriesGoal: 2800,
          distanceKm,
        },
        body: {
          weightKg: lastWeightG ? +(lastWeightG / 1000).toFixed(1) : null,
          spo2Pct: spo2Arr?.length ? Math.round(spo2Arr.reduce((a, b) => a + b, 0) / spo2Arr.length) : null,
          skinTempDeltaC: null,
        },
        sessions: daySessions,
      },
    });
  }

  return out;
}

// Map Google/Fitbit exercise type strings to our ActivityType enum (for emoji + label).
const EXERCISE_TYPE_MAP: Record<string, ActivityType> = {
  STRENGTH_TRAINING: "strength", WEIGHTLIFTING: "strength", WEIGHTS: "strength", WEIGHT_TRAINING: "strength",
  WORKOUT: "activity", BOOTCAMP: "functional-fitness", FUNCTIONAL_STRENGTH_TRAINING: "functional-fitness",
  RUN: "running", RUNNING: "running", TREADMILL: "running",
  WALK: "walking", WALKING: "walking",
  BIKE: "cycling", BIKING: "cycling", CYCLING: "cycling", SPINNING: "cycling",
  TENNIS: "tennis", SWIM: "swimming", SWIMMING: "swimming", POOL_SWIM: "swimming",
  YOGA: "yoga", PILATES: "yoga",
  HIKE: "hiking-rucking", HIKING: "hiking-rucking",
  DANCE: "dance", RUGBY: "rugby", SKI: "skiing", SKIING: "skiing", SNOWBOARD: "skiing",
};

function mapExerciseType(raw: string): ActivityType {
  const k = (raw || "").toUpperCase().replace(/[\s-]+/g, "_");
  return EXERCISE_TYPE_MAP[k] ?? "activity";
}

interface ExerciseMetricsSummary {
  caloriesKcal?: number;
  averageHeartRateBeatsPerMinute?: string;
  distanceMillimeters?: number;
  averagePaceSecondsPerMeter?: number;
  elevationGainMillimeters?: number;
  heartRateZoneDurations?: { lightTime?: string; moderateTime?: string; vigorousTime?: string; peakTime?: string };
}
interface ExerciseBody {
  interval?: { startTime?: string; endTime?: string };
  exerciseType?: string;
  displayName?: string;
  metricsSummary?: ExerciseMetricsSummary;
}

// "1920s" → 1920 (seconds). parseFloat ignores the trailing unit.
const secs = (v: unknown) => (v == null ? 0 : parseFloat(String(v)) || 0);

/** Parse Google Health `exercise` session dataPoints into ActivitySession[].
 *  Calibrated against the real metricsSummary shape. Each session is dated by
 *  its own start time, so this works for both today and multi-day backfill. */
function parseExerciseSessions(pts: RawDataPoint[], fallbackDate: string): ActivitySession[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: ActivitySession[] = [];
  pts.forEach((p, i) => {
    const ex = ((p as { exercise?: ExerciseBody }).exercise ?? p) as ExerciseBody;
    const start = ex.interval?.startTime ? new Date(ex.interval.startTime) : null;
    const end = ex.interval?.endTime ? new Date(ex.interval.endTime) : null;
    const durationMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
    const date = start ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}` : fallbackDate;

    const ms = ex.metricsSummary ?? {};
    const displayName = ex.displayName;
    let type = mapExerciseType(ex.exerciseType ?? displayName ?? "activity");
    if (type === "activity" && displayName) {
      const fromName = mapExerciseType(displayName);
      if (fromName !== "activity") type = fromName;
    }

    const calories = Math.round(num(ms.caloriesKcal));
    const avgHr = Math.round(num(ms.averageHeartRateBeatsPerMinute));
    const distanceKm = ms.distanceMillimeters ? +(num(ms.distanceMillimeters) / 1_000_000).toFixed(2) : undefined;
    const paceMinPerKm = ms.averagePaceSecondsPerMeter ? +((num(ms.averagePaceSecondsPerMeter) * 1000) / 60).toFixed(2) : undefined;
    const elevationM = ms.elevationGainMillimeters ? Math.round(num(ms.elevationGainMillimeters) / 1000) : undefined;
    const startTime = start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : undefined;

    // Heart-rate zones from the Fitbit zone durations (seconds → minutes).
    const z = ms.heartRateZoneDurations;
    let zones: ActivitySession["zones"];
    if (z) {
      const light = secs(z.lightTime) / 60;
      const mod = secs(z.moderateTime) / 60;
      const vig = secs(z.vigorousTime) / 60;
      const peak = secs(z.peakTime) / 60;
      const inZone = light + mod + vig + peak;
      if (inZone > 0) {
        zones = {
          zone0Min: Math.max(0, Math.round(durationMin - inZone)),
          zone1Min: Math.round(light),
          zone2Min: Math.round(mod),
          zone3Min: Math.round(vig),
          zone4Min: Math.round(peak),
        };
      }
    }

    out.push({
      id: `ex-${date}-${i}`,
      type,
      label: displayName || undefined,
      date,
      startTime,
      durationMin,
      calories,
      strain: 0,
      avgHr,
      maxHr: 0, // not in the summary — derived from HR samples for today's sessions
      distanceKm: distanceKm && distanceKm > 0.05 ? distanceKm : undefined,
      paceMinPerKm,
      elevationM,
      zones,
    });
  });
  return out.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

function sampleTime(p: RawDataPoint): string {
  const findTime = (o: unknown): string => {
    if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (k === "physicalTime" && typeof v === "string") return v;
        if (v && typeof v === "object") { const t = findTime(v); if (t) return t; }
      }
    }
    return "";
  };
  return findTime(p);
}

function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}
