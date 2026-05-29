import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";

export const metadata = { title: "Getting started as a patient", description: "A practical patient guide for creating an Ambulant+ account, completing profile information, adding medical aid, connecting devices, booking" };
const bullets = ['Create your patient account and complete your protected health profile.',
'Add allergies, conditions, current medication and emergency-contact information.',
'Add medical-aid details or select cash/card payment where supported.',
'Connect supported devices and follow troubleshooting guidance where needed.',
'Book a clinician and join the virtual care session at the scheduled time.',
'Use MedReach for home diagnostics and CarePort for medicine fulfilment when available.'];
export default function Page() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Patients</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Getting started as a patient</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">A practical patient guide for creating an Ambulant+ account, completing profile information, adding medical aid, connecting devices, booking clinicians, funding wallet and using CarePort or MedReach.</p>
          <Link href="https://patient.ambulantplus.co.za/auth/signup" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">Create patient account <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="glass-panel rounded-[38px] p-6"><div className="rounded-[30px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-6"><div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Operating guide</div><div className="mt-6 grid gap-4">{bullets.map((item)=><div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-4"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600"/><p className="text-sm leading-7 text-slate-600">{item}</p></div>)}</div></div></div>
      </section>
      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6"><CTA /></div>
    </main>
  );
}
