"use client";
import React from "react";

export type InsightReply = { summary?: string; goals?: string[]; notes?: string };

export function InsightPanel({
  title = "InsightCore",
  insight,
  busy,
  onAnalyze,
}: {
  title?: string;
  insight: InsightReply | null;
  busy: boolean;
  onAnalyze: () => void;
}) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">{title}</div>
        <button
          className="text-xs px-2 py-1 border rounded"
          onClick={onAnalyze}
          disabled={busy}
          aria-disabled={busy}
          aria-label="Analyze Notes with InsightCore"
        >
          {busy ? "Analyzing…" : "Analyze Notes"}
        </button>
      </div>

      {insight ? (
        <div className="space-y-2 text-sm">
          {insight.summary && <p className="font-medium">{insight.summary}</p>}
          {Array.isArray(insight.goals) && insight.goals.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {insight.goals.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          )}
          {insight.notes && <p className="text-gray-600">{insight.notes}</p>}
          <div className="flex gap-2 pt-1">
            <button className="px-2 py-1 border rounded text-xs">Accept</button>
            <button className="px-2 py-1 border rounded text-xs">Adjust</button>
            <button className="px-2 py-1 border rounded text-xs">Decline</button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">Run analysis to get AI-assisted goals & notes.</div>
      )}
    </div>
  );
}
