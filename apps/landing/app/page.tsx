import Link from "next/link";
import { ArrowRight, Globe2, LockKeyhole, RadioTower, ShieldCheck } from "lucide-react";
import CTA from "@/components/CTA";
import ProductCard from "@/components/ProductCard";
import SectionShell from "@/components/SectionShell";
import ComplianceBadge from "@/components/ComplianceBadge";
import ImageStoryBand from "@/components/ImageStoryBand";
import VisualHero from "@/components/VisualHero";
import { productRoutes, trustPillars } from "@/lib/routes";
import { site } from "@/lib/site";

const heroStatus = [
  { label: "Clinical", value: "Virtual consultation and device-supported review." },
  { label: "Diagnostics", value: "Home phlebotomy and laboratory coordination." },
  { label: "Operations", value: "Pharmacy fulfilment and care logistics visibility." },
];

const ecosystemSignals = [
  ["Patient workspace", "Vitals, reports, medication, bookings and care actions."],
  ["Clinician workspace", "Consultation, review, documentation and escalation."],
  ["MedReach", "Home diagnostics, specimen custody and lab handover."],
  ["CarePort", "Medicine fulfilment, rider workflow and delivery proof."],
];

export default function HomePage() {
  return (
    <main>
      <VisualHero
        eyebrow="Contactless medicine infrastructure"
        title="The operating layer for contactless medicine."
        body="Ambulant+ unifies virtual consultation, connected clinical devices, home diagnostics, pharmacy fulfilment and care logistics into one governed digital health infrastructure."
        imageSrc="/visuals/home/ambulant-ecosystem-command.webp"
        imageAlt="Ambulant+ ecosystem command interface for contactless medicine"
        actions={[
          { label: "Access Patient App", href: site.patientAppUrl, external: true },
          { label: "Explore the platform", href: "/platform", variant: "secondary" },
        ]}
        statusItems={heroStatus}
      >
        <div className="rounded-[28px] border border-white/20 bg-slate-950/70 p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
            <span>Ambulant+ ecosystem</span>
            <RadioTower className="h-4 w-4" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ecosystemSignals.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-sm font-semibold">{title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-200">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </VisualHero>

      <SectionShell
        eyebrow="Platform routes"
        title="One ecosystem. Dedicated workspaces for every care pathway."
        body="Ambulant+ gives each user group a focused environment while the public domain remains the trusted home for platform information, access and governance."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productRoutes.map((item) => (
            <ProductCard key={item.title} title={item.title} summary={item.summary} href={item.href} icon={item.icon} />
          ))}
        </div>
      </SectionShell>

      <ImageStoryBand
        eyebrow="Diagnostics at home"
        title="MedReach brings laboratory workflows closer to the patient."
        body="Home phlebotomy, specimen collection, chain-of-custody and laboratory handover become part of one governed diagnostic journey."
        imageSrc="/visuals/medreach/medreach-home-draw.webp"
        imageAlt="MedReach phlebotomist performing a home blood draw"
        imageSide="left"
        imagePosition="center"
        points={[
          "Structured home blood draw and specimen-collection workflow.",
          "Laboratory handover and result-routing visibility.",
          "Consent, traceability and operational accountability across the diagnostic pathway.",
        ]}
        ctaLabel="Explore MedReach"
        ctaHref="/medreach"
      />

      <ImageStoryBand
        eyebrow="Medicine continuity"
        title="CarePort connects pharmacy fulfilment to patient delivery."
        body="Medication access becomes operationally visible from pharmacy preparation to rider handover, delivery progress and proof-of-delivery."
        imageSrc="/visuals/careport/careport-erx-delivery.webp"
        imageAlt="CarePort rider delivering medication to a patient at home"
        imageSide="right"
        imagePosition="center"
        points={[
          "Pharmacy order handling and dispatch readiness.",
          "Delivery-rider workflow, patient updates and proof-of-delivery.",
          "Fulfilment visibility for patients, clinicians and accountable care programmes.",
        ]}
        ctaLabel="Explore CarePort"
        ctaHref="/careport"
      />

      <SectionShell
        eyebrow="Trust architecture"
        title="Designed for careful healthcare deployment."
        body="Ambulant+ uses restrained clinical language, separates informational content from clinical advice, and preserves governance boundaries around emergency care, device data and regulated claims."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trustPillars.map((item) => (
            <ComplianceBadge key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-panel rounded-[34px] p-6">
            <LockKeyhole className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">Privacy-aware</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">Role-based access, consent-aware sharing and careful handling of sensitive health-related information across workflows.</p>
          </div>
          <div className="glass-panel rounded-[34px] p-6">
            <ShieldCheck className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">Governance-ready</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">Structured for review, auditability, operational controls, escalation language and documented care boundaries.</p>
          </div>
          <div className="glass-panel rounded-[34px] p-6">
            <Globe2 className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">Deployment-ready</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">Designed to connect patient, clinician, diagnostics, pharmacy, client and administrative workspaces behind clean deployment routes.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}
