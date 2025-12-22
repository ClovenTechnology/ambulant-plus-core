'use client';

import dynamic from 'next/dynamic';

const OptometryWorkspace = dynamic(() => import('../page'), { ssr: false });

export default function OptometryWorkspaceSFU() {
  return (
    <div className="min-h-0">
      <OptometryWorkspace />
    </div>
  );
}
