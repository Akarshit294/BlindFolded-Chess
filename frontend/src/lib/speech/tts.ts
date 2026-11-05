/** Thin wrapper over speechSynthesis honouring the user's voice settings. */
import { getSettings } from "@/lib/settings/store";

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

/** Speaks text. `force` ignores the voice-output setting (e.g. drills that read aloud on request). */
export function speak(text: string, { interrupt = true, force = false }: { interrupt?: boolean; force?: boolean } = {}): Promise<void> {
  return new Promise((resolve) => {
    const s = getSettings();
    if (!ttsSupported() || (!s.voiceOutput && !force)) return resolve();
    const synth = window.speechSynthesis;
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = s.speechRate;
    u.volume = Math.max(0.2, s.volume);
    const voice = s.voiceName ? synth.getVoices().find((v) => v.name === s.voiceName) : undefined;
    if (voice) u.voice = voice;
    else u.lang = "en-US";
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    // Some browsers never fire onend for queued utterances; don't hang callers.
    window.setTimeout(resolve, Math.max(3000, text.length * 120));
  });
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
