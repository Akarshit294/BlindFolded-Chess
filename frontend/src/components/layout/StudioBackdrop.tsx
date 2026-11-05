"use client";
import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings/store";

/**
 * The photo-studio sweep with big, out-of-focus pieces floating at the edges (rendered offline with real depth of
 * field, see scripts/render-3d.mjs). They drift a little with the pointer and with scrolling; with reduced motion,
 * or on touch screens, they stay still.
 *
 * The images are CSS backgrounds chosen by data-theme (see globals.css), so only the current theme's files load.
 */
const PIECES = [
  // [class, depth]: deeper pieces move more.
  ["bd-1", 0.55],
  ["bd-2", 0.9],
  ["bd-3", 0.7],
  ["bd-4", 1],
  ["bd-5", 0.4],
] as const;

export function StudioBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const motionPref = useSettings((s) => s.motion);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = motionPref === "reduced" || (motionPref === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduced || !fine) {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
      el.style.setProperty("--sy", "0");
      return;
    }
    let raf = 0;
    let px = 0;
    let py = 0;
    const write = () => {
      raf = 0;
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
      el.style.setProperty("--sy", String(Math.round(window.scrollY)));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", schedule);
    };
  }, [motionPref]);

  return (
    <div ref={ref} className="studio-backdrop" aria-hidden="true">
      {PIECES.map(([cls, depth]) => (
        <div key={cls} className={`bd-piece ${cls}`} style={{ ["--d" as string]: depth }} />
      ))}
    </div>
  );
}
