"use client";
export function TextBlock({
  label, value, onChange, multiline,
}: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500">{label}</div>
      {multiline ? (
        <textarea
          className="w-full border rounded px-2 py-1 text-sm"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
