import CTA from "@/components/CTA";
import ComplianceBadge from "@/components/ComplianceBadge";
import ImageStoryBand from "@/components/ImageStoryBand";
import VisualHero from "@/components/VisualHero";
import { complianceNotice } from "@/lib/site";

export const metadata = {
  title: "Built for responsible healthcare deployment.",
  description: "Ambulant+ compliance, privacy, security, clinical safety and regulatory-positioning statement.",
};

const statements = [
  {
    title: "POPIA and GDPR-aligned privacy posture",
    body: "Ambulant+ is designed to support privacy principles such as purpose limitation, data minimisation, appropriate access controls, user rights workflows and consent-aware sharing. Final compliance depends on operating entity, policies, contracts and deployment configuration."
  },
  {
    title: "HIPAA-aware architecture",
    body: "Ambulant+ can support healthcare privacy and security workflows relevant to HIPAA-style environments. HIPAA obligations depend on entity status, deployment model and contractual context."
  },
  {
    title: "Medical-device regulatory caution",
    body: "Device regulatory status depends on the specific device, manufacturer, country, intended use and applicable conformity pathway. Ambulant+ should not be described as SAHPRA-approved, FDA-cleared, CE-certified or TÜV-certified unless official documentation confirms that claim."
  },
  {
    title: "Clinical safety boundaries",
    body: "Ambulant+ supports connected-care workflows but does not replace emergency care, in-person examination where clinically required, or professional clinical judgement."
  },
  {
    title: "Security governance",
    body: "The platform is structured around protected workspaces, role-aware access, auditability, environment-specific configuration and responsible data handling."
  },
  {
    title: "Marketing claim control",
    body: "Public materials should use careful language such as designed to support, aligned with and built for unless formal approval, certification or clearance has been verified."
  }
];

export default function CompliancePage() {
  return (
    <main>
      <VisualHero
        eyebrow="Compliance"
        title="Built for responsible healthcare deployment."
        body={complianceNotice}
        imageSrc="/visuals/compliance/compliance-governance.webp"
        imageAlt="Ambulant+ healthcare compliance and governance framework"
        primaryCta={{ label: "Discuss compliance", href: "/contact" }}
        secondaryCta={{ label: "View clinical boundaries", href: "/clinical-disclaimer" }}
        overlayTitle="Governance posture"
        overlayItems={[
          { label: "Privacy principles", value: "Purpose limitation, minimisation and user rights." },
          { label: "Clinical boundaries", value: "Professional judgement and emergency-care limits." },
          { label: "Claim discipline", value: "No unverified approval or certification claims." },
        ]}
      />

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-3">
        {statements.map((item) => <ComplianceBadge key={item.title} title={item.title} body={item.body} />)}
      </section>

      <ImageStoryBand
        eyebrow="Governance discipline"
        title="Careful language is part of healthcare safety."
        body="Ambulant+ should be described with precise, non-overclaiming language across privacy, device status, clinical workflow and deployment-readiness contexts."
        imageSrc="/visuals/compliance/compliance-governance.webp"
        imageAlt="Governance framework for privacy security clinical safety and regulatory caution"
        points={[
          "Do not claim certification, clearance or approval unless verified by official documentation.",
          "Separate product workflow support from clinical diagnosis, emergency response and regulated device claims.",
          "Treat jurisdiction, deployment model, contracts and operating entity as part of compliance readiness.",
        ]}
        reverse
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
