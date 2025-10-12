"use client";
import { useEffect, useState } from "react";
import ReferralPanelEnhanced from "@/components/SessionConclusions"; // or import separately if modular

export default function Discharge({ encounterId, clinicianId }: { encounterId?: string; clinicianId: string }) {
  const [form, setForm] = useState({
    diagnosis: "",
    plan: "",
    referral: "",
    noteType: "none",
    email: "",
    notes: "",
  });

  // ------------------ Autopopulate from SessionConclusions ------------------
  useEffect(() => {
    if (!encounterId) return;
    try {
      const raw = localStorage.getItem(`sfu-session-conclusions:${encounterId}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as { dxQuery?: string; plan?: string; notes?: string };
      setForm(f => ({
        ...f,
        diagnosis: draft.dxQuery || "",
        plan: draft.plan || "",
        notes: draft.notes || "",
      }));
    } catch {}
  }, [encounterId]);

  // ------------------ Submission / document generation ------------------
  async function submit() {
    // TODO: hook to backend or PDF generator
    if (form.noteType !== "none") {
      // generate Sick Note or Fitness Certificate
      const docTitle = form.noteType === "sick" ? "Sick Note" : "Fitness Certificate";
      const pdfData = `
        ${docTitle}\n
        Patient Notes: ${form.notes}\n
        Diagnosis: ${form.diagnosis}\n
        Plan: ${form.plan}\n
        Referral: ${form.referral}\n
        Clinician ID: ${clinicianId}\n
      `;
      console.log(pdfData);
    }
    alert("Discharge saved and documents generated (stub).");
  }

  return (
    <main className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">Discharge</h2>

      <input
        className="border rounded px-2 py-1 w-full"
        placeholder="Diagnosis"
        value={form.diagnosis}
        onChange={e => setForm({ ...form, diagnosis: e.target.value })}
      />
      <textarea
        className="border rounded px-2 py-1 w-full"
        placeholder="Treatment plan"
        rows={4}
        value={form.plan}
        onChange={e => setForm({ ...form, plan: e.target.value })}
      />
      <input
        className="border rounded px-2 py-1 w-full"
        placeholder="Referral (optional)"
        value={form.referral}
        onChange={e => setForm({ ...form, referral: e.target.value })}
      />

      <select
        className="border rounded px-2 py-1"
        value={form.noteType}
        onChange={e => setForm({ ...form, noteType: e.target.value })}
      >
        <option value="none">No note</option>
        <option value="sick">Sick Note</option>
        <option value="fitness">Fitness Certificate</option>
      </select>

      <input
        className="border rounded px-2 py-1 w-full"
        placeholder="Send securely to email (employer/insurer)"
        value={form.email}
        onChange={e => setForm({ ...form, email: e.target.value })}
      />
      <textarea
        className="border rounded px-2 py-1 w-full"
        placeholder="Additional notes"
        rows={3}
        value={form.notes}
        onChange={e => setForm({ ...form, notes: e.target.value })}
      />

      {/* Internal / External referral */}
      <ReferralPanelEnhanced clinicianId={clinicianId} />

      <button onClick={submit} className="border rounded px-3 py-2">
        Save & Send
      </button>
    </main>
  );
}
