"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { GOOGLE_HEALTH_SCOPES } from "@/lib/env";
import { useState } from "react";

export default function Home() {
  const [busy, setBusy] = useState(false);
  const supabase = getSupabaseBrowser();

  async function continueWithGoogle() {
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: GOOGLE_HEALTH_SCOPES,
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-xl"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-separator text-xs text-muted mb-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          Pulse · health dashboard
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Your body,<br />
          <span className="text-muted">at a glance.</span>
        </h1>
        <p className="mt-5 text-base text-muted leading-relaxed">
          A clean, Apple-style dashboard for your Google Health data. Recovery, sleep stages,
          activity, and body metrics — all in one place.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {supabase ? (
            <button
              onClick={continueWithGoogle}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              <GoogleGlyph />
              {busy ? "Redirecting…" : "Continue with Google"}
            </button>
          ) : (
            <button
              disabled
              title="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable"
              className="inline-flex items-center justify-center px-5 py-3 rounded-full border border-separator text-muted font-medium text-sm cursor-not-allowed"
            >
              Continue with Google · configure Supabase
            </button>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-5 py-3 rounded-full border border-separator text-foreground font-medium text-sm hover:bg-surface transition"
          >
            View demo dashboard
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
