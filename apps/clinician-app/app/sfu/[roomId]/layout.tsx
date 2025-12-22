// apps/clinician-app/app/sfu/[roomId]/layout.tsx
'use client';

import type { ReactNode } from 'react';
import * as SFUModule from '@/src/sfu/useSFU';

export default function SFURoomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { roomId: string };
}) {
  const Provider =
    (SFUModule as any).SFUClientProvider ?? (SFUModule as any).default;

  if (!Provider) {
    throw new Error(
      'SFUClientProvider export not found in src/sfu/useSFU.ts (check default vs named export).'
    );
  }

  return <Provider roomId={params.roomId}>{children}</Provider>;
}
