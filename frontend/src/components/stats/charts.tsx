"use client";
/**
 * Small, dependency-free SVG charts following the project's dataviz rules:
 * thin marks (2px lines, ≥8px end dots with a 2px surface ring), solid hairline grids,
 * a legend for ≥2 series plus selective direct labels, a crosshair tooltip that lists every
 * series, keyboard access, and a table view for every chart.
 *
 * Series colours (validated for the dark surface): moon-500, ember-600, jade-600.
 */
import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { niceTicks, valueAt, type Point } from "@/lib/stats/aggregate";
import { cn } from "@/lib/utils/cn";

export const SERIES_COLORS = ["#7a85df", "#c4731b", "#1f8f67"] as const;
const SURFACE = "#12161f";
const GRID = "#232a3a";
const AXIS = "#343c52";
const MUTED = "#7d786e";

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const dateFmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function TableToggle({ showTable, onToggle }: { showTable: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showTable}
      className="rounded-lg px-2 py-1 text-xs font-medium text-ivory-400 outline-none ring-1 ring-inset ring-ivory-100/10 hover:text-ivory-100 focus-visible:ring-2 focus-visible:ring-moon-300"
    >
      {showTable ? "Chart" : "Table"}
    </button>
  );
}

/* ------------------------------------------------------------------ line chart */
export type Series = { id: string; label: string; color: string; points: Point[] };

