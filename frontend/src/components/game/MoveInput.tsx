"use client";
/**
 * Typed + spoken move entry. Practice mode can show legal-move autocomplete or just validate;
 * rated mode only checks syntax until you press Enter (no free legality probing).
 */
import type { Chess, Move, PieceSymbol } from "chess.js";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { IconMic } from "@/components/ui/Icons";
import { PIECE_NAMES } from "@/lib/chess/notation";
import { autocompleteMoves, looksLikeMove, resolveMoveText, resolveSpecs, type MoveResolution } from "@/lib/chess/parse-move";
import { interpretMoveText } from "@/lib/chess/parse-move";
import { useSettings, type MoveHints } from "@/lib/settings/store";
import { useSpeechRecognition } from "@/lib/speech/recognition";
import { cn } from "@/lib/utils/cn";

export type MoveInputHandle = { focus: () => void; clear: () => void; startVoice: () => void };

type Props = {
  chess: Chess;
  disabled?: boolean;
  hints: MoveHints;
  /** Called with a fully resolved legal move. */
  onMove: (move: Move) => void;
  /** Called when the user submits a syntactically valid but illegal move. */
  onIllegal: (text: string, message: string) => void;
  placeholder?: string;
  disabledPlaceholder?: string;
  className?: string;
};

type Status = { tone: "neutral" | "good" | "bad" | "info"; text: string } | null;

