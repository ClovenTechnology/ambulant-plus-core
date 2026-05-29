import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import CTA from "@/components/CTA";
import WorkflowTimeline from "@/components/WorkflowTimeline";

const cases = [
  ["Virtual consultation with device context", "Patients and clinicians can combine remote consultation with supported vitals, auscultation, otoscopy and longitudinal signals."],
  ["Home diagnostics", "MedReach coordinates home phlebotomy, specimen collection, chain-of-custody and laboratory handover workflows."],
  ["Medicine fulfilment", "CarePort links pharmacy preparation, dispatch readiness, rider workflow, patient updates and proof-of-delivery."],
  ["Chronic care support", "Patients can use structured reminders, reports, medication visibility and connected-device pathways to support longitudinal care."],
  ["Employer and scheme programmes", "Clients can view aggregated programme performance and service utilisation while preserving patient trust and disclosure boundaries."],
  ["Post-discharge follow-up", "Care teams can support follow-up planning, remote checks, escalation language and continuity after facility-based care."],
];

const steps = [
  { title: "Identify pathway", body: "Patient, clinician, sponsor or operational team selects the relevant care pathway." },
  { title: "Route workspace", body: "Ambulant+ directs users into the protected workspace that matches their role." },
  { title: "Coordinate workflow", body: "Consultation, diagnostics, pharmacy fulfilment, reporting or escalation proceeds within defined boundaries." },
  { title: "Close loop", body: "Records, updates and operational signals support accountable follow-up and visibility." },
];

export const metadata = {
  title: "Use cases for contactless medicine deployment.",
  description: "Practical Ambulant+ use cases across virtual care, home diagnostics, medicine fulfilment, chronic care, programmes and follow-up.",
};

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Use cases</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">Real-world care pathways, built into one ecosystem.</h1>
          <p className="mt-6 text-lg leading-9 text-slate-600">Ambulant+ is designed for practical healthcare deployment: virtual care, home diagnostics, medicine fulfilment, connected devices, programme visibility and care-continuity operations.</p>
          <Link href="/demos" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">Request a walkthrough <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cases.map(([title, body]) => (
            <div key={title} className="glass-panel rounded-[34px] p-6">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <h2 className="mt-5 text-xl font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <WorkflowTimeline eyebrow="Deployment flow" title="A use case becomes a governed pathway." steps={steps} />
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6"><CTA /></section>
    </main>
  );
}
