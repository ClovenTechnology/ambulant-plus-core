import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import CommandDashboard from "@/components/CommandDashboard";
import WorkflowTimeline from "@/components/WorkflowTimeline";

export const metadata = {
  title: "Operational command for contactless medicine.",
  description: "Ambulant+ coordinates clinical operations, diagnostics, pharmacy fulfilment, onboarding, support and governance workflows.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Operations"
        title="Operational command for care beyond the walls of the clinic."
        body="Ambulant+ is designed to coordinate the real-world movement behind contactless medicine: clinical review, home diagnostics, pharmacy fulfilment, onboarding, support and governance escalation."
        imageSrc="/visuals/operations/operations-command-centre.webp"
        imageAlt="Ambulant+ healthcare operations command centre"
        primaryCta={{ label: "Discuss operations", href: "/contact" }}
        secondaryCta={{ label: "View partnerships", href: "/partnerships" }}
        overlayTitle="Operations layer"
        overlayItems={[
          { label: "Clinical operations", value: "Consults, follow-up and escalation." },
          { label: "Diagnostics operations", value: "Home phlebotomy and laboratory coordination." },
          { label: "Fulfilment operations", value: "Pharmacy dispatch and proof-of-delivery." },
        ]}
      />

      <CommandDashboard
        eyebrow="Command model"
        title="Coordinated healthcare operations need governed visibility."
        body="Ambulant+ gives programme and operational teams a structured way to understand work in motion without collapsing clinical, diagnostic, pharmacy and administrative responsibilities into one unsafe view."
        metrics={[
          { value: "Clinical", label: "Consultation, notes, follow-up and escalation" },
          { value: "Diagnostic", label: "Collection, transport, laboratory handover and result routing" },
          { value: "Fulfilment", label: "Prescription, pharmacy preparation, delivery and completion" },
        ]}
        rows={[
          { title: "Clinical operations", body: "Support care access, virtual review, documentation, safety-netting and escalation pathways." },
          { title: "Diagnostics operations", body: "Coordinate home phlebotomy, specimen traceability, laboratory handover and result workflow visibility." },
          { title: "Pharmacy operations", body: "Coordinate dispensing readiness, rider handover, delivery progress and proof-of-delivery records." },
          { title: "Training and onboarding", body: "Support structured onboarding for clinicians, partners and operational teams with clear workspace responsibilities." },
        ]}
      />

      <WorkflowTimeline
        eyebrow="Operating rhythm"
        title="From request to resolved workflow."
        body="Operational excellence comes from disciplined handoffs, visible status and clear accountability."
        steps={[
          { title: "Request", body: "The patient, clinician, partner or programme initiates a role-appropriate action." },
          { title: "Route", body: "Ambulant+ directs the action into the correct protected workspace and operational lane." },
          { title: "Assign", body: "Clinicians, phlebotomists, pharmacies, delivery teams or administrators receive the relevant task." },
          { title: "Execute", body: "The workflow proceeds with status visibility, consent boundaries and operational traceability." },
          { title: "Document", body: "Relevant notes, proof, reports, handovers or follow-up instructions are captured." },
          { title: "Resolve", body: "The care pathway closes, escalates or transitions into a new governed action." },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
