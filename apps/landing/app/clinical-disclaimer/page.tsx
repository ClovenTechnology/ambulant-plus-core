export const metadata = {
  title: "Clinical safety and care boundaries.",
  description: "Ambulant+ clinical disclaimer and care-boundary statement.",
};

const sections = [
  ["No emergency service", "Ambulant+ is not an emergency service. In a medical emergency, users must contact local emergency services immediately."],
  ["No automatic diagnosis", "Device readings, symptom inputs, adherence signals, reports and platform insights are informational and workflow-supportive unless reviewed by an authorised clinician."],
  ["Clinician judgement remains essential", "Clinical decisions should be made by qualified healthcare professionals using full clinical context, examination where required, local protocols and professional judgement."],
  ["Remote-care limits", "Virtual and contactless workflows may be unsuitable for some symptoms, conditions or emergencies. Users may be directed to in-person, urgent or emergency care."],
  ["Device limitations", "Connected devices may have measurement limitations, user-operation issues, connectivity failures or regulatory constraints. Device data should be interpreted carefully."],
  ["Medication safety", "Medication reminders and adherence tools do not replace professional medication review, pharmacy advice, emergency care or urgent clinical assessment."],
];

export default function ClinicalDisclaimerPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Clinical safety</div>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Clinical safety and care boundaries.</h1>
      <p className="mt-6 text-lg leading-9 text-slate-600">
        Ambulant+ supports contactless care workflows, connected-device review, care coordination and operational visibility. It does not replace emergency services, professional clinical judgement, urgent in-person assessment or regulated clinical responsibility.
      </p>
      <div className="mt-8 grid gap-4">
        {sections.map(([title, body]) => (
          <section key={title} className="glass-panel rounded-[28px] p-6">
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-8 text-slate-600">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
