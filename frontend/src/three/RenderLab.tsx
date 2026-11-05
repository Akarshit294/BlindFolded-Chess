"use client";
/**
 * Offline render lab (development only, /lab/render). scripts/render-3d.mjs opens it in a headless browser and
 * calls window.__bfRender(spec) for every image the site ships: piece sprites, the hero frames and the blurred
 * backdrop pieces. Each call mounts a fresh canvas, waits a few frames and returns a WebP data URL.
 */
import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DepthOfField, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HeroBoardScene } from "./HeroBoardScene";
import { PIECE_HEIGHT, type PieceType } from "./pieces";
import { Piece, StudioEnvironment, StudioLights, type Theme } from "./scene";

export type RenderSpec =
  | { kind: "sprite"; piece: string; theme: Theme; size: number }
  | { kind: "backdrop"; piece: string; theme: Theme; size: number; blur: number; tilt?: number; turn?: number; dof?: boolean; matte?: "black" | "white" }
  | { kind: "hero"; theme: Theme; frame: "solid" | "melted"; width: number; height: number };

type Pending = { spec: RenderSpec; resolve: (url: string) => void };

declare global {
  interface Window {
    __bfRender?: (spec: RenderSpec) => Promise<string>;
    __bfMatte?: (overBlack: string, overWhite: string) => Promise<string>;
    __bfRenderReady?: boolean;
  }
}

function loadPixels(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      resolve(x.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Difference matting. Post-processing (depth of field) renders opaque, so each backdrop piece is rendered over
 * black and over white: alpha = 1 - (white - black), color = black / alpha.
 */
async function matte(overBlack: string, overWhite: string): Promise<string> {
  const [b, w] = await Promise.all([loadPixels(overBlack), loadPixels(overWhite)]);
  const out = new ImageData(b.width, b.height);
  for (let i = 0; i < b.data.length; i += 4) {
    const d = ((w.data[i]! - b.data[i]!) + (w.data[i + 1]! - b.data[i + 1]!) + (w.data[i + 2]! - b.data[i + 2]!)) / 3;
    const a = Math.max(0, Math.min(1, 1 - d / 255));
    out.data[i + 3] = Math.round(a * 255);
    for (let k = 0; k < 3; k++) out.data[i + k] = a > 0.004 ? Math.min(255, Math.round(b.data[i + k]! / a)) : 0;
  }
  const c = document.createElement("canvas");
  c.width = b.width;
  c.height = b.height;
  c.getContext("2d")!.putImageData(out, 0, 0);
  return c.toDataURL("image/webp", 0.88);
}

/** Downscales (by halving, for quality) and encodes a canvas region. */
function encode(src: HTMLCanvasElement, w: number, h: number, blurPx = 0, type = "image/webp"): string {
  let cur: HTMLCanvasElement = src;
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const c = document.createElement("canvas");
    c.width = Math.round(cur.width / 2);
    c.height = Math.round(cur.height / 2);
    const x = c.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  // Leave room for the blur to spread: draw slightly inset when blurring.
  const inset = blurPx > 0 ? blurPx * 1.6 : 0;
  ctx.drawImage(cur, inset, inset, w - inset * 2, h - inset * 2);
  return out.toDataURL(type, 0.9);
}

function Capture({ frames, onCanvas }: { frames: number; onCanvas: (c: HTMLCanvasElement) => void }) {
  const gl = useThree((s) => s.gl);
  const n = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    n.current += 1;
    if (n.current >= frames && !done.current) {
      done.current = true;
      requestAnimationFrame(() => onCanvas(gl.domElement));
    }
  });
  return null;
}

function parsePiece(code: string): { color: "w" | "b"; type: PieceType | "token" } {
  if (code === "token") return { color: "w", type: "token" };
  return { color: code[0] === "b" ? "b" : "w", type: code[1]!.toLowerCase() as PieceType };
}

/**
 * Every sprite shares one camera, so pieces line up on the board. Like most 2D sets, the small pieces are drawn
 * a little larger than true scale so a pawn still fills its square.
 */
