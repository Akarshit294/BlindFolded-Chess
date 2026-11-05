"use client";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/Button";
import { DisplayTitle, PageHeader } from "@/components/ui/Display";

const SECTIONS = [
  { id: "why", title: "Why train blindfold?" },
  { id: "skills", title: "How visualisation is built" },
  { id: "tips", title: "Playing without the board" },
  { id: "plan", title: "A four-week plan" },
  { id: "history", title: "A short history" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <motion.section
      id={id}
      className="scroll-mt-24"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <DisplayTitle as="h2" size="md" bold={title} />
      <div className="mt-5 space-y-4 text-[1.0625rem] leading-[1.75] text-fg">{children}</div>
    </motion.section>
  );
}

function DrillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="pill-secondary inline-flex items-center rounded-full px-3 py-0.5 text-small font-semibold text-ink transition-transform hover:-translate-y-px">
      {children}
    </Link>
  );
}

const PLAN = [
  {
    week: "Week 1",
    focus: "The map",
    daily: ["Square colour, levels 1–2 (5 min)", "Coordinates, levels 1–3 (5 min)", "One game, full board → ghost, vs Ember or Candle"],
  },
  {
    week: "Week 2",
    focus: "The lines",
    daily: ["Coordinates level 4 + Diagonals 1–2 (5 min)", "Knight routes 1–2 (5 min)", "Ghost or silhouette game vs Candle/Lantern", "Three mate-in-1 puzzles"],
  },
  {
    week: "Week 3",
    focus: "Following play",
    daily: ["Where's the piece? 1–3 (5 min)", "Memory 1–2 (5 min)", "Empty-board game vs Lantern", "Mate-in-2 puzzles with ≤9 pieces"],
  },
  {
    week: "Week 4",
    focus: "Lights out",
    daily: ["Where's the piece? 3–5", "Knight routes 3–4", "Total blindfold game vs Lantern or Torch (3 peeks)", "Mate-in-2 and mate-in-3 puzzles"],
  },
];

