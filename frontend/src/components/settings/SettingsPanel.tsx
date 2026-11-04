"use client";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Board } from "@/components/board/Board";
import { PieceGlyph } from "@/components/board/PieceGlyph";
import { Button } from "@/components/ui/Button";
import { Card, Segmented, Slider, Toggle } from "@/components/ui/Controls";
import { IconRefresh, IconVolume } from "@/components/ui/Icons";
import { playSound } from "@/lib/audio/sounds";
import { recognitionSupported } from "@/lib/speech/recognition";
import { speak, ttsSupported } from "@/lib/speech/tts";
import { useHydrated, useVoices } from "@/lib/utils/hooks";
import { BOARD_THEMES, PIECE_SETS, useSettings, type BoardThemeId, type MotionPref, type MoveHints, type PieceSetId } from "@/lib/settings/store";
import { cn } from "@/lib/utils/cn";

const PREVIEW_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 3 5";

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-ivory-50">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ivory-400">{description}</p> : null}
      <div className="mt-4 divide-y divide-ivory-100/[0.06]">{children}</div>
    </Card>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="py-2">{children}</div>;
}

export function SettingsPanel() {
  const s = useSettings();
  const hydrated = useHydrated();
  const voices = useVoices();
  const support = { tts: hydrated && ttsSupported(), stt: hydrated && recognitionSupported() };

  if (!s.hydrated) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_380px]" aria-busy="true">
        <div className="space-y-6">
          <div className="skeleton h-12 w-48" />
          <div className="skeleton h-80" />
          <div className="skeleton h-56" />
        </div>
        <div className="skeleton hidden h-96 lg:block" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-ivory-50 sm:text-5xl">Settings</h1>
          <p className="mt-2 text-ivory-300">Saved automatically in this browser.</p>
        </div>
        <Button variant="ghost" size="sm" icon={<IconRefresh size={15} />} onClick={() => s.reset()} data-testid="reset-settings">
          Restore defaults
        </Button>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Group title="Board" description="Themes and pieces apply everywhere — games, drills, puzzles and replays.">
            <Row>
              <div className="mb-2 text-sm font-medium text-ivory-100">Theme</div>
              <div role="radiogroup" aria-label="Board theme" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {BOARD_THEMES.map((t) => {
                  const active = s.boardTheme === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`theme-${t.id}`}
                      onClick={() => s.set("boardTheme", t.id as BoardThemeId)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "rounded-xl p-1.5 text-left outline-none ring-1 ring-inset focus-visible:ring-2 focus-visible:ring-moon-300",
                        active ? "bg-ember-400/10 ring-ember-400/70" : "ring-ivory-100/10 hover:ring-ivory-100/25",
                      )}
                    >
                      <span className="grid aspect-square grid-cols-2 overflow-hidden rounded-lg">
                        {[t.light, t.dark, t.dark, t.light].map((c, i) => (
                          <span key={i} style={{ background: c }} />
                        ))}
                      </span>
                      <span className="mt-1.5 block truncate text-center text-xs text-ivory-300">{t.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </Row>
            <Row>
              <div className="mb-2 text-sm font-medium text-ivory-100">Pieces</div>
              <div role="radiogroup" aria-label="Piece set" className="grid gap-3 sm:grid-cols-2">
                {PIECE_SETS.map((p) => {
                  const active = s.pieceSet === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`pieces-${p.id}`}
                      onClick={() => s.set("pieceSet", p.id as PieceSetId)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-3 text-left outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-moon-300",
                        active ? "bg-ember-400/10 ring-ember-400/70" : "ring-ivory-100/10 hover:ring-ivory-100/25",
                      )}
                    >
                      <span className="flex rounded-lg bg-[var(--sq-light)] p-1">
                        {(["k", "q", "n"] as const).map((t) => (
                          <PieceGlyph key={t} set={p.id} color="w" type={t} className="h-8 w-8" />
                        ))}
                        <PieceGlyph set={p.id} color="b" type="n" className="h-8 w-8" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ivory-50">{p.name}</span>
                        <span className="block text-xs text-ivory-400">{p.note}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row>
              <Toggle checked={s.coordinates} onChange={(v) => s.set("coordinates", v)} label="Show coordinates" description="Rank and file labels on the board edge (empty-board mode always labels every square)." />
            </Row>
            <Row>
              <Toggle checked={s.figurine} onChange={(v) => s.set("figurine", v)} label="Figurine notation" description="Show ♘f3 instead of Nf3 in move lists." />
            </Row>
          </Group>

          <Group title="Blindfold" description="How hidden boards behave.">
            <Row>
              <Slider label="Ghost mode: pieces fade after" min={1} max={8} step={0.5} value={s.ghostDelay} onChange={(v) => s.set("ghostDelay", v)} format={(v) => `${v}s`} />
            </Row>
            <Row>
              <Slider label="Peek duration" min={1} max={8} step={0.5} value={s.peekSeconds} onChange={(v) => s.set("peekSeconds", v)} format={(v) => `${v}s`} />
            </Row>
            <Row>
              <div className="mb-2 text-sm font-medium text-ivory-100">Typed-move help in practice games</div>
              <Segmented<MoveHints>
                label="Move hints"
                value={s.moveHints}
                onChange={(v) => s.set("moveHints", v)}
                options={[
                  { value: "autocomplete", label: "Autocomplete" },
                  { value: "validate", label: "Validate only" },
                  { value: "off", label: "Off" },
                ]}
              />
              <p className="mt-2 text-xs text-ivory-400">Rated games always use “Off”, so you can&apos;t probe which moves are legal.</p>
            </Row>
            <Row>
              <Toggle checked={s.confirmResign} onChange={(v) => s.set("confirmResign", v)} label="Confirm before resigning" />
            </Row>
          </Group>

          <Group title="Sound">
            <Row>
              <Toggle checked={s.sound} onChange={(v) => s.set("sound", v)} label="Sound effects" description="Synthesised in your browser — moves, captures, checks, answers." />
            </Row>
            <Row>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Slider label="Volume" min={0} max={1} step={0.05} value={s.volume} onChange={(v) => s.set("volume", v)} format={(v) => `${Math.round(v * 100)}%`} />
                </div>
                <Button
                  size="sm"
                  icon={<IconVolume size={15} />}
                  onClick={() => {
                    playSound("move");
                    window.setTimeout(() => playSound("capture"), 260);
                    window.setTimeout(() => playSound("check"), 560);
                  }}
                  disabled={!s.sound}
                >
                  Test
                </Button>
              </div>
            </Row>
          </Group>

          <Group title="Voice" description="Hands-free blindfold play using your browser's built-in speech features.">
            <Row>
              <Toggle
                checked={s.voiceOutput}
                onChange={(v) => s.set("voiceOutput", v)}
                label="Read moves aloud"
                description={support.tts ? "The engine's moves (and puzzle replies) are spoken." : "Speech synthesis isn't available in this browser."}
                disabled={!support.tts}
              />
            </Row>
            <Row>
              <Toggle checked={s.announceOwnMoves} onChange={(v) => s.set("announceOwnMoves", v)} label="Also read my own moves" disabled={!support.tts} />
            </Row>
            {support.tts ? (
              <>
                <Row>
                  <label className="block text-sm font-medium text-ivory-100" htmlFor="voice-select">
                    Voice
                  </label>
                  <select
                    id="voice-select"
                    value={s.voiceName ?? ""}
                    onChange={(e) => s.set("voiceName", e.target.value || null)}
                    className="mt-2 h-10 w-full rounded-xl bg-night-850 px-3 text-sm text-ivory-100 outline-none ring-1 ring-inset ring-ivory-100/10 focus:ring-moon-400/50"
                  >
                    <option value="">System default</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </Row>
                <Row>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Slider label="Speaking rate" min={0.6} max={1.6} step={0.05} value={s.speechRate} onChange={(v) => s.set("speechRate", v)} format={(v) => `${v.toFixed(2)}×`} />
                    </div>
                    <Button size="sm" icon={<IconVolume size={15} />} onClick={() => void speak("Knight takes e5, check", { force: true })}>
                      Hear it
                    </Button>
                  </div>
                </Row>
              </>
            ) : null}
            <Row>
              <Toggle
                checked={s.voiceInput}
                onChange={(v) => s.set("voiceInput", v)}
                label="Voice input (microphone button)"
                description={support.stt ? "Say moves like “e4”, “knight f three” or “castle kingside”." : "Speech recognition isn't supported here (try Chrome, Edge or Safari)."}
              />
            </Row>
          </Group>

          <Group title="Motion">
            <Row>
              <Segmented<MotionPref>
                label="Animation"
                value={s.motion}
                onChange={(v) => s.set("motion", v)}
                options={[
                  { value: "system", label: "Follow system" },
                  { value: "full", label: "Full" },
                  { value: "reduced", label: "Reduced" },
                ]}
              />
              <p className="mt-2 text-xs text-ivory-400">Reduced turns off piece flights, fog, confetti and page transitions. “Follow system” respects your OS setting.</p>
            </Row>
          </Group>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Preview">
          <Card className="p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ivory-500">Preview</div>
            <Board fen={PREVIEW_FEN} interactive={false} lastMove={{ from: "f1", to: "c4" }} arrows={[{ from: "f3", to: "g5", color: "moon" }]} ariaLabel="Board preview" />
          </Card>
        </aside>
      </div>
    </div>
  );
}
