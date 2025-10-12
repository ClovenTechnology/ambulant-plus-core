'use client';

import { useState } from 'react';

export default function XRToggle({ onChange }: { onChange?: (enabled: boolean) => void }) {
  const [on, setOn] = useState(false);
  return (
    <button
      onClick={() => { const nx = !on; setOn(nx); onChange?.(nx); }}
      className={`px-2 py-1 rounded text-xs border ${on ? 'bg-indigo-600 text-white' : 'bg-white'}`}
      title="Enter XR Consult"
    >
      {on ? 'XR: On' : 'XR: Off'}
    </button>
  );
}
