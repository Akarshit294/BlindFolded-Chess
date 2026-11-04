export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = clamped < 10_000 ? Math.floor(clamped / 100) / 10 : Math.ceil(clamped / 1000);
  if (clamped < 10_000) return totalSeconds.toFixed(1);
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function formatRelativeDay(ts: number, now = Date.now()): string {
  const day = 86_400_000;
  const d0 = new Date(now);
  d0.setHours(0, 0, 0, 0);
  const diff = Math.floor((d0.getTime() - new Date(ts).setHours(0, 0, 0, 0)) / day);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}
