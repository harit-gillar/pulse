"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: number[];
  color: string;
  height?: number;
  labels?: string[];
  unit?: string;
}

interface PayloadEntry {
  payload: { i: number; v: number; label?: string };
  value: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: PayloadEntry[];
  unit?: string;
}

function CustomTooltip({ active, payload, unit }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div
      className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-separator/80 shadow-xl backdrop-blur-xl text-xs tile-tabular pointer-events-none"
      style={{ transform: "translateY(-4px)" }}
    >
      {p.payload.label && <div className="text-muted text-[10px] mb-0.5">{p.payload.label}</div>}
      <div className="font-medium text-foreground">
        {p.value}
        {unit ? <span className="text-muted ml-0.5">{unit}</span> : null}
      </div>
    </div>
  );
}

export function Sparkline({ data, color, height = 56, labels, unit }: Props) {
  const chartData = data.map((v, i) => ({ i, v, label: labels?.[i] }));
  // Sanitize the gradient id — colors like "var(--blue)" contain characters
  // that break the SVG url(#…) reference (and caused the dark fallback fill).
  const id = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <Tooltip
            content={<CustomTooltip unit={unit} />}
            cursor={{ stroke: color, strokeOpacity: 0.25, strokeWidth: 1 }}
            wrapperStyle={{ outline: "none" }}
            allowEscapeViewBox={{ x: true, y: true }}
            offset={12}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
