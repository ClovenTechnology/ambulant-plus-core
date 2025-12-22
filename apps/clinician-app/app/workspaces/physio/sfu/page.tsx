'use client';

import dynamic from 'next/dynamic';

// We intentionally reuse the primary workspace page,
// but render it safely in the SFU (client-only) context.
const PhysioWorkspace = dynamic(() => import('../page'), { ssr: false });

export default function PhysioWorkspaceSFU() {
  return (
    <div className="min-h-0">
      <PhysioWorkspace />
    </div>
  );
}
