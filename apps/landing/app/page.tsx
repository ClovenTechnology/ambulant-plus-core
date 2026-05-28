import Link from "next/link";
import { ArrowRight, CheckCircle2, Globe2, LockKeyhole, RadioTower, ShieldCheck } from "lucide-react";
import CTA from "@/components/CTA";
import ProductCard from "@/components/ProductCard";
import SectionShell from "@/components/SectionShell";
import ComplianceBadge from "@/components/ComplianceBadge";
import { productRoutes, trustPillars } from "@/lib/routes";
import { site } from "@/lib/site";

const accessCards = [
  ["Patients", "Protected access to vitals, appointments, medication, reports and connected-care actions."],
  ["Clinicians", "Governed clinical workflows for virtual care, device-supported review and escalation."],
  ["Care operations", "Diagnostics, pharmacy fulfilment, logistics and programme visibility in one ecosystem."],
];

const ecosystem = [
  ["Patient health workspace", "Vitals, medication, appointments, reports, care records and supported device pathways."],
  ["Clinician care workspace", "Virtual consultation, device-supported review, documentation and follow-up planning."],
  ["MedReach diagnostics operations", "Home phlebotomy, specimen collection, laboratory coordination and result-routing workflows."],
  ["CarePort pharmacy fulfilment", "Medicine coordination, dispatch readiness, delivery-rider workflow and proof-of-delivery visibility."],
];

export default function HomePage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-slate-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
              <ShieldCheck className="h-4 w-4" />
              Contactless medicine infrastructure
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
              The operating layer for contactless medicine.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-slate-600">
              Ambulant+ unifies virtual consultation, connected clinical devices, home diagnostics,
              pharmacy fulfilment and care logistics into one governed digital health infrastructure.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={site.patientAppUrl} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
                Access Patient App <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/platform" className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-6 py-4 text-sm font-semibold text-cyan-800">
                Explore the platform <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {accessCards.map(([title, body]) => (
                <div key={title} className="rounded-3xl border border-white/70 bg-white/72 p-4 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div className="mt-3 text-sm font-semibold text-slate-950">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-8">
            <div className="rounded-[34px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-6">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                <span>Ambulant+ ecosystem</span>
                <RadioTower className="h-4 w-4 text-cyan-700" />
              </div>
              <div className="mt-8 grid gap-4">
                {ecosystem.map(([title, body], index) => (
                  <div key={title} className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">{index + 1}</div>
                      <div>
                        <div className="font-semibold text-slate-950">{title}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-600">{body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900">
                Public information remains separate from protected clinical and operational workspaces, keeping healthcare access clear, role-based and security-conscious.
              </div>
            </div>
          </div>
        </div>
      </section>

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
