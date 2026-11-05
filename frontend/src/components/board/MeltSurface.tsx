"use client";
/**
 * The melting board: one WebGL fragment shader (no Three.js) that redraws the checkerboard as a liquid. The
 * squares flow with a slow domain warp, a ripple runs out from the last move when the pieces hide, a soft sheen
 * drifts across, and the edges sink a little. It only renders while the board is melted (or settling back), at
 * up to 1.5× device pixels; when the board is solid the canvas fades out and the crisp CSS squares show.
 *
 * Without WebGL it falls back to a softened CSS layer; with reduced motion it draws a single still frame.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uMelt;
uniform float uRipple;
uniform vec2 uOrigin;
uniform vec3 uLight;
uniform vec3 uDark;
uniform float uPx;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vUv;
  float t = uTime;
  vec2 w = vec2(fbm(uv * 2.2 + vec2(0.0, t * 0.07)), fbm(uv * 2.2 + vec2(5.2, -t * 0.06))) - 0.5;
  vec2 p = uv + w * 0.06 * uMelt;
  if (uRipple < 1.0) {
    float d = distance(uv, uOrigin);
    float r = uRipple * 1.15;
    float ring = sin((d - r) * 48.0) * exp(-pow((d - r) * 8.0, 2.0)) * (1.0 - uRipple);
    p += (uv - uOrigin) / max(d, 0.001) * ring * 0.012;
  }
  vec2 q = p * 8.0;
  float s = sin(3.14159265 * q.x) * sin(3.14159265 * q.y);
  float aa = 3.14159265 * 8.0 * uPx * 1.5 + uMelt * 0.22;
  float c = smoothstep(-aa, aa, s);
  vec3 col = mix(uDark, uLight, c);
  float sh = smoothstep(0.58, 0.9, fbm(p * 1.4 + vec2(t * 0.025, -t * 0.02)));
  col = mix(col, vec3(1.0), sh * 0.16 * uMelt);
  vec2 e = abs(uv - 0.5) * 2.0;
  float edge = smoothstep(0.72, 1.0, max(e.x, e.y));
  col *= 1.0 - edge * 0.1 * uMelt;
  gl_FragColor = vec4(col, 1.0);
}`;

function parseColor(v: string): [number, number, number] {
  const s = v.trim();
  if (s.startsWith("#")) {
    const h = s.length === 4 ? s.slice(1).split("").map((c) => c + c).join("") : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  const m = s.match(/[\d.]+/g);
  if (m && m.length >= 3) return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  return [0.85, 0.85, 0.85];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
}

type Engine = {
  gl: WebGLRenderingContext;
  u: Record<"uTime" | "uMelt" | "uRipple" | "uOrigin" | "uLight" | "uDark" | "uPx", WebGLUniformLocation | null>;
  light: [number, number, number];
  dark: [number, number, number];
};

type Props = {
  /** 0 = solid board, 1 = fully melted. */
  melt: number;
  /** A new id starts a ripple from (x, y) in board fractions (0..1, top-left origin). */
  ripple?: { x: number; y: number; id: number } | null;
  /** No continuous motion: draw a still frame (reduced motion, tests). */
  still?: boolean;
  /** There are no CSS squares underneath (puzzle, blind panel): the no-WebGL fallback draws soft ones. */
  ownSquares?: boolean;
  className?: string;
};

