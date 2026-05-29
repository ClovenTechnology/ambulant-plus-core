import { Activity, Building2, HeartPulse, ShieldCheck, Stethoscope, Truck, UserRound } from "lucide-react";

const nodes = [
  { title: "Patient workspace", body: "Personal access to care, vitals, bookings, reports and connected-care actions.", icon: UserRound },
  { title: "Clinician workspace", body: "Governed virtual care, device-supported review, documentation and escalation.", icon: Stethoscope },
  { title: "MedReach diagnostics", body: "Home phlebotomy, specimen collection, laboratory coordination and result routing.", icon: HeartPulse },
  { title: "CarePort fulfilment", body: "Pharmacy preparation, dispatch, delivery-rider workflow and proof-of-delivery.", icon: Truck },
  { title: "InsightCore intelligence", body: "Aggregated programme visibility, operational reporting and governance-aware analytics.", icon: Activity },
  { title: "Admin governance", body: "Configuration, onboarding, quality controls, support pathways and audit visibility.", icon: Building2 },
];

export default function PlatformEcosystem() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Platform architecture</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">One operating layer. Multiple governed workspaces.</h2>
        <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
          Ambulant+ separates care experiences by role while keeping the wider contactless-medicine ecosystem connected through disciplined workflow design.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {nodes.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-4xl rounded-[30px] border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          Public information remains separate from protected clinical and operational workspaces, preserving role boundaries, consent-aware sharing and healthcare governance discipline.
        </div>
      </div>
    </section>
  );
}
