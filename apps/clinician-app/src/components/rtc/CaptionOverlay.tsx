"use client";

import type { CaptionEvent } from "@ambulant/rtc";

type Props = {
  text?: string;
  lines?: CaptionEvent[];
  enabled?: boolean;
  maxLines?: number;
};

export default function CaptionOverlay({ text = "", lines = [], enabled = true, maxLines = 3 }: Props) {
  const visible = lines.slice(-maxLines);
  if (!enabled) return null;
  if (!text && visible.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-20 z-20 flex flex-col items-center gap-1 sm:bottom-24">
      {visible.length > 0 ? (
        visible.map((line) => (
          <div
            key={[line.speakerIdentity || line.speakerDisplay, line.sequence, line.timestamp].join(":")}
            className="max-w-[94%] rounded-2xl bg-black/75 px-3 py-2 text-center text-xs font-medium leading-snug text-white shadow-lg backdrop-blur sm:text-sm"
          >
            <span className="mr-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/80">
              {line.speakerDisplay || line.speakerName || "Speaker"}
            </span>
            <span>{line.text}</span>
          </div>
        ))
      ) : (
        <div className="inline-block max-w-[90%] rounded bg-black/70 px-2 py-1 text-xs text-white shadow">
          {text}
        </div>
      )}
    </div>
  );
}
