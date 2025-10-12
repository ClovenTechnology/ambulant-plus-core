'use client';
import React from 'react';

type ToastMsg = { id: number; text: string };

export function toast(text: string) {
  // fire a window event any component can listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { text } }));
  }
}

export function ToastHost() {
  const [items, setItems] = React.useState<ToastMsg[]>([]);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text: string };
      setItems((prev) => {
        const id = Date.now();
        // auto remove after 2.5s
        setTimeout(() => {
          setItems((p) => p.filter((m) => m.id !== id));
        }, 2500);
        return [...prev, { id, text: detail.text }];
      });
    };
    window.addEventListener('app:toast', handler as EventListener);
    return () => window.removeEventListener('app:toast', handler as EventListener);
  }, []);

  return (
    <div className="fixed z-50 bottom-4 right-4 space-y-2">
      {items.map((m) => (
        <div
          key={m.id}
          className="px-3 py-2 rounded-lg border bg-white shadow text-sm"
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