export function LineChart({
  series,
  height = 220,
  yFormat = (v: number) => String(Math.round(v)),
  title,
  yDomain,
}: {
  series: Series[];
  height?: number;
  yFormat?: (v: number) => string;
  title: string;
  yDomain?: [number, number];
}) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const clipId = useId();
  const live = series.filter((s) => s.points.length > 0);
  const allPts = live.flatMap((s) => s.points);
  const times = useMemo(() => [...new Set(allPts.map((p) => p.t))].sort((a, b) => a - b), [allPts]);

  const pad = { l: 44, r: live.length === 1 ? 52 : live.length <= 4 ? 100 : 16, t: 12, b: 28 };
  const plotW = Math.max(10, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const tMin = Math.min(...allPts.map((p) => p.t));
  const tMax = Math.max(...allPts.map((p) => p.t));
  const vMin = yDomain ? yDomain[0] : Math.min(...allPts.map((p) => p.v));
  const vMax = yDomain ? yDomain[1] : Math.max(...allPts.map((p) => p.v));
  const ticks = yDomain ? niceTicks(yDomain[0], yDomain[1], 4) : niceTicks(vMin, vMax, 4);
  const y0 = ticks[0] ?? vMin;
  const y1 = ticks[ticks.length - 1] ?? vMax;
  const x = (t: number) => pad.l + (tMax === tMin ? plotW / 2 : ((t - tMin) / (tMax - tMin)) * plotW);
  const y = (v: number) => pad.t + plotH - ((v - y0) / Math.max(1e-9, y1 - y0)) * plotH;

  const xTicks = useMemo(() => {
    if (times.length === 0) return [];
    const n = Math.min(4, times.length);
    return Array.from({ length: n }, (_, i) => tMin + ((tMax - tMin) * i) / Math.max(1, n - 1));
  }, [times, tMin, tMax]);

  // Direct end labels only when they don't collide.
  const ends = live.map((s) => ({ s, p: s.points[s.points.length - 1]! }));
  const endYs = ends.map((e) => y(e.p.v)).sort((a, b) => a - b);
  const labelsFit = live.length <= 4 && endYs.every((v, i) => i === 0 || v - endYs[i - 1]! >= 16);

  const snap = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    let best = times[0] ?? null;
    let bestD = Infinity;
    for (const t of times) {
      const d = Math.abs(x(t) - px);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    setHoverT(best);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!times.length) return;
    const idx = hoverT === null ? times.length - 1 : times.indexOf(hoverT);
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHoverT(times[Math.max(0, idx - 1)]!);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setHoverT(times[Math.min(times.length - 1, idx + 1)]!);
    } else if (e.key === "Escape") setHoverT(null);
  };

  const legend =
    live.length >= 2 ? (
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ivory-300" aria-label="Legend">
        {live.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
    ) : (
      <span />
    );

  if (live.length === 0) return <EmptyChart text="No data yet." />;

  const tooltipItems = hoverT === null ? [] : live.map((s) => ({ s, v: valueAt(s.points, hoverT) }));
  const tipLeft = hoverT === null ? 0 : x(hoverT);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        {legend}
        <TableToggle showTable={showTable} onToggle={() => setShowTable((v) => !v)} />
      </div>
      {showTable ? (
        <DataTable
          caption={title}
          columns={["Date", ...live.map((s) => s.label)]}
          rows={times.map((t) => [dateFmt(t), ...live.map((s) => (s.points.some((p) => p.t === t) ? yFormat(valueAt(s.points, t)!) : "—"))])}
        />
      ) : (
        <div
          ref={wrap}
          className="relative outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-moon-300"
          tabIndex={0}
          role="img"
          aria-label={`${title}. Use the left and right arrow keys to read values, or switch to the table view.`}
          onKeyDown={onKey}
          onBlur={() => setHoverT(null)}
        >
          {width > 0 ? (
            <svg
              width={width}
              height={height}
              className="block touch-pan-y"
              onPointerMove={(e) => snap(e.clientX, e.currentTarget)}
              onPointerLeave={() => setHoverT(null)}
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x={pad.l - 6} y={0} width={plotW + 12} height={height} />
                </clipPath>
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={pad.l + plotW} y1={y(t)} y2={y(t)} stroke={t === y0 ? AXIS : GRID} strokeWidth={1} shapeRendering="crispEdges" />
                  <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {yFormat(t)}
                  </text>
                </g>
              ))}
              {xTicks.map((t, i) => (
                <text key={i} x={x(t)} y={height - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} fontSize={11} fill={MUTED}>
                  {dateFmt(t)}
                </text>
              ))}
              <g clipPath={`url(#${clipId})`}>
                {live.map((s) => {
                  const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
                  return (
                    <motion.path
                      key={s.id}
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  );
                })}
              </g>
              {ends.map(({ s, p }) => (
                <circle key={s.id} cx={x(p.t)} cy={y(p.v)} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
              ))}
              {labelsFit
                ? ends.map(({ s, p }) => (
                    <text key={s.id} x={x(p.t) + 10} y={y(p.v)} dy="0.32em" fontSize={12} fill="#e2dccf">
                      <tspan fontWeight={600}>{yFormat(p.v)}</tspan>
                      {live.length > 1 ? <tspan fill={MUTED}> {s.label}</tspan> : null}
                    </text>
                  ))
                : null}
              {hoverT !== null ? (
                <g pointerEvents="none">
                  <line x1={x(hoverT)} x2={x(hoverT)} y1={pad.t} y2={pad.t + plotH} stroke="#6c7894" strokeWidth={1} />
                  {tooltipItems.map(({ s, v }) => (v === null ? null : <circle key={s.id} cx={x(hoverT)} cy={y(v)} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />))}
                </g>
              ) : null}
            </svg>
          ) : (
            <div style={{ height }} />
          )}
          {hoverT !== null ? (
            <div
              className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl bg-night-950/95 px-3 py-2 text-xs shadow-xl ring-1 ring-ivory-100/10"
              style={{ left: Math.min(Math.max(0, tipLeft + 12), Math.max(0, width - 160)) }}
              role="status"
            >
              <div className="mb-1 text-ivory-500">{dateFmt(hoverT)}</div>
              {tooltipItems.map(({ s, v }) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <span className="font-semibold text-ivory-50">{v === null ? "—" : yFormat(v)}</span>
                  <span className="text-ivory-400">{s.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ sparkline */
export function Sparkline({ points, width = 96, height = 28, label }: { points: Point[]; width?: number; height?: number; label: string }) {
  if (points.length < 2) return <span className="text-xs text-ivory-500">—</span>;
  const pts = points.slice(-12);
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (width - 8);
  const y = (v: number) => 4 + (height - 8) * (1 - (v - lo) / Math.max(1e-9, hi - lo));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <path d={d} fill="none" stroke="#7d786e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(last.v)} r={4} fill="#c4731b" stroke={SURFACE} strokeWidth={2} />
    </svg>
  );
}

/* ------------------------------------------------------------------ heatmap */
const HEAT = ["#1d2331", "#5a3a1a", "#92541a", "#c4731b", "#e8932b"];

function heatIndex(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  return Math.min(4, 1 + Math.floor(((count - 1) / Math.max(1, max - 1)) * 3.999));
}

export function Heatmap({ days, title }: { days: Array<{ day: number; count: number }>; title: string }) {
  const [hover, setHover] = useState<{ day: number; count: number } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(0, ...days.map((d) => d.count));
  const weeks: Array<Array<{ day: number; count: number }>> = [];
  days.forEach((d, i) => {
    const w = Math.floor(i / 7);
    (weeks[w] ??= []).push(d);
  });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-ivory-500" aria-label="Colour scale: fewer to more activities">
          Less
          {HEAT.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
          ))}
          More
        </div>
        <TableToggle showTable={showTable} onToggle={() => setShowTable((v) => !v)} />
      </div>
      {showTable ? (
        <DataTable
          caption={title}
          columns={["Week of", "Activities"]}
          rows={weeks.map((w) => [dateFmt(w[0]!.day), String(w.reduce((a, b) => a + b.count, 0))])}
        />
      ) : (
        <div className="relative" role="img" aria-label={`${title}: ${days.reduce((a, b) => a + b.count, 0)} activities over ${weeks.length} weeks`}>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {w.map((d) => (
                  <motion.div
                    key={d.day}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: wi * 0.015, duration: 0.25 }}
                    onPointerEnter={() => setHover(d)}
                    onPointerLeave={() => setHover(null)}
                    className={cn("h-3.5 w-3.5 rounded-[3px] sm:h-4 sm:w-4", hover?.day === d.day && "ring-1 ring-ivory-50")}
                    style={{ background: HEAT[heatIndex(d.count, max)] }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 h-4 text-xs text-ivory-400" aria-hidden="true">
            {hover ? (
              <>
                <span className="font-semibold text-ivory-100">{hover.count}</span> {hover.count === 1 ? "activity" : "activities"} on {new Date(hover.day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bars */
export function BarList({ items, title, format }: { items: Array<{ label: string; value: number; detail?: string }>; title: string; format: (v: number) => string }) {
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <TableToggle showTable={showTable} onToggle={() => setShowTable((v) => !v)} />
      </div>
      {showTable ? (
        <DataTable caption={title} columns={["Goal", "Value", "Detail"]} rows={items.map((i) => [i.label, format(i.value), i.detail ?? ""])} />
      ) : (
        <ul className="space-y-3" aria-label={title}>
          {items.map((it, i) => (
            <li key={it.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm" title={`${it.label}: ${format(it.value)}${it.detail ? ` (${it.detail})` : ""}`}>
              <span className="truncate text-ivory-300">{it.label}</span>
              <span className="relative h-2.5 rounded-r bg-night-700/60">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{ background: SERIES_COLORS[0], width: `${(it.value / max) * 100}%`, transformOrigin: "left" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 120, damping: 20 }}
                />
              </span>
              <span className="w-24 text-right text-ivory-100">
                <span className="font-semibold">{format(it.value)}</span>
                {it.detail ? <span className="ml-1 text-xs text-ivory-500">{it.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ table & empty */
export function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-xl ring-1 ring-inset ring-ivory-100/[0.07]">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-night-800 text-xs text-ivory-400">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-ivory-100/[0.05]">
              {r.map((cell, j) => (
                <td key={j} className={cn("px-3 py-1.5 text-ivory-200", j > 0 && "tabular")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyChart({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ivory-100/10 p-6 text-center text-sm text-ivory-400">
      {text}
      {children}
    </div>
  );
}
