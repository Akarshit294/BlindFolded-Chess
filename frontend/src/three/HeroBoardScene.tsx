"use client";
/**
 * The hero: a checkerboard that has started to melt into a puddle, with glossy pieces standing on it.
 * The board is one subdivided plane; its material is three's MeshPhysicalMaterial extended in the shader:
 * the vertex stage droops the puddle's edge and adds slow waves (plus ripples while melting), the fragment
 * stage paints the checker, warps it as it melts and lights the rim.
 *
 * `still` renders a fixed frame (the offline renders); otherwise it animates and plays the ghost demo:
 * the pieces fade, the board melts, a "peek" brings everything back.
 */
import { ContactShadows, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PieceType } from "./pieces";
import { Piece, StudioEnvironment, StudioLights, useStudioEnv, type Theme } from "./scene";

export const BOARD_SQUARE = 0.8;

/**
 * The puddle's outline: a smooth union of circles (positive inside, ≈ distance to the edge). No atan(), so there
 * is no seam where the angle wraps. Same formula as the shader.
 */
const LOBES: Array<[number, number, number]> = [
  [0, 0, 2.5],
  [-1.25, -1.35, 1.3],
  [1.45, -1.1, 1.35],
  [1.65, 1.2, 1.1],
  [-1.55, 1.15, 1.05],
  [0.25, -2.15, 0.75],
  [-2.45, -0.2, 0.7],
];
function smax(a: number, b: number, k = 3.2): number {
  return Math.log(Math.exp(k * a) + Math.exp(k * b)) / k;
}
export function puddleEdge(x: number, y: number): number {
  let e = -10;
  for (const [cx, cy, r] of LOBES) e = smax(e, r - Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + 0.12));
  return e;
}

/** Surface height at board point (x, y), mirroring the vertex shader (without ripples). */
export function surfaceHeight(x: number, y: number, t: number, melt: number): number {
  const m = puddleEdge(x, y);
  const droop = -0.42 * (1 - THREE.MathUtils.smoothstep(m, 0, 1.25));
  const waves = 0.045 * Math.sin(x * 1.25 + t * 0.55) * Math.cos(y * 1.1 - t * 0.4);
  return droop + waves * (0.6 + melt);
}

const SHARED_GLSL = /* glsl */ `
uniform float uTime;
uniform float uMelt;
uniform float uSquare;
float bfHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float bfNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(bfHash(i), bfHash(i + vec2(1.0, 0.0)), u.x), mix(bfHash(i + vec2(0.0, 1.0)), bfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float bfLen(vec2 d) { return sqrt(dot(d, d) + 0.12); }
float bfSmax(float a, float b) { float k = 3.2; return log(exp(k * a) + exp(k * b)) / k; }
float bfEdge(vec2 p) {
  float e = -10.0;
  e = bfSmax(e, 2.5 - bfLen(p));
  e = bfSmax(e, 1.3 - bfLen(p - vec2(-1.25, -1.35)));
  e = bfSmax(e, 1.35 - bfLen(p - vec2(1.45, -1.1)));
  e = bfSmax(e, 1.1 - bfLen(p - vec2(1.65, 1.2)));
  e = bfSmax(e, 1.05 - bfLen(p - vec2(-1.55, 1.15)));
  e = bfSmax(e, 0.75 - bfLen(p - vec2(0.25, -2.15)));
  e = bfSmax(e, 0.7 - bfLen(p - vec2(-2.45, -0.2)));
  return e;
}
float bfHeight(vec2 p) {
  float m = bfEdge(p);
  float droop = -0.42 * (1.0 - smoothstep(0.0, 1.25, m));
  float waves = 0.045 * sin(p.x * 1.25 + uTime * 0.55) * cos(p.y * 1.1 - uTime * 0.4);
  float d = length(p);
  float ripple = uMelt * 0.05 * sin(d * 4.6 - uTime * 2.4) * exp(-d * 0.35);
  return droop + waves * (0.6 + uMelt) + ripple;
}
`;

