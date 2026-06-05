"use client";

import { motion } from "framer-motion";
import { Sparkline } from "@/components/Sparkline";
import { activityEmoji } from "@/lib/activityVisuals";
import type { ActivitySession, HeartRateZones, Intensity } from "@/lib/types";

const ACTIVITY_META: Record<string, { label: string; emoji: string }> = {
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

const INTENSITY_COLOR: Record<Intensity, string> = {
  Easy: "var(--accent)",
  Moderate: "var(--orange)",
  Hard: "var(--red)",
};

const fmtTime = (t?: string) => {
  if (!t) return "";
  const [hh, mm] = t.split(":").map(Number);
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh < 12 ? "AM" : "PM";
  return `${h12}:${mm.toString().padStart(2, "0")} ${ampm}`;
};

const fmtPace = (mins?: number) => {
  if (mins == null) return "—";
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtMonthDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

interface Props {
  session: ActivitySession;
  delay?: number;
}

export function ActivityDetailCard({ session, delay = 0 }: Props) {
  const meta = ACTIVITY_META[session.type] ?? { label: session.type, emoji: "•" };
  const title = session.label ?? meta.label;
  const emoji = activityEmoji(title);
  const intensityColor = session.intensity ? INTENSITY_COLOR[session.intensity] : "var(--muted)";
  const strainPct = Math.min(100, (session.strain / 21) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="tile tile-tabular p-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-separator/60">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-2xl flex-shrink-0">
            {emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
              {session.intensity && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border"
                  style={{
                    color: intensityColor,
                    borderColor: intensityColor,
                    backgroundColor: "transparent",
                  }}
                >
                  {session.intensity}
                </span>
              )}
            </div>
            <div className="text-xs text-muted mt-1">
              {fmtMonthDay(session.date)}
              {session.startTime ? ` · ${fmtTime(session.startTime)}` : ""} · {session.durationMin} min
            </div>
            {session.strain > 0 && (
              <div className="mt-2 h-1 w-32 rounded-full bg-white/[0.05] dark:bg-white/[0.05] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${strainPct}%` }}
                  transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--accent), var(--blue))" }}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-start gap-6 flex-shrink-0 text-right">
          {session.strain > 0 && (
            <div>
              <div className="section-label">Strain</div>
              <div className="text-lg font-semibold mt-1" style={{ color: "var(--accent)" }}>
                {session.strain.toFixed(1)}
              </div>
            </div>
          )}
          {session.avgHr > 0 && (
            <div>
              <div className="section-label">Avg HR</div>
              <div className="text-lg font-semibold mt-1">{session.avgHr}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {session.calories > 0 && <Stat label="Calories" value={session.calories.toLocaleString()} unit="kcal" />}
        {session.avgHr > 0 && <Stat label="Avg HR" value={session.avgHr} unit="bpm" />}
        {session.maxHr > 0 && <Stat label="Max HR" value={session.maxHr} unit="bpm" />}
        {session.distanceKm != null && session.distanceKm > 0 && (
          <Stat label="Distance" value={session.distanceKm.toFixed(2)} unit="km" />
        )}
        {session.paceMinPerKm != null && (
          <Stat label="Pace" value={fmtPace(session.paceMinPerKm)} unit="/km" />
        )}
        {session.elevationM != null && (
          <Stat label="Elevation" value={session.elevationM} unit="m" />
        )}
      </div>

      {/* Heart rate graph */}
      {session.hrSeries && session.hrSeries.length > 1 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1">
            <div className="section-label">Heart Rate</div>
            <div className="text-xs text-muted tile-tabular">
              {session.avgHr > 0 && <span>avg {session.avgHr}</span>}
              {session.maxHr > 0 && <span className="ml-2">max <span className="text-foreground/80">{session.maxHr}</span> bpm</span>}
            </div>
          </div>
          <div className="-mx-1">
            <Sparkline data={session.hrSeries} color="var(--red)" unit="bpm" height={88} />
          </div>
        </div>
      )}

      {/* Heart rate zones */}
      {session.zones && <HeartRateZonesBar zones={session.zones} delay={delay + 0.2} />}
    </motion.div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-surface-2 rounded-2xl p-3.5 tile-tabular">
      <div className="section-label">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-muted text-xs">{unit}</span>}
      </div>
    </div>
  );
}

const ZONE_META = [
  { key: "zone0Min", label: "Zone 0", range: "<50%", color: "rgba(180,180,190,0.55)" },
  { key: "zone1Min", label: "Zone 1", range: "50–60%", color: "var(--blue)" },
  { key: "zone2Min", label: "Zone 2", range: "60–70%", color: "var(--accent)" },
  { key: "zone3Min", label: "Zone 3", range: "70–80%", color: "var(--orange)" },
  { key: "zone4Min", label: "Zone 4", range: "80%+", color: "var(--red)" },
] as const;

function HeartRateZonesBar({ zones, delay }: { zones: HeartRateZones; delay: number }) {
  const total = ZONE_META.reduce((s, z) => s + zones[z.key], 0);
  return (
    <div className="mt-5">
      <div className="section-label mb-2">Heart Rate Zones</div>
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/[0.04] gap-[2px]">
        {ZONE_META.map((z, i) => {
          const mins = zones[z.key];
          const pct = total === 0 ? 0 : (mins / total) * 100;
          return (
            <motion.div
              key={z.key}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, delay: delay + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
              style={{
                background: z.color,
                borderRadius:
                  i === 0
                    ? "999px 4px 4px 999px"
                    : i === ZONE_META.length - 1
                    ? "4px 999px 999px 4px"
                    : "4px",
              }}
              aria-label={`${z.label}: ${mins} minutes`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-2 mt-3 text-xs">
        {ZONE_META.filter((z) => zones[z.key] > 0).map((z) => (
          <div key={z.key} className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: z.color }} />
            <div className="leading-tight">
              <div className="text-foreground font-medium tile-tabular">{zones[z.key]}m</div>
              <div className="text-muted text-[10px]">
                {z.label} · {z.range}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
