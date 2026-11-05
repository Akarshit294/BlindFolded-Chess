import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { DisplayTitle, Rule, SectionTitle } from "@/components/ui/Display";
import { IconCheck, IconMic } from "@/components/ui/Icons";
import { DRILLS } from "@/components/drills/catalog";
import { VISIBILITY_MODES } from "@/lib/game/modes";
import type { Visibility } from "@/lib/storage/types";
import { cn } from "@/lib/utils/cn";
import { DrillVisual } from "@/components/drills/DrillVisual";
import { MiniBoard, type MiniPiece } from "./MiniBoard";

const DEMO: MiniPiece[] = [
  { at: [0, 1], p: "bK" },
  { at: [1, 2], p: "bN" },
  { at: [2, 1], p: "wQ" },
  { at: [2, 3], p: "wP" },
  { at: [3, 2], p: "wK" },
];

function ThemedImg({ light, dark, className, alt = "" }: { light: string; dark: string; className?: string; alt?: string }) {
  return (
    <>
      <img src={light} alt={alt} loading="lazy" decoding="async" className={cn("theme-light-only", className)} />
      <img src={dark} alt="" loading="lazy" decoding="async" className={cn("theme-dark-only", className)} />
    </>
  );
}

function ModeDemo({ mode }: { mode: Visibility }) {
  if (mode === "blind") {
    return (
      <div className={cn("mb-mini", "relative bg-sunken")}>
        <ThemedImg light="/3d/hero/light-melted-720.webp" dark="/3d/hero/dark-melted-720.webp" className="absolute inset-0 h-full w-full scale-[1.45] object-cover" />
        <span className="absolute inset-x-0 bottom-3 text-center font-display text-[1.75rem] font-bold uppercase leading-none text-ink [text-shadow:0_1px_12px_var(--studio-hi)]">Nf3</span>
      </div>
    );
  }
  if (mode === "silhouette") return <MiniBoard pieces={DEMO.map((d) => ({ ...d, p: "token" }))} />;
  if (mode === "empty") return <MiniBoard coords files="efgh" rankTop={5} mark={{ "1,3": "demo-flash", "3,3": "demo-flash" }} />;
  if (mode === "ghost")
    return (
      <MiniBoard pieces={DEMO} className={"demo-ghost"}>
        <span className={"demo-melt"} />
      </MiniBoard>
    );
  return <MiniBoard pieces={DEMO} />;
}

function Steps({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Difficulty ${n + 1} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= n ? "bg-ink" : "bg-ink/15")} />
      ))}
    </span>
  );
}

