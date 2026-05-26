export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Ambulant+.",
};

const faqs = [
  ["What is Ambulant+?", "Ambulant+ is a connected-care platform for contactless medicine, patient access, clinician workflows, medication continuity, device-supported virtual care and programme operations."],
  ["Is Ambulant+ an emergency service?", "No. Ambulant+ is not an emergency service. In a medical emergency, users should contact local emergency services immediately."],
  ["Which apps will sit under the Ambulant+ domain?", "Recommended subdomains include patient.ambulantplus.co.za, clinician.ambulantplus.co.za, careport.ambulantplus.co.za, medreach.ambulantplus.co.za, clients.ambulantplus.co.za and admin.ambulantplus.co.za."],
  ["Does Ambulant+ replace a doctor?", "No. Ambulant+ supports care coordination and connected-care workflows. It does not replace professional clinical judgement or in-person examination when clinically required."],
  ["Does Ambulant+ claim regulatory approval?", "No public claim of SAHPRA, FDA, CE, TÜV or other approval should be made unless official documentation confirms it for the exact product, device, module and market."],
  ["Can patients use connected devices?", "Ambulant+ is designed around supported connected-care devices including Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows."],
  ["Can medical aids or employers see patient data?", "Data sharing should be permission-aware and governed by purpose, role and applicable law. The platform should avoid inappropriate patient-level disclosure."],
  ["Where should a visitor go first?", "General visitors can start on ambulantplus.co.za. Patients and operational users should be routed into the correct protected app workspace."]
];

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 md:px-6 md:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">FAQ</div>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Frequently asked questions.</h1>
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
