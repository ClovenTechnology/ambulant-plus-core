//SeverityBar.tsx
'use client';

type Severity = 'low' | 'moderate' | 'high' | 'critical';

const map: Record<Severity, string> = {
  low: 'bg-sky-400',
  moderate: 'bg-yellow-400',
  high: 'bg-amber-500',
  critical: 'bg-red-600',
};

export function SeverityBar({ severity }: { severity: Severity }) {
  return (
    <div className="w-full h-1.5 rounded bg-gray-100 overflow-hidden">
      <div className={`h-full ${map[severity]} transition-all`} />
    </div>
  );
}
