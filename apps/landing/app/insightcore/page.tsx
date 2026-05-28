import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

const items = ["Programme visibility across access, engagement, service utilisation and operational performance.", "Workflow reporting for diagnostics, pharmacy fulfilment, consultations and care-network coordination.", "Governance-aware analytics designed to respect permission boundaries and avoid inappropriate patient-level exposure.", "Operational signals that help teams identify bottlenecks, utilisation patterns and service-readiness gaps.", "Client and sponsor reporting models focused on aggregated performance rather than intrusive individual surveillance.", "Future-ready intelligence architecture for responsible, auditable and clinically cautious platform insights."];

export const metadata = {
  title: "Governance-aware intelligence for contactless care operations.",
  description: "InsightCore is the Ambulant+ intelligence layer for programme visibility, operational reporting, service utilisation, workflow performance and governance-aware analytics.",
};

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">InsightCore</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Governance-aware intelligence for contactless care operations.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">InsightCore is the Ambulant+ intelligence layer for programme visibility, operational reporting, service utilisation, workflow performance and governance-aware analytics.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
            Speak to Ambulant+ <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 glass-panel rounded-[38px] p-6 md:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Intelligence layer</div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-7 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
