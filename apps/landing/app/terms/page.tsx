export const metadata = {
  title: "Terms & Conditions",
  description: "Ambulant+ terms and conditions.",
};

const sections = [
  ["Acceptance", "By accessing Ambulant+ websites or applications, users agree to comply with these Terms and any additional app-specific terms presented in the relevant workspace."],
  ["Not emergency care", "Ambulant+ is not an emergency service. Users must contact local emergency services immediately in an emergency."],
  ["Clinical limitations", "Ambulant+ supports connected-care workflows but does not replace professional clinical judgement, diagnosis, emergency treatment or in-person care where clinically required."],
  ["Accounts", "Users are responsible for keeping account credentials secure and for ensuring that information supplied to the platform is accurate and current."],
  ["Payments", "Where payments are available, fees, deposits, refunds and payment-provider terms may apply according to the specific service, jurisdiction and checkout flow."],
  ["Acceptable use", "Users must not misuse the platform, attempt unauthorised access, upload harmful content, interfere with service operation or use the platform unlawfully."],
  ["Third parties", "Ambulant+ may integrate with payment providers, device workflows, communication providers, pharmacies, delivery partners or other services subject to their own terms."],
  ["Intellectual property", "Ambulant+ branding, software, interface patterns and content are protected and may not be copied or reused without permission."],
  ["Disclaimers", "The platform is provided subject to availability, operational constraints, clinical limitations and applicable legal requirements."],
  ["Changes", "Ambulant+ may update these Terms from time to time. Continued use after publication of changes may constitute acceptance."]
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Legal</div>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Terms & Conditions</h1>
      <p className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
        Draft template for legal review. Adapt for your operating company, market, payment rules and clinical service model.
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
