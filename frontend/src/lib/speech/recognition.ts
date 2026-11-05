"use client";
/**
 * Web Speech API recognition (Chrome/Edge/Safari). Returns several alternatives so the
 * caller can try each against the legal moves.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type RecognitionResultList = { length: number; [i: number]: { length: number; isFinal: boolean; [j: number]: { transcript: string; confidence: number } } };
type RecognitionEvent = { results: RecognitionResultList; resultIndex: number };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return getCtor() !== null;
}

export type RecognitionState = "idle" | "listening" | "error" | "unsupported";

export function useSpeechRecognition(onAlternatives: (alts: string[], final: boolean) => void) {
  const [state, setState] = useState<RecognitionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onAlternatives);
  useLayoutEffect(() => {
    cb.current = onAlternatives;
  });
  const supported = typeof window !== "undefined" && recognitionSupported();

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setState("unsupported");
      return;
    }
    rec.current?.abort();
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.onstart = () => {
      setError(null);
      setState("listening");
    };
    r.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      if (!result) return;
      const alts: string[] = [];
      for (let i = 0; i < result.length; i++) {
        const alt = result[i];
        if (alt?.transcript) alts.push(alt.transcript.trim());
      }
      cb.current(alts, result.isFinal);
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone permission was denied." : e.error === "no-speech" ? "Didn't catch that." : `Voice error: ${e.error}`);
      setState("error");
    };
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.current = r;
    try {
      r.start();
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { state, error, start, stop, supported };
}
