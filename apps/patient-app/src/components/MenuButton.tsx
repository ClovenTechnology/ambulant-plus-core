// apps/patient-app/src/components/MenuButton.tsx
"use client";

export default function MenuButton() {
  const onClick = () => {
    window.dispatchEvent(new Event("sidebar-toggle"));
  };

  return (
    <button
      aria-label="Open menu"
      onClick={onClick}
      className="inline-flex items-center justify-center p-2 rounded hover:bg-gray-100 focus:outline-none"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
