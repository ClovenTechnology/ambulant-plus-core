import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import DeviceShowcase from "@/components/DeviceShowcase";
import WorkflowTimeline from "@/components/WorkflowTimeline";

export const metadata = {
  title: "Device-supported workflows for clinical care beyond the clinic.",
  description: "Ambulant+ supports a defined connected-device ecosystem: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Supported devices"
        title="Device-supported workflows for clinical care beyond the clinic."
        body="Ambulant+ focuses on a defined device ecosystem — Health Monitor, Digital Stethoscope, HD Otoscope and NexRing — each mapped to specific care workflows and clinical boundaries."
        imageSrc="/visuals/devices/device-ecosystem.webp"
        imageAlt="Ambulant+ defined contactless medicine device ecosystem"
        primaryCta={{ label: "Discuss device pathways", href: "/contact" }}
        secondaryCta={{ label: "View clinical workflow", href: "/clinicians" }}
        overlayTitle="Device scope"
        overlayItems={[
          { label: "Health Monitor", value: "Vitals, ECG and multi-parameter review." },
          { label: "Digital Stethoscope", value: "Heart and lung auscultation workflow." },
          { label: "HD Otoscope + NexRing", value: "Image-supported review and longitudinal signals." },
        ]}
      />

      <DeviceShowcase />

      <WorkflowTimeline
        eyebrow="Device workflow"
        title="Signals become useful when the workflow is governed."
        body="Ambulant+ treats device data as structured context for appropriate care workflows, not as standalone automatic diagnosis."
        steps={[
          { title: "Pair", body: "Connect supported devices through approved setup pathways." },
          { title: "Capture", body: "Collect vitals, auscultation, otoscopy or longitudinal signals depending on the device." },
          { title: "Review", body: "Present readings in a structured patient or clinician workspace." },
          { title: "Document", body: "Attach relevant signals to care notes, reports or follow-up actions where appropriate." },
          { title: "Share", body: "Use consent-aware sharing with approved clinicians and care workflows." },
          { title: "Escalate", body: "Direct patients to urgent or in-person care where device-supported remote review is not sufficient." },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
