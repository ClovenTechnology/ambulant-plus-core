// apps/patient-app/app/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

import Sparkline from "@/components/Sparkline";
import VitalsCard from "@/components/VitalsCard";
import HealthScoreCard from "@/components/HealthScore";
import AllergiesPanel from "@/components/AllergiesPanel";
import CareTeamCard from "@/components/CareTeamCard";
import MedicalAidManager from "@/components/MedicalAidManager";

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({
    name: "",
    heightCm: 175,
    weightKg: 75,
    address: "Morningside, Sandton 2150",
    mobile: "074-551-8583",
    emergencyContact: { name: "", phone: "" },
  });
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [vitalsSummary, setVitalsSummary] = useState<any>(null);
  const [careTeam, setCareTeam] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [pRes, dRes, vRes, cRes, fRes] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }),
          fetch("/api/devices", { cache: "no-store" }),
          fetch("/api/vitals/summary", { cache: "no-store" }),
          fetch("/api/care-team", { cache: "no-store" }),
          fetch("/api/favourites", { cache: "no-store" }),
        ]);

        if (!mounted) return;
        const [p, d, v, c, f] = await Promise.all([
          pRes.json().catch(() => ({})),
          dRes.json().catch(() => []),
          vRes.json().catch(() => ({})),
          cRes.json().catch(() => []),
          fRes.json().catch(() => ({ ids: [] })),
        ]);

        setProfile(p || null);
        setForm((prev: any) => ({
          ...prev,
          name: p?.name || prev.name,
          heightCm: p?.heightCm ?? prev.heightCm,
          weightKg: p?.weightKg ?? prev.weightKg,
          address: p?.address || prev.address,
          mobile: p?.mobile || prev.mobile,
          emergencyContact: p?.emergencyContact || prev.emergencyContact,
        }));
        setDevices(d || []);
        setVitalsSummary(v || null);
        setCareTeam(c || []);
        setFavs(f?.ids || []);
      } catch (err) {
        console.error("Failed to load profile data", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const bmi =
    form.weightKg && form.heightCm
      ? form.weightKg / Math.pow(form.heightCm / 100, 2)
      : null;

  function completenessScore() {
    const fields = ["name", "mobile", "address", "emergencyContact"];
    let filled = 0;
    if (form.name) filled++;
    if (form.mobile) filled++;
    if (form.address) filled++;
    if (form.emergencyContact?.name && form.emergencyContact?.phone) filled++;
    return Math.round((filled / fields.length) * 100);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        address: form.address,
        mobile: form.mobile,
        emergencyContact: form.emergencyContact,
        name: form.name,
      };
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setProfile((prev: any) => ({ ...(prev || {}), ...payload }));
      setEditing(false);
      alert("Saved");
    } catch (err) {
      console.error(err);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync-devices", { method: "POST" });
      if (res.ok) {
        const payload = await res.json();
        setDevices(payload.devices || devices);
        setVitalsSummary(payload.vitalsSummary || vitalsSummary);
      }
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleFavourite(clinicianId: string) {
    try {
      const isFav = favs.includes(clinicianId);
      if (isFav) {
        await fetch(`/api/favourites?id=${clinicianId}`, { method: "DELETE" });
        setFavs((prev) => prev.filter((x) => x !== clinicianId));
      } else {
        await fetch("/api/favourites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: clinicianId }),
        });
        setFavs((prev) => [...prev, clinicianId]);
      }
    } catch (err) {
      console.error("fav toggle failed", err);
    }
  }

  const patientIdForMedicalAid =
    profile?.patientId || profile?.id || "pt-za-001";

  return (
    <main className="p-4 space-y-6 max-w-6xl mx-auto">
      {/* Header / Profile Overview */}
      <section className="flex items-center gap-4">
        <div className="relative">
          <motion.div
            animate={syncing ? { rotate: 360 } : { rotate: 0 }}
            transition={{
              repeat: syncing ? Infinity : 0,
              duration: 6,
              ease: "linear",
            }}
            className="rounded-full p-1 bg-gradient-to-br from-sky-400 to-indigo-600"
            style={{ display: "inline-block" }}
            aria-hidden
          >
            <img
              src={profile?.avatarUrl || "/images/avatar-placeholder.png"}
              alt="profile"
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
            />
          </motion.div>
          <span className="absolute -bottom-2 -right-2 text-xs bg-white px-2 py-0.5 rounded-full shadow">
            ID {profile?.patientId || "Am25-02-001"}
          </span>
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {profile?.name || form.name || "Lerato Toto"}
          </h1>
          <div className="text-sm text-gray-500">
            {profile?.age ? `${profile.age} yrs` : ""}{" "}
            {profile?.gender ? `• ${profile.gender}` : "Female"}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {vitalsSummary
              ? `Vitals: ${vitalsSummary.overallStatus} · Last sync: ${vitalsSummary.lastSyncHuman}`
              : "No vitals available"}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-xs text-gray-500">
              Profile completeness
            </div>
            <div className="text-sm font-semibold">
              {completenessScore()}%
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setEditing(true)}
            className="border rounded px-3 py-2"
          >
            Edit Profile
          </button>
          <button
            onClick={triggerSync}
            className="border rounded px-3 py-2"
          >
            {syncing ? "Syncing..." : "Sync Devices"}
          </button>
          <button
            onClick={() => {
              navigator.share?.({
                title: "Ambulant+ Profile",
                text: "Sharing my Ambulant+ profile",
                url: window.location.href,
              });
            }}
            className="border rounded px-3 py-2"
          >
            Share Record
          </button>
        </div>
      </section>

      {/* Health Passport + BMI */}
      <section className="grid md:grid-cols-3 gap-3">
        <div className="col-span-2 p-4 border rounded bg-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-500">Health Passport</div>
              <div className="font-semibold text-lg mt-1">
                {profile?.name || "Lerao Toto"}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Blood: {profile?.bloodType || "O+"} • Allergies:{" "}
                {Array.isArray(profile?.allergies)
                  ? profile.allergies.join(", ")
                  : profile?.allergies || "Peanuts - Mild (Unresolved)"}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Emergency:{" "}
                {profile?.emergencyContact?.name || "Phumla"} (
                {profile?.emergencyContact?.phone || "083-551-8582"})
              </div>
              <div className="mt-3">
                <a
                  className="text-sm text-indigo-600"
                  href="/careport"
                >
                  Open CarePort →
                </a>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="w-24 h-24 bg-gray-50 rounded grid place-items-center text-xs text-gray-400">
                Profile QR
              </div>
              <a
                className="text-sm text-indigo-600"
                href="/allergies"
              >
                Manage My Allergies
              </a>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded bg-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">BMI</div>
              <div className="text-3xl font-semibold">
                {bmi ? bmi.toFixed(1) : "—"}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                Height: {form.heightCm} cm • Weight: {form.weightKg} kg
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-sm border rounded px-3 py-2"
            >
              Edit
            </button>
          </div>
        </div>
      </section>

      {/* Connected Devices */}
      <section>
        <h2 className="text-md font-medium">Connected Devices</h2>
        <div className="mt-2 grid md:grid-cols-3 gap-3">
          {devices.length === 0 && (
            <div className="col-span-3 text-sm text-gray-500">
              No devices connected.
            </div>
          )}
          {devices.map((d: any) => (
            <div
              key={d.id || d.name}
              className="p-3 border rounded bg-white"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-sm text-gray-500">
                    {d.status || "unknown"} •{" "}
                    {d.battery ? `${d.battery}%` : "—"}
                  </div>
                </div>
                <div className="w-24">
                  <Sparkline
                    values={
                      Array.isArray(d.recent)
                        ? d.recent
                            .slice(-12)
                            .map((x: any) => x.value)
                        : []
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Health Snapshot */}
      <section>
        <h2 className="text-md font-medium">Health Snapshot</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <VitalsCard data={vitalsSummary?.hr} label="Heart Rate" />
          </div>
          <div>
            <HealthScoreCard data={vitalsSummary} />
          </div>
          <div className="p-3 border rounded bg-white">
            <AllergiesPanel
              allergies={profile?.allergiesList || []}
              onRefresh={async () => {
                try {
                  const res = await fetch("/api/allergies");
                  const data = await res.json();
                  setProfile((prev: any) => ({
                    ...(prev || {}),
                    allergiesList: data,
                  }));
                } catch (err) {
                  console.error("Allergies refresh failed", err);
                }
              }}
              onExport={() => {
                alert(
                  "Exporting allergies (implement server export)."
                );
              }}
            />
          </div>
        </div>
      </section>

      {/* Care Team */}
      <section>
        <h2 className="text-md font-medium">Care Team</h2>
        <div className="mt-2 flex gap-3 overflow-x-auto">
          {careTeam.length === 0 && (
            <div className="text-sm text-gray-500">
              No clinicians linked.
            </div>
          )}
          {careTeam.map((c: any) => (
            <CareTeamCard
              key={c.id}
              clinician={c}
              isFav={favs.includes(c.id)}
              onToggleFav={() => toggleFavourite(c.id)}
            />
          ))}
        </div>
      </section>

      {/* Medical Aid / Insurance */}
      <section className="p-3 border rounded bg-white">
        <MedicalAidManager patientId={patientIdForMedicalAid} />
      </section>

      {/* Data & Privacy Controls */}
      <section className="p-3 border rounded bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Data & Privacy</div>
            <div className="text-sm text-gray-500">
              Manage who can access your health data
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={
                  profile?.allowClinicianAccess ?? true
                }
              />{" "}
              <span className="text-sm">Clinician access</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                defaultChecked={profile?.autoSync ?? true}
              />{" "}
              <span className="text-sm">Auto sync devices</span>
            </label>
          </div>
        </div>
      </section>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-lg p-4 bg-white rounded shadow-lg"
          >
            <h3 className="text-lg font-semibold">Edit Profile</h3>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm text-gray-500">
                  Full name
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="border rounded px-2 py-1 w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={form.heightCm}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        heightCm: Number(e.target.value),
                      })
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={form.weightKg}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weightKg: Number(e.target.value),
                      })
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500">Mobile</label>
                <input
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({ ...form, mobile: e.target.value })
                  }
                  className="border rounded px-2 py-1 w-full"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500">Address</label>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="border rounded px-2 py-1 w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500">
                    Emergency contact name
                  </label>
                  <input
                    value={form.emergencyContact?.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        emergencyContact: {
                          ...form.emergencyContact,
                          name: e.target.value,
                        },
                      })
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500">
                    Emergency contact phone
                  </label>
                  <input
                    value={form.emergencyContact?.phone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        emergencyContact: {
                          ...form.emergencyContact,
                          phone: e.target.value,
                        },
                      })
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Email and gender are linked to your account and cannot be
                changed here.
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-2 bg-indigo-600 text-white rounded"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
