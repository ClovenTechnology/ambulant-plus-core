import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

const bullets = ["Coordinate home blood draws and specimen collection through structured phlebotomy workflows.", "Connect laboratory partners, phlebotomists and care teams around request, collection, handover and result status.", "Give patients a clearer diagnostic journey without unnecessary facility visits where home collection is appropriate.", "Maintain operational traceability across collection, transport, laboratory processing and result routing."];

export const metadata = {
  title: "The diagnostics operations layer for contactless medicine.",
  description: "Diagnostics operations for home phlebotomy, specimen collection, laboratory coordination and result-routing workflows.",
};

export default function Page() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">MedReach</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">The diagnostics operations layer for contactless medicine.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">MedReach coordinates home phlebotomy, specimen collection, laboratory handover, processing visibility and result-routing workflows across the Ambulant+ ecosystem.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
            Explore MedReach <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-6">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Diagnostic workflow</div>
            <div className="mt-6 grid gap-4">
              {bullets.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
