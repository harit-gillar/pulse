"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/lib/useSettings";
import { useTheme } from "@/lib/useTheme";
import { Calendar } from "@/components/Calendar";
import { todayISO, addDaysISO } from "@/lib/dates";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtShort = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export default function SettingsPage() {
  const { settings, update, loaded } = useSettings();
  const { theme, toggle } = useTheme();
  const supabase = getSupabaseBrowser();

  const [email, setEmail] = useState<string | null>(null);
  const [resync, setResync] = useState<"idle" | "running" | "done" | "error">("idle");
  const [resyncMsg, setResyncMsg] = useState("");
  const [earliest, setEarliest] = useState("2024-01-01");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const today = todayISO();

  // Deep history sync (chunked, with progress).
  const [deep, setDeep] = useState<"idle" | "running" | "done" | "error">("idle");
  const [deepPct, setDeepPct] = useState(0);
  const [deepMsg, setDeepMsg] = useState("");
  const cancelRef = useRef(false);

  async function syncFullHistory() {
    setDeep("running");
    setDeepPct(0);
    setDeepMsg("Starting…");
    cancelRef.current = false;
    const MAX_WINDOWS = 16; // ~4 years cap
    const WINDOW = 90;
    let to = today;
    let totalSaved = 0;
    let oldest = today;
    let emptyStreak = 0;
    try {
      for (let w = 0; w < MAX_WINDOWS; w++) {
        if (cancelRef.current) break;
        const windowStart = addDaysISO(to, -WINDOW);
        setDeepMsg(`Syncing ${fmtShort(windowStart)} → ${fmtShort(to)}…`);
        const res = await fetch(`/api/backfill?to=${to}&days=${WINDOW}`, { method: "POST" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "sync failed");
        const json = await res.json();
        const saved = json.saved ?? 0;
        totalSaved += saved;
        if (json.from) oldest = json.from;
        setDeepPct(Math.min(96, (w + 1) * (96 / MAX_WINDOWS)));
        setDeepMsg(`${totalSaved} days synced · back to ${fmtShort(oldest)}`);
        if (saved === 0) { emptyStreak++; if (emptyStreak >= 2) break; } else emptyStreak = 0;
        to = windowStart;
      }
      setDeepPct(100);
      setDeep("done");
      setDeepMsg(totalSaved > 0 ? `Done — ${totalSaved} days synced, back to ${fmtShort(oldest)}.` : "No more history found.");
      const fresh = await fetch("/api/snapshots").then((r) => r.json()).catch(() => null);
      if (fresh?.dates?.length) setEarliest(fresh.dates[0]);
    } catch (e) {
      setDeep("error");
      setDeepMsg(e instanceof Error ? e.message : "Sync failed.");
    }
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    fetch("/api/snapshots").then((r) => r.json()).then((d) => {
      if (d.dates?.length) setEarliest(d.dates[0]);
    }).catch(() => {});
  }, [supabase]);

  async function reSync() {
    setResync("running");
    setResyncMsg("");
    try {
      const res = await fetch("/api/backfill?days=30", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setResync("done");
        setResyncMsg(`Saved ${json.saved} days (${json.from} → ${json.to}).`);
      } else {
        setResync("error");
        setResyncMsg(json.error ?? "Re-sync failed.");
      }
    } catch {
      setResync("error");
      setResyncMsg("Re-sync failed.");
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!loaded) return null;

  return (
    <main className="mx-auto max-w-[760px] px-6 py-8 sm:py-10 w-full">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Settings</h1>
      </motion.header>

      {/* GOALS */}
      <Section title="Daily Goals">
        <NumberRow
          label="Steps goal"
          value={settings.stepsGoal}
          step={500}
          onChange={(v) => update({ stepsGoal: v })}
        />
        <NumberRow
          label="Calories goal"
          unit="kcal"
          value={settings.caloriesGoal}
          step={50}
          onChange={(v) => update({ caloriesGoal: v })}
        />
        <NumberRow
          label="Sleep need"
          unit="hrs"
          value={settings.sleepNeedHours}
          step={0.5}
          decimals={1}
          onChange={(v) => update({ sleepNeedHours: v })}
        />
      </Section>

      {/* UNITS */}
      <Section title="Units">
        <ToggleRow
          label="Distance"
          options={["km", "mi"]}
          value={settings.distanceUnit}
          onChange={(v) => update({ distanceUnit: v as "km" | "mi" })}
        />
        <ToggleRow
          label="Weight"
          options={["kg", "lbs"]}
          value={settings.weightUnit}
          onChange={(v) => update({ weightUnit: v as "kg" | "lbs" })}
        />
      </Section>

      {/* APPEARANCE */}
      <Section title="Appearance">
        <ToggleRow
          label="Theme"
          options={["dark", "light"]}
          value={theme}
          onChange={(v) => { if (v !== theme) toggle(); }}
        />
      </Section>

      {/* DATA */}
      <Section title="Data" className={datePickerOpen ? "z-50" : ""}>
        <div className="relative">
          <Row label="Stats start date" sub="Default window for the Stats page">
            <div className="flex items-center gap-2">
              {settings.statsFrom && (
                <button
                  onClick={() => update({ statsFrom: "" })}
                  className="px-2.5 py-1 rounded-full text-xs text-muted border border-separator hover:text-foreground hover:bg-surface transition"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setDatePickerOpen((o) => !o)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-separator text-foreground hover:bg-surface transition tile-tabular"
              >
                {settings.statsFrom ? fmtShort(settings.statsFrom) : "All time"}
              </button>
            </div>
          </Row>
          <AnimatePresence>
            {datePickerOpen && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setDatePickerOpen(false)} />
                <Calendar
                  selected={settings.statsFrom || earliest}
                  earliest={earliest}
                  latest={today}
                  onPick={(d) => { update({ statsFrom: d }); setDatePickerOpen(false); }}
                  className="absolute right-5 top-full -mt-1"
                />
              </>
            )}
          </AnimatePresence>
        </div>

        <Row label="Sync full history" sub="Pull all your past data from Google Health (chunked)">
          <button
            onClick={syncFullHistory}
            disabled={!supabase || deep === "running"}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-separator text-foreground hover:bg-surface disabled:opacity-40 transition"
          >
            {deep === "running" ? "Syncing…" : "Sync full history"}
          </button>
        </Row>
        {deep !== "idle" && (
          <div className="px-5 pb-4 -mt-1">
            <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent"
                animate={{ width: `${deepPct}%` }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className={`text-xs mt-2 ${deep === "error" ? "text-red" : "text-muted"}`}>{deepMsg}</div>
          </div>
        )}
      </Section>

      {/* ACCOUNT */}
      <Section title="Account">
        <Row label="Connected">
          <span className="text-sm text-foreground/90">
            {email ?? (supabase ? "Not signed in" : "Demo (Supabase not configured)")}
          </span>
        </Row>
        <Row label="Sync status">
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
            {email ? "Connected to Google Health" : "—"}
          </span>
        </Row>
        <Row label="Re-sync recent" sub="Re-pull the last 30 days from Google Health">
          <button
            onClick={reSync}
            disabled={!supabase || resync === "running"}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-separator text-foreground hover:bg-surface disabled:opacity-40 transition"
          >
            {resync === "running" ? "Syncing…" : "Re-sync"}
          </button>
        </Row>
        {resyncMsg && (
          <div className="px-5 pb-2 -mt-1">
            <div className={`text-xs ${resync === "error" ? "text-red" : "text-accent"}`}>{resyncMsg}</div>
          </div>
        )}
        {email && (
          <Row label="Sign out">
            <button
              onClick={signOut}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-separator text-red hover:bg-surface transition"
            >
              Sign out
            </button>
          </Row>
        )}
      </Section>

      <footer className="text-xs text-muted text-center pt-4 pb-2">
        Pulse · made with <span aria-label="love">❤️</span> in SW6
      </footer>
    </main>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-8 relative ${className ?? ""}`}>
      <div className="section-label mb-3">{title}</div>
      <div className="tile divide-y divide-separator/40">{children}</div>
    </section>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function NumberRow({
  label, value, onChange, step = 1, decimals = 0, unit,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; decimals?: number; unit?: string }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2 tile-tabular">
        <button
          onClick={() => onChange(+Math.max(0, value - step).toFixed(decimals))}
          className="w-7 h-7 rounded-full border border-separator text-muted hover:text-foreground hover:bg-surface transition flex items-center justify-center"
          aria-label={`Decrease ${label}`}
        >−</button>
        <span className="min-w-[64px] text-center text-sm font-medium">
          {value.toLocaleString()}{unit ? <span className="text-muted ml-1">{unit}</span> : null}
        </span>
        <button
          onClick={() => onChange(+(value + step).toFixed(decimals))}
          className="w-7 h-7 rounded-full border border-separator text-muted hover:text-foreground hover:bg-surface transition flex items-center justify-center"
          aria-label={`Increase ${label}`}
        >+</button>
      </div>
    </Row>
  );
}

function ToggleRow({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 border border-separator/60">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition
              ${value === opt ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </Row>
  );
}