export function LearnGuide() {
  return (
    <div className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pt-10">
      <PageHeader
        thin="See"
        bold="without looking"
        lead="A short guide to blindfold chess: what it trains, how the skill is built, a plan for your first month, and a little of its long history."
      />

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-28 space-y-1 border-l border-line text-small">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 font-semibold text-muted transition-colors hover:border-ink hover:text-ink">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl space-y-16">
          <Section id="why" title="Why train blindfold?">
            <p>
              Every time you calculate a line, you are already playing blindfold: the pieces in your head move while the ones on the board stay still.
              Most missed tactics are not failures of knowledge but of <em>visualisation</em> — a piece you forgot had moved, a diagonal that opened three moves
              deep.
            </p>
            <p>
              Training without the board makes that mental picture sharper and steadier. Players who practise it usually notice they can calculate further and
              trust their lines more in ordinary games. And there is a simple pleasure in it: the first time you finish a game with your eyes closed, it feels
              like a magic trick you taught yourself.
            </p>
          </Section>

          <Section id="skills" title="How visualisation is built">
            <p>Blindfold skill is not one ability but a stack of small ones. Work on them roughly in this order:</p>
            <ol className="list-decimal space-y-3 pl-6 marker:font-semibold marker:text-ink">
              <li>
                <strong className="font-semibold text-ink">Know the map.</strong> Every square has a name and a colour. Strong blindfold players answer “what colour is
                f6?” instantly, from either side of the board. <DrillLink href="/train/square-color">Square colour</DrillLink>{" "}
                <DrillLink href="/train/coordinates">Coordinates</DrillLink>
              </li>
              <li>
                <strong className="font-semibold text-ink">Know the lines.</strong> Bishops, rooks and queens travel on diagonals, ranks and files. If you can list the
                squares between b2 and g7 without looking, long-range pieces stop hiding. <DrillLink href="/train/lines">Diagonals &amp; lines</DrillLink>
              </li>
              <li>
                <strong className="font-semibold text-ink">Know the knight.</strong> The knight is the piece people lose track of most. Practise routes until you
                can see that a knight on b1 needs three moves to reach f7.{" "}
                <DrillLink href="/train/knight-routes">Knight routes</DrillLink>
              </li>
              <li>
                <strong className="font-semibold text-ink">Track changes, not snapshots.</strong> Experienced blindfold players rarely describe a photographic board.
                They remember structure — pawn chains, where the kings live, what is attacked — and update it move by move.{" "}
                <DrillLink href="/train/where-piece">Where&apos;s the piece?</DrillLink>
              </li>
              <li>
                <strong className="font-semibold text-ink">Remember in chunks.</strong> A castled king with its pawns is one idea, not four pieces. Grouping pieces
                into familiar patterns is how masters recall whole positions. <DrillLink href="/train/memory">Memory</DrillLink>
              </li>
            </ol>
          </Section>

          <Section id="tips" title="Playing without the board">
            <ul className="space-y-3">
              {[
                ["Say the move in full.", "“Knight from g1 to f3” — out loud or in your head. The origin square anchors the picture."],
                ["Scan after every move pair.", "Where are both kings? What is attacked? Which pieces haven't moved yet?"],
                ["Be careful around captures.", "Exchanges change the board fastest. Pause and rebuild the area around the capture."],
                ["Take your time.", "With an invisible board, a long think is not a weakness. Turn the clock off at first."],
                ["Peek on purpose.", "When you peek, compare the real board with your mental one and notice exactly what you had wrong."],
                ["Start from what you know.", "Openings you play often are easier to follow; strange positions are harder to hold."],
              ].map(([h, t]) => (
                <li key={h} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-ink">{h}</strong> {t}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Move down the visibility ladder only when the current rung feels comfortable: full board → ghost → silhouette → empty board → total blindfold.
            </p>
          </Section>

          <Section id="plan" title="A four-week plan">
            <p>Fifteen to twenty minutes a day. Consistency matters far more than session length — your streak on the Stats page will keep you honest.</p>
            <div className="not-prose grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLAN.map((w, i) => (
                <motion.div
                  key={w.week}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  className="glass-panel rounded-panel p-5"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-[1.375rem] font-bold uppercase leading-none text-ink">{w.week}</span>
                    <span className="text-small font-semibold text-muted">{w.focus}</span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-[0.9375rem] text-fg">
                    {w.daily.map((d) => (
                      <li key={d} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
            <p>
              After the first month: play one rated blindfold game a week, cut your peeks, and raise the engine level whenever you win twice in a row.
            </p>
          </Section>

          <Section id="history" title="A short history">
            <p>
              Blindfold chess is far older than modern chess. The earliest named player linked to it is Sa&apos;id bin Jubair (665–714), in the Middle East, in
              the era of shatranj, chess&apos;s medieval ancestor. The first recorded blindfold event in Europe took place in Florence in 1266.
            </p>
            <p>
              In the 18th century, François-André Danican Philidor — composer and the strongest player of his day — astonished audiences by playing up to three
              games at once without sight of the boards, a feat his contemporaries thought barely possible. In 1858 Paul Morphy faced eight of the strongest
              players in Paris simultaneously, blindfolded, winning six games and drawing two.
            </p>
            <p>
              The numbers kept climbing. Harry Nelson Pillsbury gave displays against twenty opponents around 1900; Alexander Alekhine played 32 games at once
              in Chicago in the 1930s; George Koltanowski played 34 in Edinburgh in 1937; and Miguel Najdorf faced 45 opponents in São Paulo in 1947, winning
              39. In 1930 the Soviet Union banned blindfold simultaneous displays on health grounds. In this century Marc Lang (46 boards, Germany, 2011) and
              Timur Gareyev (48 boards, 2016) set new marks, and the Amber tournament, held until 2011, regularly matched the world&apos;s elite in blindfold
              games.
            </p>
            <p>
              Scientists have been curious too. Alfred Binet began studying blindfold players in 1893 and concluded that they rely on abstract, organised
              knowledge of the position rather than a photographic image — the same insight behind the drills on this site.
            </p>
            <p className="text-[0.9375rem] text-muted">
              Further reading: Eliot Hearst and John Knott, <em>Blindfold Chess: History, Psychology, Techniques, Champions, World Records, and Important
              Games</em> (McFarland, 2009).
            </p>
          </Section>

          <div className="glass-panel flex flex-col items-start justify-between gap-5 rounded-panel p-6 sm:flex-row sm:items-center">
            <div>
              <div className="font-display text-[1.75rem] font-bold uppercase leading-none text-ink">Ready for day one?</div>
              <div className="mt-2 text-fg">Start with five minutes of square colours, then a ghost-board game.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/train/square-color?go=1" variant="primary">
                Square colours
              </LinkButton>
              <LinkButton href="/play?new=1&mode=ghost">Ghost game</LinkButton>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
