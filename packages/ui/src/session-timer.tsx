"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

export function SessionTimer({
  durationSec = 1800,
  onExpire,
  className = "",
}: {
  durationSec?: number;
  onExpire?: () => void;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      const e = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(Math.min(durationSec, e));
    }, 1000);
    return () => clearInterval(id);
  }, [durationSec]);

  useEffect(() => {
    if (elapsed >= durationSec) onExpire?.();
  }, [elapsed, durationSec, onExpire]);

  const pct = Math.min(100, Math.round((elapsed / durationSec) * 100));
  const color = useMemo(() => {
    if (pct <= 50) return "bg-green-500";
    if (pct <= 80) return "bg-yellow-500";
    return "bg-red-500";
  }, [pct]);

  const remain = durationSec - elapsed;
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");

  return (
    <div className={"w-full " + className}>
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <div>Session Time</div>
        <div className="font-mono">{mm}:{ss}</div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={"h-full " + color} style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}