function useMeltMaterial(theme: Theme) {
  const env = useStudioEnv();
  return useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uMelt: { value: 0 },
      uSquare: { value: BOARD_SQUARE },
      uLight: { value: new THREE.Color(theme === "light" ? 0xf2f2f2 : 0xcfcfcf) },
      uDark: { value: new THREE.Color(theme === "light" ? 0x080808 : 0x060606) },
      uRim: { value: new THREE.Color(theme === "light" ? 0xfafafa : 0xe6e6e6) },
    };
    const m = new THREE.MeshPhysicalMaterial({
      roughness: 0.32,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      metalness: 0,
      transparent: true,
      side: THREE.DoubleSide,
      envMap: env,
      envMapIntensity: theme === "light" ? 0.32 : 0.3,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${SHARED_GLSL}\nvarying vec2 vBoard;\nvarying float vEdge;`)
        .replace(
          "#include <beginnormal_vertex>",
          `vec2 bp = position.xy;
           float e = 0.012;
           float hx = bfHeight(bp + vec2(e, 0.0)) - bfHeight(bp - vec2(e, 0.0));
           float hy = bfHeight(bp + vec2(0.0, e)) - bfHeight(bp - vec2(0.0, e));
           vec3 objectNormal = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));
           #ifdef USE_TANGENT
             vec3 objectTangent = vec3(1.0, 0.0, 0.0);
           #endif`,
        )
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = vec3(position.xy, bfHeight(position.xy));
           vBoard = position.xy;
           vEdge = bfEdge(position.xy);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\n${SHARED_GLSL}\nuniform vec3 uLight;\nuniform vec3 uDark;\nuniform vec3 uRim;\nvarying vec2 vBoard;\nvarying float vEdge;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           vec2 q = vBoard / uSquare;
           // As it melts the squares flow: a slow domain warp that grows toward the edge.
           float flow = uMelt * 0.35 + (1.0 - smoothstep(0.0, 1.6, vEdge)) * 0.25;
           q += flow * vec2(bfNoise(vBoard * 0.7 + uTime * 0.08) - 0.5, bfNoise(vBoard * 0.7 - uTime * 0.07 + 7.0) - 0.5);
           float s = sin(3.14159265 * q.x) * sin(3.14159265 * q.y);
           float aa = fwidth(s) * 1.2 + 0.02 + uMelt * 0.12;
           float c = smoothstep(-aa, aa, s);
           vec3 checker = mix(uDark, uLight, c);
           float rim = 1.0 - smoothstep(0.02, 0.2, vEdge);
           diffuseColor.rgb = mix(checker, uRim, rim * 0.92);
           diffuseColor.a *= smoothstep(0.0, 0.025, vEdge);`,
        );
    };
    m.customProgramCacheKey = () => `bf-melt-${theme}`;
    return { material: m, uniforms };
  }, [theme, env]);
}

type Placement = { type: PieceType; color: "w" | "b"; x: number; y: number; tilt?: [number, number]; turn?: number; delay: number };

/** The cast, after the reference: a tilted black pawn sinking in, a black king, a porcelain pawn and knight. */
const CAST: Placement[] = [
  { type: "p", color: "b", x: -1.75, y: -0.35, tilt: [0.06, 0.24], turn: 0.3, delay: 0 },
  { type: "k", color: "b", x: -0.25, y: 0.35, turn: 0.2, delay: 0.25 },
  { type: "p", color: "w", x: 1.15, y: 1.0, turn: -0.4, delay: 0.5 },
  { type: "n", color: "w", x: 1.45, y: -0.75, turn: -0.9, delay: 0.75 },
];

type Props = {
  theme: Theme;
  /** 0 = solid, 1 = melted. Ignored when `demo` is on. */
  melt?: number;
  piecesOpacity?: number;
  /** Render a fixed frame (offline renders). */
  still?: boolean;
  /** Loop the ghost demo: fade, melt, peek. */
  demo?: boolean;
  /** -1..1 pointer offset for a gentle camera drift. */
  pointer?: React.RefObject<{ x: number; y: number }>;
  onPhase?: (phase: "visible" | "fading" | "hidden" | "peek") => void;
};

const LOOP = 10;

/** Demo timeline: 0–3.4 s visible, then fade + melt, hidden until 7.6 s, then a peek. */
function demoState(t: number): { melt: number; opacity: (delay: number) => number; phase: "visible" | "fading" | "hidden" | "peek" } {
  const u = t % LOOP;
  const ease = (x: number) => THREE.MathUtils.smootherstep(x, 0, 1);
  if (u < 3.4) return { melt: 0, opacity: () => 1, phase: u < 0.6 && t > LOOP ? "peek" : "visible" };
  if (u < 5.2) {
    const k = (u - 3.4) / 1.8;
    return { melt: ease(k), opacity: (d) => 1 - ease(THREE.MathUtils.clamp((u - 3.4 - d * 0.6) / 0.9, 0, 1)), phase: "fading" };
  }
  if (u < 8.8) return { melt: 1, opacity: () => 0, phase: "hidden" };
  const k = (u - 8.8) / 1.2;
  return { melt: 1 - ease(k), opacity: () => ease(k), phase: "peek" };
}

export function HeroBoardScene({ theme, melt = 0, piecesOpacity = 1, still = false, demo = false, pointer, onPhase }: Props) {
  const { material, uniforms } = useMeltMaterial(theme);
  const geometry = useMemo(() => new THREE.PlaneGeometry(8, 8, 260, 260), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  const pieces = useRef<Array<THREE.Group | null>>([]);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const opacities = useRef<number[]>(CAST.map(() => piecesOpacity));
  const lastPhase = useRef<string>("");
  const invalidate = useThree((s) => s.invalidate);

  const place = (t: number, m: number) => {
    CAST.forEach((p, i) => {
      const g = pieces.current[i];
      if (!g) return;
      const h = surfaceHeight(p.x, p.y, t, m);
      // Board plane is rotated -90° about X: board (x, y) → world (x, -y).
      g.position.set(p.x, h - 0.02, -p.y);
      const [tx, tz] = p.tilt ?? [0, 0];
      g.rotation.set(tx + Math.sin(t * 0.5 + i) * 0.012 * (0.5 + m), p.turn ?? 0, tz);
    });
  };

  useEffect(() => {
    uniforms.uMelt.value = melt;
    place(still ? 0.6 : uniforms.uTime.value, melt);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [melt, still]);

  useFrame((state, delta) => {
    if (still) return;
    const t = (uniforms.uTime.value += Math.min(delta, 0.05));
    let m = melt;
    if (demo) {
      const s = demoState(t);
      m = s.melt;
      CAST.forEach((p, i) => {
        opacities.current[i] = s.opacity(p.delay);
      });
      if (s.phase !== lastPhase.current) {
        lastPhase.current = s.phase;
        onPhase?.(s.phase);
      }
    }
    uniforms.uMelt.value = m;
    place(t, m);
    CAST.forEach((_, i) => {
      const g = pieces.current[i];
      if (!g) return;
      const o = demo ? opacities.current[i]! : piecesOpacity;
      g.visible = o > 0.01;
      g.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshPhysicalMaterial;
          mat.transparent = o < 0.999;
          mat.opacity = o;
          mat.depthWrite = o > 0.6;
        }
      });
      // Fading pieces also sink a little into the soft board.
      g.position.y -= (1 - o) * 0.18;
    });
    if (camera.current && pointer?.current) {
      const target = new THREE.Vector3(0.15, -0.1, 0.1);
      camera.current.position.x += (-2.4 + pointer.current.x * 0.6 - camera.current.position.x) * 0.05;
      camera.current.position.y += (5.4 - pointer.current.y * 0.35 - camera.current.position.y) * 0.05;
      camera.current.lookAt(target);
    }
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault fov={30} position={[-2.4, 5.4, 8.6]} onUpdate={(c) => c.lookAt(0.15, -0.1, 0.1)} />
      <StudioEnvironment intensity={theme === "light" ? 1 : 0.8} />
      <StudioLights theme={theme} shadows keyPosition={[-6, 4.6, 0.6]} />
      <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {CAST.map((p, i) => (
        <Piece
          key={i}
          ref={(g: THREE.Group | null) => {
            pieces.current[i] = g;
            if (g && still) place(0.6, melt);
          }}
          type={p.type}
          color={p.color}
          theme={theme}
          opacity={piecesOpacity}
          castShadow
          scale={1.12}
        />
      ))}
      <ContactShadows position={[0, -0.55, 0]} opacity={theme === "light" ? 0.42 : 0.7} scale={11} blur={3.2} far={1.4} resolution={512} color="#000000" frames={still ? 1 : Infinity} />
    </>
  );
}
