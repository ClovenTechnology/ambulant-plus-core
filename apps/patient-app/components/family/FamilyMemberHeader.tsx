import { Activity, Calendar, ClipboardList } from 'lucide-react';
import type { FamilyMember } from './types';
import { cn, statusLabel, statusTone } from './utils';

export default function FamilyMemberHeader({ member }: { member: FamilyMember }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Managing care for
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xl font-semibold text-slate-900">{member.name}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
            {member.relationLabel}
          </span>
          <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', statusTone(member.status))}>
            {statusLabel(member.status)}
          </span>
        </div>
        <div className="mt-2 text-sm text-slate-500">
          Actions in this console are scoped to this person using canonical subject routing.
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {member.access.canBook ? (
          <AccessChip icon={<Calendar className="h-3.5 w-3.5" />} label="Book appointments" tone="indigo" />
        ) : null}
        {member.access.canViewHealth ? (
          <AccessChip icon={<ClipboardList className="h-3.5 w-3.5" />} label="View health record" tone="emerald" />
        ) : null}
        {member.access.canJoinTelevisit ? (
          <AccessChip icon={<Activity className="h-3.5 w-3.5" />} label="Join Televisit" tone="sky" />
        ) : null}
      </div>
    </div>
  );
}

function AccessChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'indigo' | 'emerald' | 'sky';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'sky'
        ? 'border-sky-200 bg-sky-50 text-sky-800'
        : 'border-indigo-200 bg-indigo-50 text-indigo-800';

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium', toneClass)}>
      {icon}
      {label}
    </span>
  );
}