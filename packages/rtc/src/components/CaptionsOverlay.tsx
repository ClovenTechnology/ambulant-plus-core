"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight live captions overlay using the Web Speech API.
 * - Local-only recognition (browser-side). Works in Chrome/Edge (webkitSpeechRecognition).
 * - Renders as an absolutely-positioned bar; parent should be `relative`.
 */
export function CaptionsOverlay({
  lang = "en-GB",
  enabled = true,
  interim = true,
  className = "",
}: {
  lang?: string;
  enabled?: boolean;
  interim?: boolean;
  className?: string;
}) {
  const recRef = useRef<any>(null);
  const [line, setLine] = useState<string>("");

  useEffect(() => {
    if (!enabled) return;
    const SR: any = (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    if (!SR) return;

    const rec = new SR();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = interim;
    rec.lang = lang;

    let stopped = false;

    rec.onresult = (e: any) => {
      // take last alternative
      const res = e.results[e.results.length - 1];
      if (!res) return;
      const txt = res[0]?.transcript || "";
      setLine(txt.trim());
    };
    rec.onerror = () => { /* swallow */ };
    rec.onend = () => {
      if (!stopped) {
        try { rec.start(); } catch {}
      }
    };

    try { rec.start(); } catch {}

    return () => {
      stopped = true;
      try { rec.stop(); } catch {}
    };
  }, [enabled, lang, interim]);

  if (!enabled) return null;

  return (
    <div
      className={[
        "pointer-events-none absolute left-2 right-2 bottom-2",
        "rounded-xl px-3 py-2 text-sm md:text-base",
        "bg-black/60 text-white backdrop-blur-sm",
        "max-w-[95%] mx-auto",
        className,
      ].join(" ")}
      aria-live="polite"
    >
      {line || "…"}
    </div>
  );
}