const SPRITE_SCALE: Record<PieceType | "token", number> = { p: 1.22, r: 1.13, n: 1.1, b: 1.04, q: 0.99, k: 0.95, token: 1.25 };
function SpriteScene({ spec }: { spec: Extract<RenderSpec, { kind: "sprite" }> }) {
  const { color, type } = parsePiece(spec.piece);
  const elevation = (19 * Math.PI) / 180;
  const target = new THREE.Vector3(0, 0.805, 0);
  const dist = 9.4;
  const pos: [number, number, number] = [0, target.y + Math.sin(elevation) * dist, Math.cos(elevation) * dist];
  return (
    <>
      <PerspectiveCamera makeDefault fov={13.4} position={pos} onUpdate={(c) => c.lookAt(target)} />
      <StudioEnvironment intensity={spec.theme === "light" ? 1 : 0.9} />
      <StudioLights theme={spec.theme} />
      {/* No baked shadow: the board draws a contact shadow, so a dragged piece can lift away from it. */}
      <Piece type={type} color={color} theme={spec.theme} position={[0, 0, 0]} scale={SPRITE_SCALE[type]} />
    </>
  );
}

/** A single big piece, close to the lens and out of focus, for the studio backdrop. */
function BackdropScene({ spec }: { spec: Extract<RenderSpec, { kind: "backdrop" }> }) {
  const { color, type } = parsePiece(spec.piece);
  const h = PIECE_HEIGHT[type];
  return (
    <>
      <PerspectiveCamera makeDefault fov={20} position={[0, h * 0.55, 5.6]} onUpdate={(c) => c.lookAt(0, h * 0.5, 0)} />
      <StudioEnvironment intensity={spec.theme === "light" ? 1 : 0.85} />
      <StudioLights theme={spec.theme} />
      <Piece type={type} color={color} theme={spec.theme} envScale={color === "b" ? 0.45 : 0.9} rotation={[spec.tilt ?? 0, spec.turn ?? 0, 0]} />
      {spec.dof ? (
        <EffectComposer multisampling={0}>
          <DepthOfField focusDistance={0.0} focalLength={0.0015} bokehScale={spec.blur} />
        </EffectComposer>
      ) : null}
    </>
  );
}

export function RenderLab() {
  const [job, setJob] = useState<Pending | null>(null);
  const queue = useRef<Pending[]>([]);
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    window.__bfRender = (spec) =>
      new Promise<string>((resolve) => {
        queue.current.push({ spec, resolve });
        setSeq((n) => n + 1);
      });
    window.__bfMatte = matte;
    window.__bfRenderReady = true;
    return () => {
      delete window.__bfRender;
      delete window.__bfMatte;
      window.__bfRenderReady = false;
    };
  }, []);

  useEffect(() => {
    if (job || queue.current.length === 0) return;
    setJob(queue.current.shift()!);
  }, [job, seq]);

  if (!job) return <div className="fixed inset-0 z-[300] bg-[#808080]" />;
  const { spec } = job;
  const scale = 2;
  const w = spec.kind === "hero" ? spec.width : spec.size;
  const h = spec.kind === "hero" ? spec.height : spec.size;
  const finish = (canvas: HTMLCanvasElement) => {
    // Without DoF the blur is all canvas blur; with DoF a light soften removes the bokeh sampling grain.
    const blur = spec.kind === "backdrop" ? (spec.dof ? 3 : spec.blur) : 0;
    const url = encode(canvas, w, h, blur, spec.kind === "backdrop" && spec.matte ? "image/png" : "image/webp");
    job.resolve(url);
    setJob(null);
    setSeq((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-start bg-[#808080]">
      <div style={{ width: w * scale, height: h * scale }}>
        <Canvas
          key={JSON.stringify(spec)}
          dpr={1}
          shadows={spec.kind === "hero" ? "variance" : false}
          gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true, premultipliedAlpha: false, toneMapping: THREE.NeutralToneMapping }}
          onCreated={({ gl }) => {
            const m = spec.kind === "backdrop" ? spec.matte : undefined;
            gl.setClearColor(m === "white" ? 0xffffff : 0x000000, m ? 1 : 0);
          }}
          style={{ width: w * scale, height: h * scale }}
        >
          {spec.kind === "sprite" ? <SpriteScene spec={spec} /> : null}
          {spec.kind === "backdrop" ? <BackdropScene spec={spec} /> : null}
          {spec.kind === "hero" ? <HeroBoardScene theme={spec.theme} melt={spec.frame === "melted" ? 1 : 0} piecesOpacity={spec.frame === "melted" ? 0 : 1} still /> : null}
          <Capture frames={spec.kind === "hero" ? 12 : 8} onCanvas={finish} />
        </Canvas>
      </div>
    </div>
  );
}
