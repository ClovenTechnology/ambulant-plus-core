export const metadata = {
  title: 'Ambulant+ Clinician Terms of Use',
};

export default function ClinicianTermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Clinician Terms of Use</h1>
        <p className="mt-2 text-sm text-slate-600">Ambulant+ Clinician Network - Last updated: 19 June 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">1) Professional responsibility</h2>
            <p>Clinicians remain responsible for practicing within their registration, competence, scope of work, indemnity position and applicable professional rules.</p>
            <p>Ambulant+ is a healthcare technology platform and does not replace the clinician's independent professional judgement.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">2) Verification and patient visibility</h2>
            <p>Ambulant+ may require identity checks, HPCSA verification, professional indemnity review, training completion, starter-kit readiness and admin certification before patient-facing visibility is enabled.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">3) Clinical safety</h2>
            <p>Clinicians must escalate emergencies, decline unsuitable remote consultations, document decisions accurately and use IoMT data as supportive clinical information rather than a substitute for clinical judgement.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">4) Platform conduct</h2>
            <p>Clinicians must not misuse patient data, share access credentials, bypass platform workflows, submit false credentials, or represent themselves as approved before certification is complete.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">5) Training, devices and starter kit</h2>
            <p>Training, payment, device readiness and starter-kit dispatch may be required before operational activation. Ambulant+ may suspend visibility where required documents, training or compliance details expire.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">6) Updates</h2>
            <p>These terms may be updated as Ambulant+ expands clinical, compliance, payment, training and operational workflows.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
