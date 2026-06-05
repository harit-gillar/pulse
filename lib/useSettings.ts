"use client";

import { useEffect, useState } from "react";

export interface Settings {
  stepsGoal: number;
  caloriesGoal: number;
  sleepNeedHours: number;
  distanceUnit: "km" | "mi";
  weightUnit: "kg" | "lbs";
  statsFrom: string; // "" = all time; otherwise YYYY-MM-DD default start for stats
}

export const DEFAULT_SETTINGS: Settings = {
  stepsGoal: 10000,
  caloriesGoal: 2800,
  sleepNeedHours: 7.5,
  distanceUnit: "km",
  weightUnit: "kg",
  statsFrom: "",
};

const KEY = "pulse.settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return { settings, update, loaded };
}

// ── Unit display helpers ──
export const toDistance = (km: number, unit: Settings["distanceUnit"]) =>
  unit === "mi" ? +(km * 0.621371).toFixed(1) : +km.toFixed(1);
export const toWeight = (kg: number, unit: Settings["weightUnit"]) =>
  unit === "lbs" ? +(kg * 2.20462).toFixed(1) : +kg.toFixed(1);
