import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "MedReach",
  description:
    "MedReach home phlebotomy, laboratory coordination and result-routing operations.",
};

const diagnosticFlow = [
  "Test request or diagnostic workflow initiated.",
  "Phlebotomist assigned and patient verified.",
  "Home blood draw and specimen labelling completed.",
  "Chain-of-custody and transport readiness maintained.",
  "Laboratory handover and processing visibility.",
  "Result readiness and result-routing back into care workflow.",
];

const medReachRoles: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Laboratories",
    body:
      "KYC, test catalogue, panel management, specimen acceptance, result readiness, billing and operational support.",
    icon: FlaskConical,
    href: "/medreach/labs",
  },
  {
    title: "Phlebotomists",
    body:
      "KYC, qualification checks, patient verification, home draw rules, specimen labelling and earnings.",
    icon: Syringe,
    href: "/medreach/phlebotomists",
  },
  {
    title: "Governance",
    body:
      "Traceability, chain-of-custody, consent, result-routing and safety boundaries.",
    icon: ShieldCheck,
    href: "/compliance",
  },
];

export default function MedReachPage() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            MedReach
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            The diagnostics operations layer for Contactless Medicine.
          </h1>

          <p className="mt-6 text-lg leading-9 text-slate-600">
            MedReach coordinates home phlebotomy, specimen collection, laboratory handover,
            chain-of-custody visibility and result-routing workflows across the Ambulant+
            ecosystem.
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
              For labs <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/medreach/phlebotomists"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
            >
              For phlebotomists <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-slate-950 p-6 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
              Diagnostic workflow
            </div>

            <div className="mt-6 grid gap-3">
              {diagnosticFlow.map((item) => (
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
        eyebrow="MedReach roles"
        title="Built for laboratories and phlebotomy operations."
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