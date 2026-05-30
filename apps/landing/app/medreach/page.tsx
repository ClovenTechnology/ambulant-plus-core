import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  MapPinned,
  ShieldCheck,
  Syringe,
  TestTube2,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "MedReach Diagnostics Operations",
  description:
    "MedReach is the Ambulant+ diagnostics operations layer for home phlebotomy, specimen collection, laboratory coordination, chain-of-custody and result-routing workflows.",
};

const diagnosticFlow = [
  {
    title: "Diagnostic request",
    body: "A clinician, programme or approved workflow initiates a diagnostic request within the Ambulant+ ecosystem.",
  },
  {
    title: "Patient and order verification",
    body: "Patient identity, consent, location, test requirements and operational readiness are checked before collection.",
  },
  {
    title: "Phlebotomist assignment",
    body: "An eligible phlebotomist receives the home-draw assignment with the relevant collection instructions.",
  },
  {
    title: "Home collection",
    body: "The phlebotomist performs the draw, labels specimens and records collection details according to workflow rules.",
  },
  {
    title: "Specimen custody",
    body: "Specimen packaging, chain-of-custody and transport readiness are tracked before laboratory handover.",
  },
  {
    title: "Laboratory processing",
    body: "Laboratory acceptance, processing status and result readiness are surfaced through the MedReach pathway.",
  },
  {
    title: "Result routing",
    body: "Results are routed into the appropriate clinician, patient or programme workflow where configured and permitted.",
  },
];

const medReachRoles: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "For laboratories",
    body:
      "Configure laboratory onboarding, test catalogue, specimen-acceptance rules, processing status, result readiness and billing visibility.",
    icon: FlaskConical,
    href: "/medreach/labs",
  },
  {
    title: "For phlebotomists",
    body:
      "Support verified home-draw assignments, patient confirmation, specimen labelling, custody, handover and earnings visibility.",
    icon: Syringe,
    href: "/medreach/phlebotomists",
  },
  {
    title: "For payers and programmes",
    body:
      "Enable payer-funded diagnostics, coverage preflight, billable-event visibility, result-routing governance and programme reporting.",
    icon: ShieldCheck,
    href: "/clients",
  },
];

const operatingCapabilities = [
  "Home phlebotomy assignment and route-ready workflow.",
  "Patient identity, consent and collection-readiness checks.",
  "Specimen labelling, packaging and chain-of-custody support.",
  "Laboratory catalogue, panels, test availability and acceptance rules.",
  "Status visibility for collection, transport, laboratory receipt and processing.",
  "Result-readiness and result-routing into clinical and patient workflows.",
  "Billable diagnostics events for payer, HMO, employer or sponsor programmes.",
  "Operational auditability across phlebotomist, specimen, lab and result events.",
];

const trustBoundaries = [
  {
    title: "Not a standalone laboratory",
    body:
      "MedReach coordinates diagnostics operations. Laboratory testing remains subject to the participating laboratory, applicable rules, clinical indication and operational agreement.",
    icon: TestTube2,
  },
  {
    title: "Chain-of-custody matters",
    body:
      "Diagnostics quality depends on identity checks, correct tubes, labelling, timing, transport, handover and documented specimen handling.",
    icon: ClipboardCheck,
  },
  {
    title: "Results need clinical context",
    body:
      "Diagnostic results should be interpreted by an appropriate clinician within the relevant care context, not treated as isolated automatic advice.",
    icon: BadgeCheck,
  },
];

const buyerUseCases = [
  "Medical aids funding chronic-disease monitoring and avoiding delayed diagnostics.",
  "Employers sponsoring health-screening programmes with controlled data visibility.",
  "Clinicians requesting home blood draws after remote consultation.",
  "Patients who cannot easily travel to pathology collection rooms.",
  "Care programmes needing longitudinal lab evidence, not one-off disconnected reports.",
  "Post-discharge pathways requiring repeat blood tests without unnecessary hospital visits.",
];

export default function MedReachPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[20%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              MedReach
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              The diagnostics operations layer for Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              MedReach connects home phlebotomy, specimen collection, laboratory coordination,
              chain-of-custody visibility and result routing into one governed diagnostics pathway
              for patients, clinicians, laboratories, medical aids and care programmes.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.medreachUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Open MedReach <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/medreach/labs"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                For laboratories <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/medreach/phlebotomists"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                For phlebotomists <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/medreach/medreach-home-draw.webp"
                alt="MedReach home phlebotomy visit for Contactless Medicine diagnostics"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Home diagnostics
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Bring diagnostics closer to the patient while preserving laboratory handover,
                  custody, result routing and clinical governance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Diagnostic workflow"
        title="From request to result routing."
        body="MedReach is designed to make home diagnostics operationally visible, auditable and connected to the wider Ambulant+ care journey."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {diagnosticFlow.map((step, index) => (
            <div key={step.title} className="glass-panel rounded-[30px] p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="overflow-hidden rounded-[38px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/medreach/medreach-specimen-transport.webp"
              alt="MedReach specimen transport and laboratory handover workflow"
              className="h-80 w-full object-cover"
            />
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Specimen movement
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              The sample journey is as important as the test request.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              Diagnostics operations fail when collection, labelling, transport, handover and
              results are treated as separate fragments. MedReach gives the ecosystem one
              coordinated view of the diagnostic journey.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                "Structured collection assignment and patient verification.",
                "Specimen labelling and collection documentation.",
                "Transport-readiness and laboratory handover visibility.",
                "Result-routing back into the care workflow.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="MedReach roles"
        title="Built for laboratories, phlebotomists and payer-funded diagnostic programmes."
        body="MedReach keeps laboratory operations and phlebotomy workflows distinct while preserving one traceable diagnostic journey."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {medReachRoles.map(({ title, body, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="glass-panel rounded-[30px] p-6 transition hover:-translate-y-1"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Operating capabilities
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Diagnostics should be reachable without becoming uncontrolled.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                MedReach is not just “someone takes blood at home.” It is the operations layer that
                helps make home diagnostics structured, reportable and connected to clinical and payer workflows.
              </p>
            </div>

            <div className="grid gap-3">
              {operatingCapabilities.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Why it matters"
        title="Diagnostics access is a prevention lever."
        body="For medical aids, employers and care programmes, delayed diagnostics often means delayed intervention. MedReach makes diagnostic access more practical while preserving governance."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buyerUseCases.map((item) => (
            <div key={item} className="rounded-3xl border border-white/70 bg-white/78 p-5 text-sm leading-7 text-slate-600 shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6 md:py-16">
        {trustBoundaries.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}