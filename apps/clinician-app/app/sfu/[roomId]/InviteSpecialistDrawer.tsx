'use client';

import { useMemo, useState } from 'react';
import {
  buildMultipartyQuote,
  type ClinicianPlanTier,
  type InvitedClinicianInput,
  type InvitedClinicianRole,
  type PatientPlanTier,
} from '@/src/lib/televisit/multiparty';

type DraftClinician = {
  clinicianId: string;
  displayName: string;
  specialty: string;
  role: InvitedClinicianRole;
  standardConsultFeeZar: number;
  followUpFeeZar?: number | null;
  expectedMinutes?: number | null;
  required?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  patientPlan: PatientPlanTier;
  leadClinicianPlan: ClinicianPlanTier;
  leadClinicianId: string;
  leadClinicianFeeZar: number;
  remotePatientParticipants: number;
  remoteObservers: number;
  onConfirm: (payload: {
    invitedClinicians: InvitedClinicianInput[];
    quote: ReturnType<typeof buildMultipartyQuote>;
  }) => void;
};

export default function InviteSpecialistDrawer({
  open,
  onClose,
  patientPlan,
  leadClinicianPlan,
  leadClinicianId,
  leadClinicianFeeZar,
  remotePatientParticipants,
  remoteObservers,
  onConfirm,
}: Props) {
  const [displayName, setDisplayName] = useState('');
  const [clinicianId, setClinicianId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [role, setRole] = useState<InvitedClinicianRole>('advisor');
  const [standardConsultFeeZar, setStandardConsultFeeZar] = useState<number>(1200);
  const [followUpFeeZar, setFollowUpFeeZar] = useState<number>(900);
  const [expectedMinutes, setExpectedMinutes] = useState<number>(15);
  const [required, setRequired] = useState(true);

  const invitedClinicians = useMemo<InvitedClinicianInput[]>(() => {
    if (!clinicianId.trim()) return [];
    return [
      {
        clinicianId: clinicianId.trim(),
        displayName: displayName.trim() || undefined,
        specialty: specialty.trim() || undefined,
        role,
        standardConsultFeeZar,
        followUpFeeZar: role === 'takeover_followup' ? followUpFeeZar : undefined,
        expectedMinutes: role === 'takeover_followup' ? undefined : expectedMinutes,
        required,
      },
    ];
  }, [
    clinicianId,
    displayName,
    specialty,
    role,
    standardConsultFeeZar,
    followUpFeeZar,
    expectedMinutes,
    required,
  ]);

  const quote = useMemo(
    () =>
      buildMultipartyQuote({
        patientPlan,
        leadClinicianPlan,
        leadClinicianId,
        leadClinicianFeeZar,
        invitedClinicians,
        remotePatientParticipants,
        remoteObservers,
      }),
    [
      patientPlan,
      leadClinicianPlan,
      leadClinicianId,
      leadClinicianFeeZar,
      invitedClinicians,
      remotePatientParticipants,
      remoteObservers,
    ],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/40"
      onClick={onClose}
    >
      <div
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-lg font-semibold text-slate-900">
            Invite specialist
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Add a co-clinician or advisor to this Televisit and generate the incremental quote for patient approval.
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3">
            <input
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Specialist display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <input
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
            />
            <input
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />

            <select
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as InvitedClinicianRole)}
            >
              <option value="advisor">Advisor</option>
              <option value="co_clinician">Co-clinician</option>
              <option value="takeover_followup">Takeover follow-up</option>
            </select>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-600">
                <div className="mb-1">Standard consult fee (ZAR)</div>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  value={standardConsultFeeZar}
                  onChange={(e) => setStandardConsultFeeZar(Number(e.target.value || 0))}
                />
              </label>

              {role === 'takeover_followup' ? (
                <label className="text-sm text-slate-600">
                  <div className="mb-1">Follow-up fee (ZAR)</div>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    value={followUpFeeZar}
                    onChange={(e) => setFollowUpFeeZar(Number(e.target.value || 0))}
                  />
                </label>
              ) : (
                <label className="text-sm text-slate-600">
                  <div className="mb-1">Expected minutes</div>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    value={expectedMinutes}
                    onChange={(e) => setExpectedMinutes(Number(e.target.value || 0))}
                  />
                </label>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              Required participant
            </label>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Quote preview</div>

            <div className="mt-3 space-y-2">
              {quote.lines.map((line) => (
                <div
                  key={line.code}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="text-slate-700">{line.label}</div>
                  <div className="font-medium text-slate-900">
                    R{line.amountZar.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
              <div className="text-sm font-semibold text-slate-900">Total</div>
              <div className="text-base font-semibold text-slate-900">
                R{quote.totalZar.toFixed(2)}
              </div>
            </div>

            {quote.blockers.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {quote.blockers.join(' · ')}
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!clinicianId.trim() || quote.blockers.length > 0}
            onClick={() => onConfirm({ invitedClinicians, quote })}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Send for patient approval
          </button>
        </div>
      </div>
    </div>
  );
}