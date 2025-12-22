'use client';

import dynamic from 'next/dynamic';

const XRayWorkspace = dynamic(() => import('../page'), { ssr: false });

export default function XRayWorkspaceSFU() {
  return (
    <div className="min-h-0">
      <XRayWorkspace />
    </div>
  );
}
