import CTA from "@/components/CTA";
import ImageStoryBand from "@/components/ImageStoryBand";
import VisualHero from "@/components/VisualHero";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import { site } from "@/lib/site";

const patientPathways = [
  { title: "Vitals", body: "Patients can access supported vital-sign workflows and connected-device pathways where enabled." },
  { title: "Bookings", body: "Consultation, home diagnostics and care-programme actions can be surfaced through one patient workspace." },
  { title: "Medication", body: "Medication reminders and fulfilment visibility support continuity without replacing pharmacy or clinician advice." },
  { title: "Reports", body: "Reports, lab status and care documents can be organised for clearer follow-up and review." },
  { title: "Care network", body: "Consent-aware sharing supports appropriate clinician, partner and care-team access." },
  { title: "Boundaries", body: "The patient app supports care coordination but does not replace emergency services or professional judgement." },
];

export const metadata = {
  title: "A protected health workspace for connected care.",
  description: "Patients can access vitals, medication, appointments, reports, device-supported checks and care-network actions from one protected workspace.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Patient app"
        title="A protected health workspace for connected care."
        body="The Ambulant+ patient app brings vitals, appointments, medication, reports, device-supported checks and care-network actions into one protected patient workspace."
        imageSrc="/visuals/patients/ami-care-companion.webp"
        imageAlt="Ami Ambulant+ care companion guiding a patient through connected care actions"
        imagePosition="center"
        actions={[
          { label: "Access Patient App", href: site.patientAppUrl, external: true },
          { label: "Explore bookings", href: "/bookings", variant: "secondary" },
        ]}
        statusItems={[
          { label: "Ami", value: "A care companion for navigation, not a replacement for clinicians." },
          { label: "Devices", value: "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows." },
          { label: "Continuity", value: "Appointments, reports, medication and care-network actions." },
        ]}
      >
        <div className="rounded-[28px] border border-cyan-200/30 bg-slate-950/72 p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">Patient journey</div>
          <div className="mt-4 grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Vitals check</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Medication reminder</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Lab status ready</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">Consultation booked</div>
          </div>
        </div>
      </VisualHero>

      <WorkflowTimeline
        eyebrow="Patient experience"
        title="A clear route through connected care."
        body="The patient workspace should feel calm, guided and secure — helping patients understand their next action without turning the app into clinical automation."
        steps={patientPathways}
      />

      <ImageStoryBand
        eyebrow="Care companion"
        title="Ami helps patients navigate the ecosystem."
        body="Ami can support education, reminders and care-navigation prompts while preserving clear boundaries around clinical judgement, emergency care and professional review."
        imageSrc="/visuals/patients/ami-care-companion.webp"
        imageAlt="Ami Ambulant+ care companion in a futuristic patient workspace"
        imageSide="right"
        imagePosition="center"
        points={[
          "Guides patients through bookings, reports, medication reminders and device-supported actions.",
          "Keeps sensitive health workflows inside protected, consent-aware platform boundaries.",
          "Does not diagnose, prescribe or replace a qualified clinician.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
