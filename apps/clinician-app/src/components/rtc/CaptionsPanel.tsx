"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CaptionEvent } from "@ambulant/rtc";

type LegacyCaption = { ts: number; text: string; mine: boolean };

export default function CaptionsPanel({
  selfLabel,
  peerLabel,
  rows,
}: {
  selfLabel: string;
  peerLabel: string;
  rows?: CaptionEvent[];
}) {
  const [legacyRows, setLegacyRows] = useState<LegacyCaption[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (window as any).__captionAdd = (c: LegacyCaption) => {
      setLegacyRows((existing) => {
        const next = [...existing, c].slice(-500);
        queueMicrotask(() => {
          const el = listRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
        return next;
      });
    };
  }, []);

  const displayRows = useMemo(() => {
    if (rows && rows.length > 0) {
      return rows.map((line) => ({
        key: [line.speakerIdentity || line.speakerDisplay, line.sequence, line.timestamp].join(":"),
        ts: Date.parse(line.timestamp) || Date.now(),
        who: line.speakerDisplay || line.speakerName || peerLabel,
        text: line.text,
        final: line.final,
      }));
    }

    return legacyRows.map((line, index) => ({
      key: `legacy-${line.ts}-${index}`,
      ts: line.ts,
      who: line.mine ? selfLabel : peerLabel,
      text: line.text,
      final: true,
    }));
  }, [legacyRows, peerLabel, rows, selfLabel]);

  return (
    <div className="space-y-2 rounded border p-3">
      <div className="text-sm font-medium">Live transcript</div>
      <div ref={listRef} className="h-44 space-y-2 overflow-auto rounded border bg-white p-2 text-xs">
        {displayRows.length === 0 ? (
          <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-3 text-gray-500">
            No transcript segments have arrived yet.
          </div>
        ) : (
          displayRows.map((row) => (
            <div key={row.key}>
              <span className="opacity-60">{new Date(row.ts).toLocaleTimeString()}</span>
              <span className="mx-1 opacity-40">-</span>
              <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5">{row.who}</span>
              <span className="mx-1 opacity-40">-</span>
              {!row.final ? <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">Partial</span> : null}
              <span>{row.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
