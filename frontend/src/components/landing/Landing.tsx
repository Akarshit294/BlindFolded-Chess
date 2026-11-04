"use client";
import { motion, type Variants } from "motion/react";
import Link from "next/link";
import type { ComponentType } from "react";
import { Fog } from "@/components/board/Fog";
import { ModePreview, VISIBILITY_MODES } from "@/components/game/GameSetup";
import { LinkButton } from "@/components/ui/Button";
import { IconArrowRight, IconBrain, IconChart, IconKeyboard, IconKnight, IconMic, IconPuzzle, IconTarget } from "@/components/ui/Icons";
import { HeroBoard } from "./HeroBoard";

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const FEATURES: Array<{ href: string; title: string; text: string; icon: ComponentType<{ size?: number }> }> = [
  { href: "/play", title: "Play Stockfish, blindfolded", text: "Ten levels from a sleepy Ember to full-strength Supernova. Type, click or speak your moves.", icon: IconKnight },
  { href: "/train", title: "Visualisation drills", text: "Square colours, coordinates, knight routes, diagonals, memory and following games in your head.", icon: IconTarget },
  { href: "/puzzles", title: "Puzzles in words", text: "Thousands of real puzzles, described only as text. Find the mate without ever seeing the board.", icon: IconPuzzle },
  { href: "/stats", title: "See yourself improve", text: "Ratings, streaks, accuracy and a game-by-game review — stored privately in your browser.", icon: IconChart },
];

const STEPS = [
  { n: "01", title: "Choose how much you see", text: "Start with the full board, then let pieces fade, turn into silhouettes, or disappear completely.", icon: IconBrain },
  { n: "02", title: "Move the way you like", text: "Type SAN like Nf3, click squares on a hidden board, or just say “knight f three”.", icon: IconMic },
  { n: "03", title: "Review with an engine", text: "Every game ends with a cinematic reveal, an accuracy score and an animated replay.", icon: IconKeyboard },
];

export function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-60">
          <Fog density={0.55} />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={rise} className="inline-flex items-center gap-2 rounded-full bg-ivory-100/[0.05] px-3 py-1 text-xs font-medium text-ivory-300 ring-1 ring-inset ring-ivory-100/10">
              <span className="h-1.5 w-1.5 rounded-full bg-jade-400" /> Free · open source · no sign-up
            </motion.div>
            <motion.h1 variants={rise} className="mt-6 text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-ivory-50 sm:text-6xl lg:text-7xl">
              <span className="block">Close your eyes.</span>
              <span className="block text-balance">
                <span className="italic text-ember-300">The board</span> is still there.
              </span>
            </motion.h1>
            <motion.p variants={rise} className="mt-6 max-w-xl text-lg leading-relaxed text-ivory-300">
              Blindfold is a trainer for playing chess without seeing the board. Build the mental picture step by step — and watch your calculation in normal games get sharper too.
            </motion.p>
            <motion.div variants={rise} className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/play" variant="primary" size="lg" icon={<IconKnight size={19} />}>
                Play blindfolded
              </LinkButton>
              <LinkButton href="/train" size="lg" icon={<IconTarget size={19} />}>
                Start training
              </LinkButton>
            </motion.div>
            <motion.dl variants={rise} className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
              {[
                ["10", "engine levels"],
                ["4,000", "puzzles"],
                ["6", "drills"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-2xl font-semibold text-ivory-50">{v}</dd>
                  <dd className="text-ivory-500">{l}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>
          <HeroBoard />
        </div>
      </section>

      {/* ---------------------------------------------------------- modes */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <motion.h2 variants={rise} className="text-3xl font-semibold text-ivory-50 sm:text-4xl">
            Five ways to take the board away
          </motion.h2>
          <motion.p variants={rise} className="mt-3 max-w-2xl text-ivory-300">
            Blindfold skill grows in layers. Move down the ladder as the picture in your head gets steadier.
          </motion.p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {VISIBILITY_MODES.map((m, i) => (
              <motion.div key={m.id} variants={rise} className="surface rounded-2xl p-3">
                <ModePreview mode={m.id} active />
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-mono text-xs text-ember-300">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-semibold text-ivory-50">{m.name}</span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-ivory-400">{m.blurb}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <motion.ul className="grid gap-4 md:grid-cols-2" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.li key={f.href} variants={rise}>
                <Link href={f.href} className="group surface flex h-full gap-5 rounded-3xl p-6 outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-moon-300">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-night-600 to-night-800 text-ember-200 ring-1 ring-inset ring-ivory-100/10 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
                    <Icon size={24} />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-xl font-semibold text-ivory-50">
                      {f.title}
                      <IconArrowRight size={16} className="text-ember-300 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
                    </span>
                    <span className="mt-1.5 block leading-relaxed text-ivory-400">{f.text}</span>
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      </section>

      {/* ---------------------------------------------------------- how */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <motion.div key={s.n} variants={rise} className="relative">
              <div className="font-display text-6xl font-semibold text-ivory-100/10">{s.n}</div>
              <h3 className="-mt-6 text-xl font-semibold text-ivory-50">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ivory-400">{s.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------------------------------------------------------- history teaser */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <motion.figure
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="surface relative overflow-hidden rounded-[32px] p-8 sm:p-12"
        >
          <div aria-hidden="true" className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(245,176,78,0.25),transparent)]" />
          <blockquote className="relative max-w-3xl font-display text-2xl leading-snug text-ivory-50 sm:text-3xl">
            In 1858, at the Café de la Régence in Paris, Paul Morphy played eight opponents at once without seeing a single board — and won six of the games.
          </blockquote>
          <figcaption className="relative mt-6 flex flex-wrap items-center gap-4 text-ivory-400">
            Blindfold chess is older than you think.
            <Link href="/learn#history" className="inline-flex items-center gap-1 font-medium text-ember-300 hover:text-ember-200">
              Read the short history <IconArrowRight size={15} />
            </Link>
          </figcaption>
        </motion.figure>
      </section>

      {/* ---------------------------------------------------------- final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 text-center sm:px-6">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <h2 className="text-balance text-4xl font-semibold text-ivory-50 sm:text-5xl">Ready to play in the dark?</h2>
          <p className="mx-auto mt-3 max-w-xl text-ivory-300">Start with a ghost board against a gentle opponent. Nobody&apos;s watching.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/play" variant="primary" size="lg" icon={<IconKnight size={19} />}>
              Play now
            </LinkButton>
            <LinkButton href="/learn" variant="ghost" size="lg">
              How to get started
            </LinkButton>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
