// Pick an emoji from an activity's display name (Fitbit names vary widely and
// don't map cleanly to a fixed enum, so we keyword-match instead).
export function activityEmoji(name: string): string {
  const n = (name || "").toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => n.includes(k));

  if (has("tennis")) return "🎾";
  if (has("rugby")) return "🏉";
  if (has("football", "soccer")) return "⚽";
  if (has("basketball")) return "🏀";
  if (has("walk")) return "🚶";
  if (has("run", "jog", "treadmill", "elliptical")) return "🏃";
  if (has("hik", "ruck", "trek")) return "🥾";
  if (has("cycl", "bike", "spin", "ride", "peloton")) return "🚴";
  if (has("swim", "pool")) return "🏊";
  if (has("yoga", "pilates", "stretch", "mobility", "meditat")) return "🧘";
  if (has("strength", "weight", "lift", "resistance")) return "🏋️";
  if (has("dance", "dancing", "zumba")) return "💃";
  if (has("ski", "snowboard")) return "⛷️";
  if (has("row")) return "🚣";
  if (has("box", "martial", "kickbox")) return "🥊";
  if (has("golf")) return "⛳";
  if (has("climb")) return "🧗";
  if (has("aerobic", "cardio", "hiit", "bootcamp", "functional", "circuit")) return "🤸";
  if (has("workout", "gym", "training", "exercise", "sport", "activity")) return "💪";
  return "🏅";
}
