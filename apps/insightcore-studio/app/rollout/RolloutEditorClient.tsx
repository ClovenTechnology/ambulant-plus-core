'use client';

import { useState } from 'react';

export default function RolloutEditorClient() {
  const [orgId, setOrgId] = useState('org-default');
  const [modelId, setModelId] = useState('composite-risk');
  const [trafficPercent, setTrafficPercent] = useState('100');
  const [status, setStatus] = useState<string | null>(null);

  async function saveRollout() {
    setStatus('Saving…');
    const res = await fetch('/api/insightcore/studio/models/rollout/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orgId,
        modelId,
        version: '2.0.0',
        enabled: true,
        trafficPercent: Number(trafficPercent),
        audience: 'all',
      }),
    });

    setStatus(res.ok ? 'Saved' : 'Failed');
  }

  async function assignExperiment() {
    setStatus('Assigning…');
    const res = await fetch('/api/insightcore/studio/experiments/assign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orgId,
        id: 'baseline-shift-rnd-v1',
        title: 'Baseline shift research',
        family: 'ml',
        version: '1.0.0',
        active: true,
      }),
    });

    setStatus(res.ok ? 'Experiment assigned' : 'Failed');
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
      <div className="text-lg font-semibold">Rollout editor</div>
      <div className="mt-4 grid gap-3">
        <input
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          className="rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-white"
          placeholder="orgId"
        />
        <input
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-white"
          placeholder="modelId"
        />
        <input
          value={trafficPercent}
          onChange={(e) => setTrafficPercent(e.target.value)}
          className="rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-white"
          placeholder="trafficPercent"
        />
        <button
          onClick={saveRollout}
          className="rounded-[14px] bg-cyan-500 px-4 py-3 font-medium text-slate-950"
        >
          Save rollout
        </button>
        <button
          onClick={assignExperiment}
          className="rounded-[14px] border border-white/10 px-4 py-3 font-medium text-white"
        >
          Assign experiment
        </button>
        {status ? <div className="text-sm text-slate-300">{status}</div> : null}
      </div>
    </div>
  );
}