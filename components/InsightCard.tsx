"use client";

import { motion } from "framer-motion";
import type { Insight } from "@/lib/types";
import { METRIC_BY_KEY } from "@/lib/trends";

const ARROW: Record<Insight["direction"], string> = {
  positive: "↑",
  negative: "↓",
  neutral: "•",
};

export function InsightCard({ insight, delay = 0 }: { insight: Insight; delay?: number }) {
  const color = METRIC_BY_KEY[insight.metric]?.color ?? "var(--accent)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="tile p-5 flex flex-col gap-2 min-h-[150px]"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
          aria-hidden
        >
          {ARROW[insight.direction]}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted px-2 py-0.5 rounded-full border border-separator">
          {insight.strength}
        </span>
      </div>

      <div className="font-semibold tracking-tight leading-snug">{insight.headline}</div>
      <p className="text-sm text-muted leading-relaxed flex-1">{insight.detail}</p>

      <div className="text-[11px] text-muted tile-tabular pt-1">n = {insight.sampleSize}</div>
    </motion.div>
  );
}
