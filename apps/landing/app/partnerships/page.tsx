import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import ImageStoryBand from "@/components/ImageStoryBand";
import WorkflowTimeline from "@/components/WorkflowTimeline";

export const metadata = {
  title: "Partner with Ambulant+.",
  description: "Ambulant+ partnership pathways for clinicians, pharmacies, laboratories, employers, schemes, technology partners and community care programmes.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Partnerships"
        title="A partner ecosystem for governed contactless medicine."
        body="Ambulant+ works across the care ecosystem: clinicians, pharmacies, laboratories, employers, medical schemes, technology partners and community care programmes."
        imageSrc="/visuals/partnerships/partner-ecosystem.webp"
        imageAlt="Ambulant+ healthcare partner ecosystem visual"
        primaryCta={{ label: "Start partnership conversation", href: "/contact" }}
        secondaryCta={{ label: "View operations", href: "/operations" }}
        overlayTitle="Partner network"
        overlayItems={[
          { label: "Clinical partners", value: "Consultation, review and care coordination." },
          { label: "Operational partners", value: "Diagnostics, pharmacy and fulfilment workflows." },
          { label: "Programme partners", value: "Employer, scheme and sponsor deployments." },
        ]}
      />

      <ImageStoryBand
        eyebrow="Ecosystem model"
        title="Partnerships are organised around responsibility, not generic access."
        body="Ambulant+ partner pathways are designed around the work each partner is authorised and equipped to perform, with clear boundaries between clinical care, diagnostics, pharmacy fulfilment, logistics and programme reporting."
        imageSrc="/visuals/partnerships/partner-ecosystem.webp"
        imageAlt="Connected partner ecosystem across Ambulant+ modules"
        points={[
          "Clinician partners support governed consultation, documentation and escalation.",
          "Laboratory and phlebotomy partners support MedReach diagnostic workflows.",
          "Pharmacy and delivery partners support CarePort fulfilment and proof-of-delivery.",
          "Employer, scheme and sponsor partners engage through governance-aware programme visibility.",
        ]}
      />

      <WorkflowTimeline
        eyebrow="Partner onboarding"
        title="A structured path from interest to operational readiness."
        steps={[
          { title: "Identify pathway", body: "Clarify whether the partner belongs to clinical, diagnostic, pharmacy, programme, technology or community care workflows." },
          { title: "Define responsibilities", body: "Map operational responsibilities, boundaries, data visibility and escalation obligations." },
          { title: "Configure workspace", body: "Set up the appropriate Ambulant+ workspace, access rules and workflow permissions." },
          { title: "Train teams", body: "Support onboarding, workflow training, quality expectations and support routes." },
          { title: "Operate", body: "Run care pathways with visible status, accountable handoffs and documented activity." },
          { title: "Review", body: "Use governance-aware reporting to improve service delivery and partner performance." },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
