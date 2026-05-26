import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

const bullets = ["Health overview with vitals, medication adherence and care readiness.", "Connected-device pathways for supported health monitor, stethoscope, otoscope and NexRing workflows.", "Care continuity, reports, appointments, allergies and risk-notes in one patient-centred interface.", "Designed for consent-aware sharing with clinicians, medical aid workflows and care partners."];

export const metadata = {
  title: "A personal command centre for connected care.",
  description: "Patients can access vitals, medication, appointments, care history and care-network actions from a protected workspace.",
};

export default function Page() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Patient app</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">A personal command centre for connected care.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">Patients can access vitals, medication, appointments, care history and care-network actions from a protected workspace.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
            Open Patient App <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-6">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Capability map</div>
            <div className="mt-6 grid gap-4">
              {bullets.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-7 text-slate-650">{item}</p>
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
