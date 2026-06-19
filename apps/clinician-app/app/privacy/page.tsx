export const metadata = {
  title: 'Ambulant+ Clinician Privacy Policy',
};

export default function ClinicianPrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">Clinician Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600">Ambulant+ Clinician Network - Last updated: 19 June 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">1) Who we are</h2>
            <p>This Privacy Policy explains how Ambulant+ and its affiliated entities collect, use, disclose, transfer, store and protect clinician information submitted through clinician onboarding, training, verification and platform use.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">2) Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Identity and contact details, including name, email, phone number, date of birth and citizenship details.</li>
              <li>Professional credentials, including HPCSA registration, qualifications, practice address, BHF/PCNS details where supplied and professional indemnity details.</li>
              <li>Uploaded documents used for verification, including registration evidence and optional practice billing credential evidence.</li>
              <li>Training, certification, device readiness, starter-kit dispatch and operational activity records.</li>
              <li>Technical usage, security, audit and session metadata needed to operate and protect the platform.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">3) How we use information</h2>
            <p>We use clinician information for onboarding, verification, patient-facing directory readiness, clinical safety, regulatory governance, platform security, training, communications, payments, dispatch operations, audit trails and fraud prevention.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">4) Credential documents</h2>
            <p>Uploaded professional or practice-credential documents are used for administrative and compliance review. They are not intended for public display and should be accessible only to authorised operational and compliance personnel.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">5) Patient-facing visibility</h2>
            <p>Only selected public profile information should be displayed to patients after approval. Sensitive onboarding documents, identity documents and indemnity details are not intended for patient-facing publication.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">6) Security and retention</h2>
            <p>We use administrative, technical and operational safeguards including access control, encryption where appropriate, audit logging and secure operational review. Clinician records may be retained for legal, clinical governance, audit, safety and operational purposes.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">7) Your rights and contact</h2>
            <p>You may request access, correction or updates to clinician information where permitted by law and platform policy. For privacy questions, contact privacy@cloventechnology.com.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
