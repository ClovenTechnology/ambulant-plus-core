'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useState } from 'react';

import { Card } from '@/components/ui';
import { Collapse } from '@/components/Collapse';
import { CollapseBtn } from '@/components/CollapseBtn';
import PreflightPanel from '@/components/PreflightPanel';

type AppointmentMeta = {
  id: string;
  when: string | null;
  patientId: string;
  patientName: string;
  clinicianName: string;
  clinicianSpecialty?: string;
  reason: string;
  status: string;
  feeZar?: number;
  coupon?: { applied: boolean; code: string; percent?: number };
};

type Props = {
  appt: AppointmentMeta;
  roomId: string;
  encounterId?: string | null;
  dense?: boolean;
  embeddedIoMT?: ReactNode;
};

function SafeDate({ iso }: { iso?: string | null }) {
  if (!iso) return <span>—</span>;
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString()}</span>;
}



function Field({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className={bold ? 'text-sm font-semibold text-slate-900' : 'text-sm text-slate-700'}>
        {value}
      </div>
    </div>
  );
}

export default function PatientLeftPane({
  appt,
  encounterId,
  dense,
  embeddedIoMT,
}: Props) {
  const [sessionOpen, setSessionOpen] = useState(true);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(true);
  const [accessOpen, setAccessOpen] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Session information">
        <div className="mb-3 flex justify-end">
          <CollapseBtn open={sessionOpen} onClick={() => setSessionOpen((v) => !v)} />
        </div>
        <Collapse open={sessionOpen}>
          <div className={dense ? 'space-y-2' : 'space-y-3'}>
            <Field label="Patient" value={appt.patientName} />
            <Field label="Patient ID" value={appt.patientId} />
            <Field label="Case" value={appt.reason} bold />
            <Field label="Session ID" value={<span className="font-mono">{appt.id}</span>} />
            <Field label="Session date" value={<SafeDate iso={appt.when} />} />
            <Field label="Clinician" value={appt.clinicianName} />
            <Field label="Specialty" value={appt.clinicianSpecialty || 'General Practice'} />
            <Field label="Status" value={appt.status} />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <div className="font-medium text-slate-900">Consult fee</div>
              <div className="mt-1">
                {typeof appt.feeZar === 'number' ? `R${appt.feeZar.toFixed(2)}` : '—'}
                {appt.coupon?.applied ? (
                  <span className="ml-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    Coupon: {appt.coupon.code} ({appt.coupon.percent || 0}%)
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </Collapse>
      </Card>

      <Card title="Connected devices">
        <div className="mb-3 flex justify-end">
          <CollapseBtn open={devicesOpen} onClick={() => setDevicesOpen((v) => !v)} />
        </div>
        <Collapse open={devicesOpen}>
          {embeddedIoMT ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
                Use live device surfaces here during the consultation session.
              </div>
              {embeddedIoMT}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
              Device console unavailable.
            </div>
          )}
        </Collapse>
      </Card>

      <Card title="Preflight">
        <div className="mb-3 flex justify-end">
          <CollapseBtn open={preflightOpen} onClick={() => setPreflightOpen((v) => !v)} />
        </div>
        <Collapse open={preflightOpen}>
          <PreflightPanel />
        </Collapse>
      </Card>

      <Card title="Care access">
        <div className="mb-3 flex justify-end">
          <CollapseBtn open={accessOpen} onClick={() => setAccessOpen((v) => !v)} />
        </div>
        <Collapse open={accessOpen}>
          <div className="space-y-3">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
              Stay in this consultation while care is in progress. Do not share the room URL. Support-person access will use a participant-scoped invitation rather than a navigation-away family link.
            </div>

            {encounterId ? (
              <Link
                href={`/encounters/${encodeURIComponent(encounterId)}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open encounter summary in a new tab
              </Link>
            ) : null}
          </div>
        </Collapse>
      </Card>
    </div>
  );
}