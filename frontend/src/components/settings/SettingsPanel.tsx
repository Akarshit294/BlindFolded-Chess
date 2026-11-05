"use client";
import { useState, type ReactNode } from "react";
import { Board } from "@/components/board/Board";
import { PieceImage } from "@/components/board/PieceImage";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Panel, Segmented, Select, Slider, Toggle } from "@/components/ui/Controls";
import { PageHeader } from "@/components/ui/Display";
import { IconMonitor, IconMoon, IconRefresh, IconSun, IconVolume } from "@/components/ui/Icons";
import { playSound } from "@/lib/audio/sounds";
import { recognitionSupported } from "@/lib/speech/recognition";
import { speak, ttsSupported } from "@/lib/speech/tts";
import { useHydrated, useVoices } from "@/lib/utils/hooks";
import {
  BOARD_THEMES,
  PIECE_SETS,
  resolveTheme,
  THEMES,
  useSettings,
  type BoardThemeId,
  type MotionPref,
  type MoveHints,
  type PieceSetId,
  type ThemePref,
} from "@/lib/settings/store";
import { cn } from "@/lib/utils/cn";

const PREVIEW_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 3 5";

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Panel as="section" className="p-5 sm:p-6">
      <h2 className="display text-[1.5rem] leading-none">{title}</h2>
      {description ? <p className="mt-2 text-small text-muted">{description}</p> : null}
      <div className="mt-4 divide-y divide-line">{children}</div>
    </Panel>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="py-3">{children}</div>;
}

const THEME_ICONS: Record<ThemePref, ReactNode> = {
  system: <IconMonitor size={16} />,
  light: <IconSun size={16} />,
  dark: <IconMoon size={16} />,
};

export function SettingsPanel() {
  const s = useSettings();
  const hydrated = useHydrated();
  const voices = useVoices();
  const support = { tts: hydrated && ttsSupported(), stt: hydrated && recognitionSupported() };
  const [melted, setMelted] = useState(false);
  const uiTheme = hydrated ? resolveTheme(s.theme) : "light";

  if (!s.hydrated) {
    return (
      <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10" aria-busy="true">
        <div className="skeleton h-24 w-72 rounded-panel" />
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-6">
            <div className="skeleton h-80 rounded-panel" />
            <div className="skeleton h-56 rounded-panel" />
          </div>
          <div className="skeleton hidden h-96 rounded-panel lg:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10">
      <PageHeader
        thin="Your"
        bold="settings"
        lead="Saved automatically in this browser."
        actions={
          <Button variant="ghost" size="sm" icon={<IconRefresh size={15} />} onClick={() => s.reset()} data-testid="reset-settings">
            Restore defaults
          </Button>
        }
      />

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Group title="Appearance" description="The studio in daylight or after dark. System follows your device.">
            <Row>
              <Segmented<ThemePref>
                label="Theme"
                value={s.theme}
                onChange={(v) => s.set("theme", v)}
                testIdPrefix="ui-theme"
                options={THEMES.map((t) => ({
                  value: t.id,
                  label: (
                    <>
                      {THEME_ICONS[t.id]}
                      {t.name}
                    </>
                  ),
                }))}
              />
            </Row>
          </Group>

          <Group title="Board" description="Themes and pieces apply everywhere: games, drills, puzzles and replays.">
            <Row>
              <FieldLabel id="board-theme-label">Board theme</FieldLabel>
              <div role="radiogroup" aria-labelledby="board-theme-label" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {BOARD_THEMES.map((t) => {
                  const active = s.boardTheme === t.id;
                  const [light, dark] = uiTheme === "dark" ? t.dark : t.light;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`theme-${t.id}`}
                      onClick={() => s.set("boardTheme", t.id as BoardThemeId)}
                      className={cn(
                        "cursor-pointer rounded-control p-1.5 text-left outline-none transition-[background,box-shadow,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)] active:scale-[0.97]",
                        active ? "pill-secondary" : "hover:bg-ink/[0.05]",
                      )}
                    >
                      <span className="grid aspect-square grid-cols-2 overflow-hidden rounded-[0.625rem] shadow-[inset_0_0_0_1px_var(--line)]">
                        {[light, dark, dark, light].map((c, i) => (
                          <span key={i} style={{ background: c }} />
                        ))}
                      </span>
                      <span className={cn("mt-1.5 block truncate text-center text-caption font-semibold", active ? "text-ink" : "text-muted")}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row>
              <FieldLabel id="pieces-label">Pieces</FieldLabel>
              <div role="radiogroup" aria-labelledby="pieces-label" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                        "flex cursor-pointer flex-col gap-2 rounded-control p-3 text-left outline-none transition-[background,box-shadow,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)] active:scale-[0.98]",
                        active ? "pill-secondary" : "hover:bg-ink/[0.05]",
                      )}
                    >
                      <span className="flex rounded-[0.625rem] p-1" style={{ background: "var(--sq-light)" }}>
                        {(["k", "q", "n"] as const).map((t) => (
                          <PieceImage key={t} set={p.id} color="w" type={t} className="h-9 w-9" />
                        ))}
                        <PieceImage set={p.id} color="b" type="n" className="h-9 w-9" />
                      </span>
                      <span>
                        <span className="block text-small font-semibold text-ink">{p.name}</span>
                        <span className="block text-caption text-muted">{p.note}</span>
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
              <FieldLabel>Typed-move help in practice games</FieldLabel>
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
              <p className="mt-2 text-caption text-muted">Rated games always use Off, so you can&apos;t probe which moves are legal.</p>
            </Row>
            <Row>
              <Toggle checked={s.confirmResign} onChange={(v) => s.set("confirmResign", v)} label="Confirm before resigning" />
            </Row>
          </Group>

          <Group title="Sound">
            <Row>
              <Toggle checked={s.sound} onChange={(v) => s.set("sound", v)} label="Sound effects" description="Synthesised in your browser: moves, captures, checks, answers." />
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
                  className="mb-2.5"
                >
                  Test
                </Button>
              </div>
            </Row>
          </Group>

          <Group title="Voice" description="Hands-free blindfold play with your browser's built-in speech features.">
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
                  <FieldLabel htmlFor="voice-select">Voice</FieldLabel>
                  <Select id="voice-select" value={s.voiceName ?? ""} onChange={(e) => s.set("voiceName", e.target.value || null)}>
                    <option value="">System default</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </Select>
                </Row>
                <Row>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Slider label="Speaking rate" min={0.6} max={1.6} step={0.05} value={s.speechRate} onChange={(v) => s.set("speechRate", v)} format={(v) => `${v.toFixed(2)}×`} />
                    </div>
                    <Button size="sm" icon={<IconVolume size={15} />} onClick={() => void speak("Knight takes e5, check", { force: true })} className="mb-2.5">
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
              <p className="mt-2 text-caption text-muted">Reduced turns off piece flights, the melting board, parallax, confetti and page transitions. Follow system respects your device setting.</p>
            </Row>
          </Group>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Preview">
          <Panel className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-small font-semibold text-ink">Preview</h2>
              <Button size="sm" variant={melted ? "primary" : "secondary"} onClick={() => setMelted((m) => !m)} aria-pressed={melted}>
                {melted ? "Solidify" : "Melt it"}
              </Button>
            </div>
            <Board
              fen={PREVIEW_FEN}
              interactive={false}
              lastMove={{ from: "f1", to: "c4" }}
              arrows={[{ from: "f3", to: "g5", color: "soft" }]}
              visibility={melted ? "ghost" : "full"}
              ghostDelayMs={200}
              ariaLabel="Board preview"
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
