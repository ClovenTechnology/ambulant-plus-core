import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import PlatformEcosystem from "@/components/PlatformEcosystem";
import ImageStoryBand from "@/components/ImageStoryBand";

export const metadata = {
  title: "Contactless medicine platform architecture.",
  description: "Ambulant+ unifies patients, clinicians, connected devices, MedReach, CarePort, InsightCore and governance workflows through one operating layer.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Platform"
        title="One operating layer for the contactless medicine ecosystem."
        body="Ambulant+ connects patient access, clinician workflows, connected clinical devices, home diagnostics, pharmacy fulfilment, programme intelligence and governance controls into one disciplined healthcare infrastructure."
        imageSrc="/visuals/platform/platform-architecture.webp"
        imageAlt="Ambulant+ contactless medicine platform architecture"
        primaryCta={{ label: "Explore use cases", href: "/use-cases" }}
        secondaryCta={{ label: "Speak to Ambulant+", href: "/contact" }}
        overlayTitle="Ecosystem modules"
        overlayItems={[
          { label: "Patient + clinician workspaces", value: "Role-based access to care workflows." },
          { label: "MedReach + CarePort", value: "Diagnostics and pharmacy fulfilment operations." },
          { label: "InsightCore + governance", value: "Programme visibility and operational controls." },
        ]}
      />

      <PlatformEcosystem />

      <ImageStoryBand
        eyebrow="Architecture discipline"
        title="Built as infrastructure, not a disconnected app collection."
        body="The platform separates public information from protected workspaces while keeping operational pathways connected across clinical review, diagnostics, fulfilment, programme visibility and administration."
        imageSrc="/visuals/platform/platform-architecture.webp"
        imageAlt="Connected Ambulant+ platform modules"
        points={[
          "Patients, clinicians, pharmacies, laboratories, clients and administrators enter role-appropriate workspaces.",
          "MedReach and CarePort remain separate operational layers for diagnostics and medicine fulfilment.",
          "InsightCore supports aggregate intelligence without weakening patient trust or governance boundaries.",
        ]}
        reverse
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
