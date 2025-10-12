'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
    >
      Print
    </button>
  );
}
