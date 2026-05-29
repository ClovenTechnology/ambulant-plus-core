import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import CommandDashboard from "@/components/CommandDashboard";
import WorkflowTimeline from "@/components/WorkflowTimeline";

export const metadata = {
  title: "Governed clinical workspace for contactless care.",
  description: "Clinicians can coordinate virtual care, review connected-device signals, document encounters and escalate through governed Ambulant+ workflows.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Clinician app"
        title="A governed clinical workspace for contactless care."
        body="The Ambulant+ clinician workspace supports virtual consultation, connected-device review, care documentation, follow-up planning and escalation within a role-based clinical environment."
        imageSrc="/visuals/clinicians/clinician-command-workspace.webp"
        imageAlt="Clinician reviewing contactless medicine consultation data in an Ambulant+ command workspace"
        primaryCta={{ label: "Request clinician access", href: "/contact" }}
        secondaryCta={{ label: "View device pathways", href: "/devices" }}
        overlayTitle="Clinical command layer"
        overlayItems={[
          { label: "Device-supported review", value: "Vitals, ECG, auscultation and otoscopy context." },
          { label: "Clinical documentation", value: "Notes, follow-up actions and care-team visibility." },
          { label: "Escalation pathway", value: "Clear boundaries for urgent and in-person care." },
        ]}
      />

      <CommandDashboard
        eyebrow="Clinical governance"
        title="Remote workflow without removing clinical responsibility."
        body="Ambulant+ is designed to help clinicians operate with more context, stronger workflow visibility and clearer escalation boundaries — not to replace professional judgement."
        metrics={[
          { value: "Role", label: "Access aligned to authorisation and responsibility" },
          { value: "Context", label: "Device signals reviewed with clinical judgement" },
          { value: "Audit", label: "Documentation and workflow visibility" },
        ]}
        rows={[
          { title: "Role-based patient access", body: "Patient information is surfaced according to authorisation, consent and clinical responsibility rather than open workspace visibility." },
          { title: "Device-supported consultation context", body: "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows provide structured signals for clinician review." },
          { title: "Follow-up and escalation", body: "Consultations can be connected to care-team communication, documented follow-up plans and clear escalation language." },
        ]}
      />

      <WorkflowTimeline
        eyebrow="Consultation flow"
        title="From patient context to accountable follow-up."
        body="The clinician experience is structured around review, documentation and safe next steps."
        steps={[
          { title: "Review context", body: "Open the patient workspace with role-appropriate access to history, reports, risk notes and care activity." },
          { title: "Assess signals", body: "Review supported device data and patient-provided information as clinical context, not as automated diagnosis." },
          { title: "Consult", body: "Conduct the virtual or contactless-care encounter within a governed workflow." },
          { title: "Document", body: "Record notes, decisions, safety-netting, follow-up requirements and escalation instructions." },
          { title: "Coordinate", body: "Connect diagnostics, pharmacy fulfilment, care teams or programme workflows where appropriate." },
          { title: "Escalate", body: "Direct patients to urgent, emergency or in-person care when remote care is unsuitable." },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
