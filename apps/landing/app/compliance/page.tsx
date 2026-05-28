import ComplianceBadge from "@/components/ComplianceBadge";
import CTA from "@/components/CTA";
import { complianceNotice } from "@/lib/site";

export const metadata = {
  title: "Built for responsible healthcare deployment.",
  description: "Ambulant+ compliance, privacy, clinical-safety and regulatory-positioning statement.",
};

const statements = [
  {
    title: "POPIA and GDPR-aligned privacy posture",
    body: "Ambulant+ is designed to support privacy principles including purpose limitation, data minimisation, appropriate access controls, user-rights workflows and consent-aware sharing. Final compliance depends on the operating entity, policies, contracts and deployment configuration.",
  },
  {
    title: "HIPAA-aware architecture",
    body: "Ambulant+ can support healthcare privacy and security workflows relevant to HIPAA-style environments. HIPAA obligations depend on covered-entity or business-associate status, deployment context and contractual controls.",
  },
  {
    title: "Medical-device regulatory caution",
    body: "Device regulatory status depends on the device, manufacturer, country, intended use and conformity pathway. Ambulant+ should not be described as SAHPRA-approved, FDA-cleared, CE-certified or TÜV-certified unless official documentation confirms that claim.",
  },
  {
    title: "Clinical safety boundaries",
    body: "Ambulant+ supports connected-care workflows but does not replace emergency care, in-person assessment where clinically required, or professional clinical judgement.",
  },
  {
    title: "Security governance",
    body: "The platform is structured around protected workspaces, role-aware access, auditability, environment-specific configuration and responsible data handling.",
  },
  {
    title: "Marketing claim control",
    body: "Public materials should use careful language such as designed to support, aligned with and built for unless approval, certification or clearance has been verified for the exact module, market and intended use.",
  },
];

export default function CompliancePage() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 py-14 md:px-6 md:py-20">
        <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Compliance</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Built for responsible healthcare deployment.</h1>
        <p className="mt-6 text-lg leading-9 text-slate-600">{complianceNotice}</p>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-16 md:grid-cols-2 md:px-6 lg:grid-cols-3">
        {statements.map((item) => <ComplianceBadge key={item.title} title={item.title} body={item.body} />)}
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
