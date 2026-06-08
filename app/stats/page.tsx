"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { MetricTile } from "@/components/MetricTile";
import { Calendar } from "@/components/Calendar";
import { ActivitiesPanel } from "@/components/ActivitiesPanel";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { todayISO, addDaysISO } from "@/lib/dates";
import { loadSettings, useSettings } from "@/lib/useSettings";
import type { AllTimeStats, PersonalRecords, ActivityAggregate } from "@/lib/types";

type Status = "loading" | "live" | "empty" | "signin";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmtShort = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};
const fmtLong = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const PRESETS: { label: string; days: number | null }[] = [
  { label: "All time", days: null },
  { label: "90d", days: 90 },
  { label: "30d", days: 30 },
  { label: "7d", days: 7 },
];

export default function StatsPage() {
  const supabase = getSupabaseBrowser();
  const { update } = useSettings();
  const [s, setS] = useState<AllTimeStats | null>(null);
  const [p, setP] = useState<PersonalRecords | null>(null);
  const [activities, setActivities] = useState<ActivityAggregate[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const today = todayISO();
  const [from, setFrom] = useState<string>(""); // "" = all time
  const [earliest, setEarliest] = useState<string>("2024-01-01");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Persist a custom start date so it sticks across visits.
  const setAndSaveFrom = (d: string) => { setFrom(d); update({ statsFrom: d }); };

  // Apply the saved default stats window + fetch the available range for the picker.
  useEffect(() => {
    const saved = loadSettings().statsFrom;
    if (saved) setFrom(saved);
    if (!supabase) return;
    fetch("/api/snapshots").then((r) => r.json()).then((d) => {
      if (d.dates?.length) setEarliest(d.dates[0]);
    }).catch(() => {});
  }, [supabase]);

  // Fetch stats whenever the window changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setStatus("signin"); return; }
      const res = await fetch(`/api/stats${from ? `?from=${from}` : ""}`);
      if (cancelled) return;
      if (!res.ok) { setStatus(res.status === 401 ? "signin" : "empty"); return; }
      const json = await res.json();
      if (json.hasData) {
        setS(json.stats);
        setP(json.records);
        setActivities(json.activities ?? []);
        setStatus("live");
      } else {
        setS(null);
        setP(null);
        setActivities([]);
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
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {from ? "Your numbers." : "Your numbers, all-time."}
        </h1>
        <p className="text-sm text-muted mt-1">
          {status === "live" && s
            ? `Across ${s.totalDaysTracked} day${s.totalDaysTracked === 1 ? "" : "s"} since ${fmtLong(s.firstDayRecorded)}.`
            : "Your all-time numbers, records, and activity breakdown."}
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
                    if (preset.days === null) setAndSaveFrom("");      // All time persists
                    else setFrom(addDaysISO(today, -preset.days));     // relative presets are session-only
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

      {status !== "live" || !s || !p ? (
        <StatsEmpty status={status} />
      ) : (
        <>
      {/* OVERVIEW */}
      <section className="mb-10">
        <div className="section-label mb-3">Overview</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricTile label="Total Days Tracked" value={s.totalDaysTracked} sub={`Since ${fmtLong(s.firstDayRecorded)}`} delay={0.02} />
          <MetricTile label="First Day Recorded" value={fmtLong(s.firstDayRecorded)} sub="When your journey began" delay={0.04} />
          <MetricTile label="Total Hours Slept" value={s.totalHoursSlept.toLocaleString()} unit="hrs" sub="All time" delay={0.06} />
          <MetricTile label="Avg Sleep Duration" value={s.avgSleepHours.toFixed(1)} unit="hrs" valueColor="var(--blue)" sub="Per night" delay={0.08} />

          <MetricTile label="Total Steps" value={s.totalSteps.toLocaleString()} valueColor="var(--accent)" sub="All time" delay={0.1} />
          <MetricTile label="Avg HRV" value={s.avgHrv} unit="ms" valueColor="var(--blue)" sub="All-time average" delay={0.12} />
          <MetricTile label="Peak HRV" value={s.peakHrv} unit="ms" valueColor="var(--blue)" sub="Personal best" delay={0.14} />
          <MetricTile label="Highest Sleep Debt" value={s.highestSleepDebt.value.toFixed(1)} unit="hrs" valueColor="var(--red)" sub={fmtShort(s.highestSleepDebt.date)} delay={0.16} />
        </div>
      </section>

      {/* ACTIVITY TOTALS */}
      <section className="mb-10">
        <div className="section-label mb-3">Activity Totals</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricTile label="Total Distance" value={s.totalDistanceKm.toLocaleString()} unit="km" valueColor="var(--accent)" sub={`≈ ${(s.totalDistanceKm / 42.195).toFixed(1)} marathons`} delay={0.02} />
          <MetricTile label="Total Calories" value={s.totalCalories.toLocaleString()} unit="kcal" valueColor="var(--orange)" sub="Burned, all time" delay={0.04} />
          <MetricTile label="Active Zone Min" value={s.totalActiveZoneMin.toLocaleString()} unit="min" valueColor="var(--pink)" sub="All time" delay={0.06} />
          <MetricTile label="Total Workouts" value={s.totalWorkouts.toLocaleString()} sub={`${s.totalWorkoutHours.toLocaleString()} hrs logged`} delay={0.08} />
        </div>
      </section>

      {/* MILESTONES */}
      <section className="mb-10">
        <div className="section-label mb-3">Milestones</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricTile label="Longest Sleep Streak" value={s.longestSleepStreak} unit="nights" valueColor="var(--blue)" sub="7h+ in a row" delay={0.02} />
          <MetricTile label="10k Step Days" value={s.tenKStepDays} valueColor="var(--accent)" sub="Goal hit" delay={0.04} />
          <MetricTile label="Best Week" value={s.bestWeekSteps.toLocaleString()} unit="steps" valueColor="var(--accent)" sub="Any 7-day window" delay={0.06} />
          <MetricTile label="Go-To Activity" value={s.mostFrequentActivity} sub={`${s.mostFrequentActivityCount} sessions`} delay={0.08} />
        </div>
      </section>

      {/* PERSONAL RECORDS */}
      <section className="mb-10">
        <div className="section-label mb-3">Personal Records</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <RecordTile label="Highest HRV" value={p.highestHrv.value} unit="ms" color="var(--blue)" date={p.highestHrv.date} delay={0.02} />
          <RecordTile label="Lowest Resting HR" value={p.lowestRestingHr.value} unit="bpm" color="var(--accent)" date={p.lowestRestingHr.date} delay={0.04} />
          <RecordTile label="Most Steps" value={p.mostSteps.value.toLocaleString()} unit="" color="var(--accent)" date={p.mostSteps.date} delay={0.06} />
          <RecordTile label="Most Calories" value={p.mostCalories.value.toLocaleString()} unit="kcal" color="var(--orange)" date={p.mostCalories.date} delay={0.08} />
          <RecordTile label="Longest Workout" value={p.longestWorkout.value} unit="min" color="var(--pink)" date={p.longestWorkout.date} delay={0.1} />
          <RecordTile label="Most Active Day" value={p.mostActiveDay.value} unit="AZM" color="var(--pink)" date={p.mostActiveDay.date} delay={0.12} />
          <RecordTile label="Longest Sleep" value={p.longestSleep.value} unit="hrs" color="var(--blue)" date={p.longestSleep.date} delay={0.14} />
          <RecordTile label="Shortest Sleep" value={p.shortestSleep.value} unit="hrs" color="var(--orange)" date={p.shortestSleep.date} delay={0.16} />
        </div>
      </section>

      {/* ACTIVITIES */}
      <section className="mb-10">
        <div className="section-label mb-3">Activities</div>
        {activities.length > 0 ? (
          <ActivitiesPanel aggregates={activities} />
        ) : (
          <div className="tile p-8 text-center">
            <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
              No workout sessions recorded yet. Logged exercises from your watch will appear here as they sync to Google Health.
            </p>
          </div>
        )}
      </section>

      <footer className="text-xs text-muted text-center pt-4 pb-2">
        Computed from your real Google Health history.
      </footer>
        </>
      )}
    </main>
  );
}

function StatsEmpty({ status }: { status: Status }) {
  if (status === "loading") {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <div className="mb-4 h-6 w-6 rounded-full border-2 border-separator border-t-foreground animate-spin" />
        <p className="text-sm text-muted">Loading your numbers…</p>
      </div>
    );
  }
  if (status === "signin") {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in to see your numbers</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Connect Google Health to see your all-time stats and personal records.
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
      <h2 className="text-2xl font-semibold tracking-tight">No numbers yet</h2>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        Once you connect Google Health and accumulate history, these tiles light up with your real
        numbers. Pull your past history from Settings to get started.
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

function RecordTile({
  label, value, unit, color, date, delay,
}: { label: string; value: number | string; unit: string; color: string; date: string; delay: number }) {
  return (
    <Link
      href={`/dashboard/${date}`}
      className="block focus:outline-none focus:ring-2 focus:ring-foreground/20 rounded-[22px]"
    >
      <MetricTile
        label={label}
        value={value}
        unit={unit}
        valueColor={color}
        sub={fmtShort(date)}
        delay={delay}
      />
    </Link>
  );
}
