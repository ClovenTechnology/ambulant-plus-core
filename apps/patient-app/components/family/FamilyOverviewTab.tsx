import Link from 'next/link';
import { Calendar, CreditCard, HeartPulse } from 'lucide-react';
import type { FamilyMember } from './types';
import { buildScopedHref } from './utils';

export default function FamilyOverviewTab({
  member,
  medicalAidRelationshipId,
  medicalAidPolicyId,
  medicalAidDependentCode,
  setMedicalAidRelationshipId,
  setMedicalAidPolicyId,
  setMedicalAidDependentCode,
  linkingMedicalAid,
  onLinkMedicalAid,
}: {
  member: FamilyMember;
  medicalAidRelationshipId: string;
  medicalAidPolicyId: string;
  medicalAidDependentCode: string;
  setMedicalAidRelationshipId: (v: string) => void;
  setMedicalAidPolicyId: (v: string) => void;
  setMedicalAidDependentCode: (v: string) => void;
  linkingMedicalAid: boolean;
  onLinkMedicalAid: () => void;
}) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <OverviewStatCard
          label="Upcoming appointments"
          value={member.upcomingAppointments ?? 0}
          note={
            <>
              Manage bookings for {member.name} from{' '}
              <Link
                href={buildScopedHref('/appointments', member.patientId, member.relationshipId)}
                className="font-medium text-indigo-600"
              >
                Appointments
              </Link>.
            </>
          }
        />
        <OverviewStatCard
          label="Active cases / encounters"
          value={member.openEncounters ?? 0}
          note={
            <>
              View case notes from{' '}
              <Link
                href={buildScopedHref('/encounters', member.patientId, member.relationshipId)}
                className="font-medium text-indigo-600"
              >
                Encounters
              </Link>.
            </>
          }
        />
        <OverviewStatCard
          label="Open reminders"
          value={member.unreadReminders ?? 0}
          note={
            <>
              Medication and follow-up nudges from{' '}
              <Link
                href={buildScopedHref('/reminders', member.patientId, member.relationshipId)}
                className="font-medium text-indigo-600"
              >
                Reminders
              </Link>.
            </>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ActionCard
          icon={<Calendar className="h-4 w-4 text-indigo-600" />}
          title={`Book for ${member.name}`}
          body="Start a new consultation and choose the best clinician or practice for them."
          primaryHref={buildScopedHref('/appointments/new', member.patientId, member.relationshipId)}
          primaryLabel={`Book for ${member.name}`}
          secondaryHref={buildScopedHref('/appointments', member.patientId, member.relationshipId)}
          secondaryLabel="Manage appointments"
        />
        <ActionCard
          icon={<HeartPulse className="h-4 w-4 text-emerald-600" />}
          title="Join Televisit & support"
          body={`When a virtual visit starts, you'll receive a secure link so you can join alongside ${member.name}, even from another location.`}
          footer="Televisit permissions depend on the relationship and downstream route enforcement."
          secondaryHref={buildScopedHref('/televisit', member.patientId, member.relationshipId)}
          secondaryLabel="Open Televisit"
        />
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <CreditCard className="h-4 w-4 text-slate-500" />
          Link host medical aid for dependant use
        </div>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          This uses the real dependant policy clone/link handler.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Relationship ID"
            value={medicalAidRelationshipId}
            onChange={(e) => setMedicalAidRelationshipId(e.target.value)}
          />
          <input
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Host policy ID"
            value={medicalAidPolicyId}
            onChange={(e) => setMedicalAidPolicyId(e.target.value)}
          />
          <input
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Dependant code (optional)"
            value={medicalAidDependentCode}
            onChange={(e) => setMedicalAidDependentCode(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={onLinkMedicalAid}
            disabled={linkingMedicalAid}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {linkingMedicalAid ? 'Linking…' : 'Link medical aid'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewStatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-white/72 bg-white/84 p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-xs leading-6 text-slate-600">{note}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  body,
  footer,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  footer?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/72 bg-white/84 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>

      {(primaryHref || secondaryHref) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {primaryHref && primaryLabel ? (
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            >
              {primaryLabel}
            </Link>
          ) : null}

          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      ) : null}

      {footer ? <p className="mt-3 text-[11px] leading-5 text-slate-500">{footer}</p> : null}
    </div>
  );
}