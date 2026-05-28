import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

const bullets = ["Pharmacy order intake, fulfilment status, dispensing coordination and dispatch readiness.", "Delivery-rider workflows for handover, route progression, patient updates and proof-of-delivery.", "Medication continuity for patients, clinicians and sponsored care programmes.", "Operational traceability across pharmacy action, dispatch, delivery and completion."];

export const metadata = {
  title: "The pharmacy fulfilment layer for contactless medicine.",
  description: "Pharmacy fulfilment and delivery-rider coordination for medicine continuity.",
};

export default function Page() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">CarePort</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">The pharmacy fulfilment layer for contactless medicine.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">CarePort connects pharmacies, dispatch teams and delivery riders into a governed workflow for medicine fulfilment, handover, delivery tracking and proof-of-delivery.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
            Explore CarePort <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-6">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Fulfilment model</div>
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
