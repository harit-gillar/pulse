"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { ActivityAggregate } from "@/lib/types";

interface Props {
  aggregates: ActivityAggregate[];
}

export function ActivitiesPanel({ aggregates }: Props) {
  const total = aggregates.reduce((s, a) => s + a.count, 0);
  const maxCount = Math.max(...aggregates.map((a) => a.count));
  const [openType, setOpenType] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="tile p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-separator/60">
        <span className="text-base font-semibold tracking-tight">Total Activities</span>
        <span className="text-2xl font-semibold tile-tabular">{total}</span>
      </div>

      <div className="divide-y divide-separator/40">
        {aggregates.map((a, i) => {
          const open = openType === a.type;
          return (
            <div key={a.type}>
              <button
                onClick={() => setOpenType(open ? null : a.type)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.015] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{a.emoji}</span>
                  <span className="text-sm font-medium">{a.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(a.count / maxCount) * 100}%` }}
                      transition={{ duration: 0.9, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-blue"
                    />
                  </div>
                  <span className="tile-tabular text-sm font-medium w-8 text-right">{a.count}</span>
                  <span className={`text-muted text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden bg-black/30"
                  >
                    <div className="px-5 pt-4 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="Longest Session" value={a.longestSessionMin} unit="min" />
                      <Stat label="Avg Duration" value={a.avgDurationMin} unit="min" />
                      <Stat label="Most Calories" value={a.mostCaloriesSingleSession.toLocaleString()} unit="kcal" />
                      <Stat label="Total Calories" value={a.totalCalories.toLocaleString()} unit="kcal" />
                      <Stat label="Avg Heart Rate" value={a.avgHr} unit="bpm" />
                      {a.maxHr > 0 && <Stat label="Max Heart Rate" value={a.maxHr} unit="bpm" />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-surface rounded-2xl p-3.5 tile-tabular">
      <div className="section-label">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight" style={color ? { color } : undefined}>{value}</span>
        {unit && <span className="text-muted text-xs">{unit}</span>}
      </div>
    </div>
  );
}
