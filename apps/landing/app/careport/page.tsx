import CTA from "@/components/CTA";
import ImageStoryBand from "@/components/ImageStoryBand";
import VisualHero from "@/components/VisualHero";
import WorkflowTimeline from "@/components/WorkflowTimeline";

const workflow = [
  { title: "Prescription", body: "A medicine request or prescription-linked fulfilment action enters the CarePort pathway." },
  { title: "Pharmacy", body: "The pharmacy prepares the order and confirms fulfilment readiness for dispatch." },
  { title: "Handover", body: "The rider receives the package through a structured handover workflow." },
  { title: "En route", body: "Delivery progress can be surfaced to the patient and operational teams." },
  { title: "Delivery", body: "Patient handover and proof-of-delivery complete the fulfilment event." },
  { title: "Audit", body: "Fulfilment records support accountability across pharmacy, rider and care-programme operations." },
];

export const metadata = {
  title: "The pharmacy fulfilment layer for contactless medicine.",
  description: "CarePort coordinates pharmacy fulfilment, delivery-rider workflow, patient updates and proof-of-delivery visibility.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="CarePort"
        title="The pharmacy fulfilment layer for contactless medicine."
        body="CarePort connects pharmacies, dispatch teams and delivery riders into a governed workflow for medicine fulfilment, handover, delivery tracking and proof-of-delivery."
        imageSrc="/visuals/careport/careport-erx-delivery.webp"
        imageAlt="CarePort rider delivering medication to a patient at home"
        imagePosition="center"
        actions={[
          { label: "Explore CarePort", href: "/contact" },
          { label: "View use cases", href: "/use-cases", variant: "secondary" },
        ]}
        statusItems={[
          { label: "Pharmacy", value: "Order handling, preparation and dispatch readiness." },
          { label: "Rider", value: "Handover, route progress and delivery completion." },
          { label: "Patient", value: "Medicine continuity with operational visibility." },
        ]}
      >
        <div className="rounded-[28px] border border-cyan-200/30 bg-slate-950/72 p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">Fulfilment status</div>
          <div className="mt-4 grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Prescription confirmed</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Pharmacy prepared</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Rider assigned</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Proof-of-delivery captured</div>
          </div>
        </div>
      </VisualHero>

      <WorkflowTimeline
        eyebrow="Fulfilment model"
        title="Medicine continuity with operational proof."
        body="CarePort is built around accountable fulfilment: pharmacy action, rider handover, patient delivery and traceable completion."
        steps={workflow}
      />

      <ImageStoryBand
        eyebrow="Pharmacy handover"
        title="From pharmacy preparation to rider dispatch."
        body="CarePort gives pharmacy and delivery operations a shared fulfilment language, so medicine movement is visible without turning clinical care into ordinary parcel logistics."
        imageSrc="/visuals/careport/careport-pharmacy-pickup.webp"
        imageAlt="CarePort rider receiving medication from Totli Pharmacy"
        imageSide="left"
        imagePosition="center"
        points={[
          "Pharmacy-focused order handling, preparation and dispatch readiness.",
          "Delivery-rider workflows for handover, patient updates and route progression.",
          "Proof-of-delivery and fulfilment visibility for accountable medicine continuity.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
