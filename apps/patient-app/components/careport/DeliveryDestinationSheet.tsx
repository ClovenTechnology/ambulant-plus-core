//apps/patient-app/components/careport/DeliveryDestinationSheet.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Destination = {
  label: string;
  addr: string;
  lat: number;
  lng: number;
  source: "last" | "home" | "gps" | "manual";
};

type Props = {
  open: boolean;
  onClose: () => void;
  profileAddress?: string | null;
  defaultCountry?: string; // "za"
  onConfirm: (x: { fulfillment: "DELIVERY" | "PICKUP"; destination?: Destination }) => void;
};

const LS_LAST = "careport:lastDestination";
const LS_SAVED = "careport:savedDestinations";

function readJson<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function writeJson(k: string, v: any) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

async function getGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("geolocation_unavailable"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

export default function DeliveryDestinationSheet(props: Props) {
  const { open, onClose, profileAddress, defaultCountry = "za", onConfirm } = props;

  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [saved, setSaved] = useState<Destination[]>([]);
  const [selected, setSelected] = useState<Destination | null>(null);

  const [manualAddr, setManualAddr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // load last + saved
  useEffect(() => {
    if (!open) return;
    setErr(null);

    const last = readJson<Destination>(LS_LAST);
    const list = readJson<Destination[]>(LS_SAVED) || [];

    setSaved(list);

    if (last && Number.isFinite(last.lat) && Number.isFinite(last.lng)) {
      setSelected({ ...last, source: "last" });
    } else {
      setSelected(null);
    }
  }, [open]);

  const canContinue = useMemo(() => {
    if (fulfillment === "PICKUP") return true;
    return !!selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng) && !!selected.addr;
  }, [fulfillment, selected]);

  async function chooseHome() {
    setErr(null);
    const addr = String(profileAddress || "").trim();
    if (!addr) {
      setErr("No home address on your profile yet.");
      return;
    }

    // Option A: geocode it (if route exists)
    setBusy("home");
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(addr)}&country=${defaultCountry}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error("geocode_failed");
      const data = await r.json();
      const d: Destination = {
        label: "Home",
        addr: data.addr || addr,
        lat: Number(data.lat),
        lng: Number(data.lng),
        source: "home",
      };
      setSelected(d);
    } catch {
      // If geocode is not available or fails, guide user to GPS
      setErr("Couldn’t locate that address yet. Try “Use current location” (recommended).");
    } finally {
      setBusy(null);
    }
  }

  async function chooseGps() {
    setErr(null);
    setBusy("gps");
    try {
      const { lat, lng } = await getGps();
      const d: Destination = {
        label: "Current location",
        addr: "Current location",
        lat,
        lng,
        source: "gps",
      };
      setSelected(d);
    } catch {
      setErr("Location permission denied (or unavailable). You can enter an address instead.");
    } finally {
      setBusy(null);
    }
  }

  async function geocodeManual() {
    setErr(null);
    const q = manualAddr.trim();
    if (!q) return;

    setBusy("manual");
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&country=${defaultCountry}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error("geocode_failed");
      const data = await r.json();
      const d: Destination = {
        label: "New address",
        addr: data.addr || q,
        lat: Number(data.lat),
        lng: Number(data.lng),
        source: "manual",
      };
      setSelected(d);
    } catch {
      setErr("Couldn’t find that address. Try being more specific (street + suburb + city).");
    } finally {
      setBusy(null);
    }
  }

  function saveSelected() {
    if (!selected) return;
    const list = readJson<Destination[]>(LS_SAVED) || [];
    const next = [selected, ...list.filter((x) => x.addr !== selected.addr)].slice(0, 8);
    writeJson(LS_SAVED, next);
    setSaved(next);
  }

  function continueNow() {
    setErr(null);

    if (fulfillment === "PICKUP") {
      onConfirm({ fulfillment: "PICKUP" });
      onClose();
      return;
    }

    if (!selected) {
      setErr("Pick a delivery address to continue.");
      return;
    }

    writeJson(LS_LAST, selected);
    onConfirm({ fulfillment: "DELIVERY", destination: selected });
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl p-4"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Delivery details</div>
              <button className="text-sm text-gray-600" onClick={onClose}>
                Close
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className={`px-3 py-2 rounded border ${fulfillment === "DELIVERY" ? "bg-gray-50" : ""}`}
                onClick={() => setFulfillment("DELIVERY")}
              >
                Delivery
              </button>
              <button
                className={`px-3 py-2 rounded border ${fulfillment === "PICKUP" ? "bg-gray-50" : ""}`}
                onClick={() => setFulfillment("PICKUP")}
              >
                Pickup
              </button>
            </div>

            {fulfillment === "DELIVERY" && (
              <div className="mt-4 space-y-3">
                <div className="text-sm text-gray-600">Choose where to deliver:</div>

                <div className="grid gap-2">
                  <button
                    onClick={chooseHome}
                    disabled={busy !== null}
                    className="border rounded p-3 text-left"
                  >
                    <div className="font-medium">Home</div>
                    <div className="text-xs text-gray-500">
                      {profileAddress ? profileAddress : "No address on profile"}
                    </div>
                  </button>

                  <button
                    onClick={chooseGps}
                    disabled={busy !== null}
                    className="border rounded p-3 text-left"
                  >
                    <div className="font-medium">Use current location</div>
                    <div className="text-xs text-gray-500">
                      Fastest and always has accurate coordinates
                    </div>
                  </button>

                  {saved.length > 0 && (
                    <div className="border rounded p-3">
                      <div className="text-sm font-medium">Saved</div>
                      <div className="mt-2 space-y-2">
                        {saved.map((d, idx) => (
                          <button
                            key={`${d.addr}-${idx}`}
                            className="w-full text-left border rounded p-2"
                            onClick={() => setSelected(d)}
                          >
                            <div className="text-sm font-medium">{d.label}</div>
                            <div className="text-xs text-gray-500 line-clamp-2">{d.addr}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border rounded p-3">
                    <div className="text-sm font-medium">New address</div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={manualAddr}
                        onChange={(e) => setManualAddr(e.target.value)}
                        placeholder="Street, suburb, city"
                        className="border rounded px-2 py-2 w-full"
                      />
                      <button
                        onClick={geocodeManual}
                        disabled={busy !== null || !manualAddr.trim()}
                        className="px-3 py-2 border rounded"
                      >
                        Find
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Tip: include suburb + city for best results
                    </div>
                  </div>
                </div>

                {selected && (
                  <div className="border rounded p-3 bg-gray-50">
                    <div className="text-sm font-medium">Selected</div>
                    <div className="text-xs text-gray-600 mt-1">{selected.addr}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button className="px-3 py-2 border rounded" onClick={saveSelected}>
                        Save
                      </button>
                      <button className="px-3 py-2 border rounded" onClick={() => setSelected(null)}>
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {err && <div className="text-sm text-red-600">{err}</div>}
              </div>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <button className="px-3 py-2 border rounded" onClick={onClose}>
                Cancel
              </button>
              <button
                className="px-3 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
                disabled={!canContinue || busy !== null}
                onClick={continueNow}
              >
                {busy ? "Working..." : "Continue"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}