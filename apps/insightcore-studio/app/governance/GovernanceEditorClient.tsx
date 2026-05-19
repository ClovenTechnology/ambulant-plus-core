'use client';

import { useState } from 'react';

export default function GovernanceEditorClient() {
  const [orgId, setOrgId] = useState('org-default');
  const [keyName, setKeyName] = useState('cardio_bp');
  const [value, setValue] = useState('0.26');
  const [status, setStatus] = useState<string | null>(null);

  async function saveWeight() {
    setStatus('Saving…');
    const res = await fetch('/api/insightcore/studio/governance/org/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orgId,
        ruleWeights: {
          [keyName]: Number(value),
        },
      }),
    });

    setStatus(res.ok ? 'Saved' : 'Failed');
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
      <div className="text-lg font-semibold">Quick editor</div>
      <div className="mt-4 grid gap-3">
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-white"
          placeholder="orgId"
        />
        <input
          value={keyName}
          onChange={(e) => setKeyName(e.target.value)}
          className="rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-white"
          placeholder="rule key"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-white"
          placeholder="value"
        />
        <button
          onClick={saveWeight}
          className="rounded-[14px] bg-cyan-500 px-4 py-3 font-medium text-slate-950"
        >
          Save weight override
        </button>
        {status ? <div className="text-sm text-slate-300">{status}</div> : null}
      </div>
    </div>
  );
}