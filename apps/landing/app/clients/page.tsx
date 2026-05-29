import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import CommandDashboard from "@/components/CommandDashboard";
import ImageStoryBand from "@/components/ImageStoryBand";

export const metadata = {
  title: "Population health visibility without compromising patient trust.",
  description: "Employers, schemes and sponsors can engage Ambulant+ care programmes through aggregated, permission-aware and governance-led workflows.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Client and sponsor app"
        title="Population health visibility without compromising patient trust."
        body="Ambulant+ gives employers, schemes and sponsors governed visibility into care-programme performance, service utilisation and engagement trends — while protecting patient-level confidentiality through permission-aware access boundaries."
        imageSrc="/visuals/clients/client-programme-dashboard.webp"
        imageAlt="Healthcare programme leadership reviewing aggregated Ambulant+ programme dashboard"
        primaryCta={{ label: "Speak to partnerships", href: "/contact" }}
        secondaryCta={{ label: "Explore InsightCore", href: "/insightcore" }}
        overlayTitle="Programme visibility"
        overlayItems={[
          { label: "Aggregated reporting", value: "Programme trends and utilisation patterns." },
          { label: "Trust boundaries", value: "No inappropriate patient-level exposure." },
          { label: "Actionable operations", value: "Engagement, access and pathway performance." },
        ]}
      />

      <CommandDashboard
        eyebrow="Client intelligence"
        title="Benefits visibility must never become patient surveillance."
        body="The client workspace is designed for programme stewardship: access trends, utilisation, service performance and engagement signals — with clear privacy and role boundaries."
        metrics={[
          { value: "Programme", label: "Visibility at population and service level" },
          { value: "Governed", label: "Permission-aware reporting boundaries" },
          { value: "Action", label: "Signals for improvement and access planning" },
        ]}
        rows={[
          { title: "Employer programmes", body: "Support workplace health engagement, access monitoring and service utilisation review without exposing inappropriate clinical records." },
          { title: "Medical scheme visibility", body: "Review care-access trends, service activity and programme performance within lawful and contracted boundaries." },
          { title: "Sponsor and client reporting", body: "Understand programme health, operational performance and member engagement at the right level of aggregation." },
        ]}
      />

      <ImageStoryBand
        eyebrow="Trust-preserving reporting"
        title="Useful insight, disciplined access."
        body="Client and sponsor stakeholders need enough visibility to improve access and programme performance, but not uncontrolled access to individual clinical records."
        imageSrc="/visuals/clients/client-programme-dashboard.webp"
        imageAlt="Aggregated programme dashboard for Ambulant+ client and sponsor workflows"
        points={[
          "Aggregated programme reporting for engagement, utilisation and service performance.",
          "Clear separation between clinical records and sponsor-facing programme intelligence.",
          "Governance-aware workflows for employers, schemes and care-programme sponsors.",
        ]}
        reverse
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
