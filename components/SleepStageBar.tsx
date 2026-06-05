"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { SleepStage } from "@/lib/types";

interface Stage {
  key: SleepStage;
  label: string;
  hours: number;
  color: string;
  blurb: string;
  target: string;
}

interface Props {
  stages: Record<SleepStage, number>;
}

const stageMeta: Record<SleepStage, Omit<Stage, "hours" | "key">> = {
  deep: {
    label: "Deep Sleep",
    color: "var(--purple)",
    blurb: "Physical recovery — muscle repair, immune support, growth hormone.",
    target: "Target: 13–23% of sleep",
  },
  rem: {
    label: "REM Sleep",
    color: "var(--blue)",
    blurb: "Memory consolidation and emotional processing — dreaming happens here.",
    target: "Target: 20–25% of sleep",
  },
  light: {
    label: "Light Sleep",
    color: "var(--accent)",
    blurb: "Transitional sleep between deep and REM — still beneficial and restorative.",
    target: "Target: 45–55% of sleep",
  },
  awake: {
    label: "Awake",
    color: "rgba(255,255,255,0.25)",
    blurb: "Brief wake periods — normal and usually unremembered.",
    target: "Target: under 10% of sleep",
  },
};

export function SleepStageBar({ stages }: Props) {
  const total = stages.deep + stages.rem + stages.light + stages.awake;
  const order: SleepStage[] = ["deep", "rem", "light", "awake"];
  const items: Stage[] = order.map((k) => ({ key: k, hours: stages[k], ...stageMeta[k] }));
  const [active, setActive] = useState<SleepStage>("light");
  const activeItem = items.find((i) => i.key === active)!;

  return (
    <div className="tile p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="section-label">Sleep Stages</div>
        <div className="flex items-center gap-4 text-xs text-muted">
          {items.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="capitalize">{s.label.replace(" Sleep", "")}</span>
              <span className="text-foreground/80 tile-tabular">{s.hours.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-white/[0.03] gap-[2px]">
        {items.map((s, idx) => {
          const pct = (s.hours / total) * 100;
          return (
            <motion.button
              key={s.key}
              onMouseEnter={() => setActive(s.key)}
              onFocus={() => setActive(s.key)}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, delay: 0.1 + idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="h-full cursor-pointer focus:outline-none transition-[filter,opacity] duration-200 ease-out hover:brightness-110"
              style={{
                background: s.color,
                opacity: active === s.key ? 1 : 0.78,
                borderRadius: idx === 0 ? "999px 4px 4px 999px" : idx === items.length - 1 ? "4px 999px 999px 4px" : "4px",
                filter: active === s.key ? "brightness(1.05)" : undefined,
              }}
              aria-label={`${s.label}: ${s.hours} hours`}
            />
          );
        })}
      </div>

      <motion.div
        key={active}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-4 flex items-start gap-3 rounded-2xl bg-white/[0.025] p-3.5"
      >
        <span className="mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: activeItem.color }} />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium tile-tabular" style={{ color: activeItem.color }}>
              {activeItem.label}
            </span>
            <span className="text-sm text-muted tile-tabular">
              {activeItem.hours.toFixed(1)}h · {((activeItem.hours / total) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-sm text-muted mt-0.5">{activeItem.blurb}</div>
          <div className="text-xs mt-1 tile-tabular" style={{ color: activeItem.color, opacity: 0.85 }}>
            {activeItem.target}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