export function MeltSurface({ melt, ripple = null, still = false, ownSquares = false, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const engine = useRef<Engine | null>(null);
  const anim = useRef({ target: melt, current: 0, ripple: 1, origin: [0.5, 0.5] as [number, number], t: 0, raf: 0, last: 0, frame: 0 });
  const [fallback, setFallback] = useState(false);
  const stillRef = useRef(still);
  useLayoutEffect(() => {
    stillRef.current = still;
  });
  // The render loop lives in the setup effect; other effects reach it through this ref.
  const kickRef = useRef<() => void>(() => undefined);

  // One context per mount. The canvas is made here, not in JSX: when an effect re-runs on the same element (Strict
  // Mode, or a cached route hidden and shown again) a context lost in the cleanup could not be used again.
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const c = document.createElement("canvas");
    c.className = "absolute inset-0 h-full w-full";
    c.style.opacity = "0";
    h.appendChild(c);
    canvas.current = c;
    // Each board starts at a different point in the flow.
    anim.current.t = Math.random() * 50;
    const gl = (c.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" }) ??
      c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    const vs = gl && compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl && vs && fs ? gl.createProgram() : null;
    const fail = () => {
      c.remove();
      canvas.current = null;
      setFallback(true);
    };
    if (!gl || !vs || !fs || !prog) {
      fail();
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      fail();
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const names = ["uTime", "uMelt", "uRipple", "uOrigin", "uLight", "uDark", "uPx"] as const;
    const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)])) as Engine["u"];

    function draw() {
      const e = engine.current;
      const c = canvas.current;
      if (!e || !c) return;
      const a = anim.current;
      const { gl, u } = e;
      gl.uniform1f(u.uTime, a.t);
      gl.uniform1f(u.uMelt, a.current);
      gl.uniform1f(u.uRipple, a.ripple);
      gl.uniform2f(u.uOrigin, a.origin[0], a.origin[1]);
      gl.uniform3f(u.uLight, ...e.light);
      gl.uniform3f(u.uDark, ...e.dark);
      gl.uniform1f(u.uPx, 1 / Math.max(1, c.width));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Fade the canvas with the melt, so a solid board is the crisp CSS one underneath.
      c.style.opacity = String(Math.min(1, a.current * 5));
    }

    function tick(now: number) {
      const a = anim.current;
      const dt = a.last ? Math.min(0.05, (now - a.last) / 1000) : 0.016;
      a.last = now;
      const rising = a.target > a.current;
      // Melting takes about a second; solidifying (a peek) is quick.
      const k = rising ? 2.4 : 10;
      a.current += (a.target - a.current) * (1 - Math.exp(-dt * k));
      if (Math.abs(a.target - a.current) < 0.002) a.current = a.target;
      if (a.ripple < 1) a.ripple = Math.min(1, a.ripple + dt / 1.5);
      a.t += dt;
      const settling = a.current !== a.target || a.ripple < 1;
      // At rest the liquid moves slowly: half the frame rate is plenty.
      a.frame += 1;
      if (settling || a.frame % 2 === 0) draw();
      if (stillRef.current && !settling) {
        a.raf = 0;
        a.last = 0;
        return;
      }
      if (a.current <= 0 && a.target <= 0 && a.ripple >= 1) {
        draw();
        a.raf = 0;
        a.last = 0;
        return;
      }
      a.raf = requestAnimationFrame(tick);
    }

    function kick() {
      const a = anim.current;
      if (!engine.current) return;
      if (stillRef.current) {
        // Reduced motion: jump to the end state, one frame.
        a.current = a.target;
        a.ripple = 1;
        draw();
        return;
      }
      if (!a.raf) a.raf = requestAnimationFrame(tick);
    }
    kickRef.current = kick;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      if (!engine.current) return;
      engine.current.light = parseColor(cs.getPropertyValue("--sq-light"));
      engine.current.dark = parseColor(cs.getPropertyValue("--sq-dark"));
      draw();
    };
    engine.current = { gl, u, light: [0.89, 0.89, 0.89], dark: [0.64, 0.64, 0.64] };

    const resize = () => {
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(rect.width * dpr));
      c.height = Math.max(1, Math.round(rect.height * dpr));
      gl.viewport(0, 0, c.width, c.height);
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    // The board theme and the interface theme both change the square colors.
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-board-theme"] });
    readColors();
    resize();
    const a = anim.current;
    return () => {
      cancelAnimationFrame(a.raf);
      a.raf = 0;
      ro.disconnect();
      mo.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      c.remove();
      canvas.current = null;
      engine.current = null;
      kickRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    anim.current.target = Math.max(0, Math.min(1, melt));
    kickRef.current();
  }, [melt, still]);

  const rippleId = ripple?.id;
  useEffect(() => {
    if (!ripple || still) return;
    anim.current.ripple = 0;
    anim.current.origin = [ripple.x, ripple.y];
    kickRef.current();
    // Only a new ripple id starts a ripple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rippleId]);

  if (fallback) {
    return (
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700", className)} style={{ opacity: melt > 0 ? 1 : 0 }}>
        {ownSquares ? (
          <div
            className="absolute -inset-[4%] blur-[5px]"
            style={{ background: "repeating-conic-gradient(var(--sq-dark) 0 25%, var(--sq-light) 0 50%) 0 0 / 23% 23%" }}
          />
        ) : null}
        <div className="absolute inset-0 backdrop-blur-[1.5px]" style={{ background: "color-mix(in oklab, var(--studio-hi) 18%, transparent)" }} />
      </div>
    );
  }
  return <div ref={host} aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)} />;
}
