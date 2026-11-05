"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, ViewTransition } from "react";
import { useSettings } from "@/lib/settings/store";
import { cn } from "@/lib/utils/cn";
import type { DemoPhase } from "./HeroScene3D";

// Three.js, React Three Fiber and the scene only load here, and only on capable desktops.
const HeroScene3D = dynamic(() => import("./HeroScene3D"), { ssr: false });

const ALT = "A black and white chessboard melting into a puddle, with a glossy black king, black pawn, white pawn and white knight standing on it";

const CAPTIONS: Record<DemoPhase, string> = {
  visible: "In Ghost mode you see the position after each move…",
  fading: "…then the pieces fade and the board melts.",
  hidden: "…then the pieces fade and the board melts.",
  peek: "Peek, and it is back for a moment.",
};

function canRunLive(motionPref: string): boolean {
  const reduced = motionPref === "reduced" || (motionPref === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduced) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (
    window.matchMedia("(min-width: 1024px) and (hover: hover)").matches &&
    "WebGL2RenderingContext" in window &&
    (nav.hardwareConcurrency ?? 4) >= 4 &&
    (nav.deviceMemory ?? 8) >= 4 &&
    !nav.connection?.saveData
  );
}

function useDocTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setTheme(el.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

/**
 * The melting board. Everyone gets the pre-rendered frames (rendered from the same scene), crossfading through
 * the ghost demo; capable desktops swap in the live scene once the page is idle.
 */
export function HeroVisual() {
  const motionPref = useSettings((s) => s.motion);
  const theme = useDocTheme();
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<DemoPhase | null>(null);

  useEffect(() => {
    if (!canRunLive(motionPref)) return;
    let idle = 0;
    let timer = 0;
    const go = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
      idle = ric(() => setLive(true)) as number;
    };
    // Wait for the page to settle: the board must never compete with the first paint.
    if (document.readyState === "complete") timer = window.setTimeout(go, 1200);
    else window.addEventListener("load", () => (timer = window.setTimeout(go, 1200)), { once: true });
    return () => {
      window.clearTimeout(timer);
      window.cancelIdleCallback?.(idle);
    };
  }, [motionPref]);

  const sizes = "(min-width: 1024px) 52vw, 94vw";
  const frame = (t: "light" | "dark", f: "solid" | "melted") => `/3d/hero/${t}-${f}-1440.webp 1440w, /3d/hero/${t}-${f}-720.webp 720w`;

  return (
    <figure className="relative m-0">
      <ViewTransition name="hero-board" share="board-morph" default="none">
        <div className={cn("hv-frames", "relative aspect-[4/3] w-full", ready && "is-live")}>
          {/* Light theme frames: the solid one is the likely LCP image, so it loads first. */}
          <img className="hero-frame hero-light" src="/3d/hero/light-solid-1440.webp" srcSet={frame("light", "solid")} sizes={sizes} width={1440} height={1080} alt={ALT} fetchPriority="high" decoding="async" />
          <img className="hero-frame hero-light hero-melted" src="/3d/hero/light-melted-720.webp" srcSet={frame("light", "melted")} sizes={sizes} width={1440} height={1080} alt="" loading="lazy" decoding="async" />
          <img className="hero-frame hero-dark" src="/3d/hero/dark-solid-720.webp" srcSet={frame("dark", "solid")} sizes={sizes} width={1440} height={1080} alt={ALT} loading="lazy" decoding="async" />
          <img className="hero-frame hero-dark hero-melted" src="/3d/hero/dark-melted-720.webp" srcSet={frame("dark", "melted")} sizes={sizes} width={1440} height={1080} alt="" loading="lazy" decoding="async" />
          {live ? <HeroScene3D theme={theme} onReady={() => setReady(true)} onPhase={setPhase} /> : null}
        </div>
      </ViewTransition>
      <figcaption className={cn("hv-caption", "mx-auto mt-1 h-6 max-w-sm text-center text-small text-muted")} aria-hidden="true" inert>
        {ready && phase ? (
          <span key={phase === "hidden" ? "fading" : phase} className="hero-caption-live">
            {CAPTIONS[phase]}
          </span>
        ) : (
          <>
            <span className="hero-cap hero-cap-1">{CAPTIONS.visible}</span>
            <span className="hero-cap hero-cap-2">{CAPTIONS.fading}</span>
            <span className="hero-cap hero-cap-3">{CAPTIONS.peek}</span>
            <span className="hero-cap-static">In Ghost mode the pieces fade and the board melts. A peek brings it back.</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
