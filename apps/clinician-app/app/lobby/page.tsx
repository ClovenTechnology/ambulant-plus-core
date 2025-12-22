//apps/clinician-app/app/lobby/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Ctx = {
  patientId?: string;
  patientName?: string;
  encounterId?: string;
  clinicianId?: string;
  clinicianName?: string;
  clinicName?: string;
  clinicAddress?: string;
  reason?: string;
};

function normalizeOrigin(x?: string | null) {
  const v = (x ?? '').trim();
  if (!v) return '';
  return v.replace(/\/+$/, '');
}

function derivePatientOriginFromHere(here: URL) {
  // 1) Same host but different port (local dev)
  if (here.hostname === 'localhost' || here.hostname === '127.0.0.1') {
    const u = new URL(here.toString());
    u.port = '3000';
    u.pathname = '/';
    u.search = '';
    u.hash = '';
    return u.origin;
  }

  // 2) Common subdomain swap: clinician.* -> patient.*
  if (here.hostname.startsWith('clinician.')) {
    return `${here.protocol}//${here.hostname.replace(/^clinician\./, 'patient.')}`;
  }

  // 3) Fallback: same origin
  return here.origin;
}

function buildSfuUrl(origin: string, roomId: string, ctx: Ctx) {
  const u = new URL(origin);
  u.pathname = `/sfu/${encodeURIComponent(roomId)}`;
  u.search = '';
  u.hash = '';

  // only attach non-empty params
  const sp = u.searchParams;
  (Object.entries(ctx) as Array<[keyof Ctx, string | undefined]>).forEach(([k, v]) => {
    const val = (v ?? '').trim();
    if (val) sp.set(String(k), val);
  });

  return u.toString();
}

function makeLinks(roomId: string, ctx: Ctx) {
  // SSR-safe defaults (dev-friendly)
  if (typeof window === 'undefined') {
    const clinicianOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_CLINICIAN_APP_ORIGIN) || 'http://localhost:3001';
    const patientOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_PATIENT_APP_ORIGIN) || 'http://localhost:3000';
    return {
      clinician: buildSfuUrl(clinicianOrigin, roomId, ctx),
      patient: buildSfuUrl(patientOrigin, roomId, ctx),
    };
  }

  const here = new URL(window.location.href);

  const clinicianOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_CLINICIAN_APP_ORIGIN) ||
    here.origin.replace(/\/lobby\/?$/, '');

  const patientOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_PATIENT_APP_ORIGIN) ||
    derivePatientOriginFromHere(here);

  return {
    clinician: buildSfuUrl(clinicianOrigin, roomId, ctx),
    patient: buildSfuUrl(patientOrigin, roomId, ctx),
  };
}

export default function Lobby() {
  const [roomId, setRoomId] = useState('[roomId]');
  const [ctx, setCtx] = useState<Ctx>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URL(window.location.href).searchParams;

    setCtx({
      patientId: sp.get('patientId') ?? undefined,
      patientName: sp.get('patientName') ?? undefined,
      encounterId: sp.get('encounterId') ?? undefined,
      clinicianId: sp.get('clinicianId') ?? undefined,
      clinicianName: sp.get('clinicianName') ?? undefined,
      clinicName: sp.get('clinicName') ?? undefined,
      clinicAddress: sp.get('clinicAddress') ?? undefined,
      reason: sp.get('reason') ?? undefined,
    });
  }, []);

  const links = useMemo(() => makeLinks(roomId, ctx), [roomId, ctx]);

  const copy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      alert('Copied!');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      alert('Copied!');
    }
  };

  return (
    <main className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Clinician Lobby</h1>

      <div className="rounded border p-4 space-y-3 bg-white">
        <label className="block text-sm text-gray-600">
          This is your waiting area to prepare for your upcoming appointment. You can take time to exhale, review the
          patient file(s), historic vitals, EHR, eRx, labs and more before the session commences.
        </label>

        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="e.g. dev, call-123"
        />

        <div className="flex flex-wrap gap-2">
          <a
            href={links.clinician}
            className="px-3 py-2 border rounded hover:bg-gray-100"
          >
            Proceed to Consultation Session
          </a>

          <button
            onClick={() => copy(links.patient)}
            className="px-3 py-2 border rounded hover:bg-gray-100"
            type="button"
            title="Copy patient invite link"
          >
            Copy Patient Invite
          </button>
        </div>
      </div>

      <div className="rounded border p-4 space-y-3 bg-white">
        <div className="font-medium">Invite Links</div>
        <div className="text-sm text-gray-600">
          Share the invite link with intended participants only. Do not share with unauthorized parties.
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-500">Clinician</div>
          <div className="flex gap-2">
            <input readOnly value={links.clinician} className="border rounded px-2 py-1 flex-1" />
            <button onClick={() => copy(links.clinician)} className="px-3 py-1 border rounded" type="button">
              Copy
            </button>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs text-gray-500">Patient</div>
          <div className="flex gap-2">
            <input readOnly value={links.patient} className="border rounded px-2 py-1 flex-1" />
            <button onClick={() => copy(links.patient)} className="px-3 py-1 border rounded" type="button">
              Copy
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => copy(`Clinician: ${links.clinician}\nPatient: ${links.patient}`)}
            className="px-3 py-2 border rounded w-full"
            type="button"
          >
            Copy Both
          </button>
        </div>
      </div>
    </main>
  );
}
