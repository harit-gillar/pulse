"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { MetricInfo } from "@/lib/metricInfo";

interface Props {
  content: string | MetricInfo;
  children: React.ReactNode;
}

export function InfoTooltip({ content, children }: Props) {
  const info: MetricInfo =
    typeof content === "string" ? { desc: content, source: "Google" } : content;
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !ref.current) return;
    function update() {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX + r.width / 2,
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center gap-1 cursor-help align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        className="opacity-30 transition-opacity duration-200 hover:opacity-80"
        aria-hidden
      >
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="6" cy="4" r="0.8" fill="currentColor" />
        <rect x="5.4" y="5.5" width="1.2" height="3.2" rx="0.5" fill="currentColor" />
      </svg>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                initial={{ opacity: 0, y: -2, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -2, scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute",
                  top: coords.top,
                  left: coords.left,
                  transform: "translate(-50%, calc(-100% - 8px))",
                }}
                className="z-[100] w-72 p-3.5 rounded-xl shadow-2xl pointer-events-none normal-case tracking-normal font-normal"
                role="tooltip"
              >
                <div className="absolute inset-0 rounded-xl bg-surface-2/95 backdrop-blur-xl border border-separator/80 -z-10" />
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className="text-[9px] font-semibold tracking-[0.12em] uppercase"
                    style={{ color: info.source === "Google" ? "var(--blue)" : "var(--accent)" }}
                  >
                    {info.source === "Google" ? "From Google Health" : "Computed by Pulse"}
                  </span>
                </div>
                <p className="block text-xs text-foreground/90 leading-relaxed">{info.desc}</p>
                {info.formula && (
                  <pre className="mt-2 px-2 py-1.5 rounded-md bg-black/40 dark:bg-black/40 text-[10.5px] leading-relaxed text-foreground/80 font-mono whitespace-pre-wrap border border-separator/40">
                    {info.formula}
                  </pre>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
