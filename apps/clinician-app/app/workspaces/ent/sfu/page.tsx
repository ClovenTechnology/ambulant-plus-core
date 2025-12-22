'use client';

import dynamic from 'next/dynamic';

const EntWorkspace = dynamic(() => import('../page'), { ssr: false });

export default function EntWorkspaceSFU() {
  return (
    <div className="min-h-0">
      <EntWorkspace />
    </div>
  );
}
