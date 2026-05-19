// components/TelevisitCountdown.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  startAtISO: string; // appointment start (server time)
  endAtISO: string; // appointment end (server time)
  nowISO?: string; // optional server "now" for first render
  size?: "sm" | "md" | "lg";
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseTime(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function TelevisitCountdown({ startAtISO, endAtISO, nowISO, size = "md" }: Props) {
  const fallbackNow = Date.now();
  const startAt = useMemo(() => parseTime(startAtISO, fallbackNow), [fallbackNow, startAtISO]);
  const endAt = useMemo(() => {
    const fallbackEnd = startAt + 30 * 60_000;
    const parsed = parseTime(endAtISO, fallbackEnd);
    return parsed > startAt ? parsed : fallbackEnd;
  }, [endAtISO, startAt]);

  // Establish an offset so the first tick aligns with server "now"
  const serverNow = parseTime(nowISO, Date.now());
  const offsetRef = useRef(serverNow - Date.now());

  const [now, setNow] = useState<number>(Date.now() + offsetRef.current);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offsetRef.current), 250);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(endAt - startAt, 1);
  const elapsed = now - startAt;
  const pct = Math.min(Math.max(elapsed / total, 0), 1); // 0..1 during session

  const beforeStart = now < startAt;
  const afterEnd = now > endAt;

  const remainingMs = beforeStart ? startAt - now : Math.max(endAt - now, 0);

  const fmt = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh > 0 ? `${hh}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}` : `${mm}:${String(ss).padStart(2,"0")}`;
  };

  const bandClass = cx(
    // progress colour bands
    pct < 0.5 && "from-emerald-500 to-emerald-400",
    pct >= 0.5 && pct < 0.8 && "from-amber-500 to-amber-400",
    pct >= 0.8 && "from-rose-600 to-rose-500"
  );

  const thickness = size === "lg" ? "h-3" : size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className="w-full max-w-xl">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Session</span>
        <span className="text-sm font-medium tabular-nums">
          {beforeStart ? `Starts in ${fmt(remainingMs)}` : afterEnd ? `Overtime +${fmt(now - endAt)}` : `Time left ${fmt(remainingMs)}`}
        </span>
      </div>

      {/* progress track */}
      <div className={cx("w-full rounded-full bg-zinc-800/60 ring-1 ring-zinc-700/60 overflow-hidden backdrop-blur", thickness)}>
        {/* progress fill */}
        <div
          className={cx("h-full bg-gradient-to-r transition-[width] duration-250 ease-linear", bandClass)}
          style={{ width: `${afterEnd ? 100 : Math.max(0, Math.min(100, pct * 100))}%` }}
        />
      </div>

      {/* ticks + labels */}
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        <span>{new Date(startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>{new Date(endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}
