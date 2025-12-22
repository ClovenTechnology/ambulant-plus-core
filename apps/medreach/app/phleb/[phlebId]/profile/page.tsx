// apps/medreach/app/phleb/[phlebId]/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PhlebProfile } from '@/app/api/phlebs/profile/route';
import type { PhlebPreferences } from '@/app/api/phlebs/preferences/route';

export default function PhlebProfilePage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [profile, setProfile] = useState<PhlebProfile | null>(null);
  const [prefs, setPrefs] = useState<PhlebPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [requestingVehicleChange, setRequestingVehicleChange] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState({
    make: '',
    model: '',
    registration: '',
    color: '',
    type: '',
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [pRes, prefRes] = await Promise.all([
          fetch(`/api/phlebs/profile?phlebId=${encodeURIComponent(phlebId)}`, {
            cache: 'no-store',
          }),
          fetch(`/api/phlebs/preferences?phlebId=${encodeURIComponent(phlebId)}`, {
            cache: 'no-store',
          }),
        ]);
        if (!pRes.ok) throw new Error(`Profile HTTP ${pRes.status}`);
        if (!prefRes.ok) throw new Error(`Prefs HTTP ${prefRes.status}`);
        const pJson = (await pRes.json()) as PhlebProfile;
        const prefJson = (await prefRes.json()) as PhlebPreferences;

        if (!mounted) return;
        setProfile(pJson);
        setPrefs(prefJson);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [phlebId]);

  async function savePrefs(partial: Partial<PhlebPreferences>) {
    if (!prefs) return;
    setSavingPrefs(true);
    setErr(null);
    try {
      const res = await fetch('/api/phlebs/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...partial, phlebId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PhlebPreferences;
      setPrefs(data);
    } catch (e: any) {
      setErr(e?.message || 'Unable to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  }

  function handleServiceAreasChange(value: string) {
    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setPrefs((prev) => prev && { ...prev, serviceAreas: parts });
  }

  function handlePreferredLabsChange(value: string) {
    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setPrefs((prev) => prev && { ...prev, preferredLabIds: parts });
  }

  async function handleSaveBasicPrefs() {
    if (!prefs) return;
    await savePrefs({
      contactPhone: prefs.contactPhone,
      avatarUrl: prefs.avatarUrl,
      serviceAreas: prefs.serviceAreas,
      preferredLabIds: prefs.preferredLabIds,
    });
    alert('Preferences saved.');
  }

  async function handleRequestVehicleChange() {
    await savePrefs({
      vehicle: {
        ...prefs?.vehicle,
        ...vehicleDraft,
      },
    });
    setRequestingVehicleChange(false);
    setVehicleDraft({
      make: '',
      model: '',
      registration: '',
      color: '',
      type: '',
    });
    alert('Vehicle change request submitted for admin approval.');
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading profile…
      </main>
    );
  }

  if (err || !profile || !prefs) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 text-sm text-red-600">
        {err || 'Unable to load profile.'}
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {profile.fullName} — Profile
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage personal settings, service areas, preferred labs, and payout-facing
            information. Core identity fields come from onboarding and are read-only here.
          </p>
        </div>
      </header>

      {err && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded">
          {err}
        </div>
      )}

      {/* Core bio (read-only) */}
      <section className="bg-white border rounded-xl p-6 shadow-sm text-sm space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Core Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium text-gray-500">Full name</div>
            <div>{profile.fullName}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Email</div>
            <div>{profile.email}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Date of birth</div>
            <div>{profile.dob}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Gender</div>
            <div>{profile.gender || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Qualification</div>
            <div>{profile.qualification || '—'}</div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          To change core identity fields (name, DOB, gender, qualification, email), please
          contact support. These are locked for clinical and compliance reasons.
        </p>
      </section>

      {/* Editable preferences */}
      <section className="bg-white border rounded-xl p-6 shadow-sm text-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Contact & Preferences
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Contact phone
            </label>
            <input
              type="tel"
              className="w-full border rounded px-3 py-2"
              value={prefs.contactPhone || ''}
              onChange={(e) =>
                setPrefs((prev) => prev && { ...prev, contactPhone: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Avatar URL (profile picture)
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="https://…/avatar.jpg"
              value={prefs.avatarUrl || ''}
              onChange={(e) =>
                setPrefs((prev) => prev && { ...prev, avatarUrl: e.target.value })
              }
            />
            {prefs.avatarUrl && (
              <div className="mt-2">
                <img
                  src={prefs.avatarUrl}
                  alt="Profile avatar"
                  className="w-12 h-12 rounded-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Service areas (comma-separated)
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder="Randburg, Rosebank, Sandton"
            value={prefs.serviceAreas.join(', ')}
            onChange={(e) => handleServiceAreasChange(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            These areas influence which jobs are prioritised for you. You may still see
            jobs just outside your area depending on demand.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Preferred labs (IDs, comma-separated)
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder="lancet-cresta, adc-diagnostics-durban"
            value={prefs.preferredLabIds.join(', ')}
            onChange={(e) => handlePreferredLabsChange(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Jobs for these labs are prioritised for you when distance and service area
            also match.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveBasicPrefs}
            disabled={savingPrefs}
            className={
              'px-4 py-2 rounded border text-sm ' +
              (savingPrefs
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-900')
            }
          >
            {savingPrefs ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </section>

      {/* Vehicle details */}
      <section className="bg-white border rounded-xl p-6 shadow-sm text-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Vehicle Details (admin-approved)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500">Make</div>
            <div>{prefs.vehicle.make || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Model</div>
            <div>{prefs.vehicle.model || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Registration</div>
            <div>{prefs.vehicle.registration || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Color</div>
            <div>{prefs.vehicle.color || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Type</div>
            <div>{prefs.vehicle.type || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500">Status</div>
            <div className="text-[11px]">
              {prefs.vehicle.changePending ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  Change pending admin approval
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400">
          Vehicle details affect safety and insurance checks. Changes require an admin
          review.
        </p>

        {!requestingVehicleChange ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setRequestingVehicleChange(true)}
              className="px-4 py-2 rounded border text-sm bg-white hover:bg-gray-50"
            >
              Request vehicle change
            </button>
          </div>
        ) : (
          <div className="border-t pt-3 mt-2 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New make
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={vehicleDraft.make}
                  onChange={(e) =>
                    setVehicleDraft((prev) => ({ ...prev, make: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New model
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={vehicleDraft.model}
                  onChange={(e) =>
                    setVehicleDraft((prev) => ({ ...prev, model: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New registration
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={vehicleDraft.registration}
                  onChange={(e) =>
                    setVehicleDraft((prev) => ({
                      ...prev,
                      registration: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New color
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={vehicleDraft.color}
                  onChange={(e) =>
                    setVehicleDraft((prev) => ({ ...prev, color: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  New type
                </label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="Bike, car, etc."
                  value={vehicleDraft.type}
                  onChange={(e) =>
                    setVehicleDraft((prev) => ({ ...prev, type: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestingVehicleChange(false)}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestVehicleChange}
                className="px-3 py-1 rounded border bg-black text-white hover:bg-gray-900 text-xs"
              >
                Submit for approval
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
