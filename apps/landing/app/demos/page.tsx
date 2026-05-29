import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import ImageStoryBand from "@/components/ImageStoryBand";

export const metadata = {
  title: "Request an Ambulant+ platform walkthrough.",
  description: "Structured enterprise demos for Ambulant+ patient, clinician, MedReach, CarePort, InsightCore and admin workflows.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Demos"
        title="Request a structured platform walkthrough."
        body="Ambulant+ demos should be organised around the workflow you need to understand: patient access, clinician review, home diagnostics, pharmacy fulfilment, programme intelligence or governance administration."
        imageSrc="/visuals/demos/platform-demo-suite.webp"
        imageAlt="Ambulant+ enterprise platform demo suite"
        primaryCta={{ label: "Request demo", href: "/contact" }}
        secondaryCta={{ label: "Explore platform", href: "/platform" }}
        overlayTitle="Demo suite"
        overlayItems={[
          { label: "Patient + clinician", value: "Connected care journey walkthrough." },
          { label: "MedReach + CarePort", value: "Diagnostics and fulfilment operations." },
          { label: "InsightCore + admin", value: "Programme intelligence and governance controls." },
        ]}
      />

      <WorkflowTimeline
        eyebrow="Demo structure"
        title="Walk through the platform by role and outcome."
        steps={[
          { title: "Define audience", body: "Clarify whether the demo is for clinicians, pharmacies, laboratories, employers, schemes or internal programme teams." },
          { title: "Select workflow", body: "Choose the modules and operational pathways that matter most for the session." },
          { title: "Map use case", body: "Anchor the walkthrough in a real pathway such as virtual consultation, home diagnostics or medicine delivery." },
          { title: "Review governance", body: "Show access boundaries, clinical disclaimers, reporting limits and operational controls." },
          { title: "Discuss deployment", body: "Identify partner requirements, configuration needs and onboarding steps." },
          { title: "Agree next steps", body: "Close with a focused action plan rather than an unfocused product tour." },
        ]}
      />

      <ImageStoryBand
        eyebrow="Enterprise walkthrough"
        title="Product demos should feel like implementation planning."
        body="The goal is not to click through screens casually. The goal is to help serious stakeholders understand how Ambulant+ would operate inside a governed healthcare environment."
        imageSrc="/visuals/demos/platform-demo-suite.webp"
        imageAlt="Ambulant+ product demo suite with multiple platform modules"
        points={[
          "Patient, clinician, MedReach, CarePort, InsightCore and admin workflows can be demonstrated separately or together.",
          "Each walkthrough should include the relevant clinical, operational, security and governance boundaries.",
          "Demo sessions can be tailored to partner type, use case and deployment maturity.",
        ]}
        reverse
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
