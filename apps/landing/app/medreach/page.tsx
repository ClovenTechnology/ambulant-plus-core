import CTA from "@/components/CTA";
import ImageStoryBand from "@/components/ImageStoryBand";
import VisualHero from "@/components/VisualHero";
import WorkflowTimeline from "@/components/WorkflowTimeline";

const workflow = [
  { title: "Request", body: "A diagnostic request is initiated through the appropriate Ambulant+ pathway or care programme." },
  { title: "Schedule", body: "The patient is scheduled for a suitable home blood draw or sample-collection appointment." },
  { title: "Collect", body: "The phlebotomy workflow supports patient verification, specimen labelling and collection readiness." },
  { title: "Secure", body: "Specimens move through traceable chain-of-custody and transport-preparation steps." },
  { title: "Handover", body: "Laboratory partners receive the specimen with operational visibility across status and accountability." },
  { title: "Route result", body: "Result readiness and routing can support clinician review and patient-facing care continuity." },
];

export const metadata = {
  title: "The diagnostics operations layer for contactless medicine.",
  description: "Diagnostics operations for home phlebotomy, specimen collection, laboratory coordination and result-routing workflows.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="MedReach"
        title="The diagnostics operations layer for contactless medicine."
        body="MedReach coordinates home phlebotomy, specimen collection, laboratory handover, processing visibility and result-routing workflows across the Ambulant+ ecosystem."
        imageSrc="/visuals/medreach/medreach-home-draw.webp"
        imageAlt="MedReach phlebotomist performing a home blood draw in a patient home"
        imagePosition="center"
        actions={[
          { label: "Explore MedReach", href: "/contact" },
          { label: "View operations", href: "/operations", variant: "secondary" },
        ]}
        statusItems={[
          { label: "Home draw", value: "Patient verification, specimen labelling and collection support." },
          { label: "Lab handover", value: "Laboratory coordination and processing visibility." },
          { label: "Governance", value: "Traceability across collection, transport and result routing." },
        ]}
      >
        <div className="rounded-[28px] border border-cyan-200/30 bg-slate-950/72 p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">Diagnostic workflow</div>
          <div className="mt-4 grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Patient verified</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Specimens labelled</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Chain-of-custody secured</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Laboratory handover visible</div>
          </div>
        </div>
      </VisualHero>

      <WorkflowTimeline
        eyebrow="Operational model"
        title="A diagnostic journey built around traceability."
        body="MedReach is not a generic outreach page. It is the operational layer for home diagnostics: request, collection, custody, laboratory handover and result-routing visibility."
        steps={workflow}
      />

      <ImageStoryBand
        eyebrow="Specimen logistics"
        title="From patient home to laboratory handover."
        body="MedReach supports the real-world movement of specimens with transport readiness, custody visibility and laboratory coordination."
        imageSrc="/visuals/medreach/medreach-specimen-transport.webp"
        imageAlt="MedReach specimen transport workflow to laboratory partner"
        imageSide="right"
        imagePosition="center"
        points={[
          "Specimen transport should remain separate from CarePort medicine delivery in public language.",
          "The workflow centres on chain-of-custody, transport stability and laboratory handover.",
          "Result-routing language remains governance-aware and clinician-review aligned.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
