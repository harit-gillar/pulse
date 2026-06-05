"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}
      aria-hidden
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

interface Props {
  selected: string;
  earliest: string;
  latest: string;
  available?: Set<string>;
  onPick: (iso: string) => void;
  className?: string;
}

export function Calendar({ selected, earliest, latest, available, onPick, className }: Props) {
  const sel = new Date(selected + "T00:00:00");
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(view.y, view.m, d));

  const monthStart = iso(view.y, view.m, 1);
  const monthEnd = iso(view.y, view.m, daysInMonth);
  const canPrevMonth = monthStart > earliest;
  const canNextMonth = monthEnd < latest;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className={`z-50 w-[280px] p-4 rounded-2xl bg-surface-2 border border-separator/80 shadow-2xl ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => canPrevMonth && setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
          disabled={!canPrevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface disabled:opacity-25 transition"
          aria-label="Previous month"
        >
          <Chevron dir="left" />
        </button>
        <span className="text-sm font-medium text-foreground tile-tabular">{MONTHS[view.m]} {view.y}</span>
        <button
          onClick={() => canNextMonth && setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
          disabled={!canNextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface disabled:opacity-25 transition"
          aria-label="Next month"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d) => (
          <div key={d} className="text-[10px] text-muted text-center font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const day = Number(cell.slice(-2));
          const inRange = cell >= earliest && cell <= latest;
          const isSelected = cell === selected;
          const hasData = available?.has(cell);
          return (
            <button
              key={cell}
              disabled={!inRange}
              onClick={() => onPick(cell)}
              className={`relative h-8 rounded-lg text-xs tile-tabular flex items-center justify-center transition
                ${isSelected ? "bg-foreground text-background font-semibold" : inRange ? "text-foreground hover:bg-surface" : "text-muted/30 cursor-not-allowed"}`}
            >
              {day}
              {hasData && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
