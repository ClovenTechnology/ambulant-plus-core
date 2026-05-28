export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Ambulant+ contactless medicine infrastructure.",
};

const faqs = [
  ["What is Ambulant+?", "Ambulant+ is the operating layer for contactless medicine, connecting patients, clinicians, connected clinical devices, home diagnostics, pharmacy fulfilment, care logistics and programme intelligence through governed digital infrastructure."],
  ["What is contactless medicine?", "Contactless medicine describes care workflows that reduce unnecessary facility visits by combining virtual consultation, connected clinical devices, home-based services, diagnostics coordination and accountable care logistics."],
  ["Is Ambulant+ an emergency service?", "No. Ambulant+ is not an emergency service. In a medical emergency, users should contact local emergency services immediately."],
  ["What is MedReach?", "MedReach is the Ambulant+ diagnostics operations layer for home phlebotomy, specimen collection, laboratory coordination and result-routing workflows."],
  ["What is CarePort?", "CarePort is the Ambulant+ pharmacy fulfilment layer for medicine coordination, dispatch, delivery-rider workflow and proof-of-delivery visibility."],
  ["What is InsightCore?", "InsightCore is the Ambulant+ intelligence layer for programme visibility, operational reporting, service utilisation and governance-aware analytics."],
  ["Does Ambulant+ replace a doctor?", "No. Ambulant+ supports care coordination and connected-care workflows. It does not replace professional clinical judgement or in-person examination when clinically required."],
  ["Which devices are supported?", "Ambulant+ is designed around a defined connected-device ecosystem: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing."],
  ["Can employers or schemes see patient data?", "Data sharing should be permission-aware and governed by purpose, role and applicable law. The platform should avoid inappropriate patient-level disclosure."],
  ["Does Ambulant+ claim regulatory approval?", "No public claim of SAHPRA, FDA, CE, TÜV or other approval should be made unless official documentation confirms it for the exact product, device, module and market."],
  ["How do users access the different workspaces?", "Users are directed to the appropriate protected workspace based on their role, such as patient, clinician, pharmacy, delivery, diagnostics, client or administrative access."],
];

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 md:px-6 md:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">FAQ</div>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Frequently asked questions.</h1>
      <p className="mt-6 text-lg leading-9 text-slate-600">
        Direct answers for patients, clinicians, partners and organisations evaluating Ambulant+ contactless medicine infrastructure.
      </p>
      <div className="mt-10 grid gap-4">
        {faqs.map(([q, a]) => (
          <div key={q} className="glass-panel rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-slate-950">{q}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
