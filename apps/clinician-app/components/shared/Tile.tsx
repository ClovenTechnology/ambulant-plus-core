"use client";
export function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3 bg-white min-h-[64px]">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
