"use client";

import { motion } from "framer-motion";
import type { SleepStage } from "@/lib/types";

interface Props {
  stages: Record<SleepStage, number>;
  size?: number;
  stroke?: number;
  gap?: number; // gap between segments in degrees
  children?: React.ReactNode;
}

const STAGE_ORDER: SleepStage[] = ["deep", "rem", "light", "awake"];
const STAGE_COLOR: Record<SleepStage, string> = {
  deep: "var(--purple)",
  rem: "var(--blue)",
  light: "var(--accent)",
  awake: "rgba(180,180,190,0.45)",
};

export function StagesRing({ stages, size = 180, stroke = 14, gap = 3, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = STAGE_ORDER.reduce((s, k) => s + stages[k], 0) || 1;
  const gapLen = (gap / 360) * c;

  // Compute each segment's arc length minus a gap, plus its starting offset
  let cursor = 0;
  const segments = STAGE_ORDER.map((key) => {
    const fraction = stages[key] / total;
    const arc = Math.max(0, fraction * c - gapLen);
    const start = cursor;
    cursor += fraction * c;
    return { key, color: STAGE_COLOR[key], arc, start, fraction };
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--ring-track)"
          strokeWidth={stroke}
          fill="none"
        />
        {segments.map((seg, i) => (
          <motion.circle
            key={seg.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={seg.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            fill="none"
            strokeDasharray={`${seg.arc} ${c - seg.arc}`}
            strokeDashoffset={-seg.start}
            initial={{ opacity: 0, strokeWidth: 0 }}
            animate={{ opacity: 1, strokeWidth: stroke }}
            transition={{ duration: 0.6, delay: 0.08 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
