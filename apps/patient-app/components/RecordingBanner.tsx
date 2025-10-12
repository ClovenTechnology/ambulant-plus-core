'use client';

export default function RecordingBanner({
  active,
  onDismiss,
}: {
  active: boolean;
  onDismiss: () => void;
}) {
  if (!active) return null;
  return (
    <div className="sticky top-[60px] z-40 mx-4 my-2 rounded border bg-red-50 text-red-900 px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-red-600">●</span>
        <span className="text-sm font-medium">Recording in progress</span>
      </div>
      <button className="text-xs px-2 py-0.5 border rounded" onClick={onDismiss} title="Dismiss">
        Dismiss
      </button>
    </div>
  );
}
