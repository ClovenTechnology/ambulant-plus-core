import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2, Cpu, HeartPulse, Network, ShieldCheck } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

const innovationPillars = [
  {
    title: "Four-device contactless clinical context",
    body:
      "Ambulant+ is designed around four defined device pathways — Health Monitor, Digital Stethoscope, HD Otoscope and NexRing — so remote care can be supported by objective signals rather than video conversation alone.",
  },
  {
    title: "eRx-to-adherence intelligence",
    body:
      "Electronic prescriptions can flow into medication reminders, camera-supported verification, adherence trends and adherence scoring to help patients and care teams understand medicine continuity.",
  },
  {
    title: "NexRing-supported fertility intelligence",
    body:
      "Lady-centre fertility support is designed to move beyond calendar-only estimation by using temperature variation against an individual baseline where NexRing signals are available.",
  },
  {
    title: "Multi-user clinical sessions",
    body:
      "Couples, parents, caregivers and multiple clinicians can join structured virtual sessions from different locations where the care context requires shared attendance.",
  },
  {
    title: "Medical-aid preflight verification",
    body:
      "Real-time payment-status and medical-aid readiness checks can help reduce failed journeys before care workflows proceed.",
  },
  {
    title: "Governance-aware intelligence",
    body:
      "InsightCore connects programme visibility, operational reporting and care-pathway signals without weakening privacy, consent or patient-level disclosure boundaries.",
  },
];

const deviceModel = [
  "Health Monitor for blood pressure, SpO₂, temperature, glucose, heart rate and ECG workflows.",
  "Digital Stethoscope for heart and lung auscultation capture, playback and clinical review.",
  "HD Otoscope for supported remote ear-imaging capture and review.",
  "NexRing for longitudinal signals such as sleep, readiness, recovery and fertility-relevant temperature variation.",
];

const ecosystemEngagement = [
  "National engagement around the development of Contactless Medicine in South Africa.",
  "Biomedical engineering engagement, including SAIEE Biomedical Engineering Chapter participation as identified by the Ambulant+ team.",
  "Academic and technical workstreams, including University of Johannesburg engagement as identified by the Ambulant+ team.",
  "Insurance, wellness, technology and skills-development ecosystem engagement, including iTOO/Hollard, Momentum Multiply and MICT SETA references identified by the Ambulant+ team.",
];

const finalCards: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Clinical boundary",
    body: "Ambulant+ supports care workflows; it does not replace emergency services or clinician judgement.",
    icon: ShieldCheck,
  },
  {
    title: "Operational continuity",
    body: "MedReach, CarePort and InsightCore connect care actions beyond the consultation window.",
    icon: HeartPulse,
  },
  {
    title: "Infrastructure category",
    body: "The goal is not another app, but a governed operating layer for contactless care.",
    icon: Network,
  },
];

export const metadata = {
  title: "Innovation in Contactless Medicine",
  description:
    "The Ambulant+ innovation thesis for Contactless Medicine: connected clinical devices, home diagnostics, eRx adherence, fertility intelligence, care logistics and governed operational intelligence.",
};

export default function InnovationPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[6%] top-[8%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Innovation</div>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
              Building the category beyond video-only telehealth.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ advances Contactless Medicine by combining connected clinical devices, home diagnostics,
              pharmacy fulfilment, care logistics, eRx adherence intelligence, fertility-support signals and
              governance-aware programme insight into one operating layer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/research-and-development" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">
                View R&D direction <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={site.nationalEngagementVideoUrl} className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800">
                Watch national engagement <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-8">
            <div className="rounded-[34px] border border-cyan-100 bg-slate-950 p-6 text-white shadow-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">Contactless Medicine thesis</div>
              <div className="mt-6 grid gap-4">
                {[
                  ["Objective signal", "Vitals, auscultation, otoscopy and longitudinal wearable signals."],
                  ["Operational continuity", "Diagnostics, medication fulfilment and patient navigation."],
                  ["Governed intelligence", "Programme visibility without inappropriate disclosure."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                    <div className="text-base font-semibold">{title}</div>
                    <div className="mt-2 text-sm leading-7 text-slate-200">{body}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-5 text-sm leading-7 text-cyan-50">
                The platform is designed to support clinician-led care. It does not replace emergency services,
                professional judgement or in-person assessment where clinically required.
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Innovation pillars"
        title="The operating model that makes Contactless Medicine credible."
        body="Ambulant+ is not positioned as ordinary video consultation. The innovation is in the combination of objective device signals, real-world healthcare operations and governed digital infrastructure."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {innovationPillars.map((item) => (
            <div key={item.title} className="glass-panel rounded-[30px] p-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Four-device model</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Virtually approximating the missing parts of a physical check.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
            Video-only telehealth can be clinically limited when it depends heavily on self-reported symptoms.
            Ambulant+ is designed to make remote care more clinically informative by pairing clinician-led
            consultation with defined device-supported workflows.
          </p>
        </div>

        <div className="grid gap-3">
          {deviceModel.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/70 bg-white/78 p-5 shadow-sm">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/60 to-indigo-50 p-6 shadow-sm md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Regulatory horizon</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                Built for the limitations of video-only care.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                South Africa’s telehealth framework has evolved significantly since the COVID-19 period. Ambulant+
                does not frame remote care as a shortcut around clinical standards. The thesis is that remote care
                should be strengthened with objective signals, governed workflows, escalation boundaries and
                professional clinical judgement.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["Beyond self-reporting", "Consultations can be supported by device signals and structured patient context."],
                ["Beyond isolated scripts", "eRx can connect into medication reminders, verification and adherence patterns."],
                ["Beyond solo video rooms", "Care sessions can include partners, caregivers, parents and multi-specialty clinicians."],
                ["Beyond blind payment journeys", "Medical-aid readiness checks can run before avoidable failed workflows."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-3xl border border-white/80 bg-white/80 p-5">
                  <div className="font-semibold text-slate-950">{title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Ecosystem engagement"
        title="Developing Contactless Medicine with serious ecosystem participation."
        body="Ambulant+ positions Contactless Medicine as a healthcare-infrastructure category requiring clinical, engineering, academic, payer, insurance, wellness and skills-development participation."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {ecosystemEngagement.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/70 bg-white/78 p-5 shadow-sm">
              <Network className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6">
        {finalCards.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[34px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}
