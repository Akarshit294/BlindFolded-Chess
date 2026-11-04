"use client";
import { motion } from "motion/react";
import { ASSET_CREDITS, SOFTWARE_CREDITS, type Credit } from "@/data/credits";

function List({ items }: { items: Credit[] }) {
  return (
    <motion.ul
      className="divide-y divide-ivory-100/[0.06] overflow-hidden rounded-2xl ring-1 ring-inset ring-ivory-100/[0.07]"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
    >
      {items.map((c) => (
        <motion.li
          key={c.name}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
          className="grid gap-1 bg-night-850/50 px-4 py-3 sm:grid-cols-[1.1fr_2fr_auto] sm:items-center sm:gap-4"
        >
          <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-medium text-ivory-50 underline-offset-4 hover:text-ember-200 hover:underline">
            {c.name}
          </a>
          <span className="text-sm text-ivory-400">
            {c.what}
            {c.author ? <span className="text-ivory-500"> — {c.author}</span> : null}
          </span>
          <span className="w-fit rounded-full bg-ivory-100/[0.05] px-2.5 py-0.5 font-mono text-[11px] text-ivory-300 ring-1 ring-inset ring-ivory-100/10">{c.license}</span>
        </motion.li>
      ))}
    </motion.ul>
  );
}

export function CreditsList() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-8 sm:px-6">
      <h1 className="text-4xl font-semibold text-ivory-50 sm:text-5xl">Credits</h1>
      <p className="mt-3 max-w-2xl text-ivory-300">
        Blindfold is free software under the <a className="text-ember-200 underline-offset-4 hover:underline" href="https://www.gnu.org/licenses/gpl-3.0.html">GNU GPL v3</a> (because it
        ships Stockfish). It stands on the shoulders of these projects. The original “Lumen” piece set, the icons, the sounds (synthesised live) and the design
        were made for this project.
      </p>
      <h2 className="mb-3 mt-10 text-xl font-semibold text-ivory-50">Engine, data and assets</h2>
      <List items={ASSET_CREDITS} />
      <h2 className="mb-3 mt-10 text-xl font-semibold text-ivory-50">Software</h2>
      <List items={SOFTWARE_CREDITS} />
      <p className="mt-8 text-sm text-ivory-500">
        Not affiliated with lichess.org, chess.com or the Stockfish project. The full list, with versions, is in CREDITS.md in the source repository.
      </p>
    </div>
  );
}
