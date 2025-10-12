// apps/patient-app/components/Logo.tsx
'use client';

import { useState } from 'react';

export default function Logo() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  // Put your logo at: apps/patient-app/public/ambulant-logo.png (optional)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ambulant-logo.png"
      alt="Ambulant+"
      width={24}
      height={24}
      className="h-6 w-auto"
      onError={() => setVisible(false)}
    />
  );
}
