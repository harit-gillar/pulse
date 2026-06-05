"use client";

import { motion } from "framer-motion";
import { MetricTile } from "@/components/MetricTile";
import { Ring } from "@/components/Ring";
import { StagesRing } from "@/components/StagesRing";
import { SleepStageBar } from "@/components/SleepStageBar";
import { ProgressBar } from "@/components/ProgressBar";
import { InfoTooltip } from "@/components/InfoTooltip";
import { ActivityDetailCard } from "@/components/ActivityDetailCard";
import { useSettings, toDistance, toWeight } from "@/lib/useSettings";
import type { DashboardData } from "@/lib/types";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function labelsBack(endIso: string, n: number): string[] {
  const out: string[] = [];
  const end = new Date(endIso + "T00:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(`${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`);
  }
  return out;
}

interface Props {
  data: DashboardData;
  greeting?: string;
  headerRight?: React.ReactNode;
  headerLeftExtra?: React.ReactNode;
  footer?: React.ReactNode;
}

export function DashboardView({ data, greeting, headerRight, headerLeftExtra, footer }: Props) {
  const { recovery, sleep, activity, body } = data;
  const { settings } = useSettings();
  const trendLabels = labelsBack(data.date, 24);
  const sessions = data.sessions ?? [];
  const stepsGoal = settings.stepsGoal;
  const caloriesGoal = settings.caloriesGoal;

  const delta = (current: number, avg: number, digits = 0) => {
    const diff = +(current - avg).toFixed(digits + 1);
    const sign = diff > 0 ? "+" : "";
    return { text: `${sign}${diff.toFixed(digits + 1)}`, positive: diff >= 0 };
  };

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8 sm:py-10 w-full">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-10"
      >
        <div>
          {headerLeftExtra}
          {greeting && <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">{greeting}</h1>}
        </div>
        {headerRight}
      </motion.header>

      {/* TODAY — Sleep hero + Steps + HRV + Resting HR */}
      <section className="mb-10">
        <div className="section-label mb-3">Today</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sleep hero ring */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            onMouseMove={(e) => {
              const el = e.currentTarget;
              const r = el.getBoundingClientRect();
              el.style.setProperty("--mx", `${e.clientX - r.left}px`);
              el.style.setProperty("--my", `${e.clientY - r.top}px`);
            }}
            className="tile tile-tabular p-5 flex flex-col items-center justify-center gap-4 min-h-[260px]"
          >
            <div className="section-label self-stretch text-center">
              <InfoTooltip
                content={{
                  desc: "Total time asleep last night and how it broke down across stages. Straight from Google Health — your real sleep, no invented score.",
                  source: "Google",
                }}
              >
                Sleep
              </InfoTooltip>
            </div>
            <StagesRing stages={sleep.stages} size={170} stroke={14} gap={4}>
              <div className="text-center leading-none">
                <div className="text-[34px] font-semibold tracking-tight tile-tabular">{fmtDuration(sleep.durationHours)}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted mt-2">Asleep</div>
              </div>
            </StagesRing>
            <div className="flex items-center gap-3 text-[11px] tile-tabular">
              <Legend color="var(--purple)" label="Deep" value={`${sleep.stages.deep.toFixed(1)}h`} />
              <Legend color="var(--blue)" label="REM" value={`${sleep.stages.rem.toFixed(1)}h`} />
              <Legend color="var(--accent)" label="Light" value={`${sleep.stages.light.toFixed(1)}h`} />
            </div>
            <div className="text-xs text-muted tile-tabular">
              {sleep.cycles > 0 && (
                <>
                  <span className="text-foreground/80">{sleep.cycles} cycles</span>
                  <span className="mx-1.5">·</span>
                </>
              )}
              {sleep.wakeUps} wake-up{sleep.wakeUps === 1 ? "" : "s"}
            </div>
          </motion.div>

          <MetricTile
            label="Steps"
            value={activity.steps.toLocaleString()}
            sub={`Goal ${stepsGoal.toLocaleString()}`}
            delay={0.06}
          >
            <div className="mt-3">
              <ProgressBar value={activity.steps} max={stepsGoal} color="var(--accent)" delay={0.3} />
            </div>
          </MetricTile>
          <MetricTile
            label="HRV"
            value={recovery.hrvMs}
            unit="ms"
            sub="Last night"
            spark={{ data: recovery.hrvTrend, color: "var(--blue)", labels: trendLabels, unit: "ms" }}
            delay={0.12}
          />
          <MetricTile
            label="Resting HR"
            value={recovery.restingHr}
            unit="bpm"
            sub="Last night"
            spark={{ data: recovery.rhrTrend, color: "var(--orange)", labels: trendLabels, unit: "bpm" }}
            delay={0.18}
          />
        </div>
      </section>

      {/* SLEEP — detail only (hero ring already covers Performance + Duration totals above) */}
      <section className="mb-10">
        <div className="section-label mb-3">Last night&apos;s sleep</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <MetricTile
            label="Duration"
            value={sleep.durationHours.toFixed(1)}
            unit="hrs"
            sub={`${sleep.cycles} cycles · ${sleep.wakeUps} wake-ups`}
            delay={0.04}
            footer={
              <div className="flex justify-between">
                <span>30d avg: <span className="text-foreground/80">{sleep.thirtyDayAvg.duration}h</span></span>
                <span style={{ color: "var(--accent)" }}>{delta(sleep.durationHours, sleep.thirtyDayAvg.duration, 0).text}h</span>
              </div>
            }
          />
          <MetricTile
            label="REM"
            value={sleep.stages.rem.toFixed(1)}
            unit="hrs"
            sub={`${((sleep.stages.rem / sleep.durationHours) * 100).toFixed(0)}% of sleep`}
            valueColor="var(--blue)"
            delay={0.1}
            footer={
              <div className="flex justify-between">
                <span>30d avg: <span className="text-foreground/80">{sleep.thirtyDayAvg.rem}h</span></span>
                <span style={{ color: "var(--blue)" }}>{delta(sleep.stages.rem, sleep.thirtyDayAvg.rem, 0).text}h</span>
              </div>
            }
          />
          <MetricTile
            label="Deep Sleep"
            value={sleep.stages.deep.toFixed(1)}
            unit="hrs"
            sub={`${((sleep.stages.deep / sleep.durationHours) * 100).toFixed(0)}% of sleep`}
            valueColor="var(--purple)"
            delay={0.16}
            footer={
              <div className="flex justify-between">
                <span>30d avg: <span className="text-foreground/80">{sleep.thirtyDayAvg.deep}h</span></span>
                <span className="text-muted">{delta(sleep.stages.deep, sleep.thirtyDayAvg.deep, 0).text}h</span>
              </div>
            }
          />
        </div>
        <SleepStageBar stages={sleep.stages} />
      </section>

      {/* ACTIVITY */}
      <section className="mb-10">
        <div className="section-label mb-3">Activity</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricTile label="Active Zone Min" value={activity.activeZoneMinutes} unit="min" sub="Today" delay={0.04} />
          <MetricTile label="Calories" value={activity.calories.toLocaleString()} sub={`Goal ${caloriesGoal.toLocaleString()}`} delay={0.1}>
            <div className="mt-3"><ProgressBar value={activity.calories} max={caloriesGoal} color="var(--orange)" delay={0.3} /></div>
          </MetricTile>
          <MetricTile label="Distance" value={toDistance(activity.distanceKm, settings.distanceUnit).toFixed(1)} unit={settings.distanceUnit} sub="Today" delay={0.16} />
        </div>
      </section>

      {/* BODY */}
      <section className="mb-10">
        <div className="section-label mb-3">Body</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {body.weightKg !== null && (
            <MetricTile label="Weight" value={toWeight(body.weightKg, settings.weightUnit).toFixed(1)} unit={settings.weightUnit} sub="Latest log" delay={0.04} />
          )}
          {body.spo2Pct !== null && (
            <MetricTile label="SpO₂" value={body.spo2Pct} unit="%" sub="Overnight avg" delay={0.1} />
          )}
          {body.skinTempDeltaC !== null && (
            <MetricTile
              label="Skin Temp"
              value={`${body.skinTempDeltaC > 0 ? "+" : ""}${body.skinTempDeltaC.toFixed(1)}`}
              unit="°C"
              sub="From baseline"
              delay={0.16}
            />
          )}
        </div>
      </section>

      {/* TODAY'S ACTIVITIES */}
      {sessions.length > 0 && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <div className="section-label">Today&apos;s Activities</div>
            <div className="text-xs text-muted">{sessions.length} session{sessions.length === 1 ? "" : "s"}</div>
          </div>
          <div className="flex flex-col gap-4">
            {sessions.map((s, i) => (
              <ActivityDetailCard key={s.id} session={s} delay={i * 0.06} />
            ))}
          </div>
        </section>
      )}

      {footer}
    </main>
  );
}

function fmtDuration(hours: number): string {
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return `${h}h ${m}m`;
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="text-foreground/90 font-medium">{value}</span>
    </div>
  );
}
