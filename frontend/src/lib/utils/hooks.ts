"use client";
import { useEffect, useSyncExternalStore } from "react";
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

/**
 * Keeps --kb on <html> equal to the height of the on-screen keyboard (iOS overlays it on the page; Android with
 * interactive-widget=resizes-content resizes the layout instead, giving 0). Fixed bars add it to their offset,
 * and data-kb="open" lets them tidy up while typing.
 */
export function useKeyboardInset(enabled: boolean) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!enabled || !vv) return;
    const root = document.documentElement;
    const update = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--kb", `${kb}px`);
      const open = kb > 80 || (document.activeElement instanceof HTMLInputElement && window.innerHeight < screen.height * 0.6);
      if (open) root.setAttribute("data-kb", "open");
      else root.removeAttribute("data-kb");
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb");
      root.removeAttribute("data-kb");
    };
  }, [enabled]);
}

/** A media query as state (false on the server and during hydration). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
