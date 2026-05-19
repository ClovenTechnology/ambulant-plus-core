// apps/patient-app/components/encounters/EncounterModeBadge.tsx
'use client';

import React from 'react';
import { FiHeadphones, FiMapPin, FiMessageCircle, FiVideo } from 'react-icons/fi';
import { normalizeMode, modeLabel } from '@/lib/encounters/display';

function ModeIcon({ mode }: { mode?: string | null }) {
  switch (normalizeMode(mode)) {
    case 'video':
      return <FiVideo className="h-3.5 w-3.5" />;
    case 'chat':
      return <FiMessageCircle className="h-3.5 w-3.5" />;
    case 'audio':
      return <FiHeadphones className="h-3.5 w-3.5" />;
    case 'in_person':
      return <FiMapPin className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

export default function EncounterModeBadge({
  mode,
  className = '',
}: {
  mode?: string | null;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/10',
        className,
      ].join(' ')}
    >
      <ModeIcon mode={mode} />
      <span>{modeLabel(mode)}</span>
    </span>
  );
}