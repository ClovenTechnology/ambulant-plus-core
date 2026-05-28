import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

const bullets = ["A unified health overview for vitals, medication, appointments, reports and care readiness.", "Connected-device pathways for Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows.", "Care continuity across allergies, risk notes, reports, follow-up plans and clinical interactions.", "Consent-aware sharing with clinicians, medical aid workflows and approved care partners."];

export const metadata = {
  title: "A protected health workspace for connected care.",
  description: "Patient workspace for vitals, medication, appointments, reports and connected care.",
};

export default function Page() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Patient app</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">A protected health workspace for connected care.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">The Ambulant+ patient app brings vitals, appointments, medication, reports, device-supported checks and care-network actions into one protected patient workspace.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
            Access Patient App <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-6">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Patient workspace</div>
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
