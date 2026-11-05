"use client";
/**
 * Typed + spoken move entry. Practice mode can show legal-move autocomplete or just validate;
 * rated mode only checks syntax until you press Enter (no free legality probing).
 */
import type { Chess, Move, PieceSymbol } from "chess.js";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buttonClass, IconButton } from "@/components/ui/Button";
import { IconMic } from "@/components/ui/Icons";
import { PIECE_NAMES } from "@/lib/chess/notation";
import { autocompleteMoves, looksLikeMove, resolveMoveText, resolveSpecs, type MoveResolution } from "@/lib/chess/parse-move";
import { interpretMoveText } from "@/lib/chess/parse-move";
import { useSettings, type MoveHints } from "@/lib/settings/store";
import { useSpeechRecognition } from "@/lib/speech/recognition";
import { cn } from "@/lib/utils/cn";
import { focusOnDesktop } from "@/lib/utils/hooks";

export type MoveInputHandle = { focus: () => void; focusSoft: () => void; clear: () => void; startVoice: () => void };

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
    placeholder = "Type a move: e4, Nf3, knight takes c6…",
    disabledPlaceholder = "Waiting for the engine…",
    className,
  },
  ref,
) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [choices, setChoices] = useState<Move[] | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceEnabled = useSettings((s) => s.voiceInput);
  const motionPref = useSettings((s) => s.motion);
  const systemReduced = useReducedMotion();
  const reduced = motionPref === "reduced" || (motionPref === "system" && !!systemReduced);
  const [shell, animateShell] = useAnimate<HTMLDivElement>();
  const fen = chess.fen();
  const legal = useMemo(() => chess.moves({ verbose: true }), [chess, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => (hints === "autocomplete" && text.trim() ? autocompleteMoves(text, legal, 6) : []), [hints, text, legal]);
  const [activeIdx, setActiveIdx] = useState(0);

  // A new position makes earlier choices and messages meaningless: a "Which one?" chip from the
  // last position must never be playable in this one.
  const [seenFen, setSeenFen] = useState(fen);
  if (seenFen !== fen) {
    setSeenFen(fen);
    setChoices(null);
    setStatus(null);
    setActiveIdx(0);
  }

  // Shake the field without remounting it, so the input keeps focus.
  const shake = () => {
    if (!reduced && shell.current) void animateShell(shell.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.35 });
  };

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
    if (disabled) return;
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
        shake();
        setStatus({ tone: "bad", text: r.message });
        onIllegal(raw, r.message);
        return false;
      case "invalid":
        shake();
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
    const r = resolveMoveText(raw, chess);
    if (hints === "autocomplete" && suggestions.length > 0 && r.status === "invalid") {
      // Enter picks the highlighted suggestion only while the text isn't a whole move yet. A
      // complete move that happens to be illegal stays illegal: it must not turn into another.
      const pickMove = suggestions[Math.min(activeIdx, suggestions.length - 1)];
      if (pickMove) return play(pickMove);
    }
    handleResolution(r, raw);
  };

  const voice = useSpeechRecognition((alts, final) => {
    // Results that arrive after the turn has passed (or the game ended) are ignored.
    if (disabled) return;
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

  const { stop: stopVoice } = voice;
  useEffect(() => {
    if (disabled) stopVoice();
  }, [disabled, stopVoice]);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    focusSoft: () => focusOnDesktop(inputRef.current),
    clear: () => {
      setText("");
      setStatus(null);
      setChoices(null);
    },
    startVoice: () => {
      if (!disabled) voice.start();
    },
  }));

  const shown = status ?? (hints !== "off" ? live : text.trim() ? live : null);
  const listening = voice.state === "listening";

  return (
    <div className={cn("relative flex flex-col", className)}>
      <div
        ref={shell}
        className={cn(
          "glass-well flex items-center gap-1 rounded-full p-1.5 pl-5 transition-shadow duration-200",
          shown?.tone === "bad"
            ? "shadow-[inset_0_0_0_1.5px_var(--bad)]"
            : shown?.tone === "good"
              ? "shadow-[inset_0_0_0_1.5px_var(--good)]"
              : "focus-within:shadow-[inset_0_0_0_1.5px_var(--ink)]",
        )}
      >
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
          className="h-10 min-w-0 flex-1 bg-transparent text-[1.0625rem] font-semibold text-ink outline-none placeholder:text-[0.9375rem] placeholder:font-normal placeholder:text-muted disabled:opacity-60"
        />
        {voiceEnabled && voice.supported ? (
          <IconButton
            label={listening ? "Stop listening" : "Speak your move"}
            active={listening}
            onClick={() => (listening ? voice.stop() : voice.start())}
            disabled={disabled}
          >
            <IconMic />
            {listening ? <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-ink/40" /> : null}
          </IconButton>
        ) : null}
        <button type="button" onClick={submit} disabled={disabled || !text.trim()} className={buttonClass("primary", "sm", "h-10 px-5")}>
          Play
        </button>
      </div>

      <div id="move-input-status" className="min-h-[1.5rem] px-3 py-1.5 text-small" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {listening ? (
            <motion.div key="listening" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-ink">
              <Waveform /> {heard ? `“${heard}”` : "Listening… say a move like “knight f3”"}
            </motion.div>
          ) : voice.error && !status ? (
            <motion.div key="verr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-bad">
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
                shown.tone === "good" && "font-semibold text-good",
                shown.tone === "bad" && "font-semibold text-bad",
                shown.tone === "info" && "font-semibold text-ink",
                shown.tone === "neutral" && "text-muted",
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
            className="flex flex-wrap gap-1.5 px-1 pb-1"
          >
            {(choices ?? suggestions).map((m, i) => (
              <motion.li key={m.lan} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.025 }}>
                <button
                  type="button"
                  role="option"
                  aria-selected={!choices && i === activeIdx}
                  disabled={disabled}
                  onClick={() => play(m)}
                  className={cn(
                    "h-9 cursor-pointer rounded-full px-3.5 text-small font-semibold tabular outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)]",
                    !choices && i === activeIdx ? "pill-secondary text-ink" : "glass-well text-ink hover:bg-ink/[0.08]",
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
          className="w-[3px] rounded-full bg-ink"
          animate={{ scaleY: [0.3, 1, 0.4, 0.8, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
          style={{ height: 14, transformOrigin: "center" }}
        />
      ))}
    </span>
  );
}
