import { CheckCircle2 } from 'lucide-react';
import type { FamilyMember } from './types';

export default function FamilyPendingPanel({ member }: { member: FamilyMember }) {
  return (
    <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Waiting for them to accept
      </div>
      <p className="mt-2 text-xs leading-6 text-amber-900">
        You&apos;ve shared an invitation with {member.name}. Once they accept, you&apos;ll be able to book appointments, join Televisit sessions and manage reminders on their behalf from this console.
      </p>
      <p className="mt-2 text-[11px] leading-5 text-amber-800">
        Pending invites can be resent or cancelled directly from the sidebar.
      </p>
    </div>
  );
}