export function ModeShowcase() {
  return (
    <section aria-labelledby="modes-title" className="px-5 sm:px-8 lg:px-12">
      <div className="max-w-2xl">
        <SectionTitle thin="Five ways to" bold="lose the board" id="modes-title" />
        <p className="mt-4 text-body text-fg">Start with Ghost, then take away a little more as the picture in your head gets steadier. Pick one to play it now.</p>
      </div>
      <ul className="mt-9 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {VISIBILITY_MODES.map((m, i) => (
          <li key={m.id} className={i === 4 ? "col-span-2 lg:col-span-1" : undefined}>
            <Link
              href={`/play?new=1&mode=${m.id}`}
              transitionTypes={["enter-game"]}
              data-testid={`mode-card-${m.id}`}
              className="group glass-panel flex h-full flex-col rounded-panel p-2.5 outline-none transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:p-3"
            >
              <div className={i === 4 ? "mx-auto w-1/2 lg:w-full" : undefined}>
                <ModeDemo mode={m.id} />
              </div>
              <div className="flex flex-1 flex-col px-1.5 pb-1 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{m.name}</span>
                  <Steps n={m.difficulty} />
                </div>
                <p className="mt-1.5 flex-1 text-small text-muted">{m.blurb}</p>
                <span className="mt-3 text-small font-semibold text-ink underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-ink">
                  Play {m.id === "full" ? "a warm-up" : `in ${m.name.replace("Total ", "")}`}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DemoCard({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel flex flex-col rounded-panel p-5 sm:p-6">
      <div className="flex h-40 items-center justify-center">{children}</div>
      <h3 className="mt-5 text-title font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-small text-muted">{text}</p>
    </div>
  );
}

export function InputShowcase() {
  return (
    <section aria-labelledby="input-title" className="px-5 sm:px-8 lg:px-12">
      <div className="max-w-2xl">
        <SectionTitle thin="Move by" bold="typing, tapping or talking" id="input-title" />
        <p className="mt-4 text-body text-fg">Use whatever keeps your eyes off the board. Every move is announced, and can be read aloud.</p>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3">
        <DemoCard title="Type it" text="SAN, coordinates or plain words: e4, g1f3, knight takes c6. Suggestions appear as you type.">
          <div className="w-full max-w-[15rem]" aria-hidden="true">
            <div className="glass-well flex h-12 items-center gap-2 rounded-full px-4 text-lg font-semibold text-ink">
              <span className="text-muted">›</span>
              <span className={"demo-typed"}>
                <span>N</span>
                <span>f</span>
                <span>3</span>
              </span>
              <span className={cn("-ml-1 h-5 w-px bg-ink", "demo-caret")} />
            </div>
            <div className="relative mt-3 h-8">
              <div className={cn("absolute inset-0 flex gap-1.5", "demo-chips")}>
                <span className="pill-secondary rounded-full px-3 py-1 text-small font-semibold">Nf3</span>
                <span className="glass-well rounded-full px-3 py-1 text-small font-semibold text-muted">Nc3</span>
              </div>
              <div className={cn("absolute inset-0 flex items-center gap-2 text-small font-semibold text-good", "demo-played")}>
                <IconCheck size={16} strokeWidth={2.2} /> Knight to f3
              </div>
            </div>
          </div>
        </DemoCard>
        <DemoCard title="Tap or drag" text="Click two squares, even on a hidden board, or drag a piece when you can see it.">
          <div className="w-36" aria-hidden="true">
            <MiniBoard size={3} pieces={[{ at: [2, 0], p: "wN", className: "demo-tap-knight" }]}>
              <span className={cn("pointer-events-none absolute left-[3%] top-[69%] h-[28%] w-[28%] rounded-full border-2 border-ink", "demo-tap-from")} />
              <span className={cn("pointer-events-none absolute left-[36%] top-[3%] h-[28%] w-[28%] rounded-full border-2 border-ink", "demo-tap-to")} />
            </MiniBoard>
          </div>
        </DemoCard>
        <DemoCard title="Say it" text="“Knight f three.” Spoken moves work in Chrome, Edge and Safari, and the engine answers out loud.">
          <div className="flex w-full max-w-[15rem] flex-col items-center gap-4" aria-hidden="true">
            <div className="flex items-center gap-3">
              <span className="pill-primary flex h-11 w-11 items-center justify-center rounded-full">
                <IconMic size={20} />
              </span>
              <span className={cn("flex h-8 items-center gap-[3px]", "demo-wave")}>
                {[0.5, 0.9, 0.6, 1, 0.7, 0.4, 0.8, 0.55, 0.95, 0.5].map((h, i) => (
                  <span key={i} className="w-[3px] rounded-full bg-ink" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.08}s` }} />
                ))}
              </span>
            </div>
            <div className="flex items-center gap-2 text-small">
              <span className={cn("text-muted", "demo-heard")}>“knight f three”</span>
              <span className={cn("pill-secondary rounded-full px-3 py-1 font-semibold", "demo-heard-move")}>Nf3</span>
            </div>
          </div>
        </DemoCard>
      </div>
    </section>
  );
}

export function TrainShowcase() {
  return (
    <section aria-labelledby="train-title" className="px-5 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <SectionTitle thin="Six drills for" bold="the mind's eye" id="train-title" />
          <p className="mt-4 text-body text-fg">Short sessions that build the skills blindfold chess is made of. One tap starts a drill.</p>
        </div>
        <LinkButton href="/train">All drills</LinkButton>
      </div>
      <ul className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {DRILLS.map((d) => (
          <li key={d.id}>
            <Link
              href={`/train/${d.id}?go=1`}
              className="group glass-panel flex h-full items-center gap-5 rounded-panel p-4 outline-none transition-transform duration-300 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:p-5"
            >
              <div className="flex h-24 w-28 shrink-0 items-center justify-center">
                <DrillVisual id={d.id} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink">{d.title}</h3>
                <p className="mt-1 line-clamp-3 text-small text-muted">{d.tagline}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A tiny rating line and an activity calendar, drawn from sample numbers. */
export function ProgressShowcase() {
  const pts = [1180, 1195, 1188, 1214, 1236, 1229, 1258, 1281, 1270, 1302, 1335, 1361];
  const w = 320;
  const h = 120;
  const lo = 1150;
  const hi = 1380;
  const x = (i: number) => 8 + (i / (pts.length - 1)) * (w - 16);
  const y = (v: number) => h - 10 - ((v - lo) / (hi - lo)) * (h - 20);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const days = Array.from({ length: 7 * 18 }, (_, i) => {
    const v = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const n = Math.abs(v);
    return i > 7 * 18 - 10 ? Math.min(4, Math.round(n * 5)) : n > 0.55 ? Math.round(n * 4) : 0;
  });
  return (
    <section aria-labelledby="progress-title" className="px-5 sm:px-8 lg:px-12">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="max-w-xl">
          <SectionTitle thin="Watch your" bold="vision sharpen" id="progress-title" />
          <p className="mt-4 text-body text-fg">
            Ratings for games, puzzles and every drill, a streak calendar, and a replay of each game with engine analysis. It all stays on this device, and you
            can export it any time.
          </p>
          <div className="mt-7">
            <LinkButton href="/stats">See your stats</LinkButton>
          </div>
        </div>
        <div className="glass-panel grid grid-cols-1 gap-6 rounded-panel p-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:p-6" aria-hidden="true">
          <div>
            <p className="text-small text-muted">Blindfold rating</p>
            <p className="mt-1 font-display text-[2.25rem] font-bold leading-none tabular text-ink">1361</p>
            <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full">
              <path d={`${d} L ${x(pts.length - 1)} ${h} L ${x(0)} ${h} Z`} fill="var(--ink)" opacity="0.06" />
              <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1]!)} r="4.5" fill="var(--ink)" stroke="var(--surface)" strokeWidth="2" />
            </svg>
          </div>
          <div>
            <p className="text-small text-muted">Last 18 weeks</p>
            <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]">
              {days.map((n, i) => (
                <span key={i} className="aspect-square rounded-[3px]" style={{ background: n ? `color-mix(in oklab, var(--ink) ${18 + n * 18}%, transparent)` : "var(--sunken)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="px-5 text-center sm:px-8 lg:px-12">
      <DisplayTitle as="h2" thin="Ready when" bold="you are" size="lg" id="closing-title" />
      <Rule className="mx-auto mt-5" />
      <p className="mx-auto mt-5 max-w-md text-body text-fg">Free and open source. No account and no tracking. Stockfish runs right in your browser.</p>
      <div className="mt-8 flex justify-center">
        <LinkButton href="/play?new=1" variant="primary" size="lg" transitionTypes={["enter-game"]}>
          Play now
        </LinkButton>
      </div>
    </section>
  );
}
