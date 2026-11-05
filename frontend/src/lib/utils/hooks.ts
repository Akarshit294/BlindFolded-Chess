"use client";
import { useSyncExternalStore } from "react";
import { listVoices, ttsSupported } from "@/lib/speech/tts";

const noop = () => () => {};

/** False during SSR and hydration, true afterwards — without a setState-in-effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

let voiceCache: SpeechSynthesisVoice[] = [];
let voiceKey = "";

function voicesSnapshot(): SpeechSynthesisVoice[] {
  const list = listVoices();
  const key = list.map((v) => v.name).join("|");
  if (key !== voiceKey) {
    voiceKey = key;
    voiceCache = list;
  }
  return voiceCache;
}

const EMPTY: SpeechSynthesisVoice[] = [];

/** English speech-synthesis voices; updates when the browser finishes loading them. */
export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(
    (onChange) => {
      if (!ttsSupported()) return () => {};
      window.speechSynthesis.addEventListener?.("voiceschanged", onChange);
      return () => window.speechSynthesis.removeEventListener?.("voiceschanged", onChange);
    },
    voicesSnapshot,
    () => EMPTY,
  );
}

/** True on devices with a mouse/trackpad; phones and tablets return false. */
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Focuses a text field without scrolling, and only on desktop: on touch devices autofocus
 * would pop up the keyboard and scroll the page.
 */
export function focusOnDesktop(el: HTMLElement | null | undefined) {
  if (el && hasFinePointer()) el.focus({ preventScroll: true });
}
