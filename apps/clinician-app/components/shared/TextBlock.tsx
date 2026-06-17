// components/shared/TextBlock.tsx
"use client";

export function TextBlock({
  label,
  value,
  onChange,
  multiline,
  dictation,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  dictation?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">{label}</div>
        {dictation ? (
          <span className="text-[10px] rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
            Dictation ready
          </span>
        ) : null}
      </div>

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