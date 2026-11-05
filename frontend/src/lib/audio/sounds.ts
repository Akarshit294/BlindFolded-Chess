/**
 * All sounds are synthesised with the Web Audio API — no audio files, no licences.
 * The AudioContext is created lazily on the first sound (after a user gesture).
 */
import { getSettings } from "@/lib/settings/store";

export type SoundName =
  | "move"
  | "capture"
  | "castle"
  | "check"
  | "promote"
  | "illegal"
  | "start"
  | "win"
  | "lose"
  | "draw"
  | "correct"
  | "wrong"
  | "tick"
  | "peek"
  | "click"
  | "streak";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  master!.gain.value = getSettings().volume * 0.9;
  return { ctx, out: master! };
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(c.sampleRate * 0.5);
  noiseBuffer = c.createBuffer(1, len, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** A short wooden "tock": filtered noise burst + a low sine thump. */
function knock(c: AudioContext, out: AudioNode, t: number, { pitch = 1, gain = 1, bright = 1 } = {}) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800 * pitch * bright;
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55 * gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.1);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(110 * pitch, t + 0.08);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(og).connect(out);
  osc.start(t);
  osc.stop(t + 0.14);
}

function tone(
  c: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  { dur = 0.25, type = "sine" as OscillatorType, gain = 0.25, attack = 0.01, glideTo }: { dur?: number; type?: OscillatorType; gain?: number; attack?: number; glideTo?: number } = {},
) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function chord(c: AudioContext, out: AudioNode, t: number, freqs: number[], opts: { dur?: number; gain?: number; stagger?: number; type?: OscillatorType } = {}) {
  freqs.forEach((f, i) => tone(c, out, t + i * (opts.stagger ?? 0), f, { dur: opts.dur ?? 0.8, gain: (opts.gain ?? 0.16) / Math.sqrt(freqs.length), type: opts.type ?? "triangle", attack: 0.02 }));
}

function whoosh(c: AudioContext, out: AudioNode, t: number, up = true) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(up ? 400 : 2400, t);
  f.frequency.exponentialRampToValueAtTime(up ? 2400 : 400, t + 0.35);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.45);
}

export function playSound(name: SoundName): void {
  const s = getSettings();
  if (!s.sound || s.volume <= 0) return;
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime + 0.005;
  switch (name) {
    case "move":
      knock(c, out, t);
      break;
    case "capture":
      knock(c, out, t, { pitch: 1.25, gain: 1.15, bright: 1.4 });
      knock(c, out, t + 0.045, { pitch: 0.85, gain: 0.6 });
      break;
    case "castle":
      knock(c, out, t);
      knock(c, out, t + 0.13, { pitch: 1.1, gain: 0.8 });
      break;
    case "check":
      knock(c, out, t, { pitch: 1.1 });
      tone(c, out, t + 0.02, 1320, { dur: 0.35, type: "triangle", gain: 0.12 });
      tone(c, out, t + 0.02, 1980, { dur: 0.25, type: "sine", gain: 0.05 });
      break;
    case "promote":
      knock(c, out, t);
      chord(c, out, t + 0.05, [784, 988, 1175], { dur: 0.5, stagger: 0.05 });
      break;
    case "illegal":
      tone(c, out, t, 180, { dur: 0.18, type: "square", gain: 0.06, glideTo: 120 });
      break;
    case "start":
      chord(c, out, t, [392, 523.25, 659.25], { dur: 0.9, stagger: 0.07, gain: 0.18 });
      break;
    case "win":
      chord(c, out, t, [523.25, 659.25, 783.99, 1046.5], { dur: 1.4, stagger: 0.09, gain: 0.22 });
      break;
    case "lose":
      chord(c, out, t, [392, 311.13, 261.63], { dur: 1.3, stagger: 0.14, gain: 0.18, type: "sine" });
      break;
    case "draw":
      chord(c, out, t, [440, 554.37], { dur: 1, stagger: 0.12, gain: 0.16 });
      break;
    case "correct":
      tone(c, out, t, 880, { dur: 0.16, type: "triangle", gain: 0.16 });
      tone(c, out, t + 0.08, 1318.5, { dur: 0.26, type: "triangle", gain: 0.16 });
      break;
    case "wrong":
      tone(c, out, t, 330, { dur: 0.16, type: "triangle", gain: 0.14 });
      tone(c, out, t + 0.09, 247, { dur: 0.28, type: "triangle", gain: 0.14 });
      break;
    case "streak":
      chord(c, out, t, [1046.5, 1318.5, 1568], { dur: 0.45, stagger: 0.04, gain: 0.16 });
      break;
    case "tick":
      tone(c, out, t, 1600, { dur: 0.04, type: "square", gain: 0.03 });
      break;
    case "peek":
      whoosh(c, out, t, true);
      break;
    case "click":
      tone(c, out, t, 1200, { dur: 0.03, type: "sine", gain: 0.05 });
      break;
  }
}

/** Picks the right sound for a chess.js move. */
export function moveSound(move: { san: string; flags: string; captured?: string }): SoundName {
  if (move.san.includes("#")) return "check";
  if (move.san.includes("+")) return "check";
  if (move.flags.includes("p")) return "promote";
  if (move.flags.includes("k") || move.flags.includes("q")) return "castle";
  if (move.captured) return "capture";
  return "move";
}
