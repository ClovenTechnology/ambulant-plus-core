// apps/patient-app/components/careport/DeliveryDestinationSheet.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Destination = {
  label: string;
  addr: string;
  lat: number;
  lng: number;
  source: 'last' | 'home' | 'gps' | 'manual';
};

type Props = {
  open: boolean;
  onClose: () => void;
  profileAddress?: string | null;
  defaultCountry?: string;
  onConfirm: (x: { fulfillment: 'DELIVERY' | 'PICKUP'; destination?: Destination }) => void;
};

const LS_LAST = 'careport:lastDestination';
const LS_SAVED = 'careport:savedDestinations';
const DIFFERENT_LOCATION_KM = 1.0;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function readJson<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

function hasCoords(d?: Destination | null) {
  return Boolean(d && Number.isFinite(d.lat) && Number.isFinite(d.lng));
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function getGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('geolocation_unavailable'));

    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

async function geocodeAddress(q: string, country: string): Promise<Destination> {
  const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`, {
    cache: 'no-store',
  });

  if (!r.ok) throw new Error('geocode_failed');

  const data = await r.json();

  const lat = Number(data?.lat);
  const lng = Number(data?.lng);
  const addr = String(data?.addr || data?.address || q).trim();

  if (!addr || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('geocode_missing_coordinates');
  }

  return {
    label: 'New address',
    addr,
    lat,
    lng,
    source: 'manual',
  };
}

export default function DeliveryDestinationSheet(props: Props) {
  const { open, onClose, profileAddress, defaultCountry = 'za', onConfirm } = props;

  const [fulfillment, setFulfillment] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [saved, setSaved] = useState<Destination[]>([]);
  const [selected, setSelected] = useState<Destination | null>(null);
  const [homeCandidate, setHomeCandidate] = useState<Destination | null>(null);
  const [gpsCandidate, setGpsCandidate] = useState<Destination | null>(null);

  const [manualAddr, setManualAddr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmedDifferentAddress, setConfirmedDifferentAddress] = useState(false);

  useEffect(() => {
    if (!open) return;

    setErr(null);
    setConfirmedDifferentAddress(false);
    setManualAddr('');

    const last = readJson<Destination>(LS_LAST);
    const list = readJson<Destination[]>(LS_SAVED) || [];

    setSaved(list.filter(hasCoords));

    if (last && hasCoords(last)) {
      setSelected({ ...last, source: 'last' });
    } else {
      setSelected(null);
    }

    setHomeCandidate(null);
    setGpsCandidate(null);
    setFulfillment('DELIVERY');
  }, [open]);

  const gpsDistanceFromHomeKm = useMemo(() => {
    if (!hasCoords(homeCandidate) || !hasCoords(gpsCandidate)) return null;
    return haversineKm(homeCandidate!, gpsCandidate!);
  }, [homeCandidate, gpsCandidate]);

  const selectedDiffersFromGps =
    selected?.source === 'home' &&
    gpsCandidate &&
    gpsDistanceFromHomeKm !== null &&
    gpsDistanceFromHomeKm >= DIFFERENT_LOCATION_KM;

  const canContinue = useMemo(() => {
    if (fulfillment === 'PICKUP') return true;
    if (!selected || !hasCoords(selected) || !selected.addr) return false;
    if (selectedDiffersFromGps && !confirmedDifferentAddress) return false;
    return true;
  }, [confirmedDifferentAddress, fulfillment, selected, selectedDiffersFromGps]);

  async function chooseHome() {
    setErr(null);
    setConfirmedDifferentAddress(false);

    const addr = String(profileAddress || '').trim();
    if (!addr) {
      setErr('No saved home address was found on your profile. Use current location or enter a new address.');
      return;
    }

    setBusy('home');

    try {
      const d = await geocodeAddress(addr, defaultCountry);
      const home: Destination = {
        ...d,
        label: 'Home address',
        source: 'home',
      };

      setHomeCandidate(home);
      setSelected(home);
    } catch {
      setErr('Your profile address could not be located. Use current location or enter a more specific address.');
    } finally {
      setBusy(null);
    }
  }

  async function chooseGps() {
    setErr(null);
    setBusy('gps');

    try {
      const { lat, lng } = await getGps();
      const d: Destination = {
        label: 'Current location',
        addr: 'Current location',
        lat,
        lng,
        source: 'gps',
      };

      setGpsCandidate(d);
      setSelected(d);
      setConfirmedDifferentAddress(false);
    } catch {
      setErr('Location permission was denied or unavailable. You can enter an address manually.');
    } finally {
      setBusy(null);
    }
  }

  async function geocodeManual() {
    setErr(null);
    setConfirmedDifferentAddress(false);

    const q = manualAddr.trim();
    if (!q) return;

    setBusy('manual');

    try {
      const d = await geocodeAddress(q, defaultCountry);
      setSelected({
        ...d,
        label: 'New address',
        source: 'manual',
      });
    } catch {
      setErr('Could not locate that address. Use street, suburb and city for best results.');
    } finally {
      setBusy(null);
    }
  }

  function saveSelected() {
    if (!selected || !hasCoords(selected)) return;

    const list = readJson<Destination[]>(LS_SAVED) || [];
    const next = [selected, ...list.filter((x) => x.addr !== selected.addr)].slice(0, 8);

    writeJson(LS_SAVED, next);
    setSaved(next);
  }

  function continueNow() {
    setErr(null);

    if (fulfillment === 'PICKUP') {
      onConfirm({ fulfillment: 'PICKUP' });
      onClose();
      return;
    }

    if (!selected || !hasCoords(selected) || !selected.addr) {
      setErr('Choose and confirm a delivery address to continue.');
      return;
    }

    if (selectedDiffersFromGps && !confirmedDifferentAddress) {
      setErr('Confirm whether to deliver to your saved address or switch to your current location.');
      return;
    }

    writeJson(LS_LAST, selected);
    onConfirm({ fulfillment: 'DELIVERY', destination: selected });
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-slate-950/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">How would you like to receive this prescription?</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose home delivery or in-store collection before pharmacies receive the request.
                  </p>
                </div>
                <button className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" onClick={onClose}>
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setFulfillment('DELIVERY')}
                  className={cx(
                    'rounded-2xl border p-4 text-left transition',
                    fulfillment === 'DELIVERY'
                      ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <div className="text-sm font-semibold text-slate-900">Home delivery</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Requires a confirmed address and coordinates for rider dispatch.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFulfillment('PICKUP')}
                  className={cx(
                    'rounded-2xl border p-4 text-left transition',
                    fulfillment === 'PICKUP'
                      ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <div className="text-sm font-semibold text-slate-900">In-store collection</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Compare pharmacies that support pickup and collect when ready.
                  </div>
                </button>
              </div>

              {fulfillment === 'DELIVERY' ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Confirm the delivery point carefully. If your current location differs from your saved home address,
                    choose the address the rider should actually use.
                  </div>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={chooseHome}
                      disabled={busy !== null}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 disabled:opacity-60"
                    >
                      <div className="text-sm font-semibold text-slate-900">Use saved home address</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {profileAddress ? profileAddress : 'No address recorded on profile'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={chooseGps}
                      disabled={busy !== null}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 disabled:opacity-60"
                    >
                      <div className="text-sm font-semibold text-slate-900">Use current location</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Best when you are not at home or want the fastest accurate rider coordinates.
                      </div>
                    </button>

                    {saved.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900">Saved delivery addresses</div>
                        <div className="mt-3 grid gap-2">
                          {saved.map((d, idx) => (
                            <button
                              key={`${d.addr}-${idx}`}
                              type="button"
                              className="rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
                              onClick={() => {
                                setSelected(d);
                                setConfirmedDifferentAddress(false);
                              }}
                            >
                              <div className="text-sm font-medium text-slate-900">{d.label}</div>
                              <div className="mt-1 line-clamp-2 text-xs text-slate-500">{d.addr}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">Enter another address</div>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={manualAddr}
                          onChange={(e) => setManualAddr(e.target.value)}
                          placeholder="Street, suburb, city"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={geocodeManual}
                          disabled={busy !== null || !manualAddr.trim()}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                          Find
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Include street number, suburb and city for best accuracy.
                      </div>
                    </div>
                  </div>

                  {selected ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">Selected delivery address</div>
                      <div className="mt-1 text-sm text-slate-700">{selected.addr}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} • Source: {selected.source}
                      </div>

                      {selectedDiffersFromGps ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          Your current location appears about {gpsDistanceFromHomeKm?.toFixed(1)} km from the selected home
                          address. Confirm the selected address, or switch to current location.
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmedDifferentAddress(true)}
                              className="rounded-full bg-amber-900 px-3 py-1.5 text-xs font-medium text-white"
                            >
                              Deliver to selected address
                            </button>
                            <button
                              type="button"
                              onClick={() => gpsCandidate && setSelected(gpsCandidate)}
                              className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900"
                            >
                              Switch to current location
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-white" onClick={saveSelected}>
                          Save address
                        </button>
                        <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-white" onClick={() => setSelected(null)}>
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {err ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  You will see pharmacies that support collection. The pharmacy address, preparation time and collection
                  instructions will be shown before checkout.
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={!canContinue || busy !== null}
                  onClick={continueNow}
                >
                  {busy ? 'Working...' : fulfillment === 'PICKUP' ? 'Continue to pickup offers' : 'Confirm delivery address'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
