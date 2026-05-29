import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import CommandDashboard from "@/components/CommandDashboard";
import ImageStoryBand from "@/components/ImageStoryBand";

export const metadata = {
  title: "Security architecture for governed contactless care.",
  description: "Ambulant+ is designed around protected workspaces, role-based access, auditability and privacy-aware operational controls.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Security"
        title="Security architecture for governed contactless care."
        body="Ambulant+ is designed around protected workspaces, role-aware access, environment separation, audit-friendly records and privacy-conscious operational patterns."
        imageSrc="/visuals/security/security-architecture.webp"
        imageAlt="Ambulant+ healthcare security architecture"
        primaryCta={{ label: "Discuss security", href: "/contact" }}
        secondaryCta={{ label: "View compliance", href: "/compliance" }}
        overlayTitle="Control framework"
        overlayItems={[
          { label: "Protected workspaces", value: "Separated by role, responsibility and workflow." },
          { label: "Audit-friendly records", value: "Designed for critical workflow traceability." },
          { label: "Deployment discipline", value: "Production, preview and development boundaries." },
        ]}
      />

      <CommandDashboard
        eyebrow="Security posture"
        title="Enterprise healthcare needs more than a login screen."
        body="Security is treated as an operating model: who can enter, what they can see, what they can do, what is recorded and which environment they are operating in."
        metrics={[
          { value: "Role", label: "Workspace and permission boundaries" },
          { value: "Trace", label: "Operational logs and workflow records" },
          { value: "Separate", label: "Environment-specific configuration" },
        ]}
        rows={[
          { title: "Role-based access", body: "Patient, clinician, pharmacy, diagnostics, client and admin workspaces should not collapse into the same permission model." },
          { title: "Data minimisation", body: "Workflows should surface only the information needed for the relevant role, action and lawful purpose." },
          { title: "Auditability", body: "Critical actions should produce records that support review, quality improvement and governance controls." },
          { title: "Environment separation", body: "Production, preview and development deployments should use environment-specific configuration and avoid secret exposure." },
        ]}
      />

      <ImageStoryBand
        eyebrow="Trust infrastructure"
        title="Security must be visible in the operating model."
        body="A healthcare platform earns trust when protected access, role boundaries, auditability and responsible data handling are evident across the product and the operational process."
        imageSrc="/visuals/security/security-architecture.webp"
        imageAlt="Protected workspaces and healthcare access control architecture"
        points={[
          "Protected app workspaces behind authentication and role-level controls.",
          "Consent-aware sharing, data minimisation and purpose-bound workflow design.",
          "Audit-friendly operational records for critical clinical, diagnostic and fulfilment pathways.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
