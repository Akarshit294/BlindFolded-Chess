"use client";
import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings/store";

type Particle = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string; life: number };

const COLORS = ["#fbca78", "#f5b04e", "#fde0a8", "#bfc7fb", "#9ca7f0", "#57d9a3", "#fbf8f2"];

/** Lightweight canvas confetti (~140 particles, one rAF loop, auto-stops). */
export function Confetti({ fire }: { fire: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motionPref = useSettings((s) => s.motion);

  useEffect(() => {
    if (!fire) return;
    const reduced = motionPref === "reduced" || (motionPref === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduced) return;
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
    };
    resize();
    const W = () => c.width;
    const H = () => c.height;
    const parts: Particle[] = [];
    const burst = (originX: number, dir: number) => {
      for (let i = 0; i < 70; i++) {
        const angle = (-Math.PI / 2) + dir * (Math.random() * 0.9 + 0.15);
        const speed = (9 + Math.random() * 11) * dpr;
        parts.push({
          x: originX,
          y: H() * 0.95,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          w: (6 + Math.random() * 6) * dpr,
          h: (3 + Math.random() * 4) * dpr,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
          life: 1,
        });
      }
    };
    burst(W() * 0.08, 1);
    burst(W() * 0.92, -1);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, W(), H());
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.vy += 0.32 * dpr * dt;
        p.vx *= 0.992;
        p.vy *= 0.992;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.vy > 0) p.life -= 0.006 * dt;
        if (p.y > H() + 40) p.life = 0;
        if (p.life <= 0) continue;
        alive++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [fire, motionPref]);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />;
}
