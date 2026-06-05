import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { aggregateActivities } from "@/lib/mockData";
import type { AllTimeStats, PersonalRecords, DashboardData, ActivitySession, DatedNumber } from "@/lib/types";

// Aggregates the user's real daily_snapshots into all-time stats + personal records.
// Optional ?from=YYYY-MM-DD limits the window to that start date onward.
export async function GET(request: Request) {
  const from = new URL(request.url).searchParams.get("from");
  const supabase = await getSupabaseServer();
  if (!supabase) return NextResponse.json({ hasData: false });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ hasData: false });

  let query = supabase
    .from("daily_snapshots")
    .select("date, data")
    .eq("user_id", session.user.id)
    .order("date", { ascending: true });
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("date", from);

  const { data: rows } = await query;

  const snaps = (rows ?? []).map((r) => ({ date: r.date as string, d: r.data as DashboardData }));
  if (snaps.length === 0) return NextResponse.json({ hasData: false, earliestAvailable: from ?? null });

  // Helpers to track min/max with the date they occurred.
  const maxBy = (sel: (d: DashboardData) => number, guard = (n: number) => true): DatedNumber => {
    let best: DatedNumber = { value: -Infinity, date: snaps[0].date };
    for (const s of snaps) { const v = sel(s.d); if (guard(v) && v > best.value) best = { value: v, date: s.date }; }
    return best;
  };
  const minBy = (sel: (d: DashboardData) => number, guard = (n: number) => true): DatedNumber => {
    let best: DatedNumber = { value: Infinity, date: snaps[0].date };
    for (const s of snaps) { const v = sel(s.d); if (guard(v) && v < best.value) best = { value: v, date: s.date }; }
    return best;
  };

  const hrvVals = snaps.map((s) => s.d.recovery.hrvMs).filter((v) => v > 0);
  const totalHoursSlept = Math.round(snaps.reduce((a, s) => a + s.d.sleep.durationHours, 0));
  const avgSleepHours = +(snaps.reduce((a, s) => a + s.d.sleep.durationHours, 0) / snaps.length).toFixed(1);
  const totalSteps = snaps.reduce((a, s) => a + (s.d.activity.steps || 0), 0);
  const avgHrv = hrvVals.length ? Math.round(hrvVals.reduce((a, v) => a + v, 0) / hrvVals.length) : 0;
  const peakHrv = maxBy((d) => d.recovery.hrvMs, (n) => n > 0).value;

  // Sleep debt = max(0, 7.5h need − got).
  const sleepDebt = maxBy((d) => Math.max(0, 7.5 - d.sleep.durationHours));

  // ── Activity totals ──
  const totalDistanceKm = +snaps.reduce((a, s) => a + (s.d.activity.distanceKm || 0), 0).toFixed(1);
  const totalCalories = snaps.reduce((a, s) => a + (s.d.activity.calories || 0), 0);
  const totalActiveZoneMin = snaps.reduce((a, s) => a + (s.d.activity.activeZoneMinutes || 0), 0);

  // ── Workouts across all snapshots ──
  const sessions: ActivitySession[] = snaps.flatMap((s) => s.d.sessions ?? []);
  const totalWorkouts = sessions.length;
  const totalWorkoutHours = +(sessions.reduce((a, s) => a + s.durationMin, 0) / 60).toFixed(1);

  // Most frequent activity by display name.
  const freq = new Map<string, number>();
  for (const s of sessions) {
    const name = s.label ?? s.type;
    freq.set(name, (freq.get(name) ?? 0) + 1);
  }
  let mostFrequentActivity = "—", mostFrequentActivityCount = 0;
  for (const [name, n] of freq) if (n > mostFrequentActivityCount) { mostFrequentActivity = name; mostFrequentActivityCount = n; }

  // ── Streaks & milestones ──
  let sleepStreak = 0, longestSleepStreak = 0;
  for (const s of snaps) {
    if (s.d.sleep.durationHours >= 7) { sleepStreak++; longestSleepStreak = Math.max(longestSleepStreak, sleepStreak); }
    else sleepStreak = 0;
  }
  const tenKStepDays = snaps.filter((s) => (s.d.activity.steps || 0) >= 10000).length;

  // Best 7-day window by steps (snaps are date-ascending).
  let bestWeekSteps = 0;
  for (let i = 0; i < snaps.length; i++) {
    let sum = 0;
    for (let j = i; j < snaps.length && j < i + 7; j++) sum += snaps[j].d.activity.steps || 0;
    bestWeekSteps = Math.max(bestWeekSteps, sum);
  }

  const stats: AllTimeStats = {
    totalDaysTracked: snaps.length,
    firstDayRecorded: snaps[0].date,
    totalHoursSlept,
    avgSleepHours,
    totalSteps,
    avgHrv,
    peakHrv: peakHrv === -Infinity ? 0 : Math.round(peakHrv),
    highestSleepDebt: { value: +sleepDebt.value.toFixed(1), date: sleepDebt.date },
    totalDistanceKm,
    totalCalories,
    totalActiveZoneMin,
    totalWorkouts,
    totalWorkoutHours,
    longestSleepStreak,
    tenKStepDays,
    bestWeekSteps,
    mostFrequentActivity,
    mostFrequentActivityCount,
  };

  // Longest workout (date of the day it occurred).
  let longestWorkout: DatedNumber = { value: 0, date: snaps[0].date };
  for (const s of snaps) for (const sess of s.d.sessions ?? []) {
    if (sess.durationMin > longestWorkout.value) longestWorkout = { value: sess.durationMin, date: s.date };
  }

  const records: PersonalRecords = {
    highestHrv: round(maxBy((d) => d.recovery.hrvMs, (n) => n > 0)),
    lowestRestingHr: round(minBy((d) => d.recovery.restingHr, (n) => n > 0)),
    longestSleep: round1(maxBy((d) => d.sleep.durationHours)),
    shortestSleep: round1(minBy((d) => d.sleep.durationHours, (n) => n > 0)),
    mostSteps: round(maxBy((d) => d.activity.steps, (n) => n > 0)),
    mostCalories: round(maxBy((d) => d.activity.calories, (n) => n > 0)),
    longestWorkout,
    mostActiveDay: round(maxBy((d) => d.activity.activeZoneMinutes, (n) => n > 0)),
  };

  // Activities — aggregate any exercise sessions stored across snapshots.
  const activities = sessions.length ? aggregateActivities(sessions) : [];

  return NextResponse.json({ hasData: true, stats, records, activities });
}

function round(d: DatedNumber): DatedNumber { return { value: Math.round(d.value), date: d.date }; }
function round1(d: DatedNumber): DatedNumber { return { value: +d.value.toFixed(1), date: d.date }; }
