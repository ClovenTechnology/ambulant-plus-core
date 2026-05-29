import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  Store,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "CarePort",
  description:
    "CarePort pharmacy fulfilment and rider operations for Ambulant+ Contactless Medicine.",
};

const operations = [
  "Prescription/order intake and pharmacy preparation.",
  "SKU/catalogue visibility and fulfilment readiness.",
  "Rider assignment, handover and route progression.",
  "Patient updates and proof-of-delivery.",
  "Payouts, fees and operational auditability.",
];

const carePortRoles: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Pharmacies",
    body:
      "Onboarding KYC, catalogue/SKU management, dispensing readiness, dispatch handover, fees and payouts.",
    icon: Store,
    href: "/careport/pharmacies",
  },
  {
    title: "Riders",
    body:
      "Identity verification, delivery rules, handover workflow, patient communication boundaries and earnings.",
    icon: Truck,
    href: "/careport/riders",
  },
  {
    title: "Operations",
    body:
      "Audit trails, proof-of-delivery, patient updates and accountable fulfilment visibility.",
    icon: PackageCheck,
    href: "/operations",
  },
];

export default function CarePortPage() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            CarePort
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            The pharmacy fulfilment layer for Contactless Medicine.
          </h1>

          <p className="mt-6 text-lg leading-9 text-slate-600">
            CarePort connects pharmacies, SKU management, dispatch coordination,
            delivery-rider workflow, patient updates, proof-of-delivery and payout
            visibility into one governed medicine-continuity operation.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={site.careportUrl}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Open CarePort <ArrowRight className="h-4 w-4" />
            </a>

            <Link
              href="/careport/pharmacies"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
            >
              For pharmacies <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/careport/riders"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
            >
              For riders <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-slate-950 p-6 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
              Operational model
            </div>

            <div className="mt-6 grid gap-3">
              {operations.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4"
                >
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="CarePort roles"
        title="Built for pharmacies and delivery teams."
        body="CarePort separates pharmacy operations from rider operations while preserving one medicine-continuity pathway for patients and care programmes."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {carePortRoles.map(({ title, body, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="glass-panel rounded-[30px] p-6 transition hover:-translate-y-1"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </Link>
          ))}
        </div>
      </SectionShell>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}