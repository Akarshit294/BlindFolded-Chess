"use client";
import dynamic from "next/dynamic";

// Three.js only ever loads on this dev page and in the lazy hero scene.
const RenderLab = dynamic(() => import("@/three/RenderLab").then((m) => m.RenderLab), { ssr: false });

export function RenderLabClient() {
  return <RenderLab />;
}
