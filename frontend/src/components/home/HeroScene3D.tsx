"use client";
/**
 * The live hero (capable desktops only, loaded lazily by HeroVisual): the same scene as the static frames,
 * rendered in real time with a gentle camera drift that follows the pointer and the ghost demo on a loop.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HeroBoardScene } from "@/three/HeroBoardScene";
import type { Theme } from "@/three/scene";

export type DemoPhase = "visible" | "fading" | "hidden" | "peek";

function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    // A couple of frames in, shaders are compiled and the shadows are drawn.
    if (!done.current && frames.current > 3) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function HeroScene3D({ theme, onReady, onPhase }: { theme: Theme; onReady: () => void; onPhase: (p: DemoPhase) => void }) {
  const pointer = useRef({ x: 0, y: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    // Stop rendering while the hero is scrolled away.
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.01 });
    if (wrap.current) io.observe(wrap.current);
    return () => {
      window.removeEventListener("pointermove", onMove);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        shadows="variance"
        frameloop={visible ? "always" : "never"}
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false, toneMapping: THREE.NeutralToneMapping, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.setAttribute("role", "img");
          gl.domElement.setAttribute("aria-label", "A chessboard melting into a puddle while glossy pieces fade away and return");
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <HeroBoardScene theme={theme} demo pointer={pointer} onPhase={onPhase} />
        <FirstFrame onReady={onReady} />
      </Canvas>
    </div>
  );
}