export const MoveInput = forwardRef<MoveInputHandle, Props>(function MoveInput(
  {
    chess,
    disabled,
    hints,
    onMove,
    onIllegal,
    placeholder = "Type a move — e4, Nf3, O-O, knight takes c6…",
    disabledPlaceholder = "Waiting for the engine…",
    className,
  },
  ref,
) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [choices, setChoices] = useState<Move[] | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [heard, setHeard] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceEnabled = useSettings((s) => s.voiceInput);
  const fen = chess.fen();
  const legal = useMemo(() => chess.moves({ verbose: true }), [chess, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => (hints === "autocomplete" && text.trim() ? autocompleteMoves(text, legal, 6) : []), [hints, text, legal]);
  const [activeIdx, setActiveIdx] = useState(0);

  const live: Status = useMemo(() => {
    const t = text.trim();
    if (!t) return null;
    if (hints === "off") return looksLikeMove(t) ? { tone: "neutral", text: "Press Enter to play" } : null;
    const r = resolveMoveText(t, chess);
    if (r.status === "legal") return { tone: "good", text: `${r.move.san} — press Enter` };
    if (r.status === "promotion") return { tone: "info", text: "Promotion — pick a piece" };
    if (r.status === "ambiguous") return { tone: "info", text: r.message };
    if (r.status === "illegal") return { tone: "bad", text: "Not legal here" };
    return suggestions.length ? null : { tone: "neutral", text: "Keep typing…" };
  }, [text, hints, chess, suggestions.length]);

  const play = (move: Move) => {
    setText("");
    setStatus(null);
    setChoices(null);
    setHeard(null);
    onMove(move);
  };

  const handleResolution = (r: MoveResolution, raw: string) => {
    switch (r.status) {
      case "legal":
        play(r.move);
        return true;
      case "promotion":
      case "ambiguous":
        setChoices(r.candidates);
        setStatus({ tone: "info", text: r.status === "promotion" ? "Promote to…" : "Which one?" });
        return true;
      case "illegal":
        setShakeKey((k) => k + 1);
        setStatus({ tone: "bad", text: r.message });
        onIllegal(raw, r.message);
        return false;
      case "invalid":
        setShakeKey((k) => k + 1);
        setStatus({ tone: "bad", text: "That doesn't look like a move." });
        return false;
      default:
        return false;
    }
  };

  const submit = () => {
    if (disabled) return;
    const raw = text.trim();
    if (!raw) return;
    if (hints === "autocomplete" && suggestions.length > 0) {
      const r = resolveMoveText(raw, chess);
      if (r.status !== "legal" && r.status !== "promotion" && r.status !== "ambiguous") {
        // Enter picks the highlighted suggestion when the text alone isn't a move yet.
        const pickMove = suggestions[Math.min(activeIdx, suggestions.length - 1)];
        if (pickMove) return play(pickMove);
      }
    }
    handleResolution(resolveMoveText(raw, chess), raw);
  };

  const voice = useSpeechRecognition((alts, final) => {
    setHeard(alts[0] ?? null);
    if (!final) return;
    // Try every alternative the recogniser offered; first legal interpretation wins.
    let firstIllegal: MoveResolution | null = null;
    for (const alt of alts) {
      const specs = interpretMoveText(alt);
      if (!specs.length) continue;
      const r = resolveSpecs(specs, legal);
      if (r.status === "legal" || r.status === "promotion" || r.status === "ambiguous") {
        if (r.status === "promotion") {
          // Spoken promotions without a piece default to a queen.
          const q = r.candidates.find((c) => c.promotion === "q");
          if (q) return play(q);
        }
        handleResolution(r, alt);
        return;
      }
      if (r.status === "illegal" && !firstIllegal) firstIllegal = r;
    }
    if (firstIllegal) handleResolution(firstIllegal, alts[0] ?? "");
    else setStatus({ tone: "bad", text: `Heard “${alts[0] ?? ""}” — not a move. Try “knight f3”.` });
  });

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      setText("");
      setStatus(null);
      setChoices(null);
    },
    startVoice: () => voice.start(),
  }));

  const shown = status ?? (hints !== "off" ? live : text.trim() ? live : null);
  const listening = voice.state === "listening";

  return (
    <div className={cn("relative", className)}>
      <motion.div
        key={shakeKey}
        animate={shakeKey ? { x: [0, -8, 7, -5, 3, 0] } : undefined}
        transition={{ duration: 0.35 }}
        className={cn(
          "flex items-center gap-2 rounded-2xl bg-night-850/90 p-1.5 pl-4 ring-1 ring-inset transition-shadow",
          shown?.tone === "bad" ? "ring-coral-400/50" : shown?.tone === "good" ? "ring-jade-400/40" : "ring-ivory-100/10 focus-within:ring-moon-400/50",
        )}
      >
        <span className="font-mono text-sm text-ivory-500" aria-hidden="true">
          ›
        </span>
        <input
          ref={inputRef}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            setStatus(null);
            setChoices(null);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              setText("");
              setStatus(null);
              setChoices(null);
            } else if (e.key === "ArrowDown" && suggestions.length) {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp" && suggestions.length) {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Tab" && suggestions.length && text.trim()) {
              e.preventDefault();
              setText(suggestions[activeIdx]?.san ?? text);
            }
          }}
          placeholder={disabled ? disabledPlaceholder : placeholder}
          aria-label="Your move"
          aria-describedby="move-input-status"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          data-testid="move-input"
          className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[15px] text-ivory-50 outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-ivory-500 disabled:opacity-60"
        />
        {voiceEnabled && voice.supported ? (
          <IconButton
            label={listening ? "Stop listening" : "Speak your move"}
            active={listening}
            onClick={() => (listening ? voice.stop() : voice.start())}
            disabled={disabled}
            className="relative"
          >
            <IconMic />
            {listening ? <span className="absolute inset-0 animate-ping rounded-xl ring-2 ring-moon-400/60" /> : null}
          </IconButton>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="h-10 rounded-xl bg-ivory-100/[0.08] px-4 text-sm font-medium text-ivory-100 outline-none transition-colors hover:bg-ivory-100/15 focus-visible:ring-2 focus-visible:ring-moon-300 disabled:opacity-40"
        >
          Play
        </button>
      </motion.div>

      <div id="move-input-status" className="mt-2 min-h-[22px] px-1 text-[13px]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {listening ? (
            <motion.div key="listening" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-moon-200">
              <Waveform /> {heard ? `“${heard}”` : "Listening… say a move like “knight f3”"}
            </motion.div>
          ) : voice.error && !status ? (
            <motion.div key="verr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-ember-300">
              {voice.error}
            </motion.div>
          ) : shown ? (
            <motion.div
              key={shown.text}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                shown.tone === "good" && "text-jade-300",
                shown.tone === "bad" && "text-coral-300",
                shown.tone === "info" && "text-moon-200",
                shown.tone === "neutral" && "text-ivory-400",
              )}
            >
              {shown.text}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Autocomplete / disambiguation chips */}
      <AnimatePresence>
        {(choices ?? suggestions).length > 0 ? (
          <motion.ul
            role="listbox"
            aria-label={choices ? "Choose a move" : "Suggestions"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-1 flex flex-wrap gap-1.5"
          >
            {(choices ?? suggestions).map((m, i) => (
              <motion.li key={m.lan} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.025 }}>
                <button
                  type="button"
                  role="option"
                  aria-selected={!choices && i === activeIdx}
                  onClick={() => play(m)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-mono text-[13px] outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
                    !choices && i === activeIdx ? "bg-moon-500/20 text-moon-100 ring-moon-400/40" : "bg-night-700/70 text-ivory-200 ring-ivory-100/10 hover:bg-night-600",
                  )}
                >
                  {m.promotion && choices ? `=${PIECE_NAMES[m.promotion as PieceSymbol]}` : m.san}
                </button>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

function Waveform() {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-moon-300"
          animate={{ scaleY: [0.3, 1, 0.4, 0.8, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
          style={{ height: 14, transformOrigin: "center" }}
        />
      ))}
    </span>
  );
}
