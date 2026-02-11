//RiskGradient.tsx
'use client';

export function RiskGradient({ score }: { score: number }) {
  const color =
    score > 0.8
      ? 'from-red-600 to-red-400'
      : score > 0.6
      ? 'from-amber-500 to-yellow-400'
      : score > 0.4
      ? 'from-yellow-400 to-sky-400'
      : 'from-sky-400 to-emerald-400';

  return (
    <div className={`h-1.5 w-full rounded bg-gradient-to-r ${color}`} />
  );
}
