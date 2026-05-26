import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { site } from "@/lib/site";

export default function CTA() {
  return (
    <section className="glass-panel rounded-[34px] p-6 md:p-10">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Start safely</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Route every user to the right Ambulant+ workspace.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            Use the landing domain as the public front door. Patients, clinicians, clients,
            pharmacies, riders and programme teams can move into the correct secured app from here.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <a
            href={site.patientAppUrl}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
          >
            Open Patient App <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            href="/contact"
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-6 py-4 text-sm font-semibold text-cyan-800 transition hover:-translate-y-0.5"
          >
            Speak to Ambulant+ <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
