'use client';

import { useState } from 'react';

type Role = 'admin' | 'trainer' | 'observer';

export default function TrainingRoomLaunch({
  trainingSlotId,
  role,
  clinicianBase,
  fallbackRoomId,
}: {
  trainingSlotId: string;
  role: Role;
  clinicianBase: string;
  fallbackRoomId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function launch() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/training/admission', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trainingSlotId, role }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false || !body?.admission?.token) throw new Error(body?.error || 'training_admission_unavailable');
      const admission = body.admission;
      const url = new URL(`/training/room/${encodeURIComponent(admission.roomId || fallbackRoomId)}`, clinicianBase);
      url.searchParams.set('trainingSlotId', admission.trainingSlotId || trainingSlotId);
      url.searchParams.set('role', admission.role || role);
      url.searchParams.set('uid', admission.uid || `training-${role}`);
      url.searchParams.set('joinToken', admission.token);
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch (reason: any) {
      setError(String(reason?.message || 'Unable to issue training-room admission').split('_').join(' '));
    } finally { setBusy(false); }
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => void launch()} className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50">
        {busy ? 'Preparing secure admission...' : `Open room as ${role}`}
      </button>
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
