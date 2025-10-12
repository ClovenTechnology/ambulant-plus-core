// apps/patient-app/src/screens/FertilitySetup.tsx
import React, { useState, useEffect } from 'react';

type FertilityPrefs = {
  lmp: string;        // YYYY-MM-DD
  cycleDays: number;  // avg length
};

export function FertilitySetup() {
  const [lmp, setLmp] = useState('');
  const [cycleDays, setCycleDays] = useState(28);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('fertilityPrefs');
    if (saved) {
      const parsed: FertilityPrefs = JSON.parse(saved);
      setLmp(parsed.lmp || '');
      setCycleDays(parsed.cycleDays || 28);
    }
  }, []);

  const save = () => {
    const prefs: FertilityPrefs = { lmp, cycleDays };
    localStorage.setItem('fertilityPrefs', JSON.stringify(prefs));
    alert('Fertility preferences saved ✅');
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Fertility Tracking Setup</h2>
      <label className="block">
        <span className="text-sm">Last Menstrual Period (LMP)</span>
        <input
          type="date"
          value={lmp}
          onChange={(e) => setLmp(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </label>
      <label className="block">
        <span className="text-sm">Cycle Length (days)</span>
        <input
          type="number"
          value={cycleDays}
          onChange={(e) => setCycleDays(Number(e.target.value))}
          className="border p-2 rounded w-full"
          min={20}
          max={40}
        />
      </label>
      <button
        onClick={save}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Save
      </button>
    </div>
  );
}

// Helper used by analytics
export function loadUserFertilityPrefs(): FertilityPrefs | null {
  const saved = localStorage.getItem('fertilityPrefs');
  return saved ? JSON.parse(saved) : null;
}
