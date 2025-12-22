import React from 'react';

type Entry = { date: string; score: number; note?: string };

type TimelineHistoryProps = {
  entries?: Entry[];      // old name used in some places
  history?: Entry[];      // alternative name used elsewhere
  open?: boolean;
  onToggle?: () => void;
};

export default function TimelineHistory({ entries, history, open, onToggle }: TimelineHistoryProps) {
  const items: Entry[] = Array.isArray(entries) ? entries : Array.isArray(history) ? history : [];

  if (!items || items.length === 0) {
    return (
      <div className="mt-6 p-3 rounded-lg bg-white/5 text-cyan-200 text-sm">
        <div className="flex items-center justify-between">
          <div>No history available</div>
          {typeof onToggle === 'function' && (
            <button onClick={onToggle} className="text-xs text-cyan-200/70 underline ml-2">
              {open ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <div className="flex gap-4 p-2">
        {items.map((e, idx) => (
          <div
            key={idx}
            className="min-w-[120px] bg-white/20 backdrop-blur-md p-3 rounded-xl text-center shadow-md animate-fadeIn"
            role="group"
            aria-label={`history-item-${idx}`}
          >
            <span className="text-xs block text-cyan-200/80">{e.date}</span>
            <div className="text-lg font-bold mt-1 text-cyan-100">{e.score}</div>
            {e.note && <div className="text-xs text-cyan-200/70 mt-1">{e.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
