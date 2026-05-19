import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

export default function FamilyTabTeaser({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  icon,
}: {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/72 bg-white/84 p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        {icon ?? <ClipboardList className="h-4 w-4 text-slate-500" />}
        <div className="text-sm font-medium text-slate-900">{title}</div>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={primaryHref}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        >
          {primaryLabel}
        </Link>
        <Link
          href={secondaryHref}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          {secondaryLabel}
        </Link>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        These links now use canonical subject routing (`subjectPatientId`, `relationshipId`) so downstream pages can enforce context properly.
      </p>
    </div>
  );
}