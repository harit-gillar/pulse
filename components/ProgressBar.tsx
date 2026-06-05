"use client";

import { motion } from "framer-motion";

interface Props {
  value: number;
  max: number;
  color: string;
  delay?: number;
}

export function ProgressBar({ value, max, color, delay = 0 }: Props) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}
