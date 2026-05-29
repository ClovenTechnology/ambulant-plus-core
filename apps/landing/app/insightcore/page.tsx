import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import CommandDashboard from "@/components/CommandDashboard";
import ImageStoryBand from "@/components/ImageStoryBand";

export const metadata = {
  title: "Governance-aware intelligence for programme visibility.",
  description: "InsightCore supports aggregated programme reporting, operational visibility, service utilisation and governance-aware analytics across Ambulant+ workflows.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="InsightCore"
        title="Governance-aware intelligence for connected care programmes."
        body="InsightCore is the Ambulant+ intelligence layer for aggregated programme visibility, operational reporting, service utilisation, workflow performance and governance-aware analytics."
        imageSrc="/visuals/insightcore/insightcore-dashboard.webp"
        imageAlt="InsightCore aggregated healthcare programme dashboard"
        primaryCta={{ label: "Discuss InsightCore", href: "/contact" }}
        secondaryCta={{ label: "View client programmes", href: "/clients" }}
        overlayTitle="Intelligence boundary"
        overlayItems={[
          { label: "Aggregated visibility", value: "Programme trends without inappropriate exposure." },
          { label: "Operational throughput", value: "Diagnostics, pharmacy and care-workflow performance." },
          { label: "Governance-aware reporting", value: "Role-bound views and careful data boundaries." },
        ]}
      />

      <CommandDashboard
        eyebrow="Programme intelligence"
        title="See performance without compromising patient trust."
        body="InsightCore helps programme teams understand utilisation, throughput, gaps and care-pathway performance while preserving appropriate access boundaries."
        metrics={[
          { value: "Aggregate", label: "Programme-level reporting model" },
          { value: "Bounded", label: "Role-aware visibility and governance" },
          { value: "Actionable", label: "Operational bottlenecks and service signals" },
        ]}
        rows={[
          { title: "Programme performance", body: "Track service utilisation, engagement trends and care pathway progression at programme level." },
          { title: "Workflow throughput", body: "Understand operational movement across MedReach diagnostics, CarePort fulfilment and clinical workflows." },
          { title: "Governance discipline", body: "Avoid inappropriate patient-level exposure for employers, sponsors or non-clinical stakeholders." },
        ]}
      />

      <ImageStoryBand
        eyebrow="Operational intelligence"
        title="Designed for decisions, not surveillance."
        body="InsightCore is positioned for programme stewardship, pathway improvement and operational visibility. It should not be used to expose identifiable clinical records to parties without an appropriate lawful, consented or role-based basis."
        imageSrc="/visuals/insightcore/insightcore-dashboard.webp"
        imageAlt="Aggregated operational intelligence dashboard for Ambulant+ programmes"
        points={[
          "Aggregated analytics for programme review and service planning.",
          "Operational signals for bottlenecks, pathway friction and utilisation trends.",
          "Governance-aware reporting boundaries across employer, sponsor and scheme contexts.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
