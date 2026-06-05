"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Calendar, Chevron } from "@/components/Calendar";

interface Props {
  date: string; // yyyy-mm-dd
  earliest: string;
  latest: string;
  availableDates?: string[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const addDays = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
};
const fmt = (s: string) => {
  const d = new Date(s + "T00:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export function DateNav({ date, earliest, latest, availableDates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const available = new Set(availableDates ?? []);

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const canPrev = prev >= earliest;
  const canNext = next <= latest;
  const isToday = date === latest;

  function go(to: string) {
    setOpen(false);
    router.push(to === latest ? "/dashboard" : `/dashboard/${to}`);
  }

  return (
    <div className="relative inline-flex items-center gap-1 text-sm text-muted">
      <button
        onClick={() => canPrev && go(prev)}
        disabled={!canPrev}
        aria-label="Previous day"
        className="w-7 h-7 -ml-1 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
      >
        <Chevron dir="left" />
      </button>

      <button
        onClick={() => setOpen((o) => !o)}
        className="min-w-[150px] text-center tile-tabular px-2 py-1 rounded-md hover:text-foreground hover:bg-surface transition"
      >
        {fmt(date)}
      </button>

      <button
        onClick={() => canNext && go(next)}
        disabled={!canNext}
        aria-label="Next day"
        className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
      >
        <Chevron dir="right" />
      </button>

      {!isToday && (
        <button
          onClick={() => go(latest)}
          className="ml-2 px-2.5 py-0.5 rounded-full text-[11px] text-muted hover:text-foreground hover:bg-surface transition border border-separator/60"
        >
          Today
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
            <Calendar
              selected={date}
              earliest={earliest}
              latest={latest}
              available={available}
              onPick={go}
              className="absolute top-full left-0 mt-2"
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
