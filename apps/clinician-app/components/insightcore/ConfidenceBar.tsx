//ConfidenceBar.tsx
'use client';

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);

  return (
    <div className="space-y-1">
      <div className="text-[10px] text-gray-500">AI Confidence</div>
      <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-500">{pct}%</div>
    </div>
  );
}
