import type { ActivityAggregate, ActivitySession } from "./types";
import { activityEmoji } from "./activityVisuals";

// Title-case an ActivityType enum value (e.g. "hiking-rucking" → "Hiking Rucking")
// as a fallback group label. Real sessions usually carry their own display `label`.
const typeLabel = (type: string) =>
  type.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

// Roll up exercise sessions into per-activity aggregates for the Stats page.
// Pure function — operates identically on live Google Health sessions.
export function aggregateActivities(sessions: ActivitySession[]): ActivityAggregate[] {
  // Group by the workout's real display name when present, else by the type label.
  const groupKey = (s: ActivitySession) => s.label ?? typeLabel(s.type);
  const byName = new Map<string, ActivitySession[]>();
  for (const s of sessions) {
    const k = groupKey(s);
    const arr = byName.get(k) ?? [];
    arr.push(s);
    byName.set(k, arr);
  }
  const out: ActivityAggregate[] = [];
  for (const [name, list] of byName) {
    const total = list.length;
    const type = list[0].type;
    const sum = (sel: (s: ActivitySession) => number) => list.reduce((a, s) => a + sel(s), 0);
    out.push({
      type,
      label: name,
      emoji: activityEmoji(name),
      count: total,
      longestSessionMin: Math.max(...list.map((s) => s.durationMin)),
      avgDurationMin: Math.round(sum((s) => s.durationMin) / total),
      mostCaloriesSingleSession: Math.max(...list.map((s) => s.calories)),
      totalCalories: sum((s) => s.calories),
      peakStrain: +Math.max(...list.map((s) => s.strain)).toFixed(1),
      avgStrain: +(sum((s) => s.strain) / total).toFixed(1),
      avgHr: Math.round(sum((s) => s.avgHr) / total),
      maxHr: Math.max(...list.map((s) => s.maxHr)),
    });
  }
  return out.sort((a, b) => b.count - a.count);
}
