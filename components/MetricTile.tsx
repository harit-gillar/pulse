"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { Sparkline } from "./Sparkline";
import { InfoTooltip } from "./InfoTooltip";
import { METRIC_INFO } from "@/lib/metricInfo";

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  valueColor?: string;
  spark?: { data: number[]; color: string; labels?: string[]; unit?: string };
  delay?: number;
  info?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export function MetricTile({
  label,
  value,
  unit,
  sub,
  valueColor,
  spark,
  delay = 0,
  info,
  footer,
  children,
}: Props) {
  const infoText = info ?? METRIC_INFO[label];
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="tile tile-tabular p-5 flex flex-col justify-between min-h-[170px]"
    >
      <div className="section-label">
        {infoText ? <InfoTooltip content={infoText}>{label}</InfoTooltip> : label}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className="text-[44px] leading-none font-semibold tracking-tight"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </span>
        {unit && <span className="text-muted text-sm font-medium">{unit}</span>}
      </div>

      {sub && <div className="mt-1.5 text-sm text-muted">{sub}</div>}

      {children}

      {spark && (
        <div className="mt-3 -mx-2">
          <Sparkline
            data={spark.data}
            color={spark.color}
            labels={spark.labels}
            unit={spark.unit ?? unit}
            height={48}
          />
        </div>
      )}

      {footer && <div className="mt-3 pt-3 border-t border-separator text-xs text-muted">{footer}</div>}
    </motion.div>
  );
}
