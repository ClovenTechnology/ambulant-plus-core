import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

const items = ["Book or access patient care through the protected patient workspace where available.", "Request clinician onboarding and device-supported workflow training.", "Coordinate home phlebotomy and laboratory services through MedReach diagnostics operations.", "Coordinate medicine fulfilment and delivery pathways through CarePort pharmacy operations.", "Request enterprise or sponsor programme deployment discussions.", "Request a platform walkthrough for patient, clinician, diagnostics, pharmacy, client or governance workflows."];

export const metadata = {
  title: "Route each request to the right care pathway.",
  description: "Ambulant+ booking pathways are designed to direct patients, clinicians and partners into the correct workflow for virtual care, home diagnostics, medicine fulfilment, onboarding or enterprise deployment.",
};

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Bookings</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Route each request to the right care pathway.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">Ambulant+ booking pathways are designed to direct patients, clinicians and partners into the correct workflow for virtual care, home diagnostics, medicine fulfilment, onboarding or enterprise deployment.</p>
          <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
            Speak to Ambulant+ <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 glass-panel rounded-[38px] p-6 md:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Booking pathways</div>
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
