"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendMetricKey, TrendPoint } from "@/lib/types";

interface Props {
  data: TrendPoint[];
  metricKey: TrendMetricKey;
  color: string;
  unit?: string;
  decimals?: number;
  height?: number;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtTick = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};
const fmtFull = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { date: string } }[];
  unit?: string;
  decimals?: number;
}

function ChartTooltip({ active, payload, unit, decimals = 0 }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  if (p.value == null) return null;
  return (
    <div className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-separator/80 shadow-xl backdrop-blur-xl text-xs tile-tabular pointer-events-none">
      <div className="text-muted text-[10px] mb-0.5">{fmtFull(p.payload.date)}</div>
      <div className="font-medium text-foreground">
        {p.value.toFixed(decimals)}
        {unit ? <span className="text-muted ml-0.5">{unit}</span> : null}
      </div>
    </div>
  );
}

export function TrendChart({ data, metricKey, color, unit, decimals = 0, height = 200 }: Props) {
  const chartData = data.map((p) => ({ date: p.date, v: p[metricKey] ?? null }));
  const present = chartData.filter((d) => d.v != null).map((d) => d.v as number);
  const avg = present.length ? present.reduce((a, v) => a + v, 0) / present.length : null;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--separator)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtTick}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={36}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["auto", "auto"]}
            allowDecimals={decimals > 0}
          />
          {avg != null && (
            <ReferenceLine
              y={avg}
              stroke={color}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: "avg", position: "right", fill: "var(--muted)", fontSize: 10 }}
            />
          )}
          <Tooltip
            content={<ChartTooltip unit={unit} decimals={decimals} />}
            cursor={{ stroke: color, strokeOpacity: 0.25, strokeWidth: 1 }}
            wrapperStyle={{ outline: "none" }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
