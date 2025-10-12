// ============================================================================
// apps/patient-app/src/screens/AntenatalSetup.tsx
// Setup form. Prefills from fertilityPrefs. Stores antenatal:prefs.
// ============================================================================
'use client';
import { useEffect, useMemo, useState } from 'react';
import { calcEDD, saveAntenatalPrefs, type AntenatalPrefs } from '@/src/analytics/antenatal';

export function AntenatalSetup() {
  const [edd, setEdd] = useState('');
  const [lmp, setLmp] = useState('');
  const [cycleDays, setCycleDays] = useState<number | ''>('');
  const [gravida, setGravida] = useState<number | ''>('');
  const [para, setPara] = useState<number | ''>('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('antenatal:prefs');
      if (saved) {
        const p: AntenatalPrefs = JSON.parse(saved);
        setEdd(p.edd || '');
        setLmp(p.lmp || '');
        setCycleDays(p.cycleDays ?? '');
        setGravida(p.gravida ?? '');
        setPara(p.para ?? '');
      } else {
        const fert = localStorage.getItem('fertilityPrefs');
        if (fert) {
          const fp = JSON.parse(fert) as { lmp?: string; cycleDays?: number };
          if (fp.lmp) setLmp(fp.lmp);
          if (fp.cycleDays) setCycleDays(fp.cycleDays);
          if (fp.lmp) setEdd(calcEDD(fp.lmp, fp.cycleDays ?? 28));
        }
      }
    } catch {}
  }, []);

  const canAuto = useMemo(() => !!lmp && !!cycleDays, [lmp, cycleDays]);

  const save = () => {
    const prefs: AntenatalPrefs = {
      edd: edd || (canAuto ? calcEDD(lmp!, Number(cycleDays)) : undefined),
      lmp: lmp || undefined,
      cycleDays: cycleDays ? Number(cycleDays) : undefined,
      gravida: gravida ? Number(gravida) : undefined,
      para: para ? Number(para) : undefined,
    };
    saveAntenatalPrefs(prefs);
    alert('Antenatal preferences saved ✅');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Antenatal Setup</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm">EDD (Estimated Due Date)</span>
          <input type="date" value={edd} onChange={(e)=>setEdd(e.target.value)} className="border p-2 rounded w-full" />
        </label>
        <label className="block">
          <span className="text-sm">LMP (optional)</span>
          <input type="date" value={lmp} onChange={(e)=>setLmp(e.target.value)} className="border p-2 rounded w-full" />
        </label>
        <label className="block">
          <span className="text-sm">Cycle length (optional)</span>
          <input type="number" min={20} max={40} value={cycleDays} onChange={(e)=>setCycleDays(e.target.value ? Number(e.target.value) : '')} className="border p-2 rounded w-full" />
        </label>
        <label className="block">
          <span className="text-sm">Gravida</span>
          <input type="number" min={0} value={gravida} onChange={(e)=>setGravida(e.target.value ? Number(e.target.value) : '')} className="border p-2 rounded w-full" />
        </label>
        <label className="block">
          <span className="text-sm">Para</span>
          <input type="number" min={0} value={para} onChange={(e)=>setPara(e.target.value ? Number(e.target.value) : '')} className="border p-2 rounded w-full" />
        </label>
      </div>
      <div className="text-xs text-gray-500">
        If LMP is set, EDD will auto-calculate (you can override).
      </div>
      <button onClick={save} className="bg-pink-600 text-white px-4 py-2 rounded">Save</button>
    </div>
  );
}
