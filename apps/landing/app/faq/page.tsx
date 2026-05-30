import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  HeartPulse,
  LockKeyhole,
  Pill,
  ShieldCheck,
  Stethoscope,
  Store,
  TestTube2,
  UserRoundCheck,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import { site } from "@/lib/site";

export const metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Ambulant+ Contactless Medicine, supported devices, patients, clinicians, MedReach, CarePort, InsightCore, medical aids and governance.",
};

const faqGroups: Array<{
  title: string;
  icon: LucideIcon;
  items: Array<{
    q: string;
    a: string;
  }>;
}> = [
  {
    title: "Ambulant+ and Contactless Medicine",
    icon: Stethoscope,
    items: [
      {
        q: "What is Ambulant+?",
        a:
          "Ambulant+ is a governed Contactless Medicine ecosystem by Cloven Technology Impilo. It connects patients, clinicians, supported connected devices, MedReach diagnostics, CarePort pharmacy fulfilment and InsightCore programme intelligence through one coordinated digital health infrastructure.",
      },
      {
        q: "What is Contactless Medicine?",
        a:
          "Contactless Medicine is a more complete model of remote care. It combines virtual consultation with supported clinical devices, structured patient profile data, home diagnostics, medicine fulfilment, reminders, adherence signals and governance-aware intelligence.",
      },
      {
        q: "How is Contactless Medicine different from ordinary telemedicine?",
        a:
          "Ordinary telemedicine is often limited to video, audio and patient self-reporting. Contactless Medicine adds objective care inputs such as vitals, auscultation, otoscopy, longitudinal wearable signals, diagnostics, pharmacy fulfilment and structured follow-up where appropriate.",
      },
      {
        q: "Is Ambulant+ an emergency service?",
        a:
          "No. Ambulant+ is not an emergency service. In a medical emergency, users must contact local emergency services immediately.",
      },
    ],
  },
  {
    title: "Patients",
    icon: HeartPulse,
    items: [
      {
        q: "How do patients get started?",
        a:
          "Patients create a protected account, complete their profile, add medical-aid or payment details where supported, connect supported devices, book a clinician and use MedReach or CarePort where clinically and operationally appropriate.",
      },
      {
        q: "Can patients add medical-aid details?",
        a:
          "Yes, where supported. Patients can add medical-aid details to their profile, and selected journeys may support payment-status or eligibility preflight before care proceeds. Cover, claims and reimbursement still depend on scheme rules, provider status and configuration.",
      },
      {
        q: "Can patients use wallet, card or cash pathways?",
        a:
          "Yes, where configured. Ambulant+ can support wallet funding, card or other payment pathways for consultations, devices, diagnostics, fulfilment and care plans, depending on the deployment model.",
      },
      {
        q: "Can family members or care partners participate?",
        a:
          "Yes, where permissions and workflows allow. Examples include a parent joining a child’s consultation remotely, couples attending fertility sessions from different locations, or multidisciplinary care sessions involving more than one clinician.",
      },
    ],
  },
  {
    title: "Clinicians",
    icon: UserRoundCheck,
    items: [
      {
        q: "Does Ambulant+ replace a clinician?",
        a:
          "No. Ambulant+ supports clinician-led care. It provides device context, structured information, documentation pathways and operational workflows, but professional clinical judgement remains essential.",
      },
      {
        q: "Can clinicians work remotely?",
        a:
          "Yes, where appropriate. Clinicians can work remotely if they meet professional, regulatory, privacy, platform-readiness and clinical-governance requirements.",
      },
      {
        q: "What does clinician onboarding include?",
        a:
          "Clinician onboarding can include account creation, professional verification, identity/KYC checks, training, device-workflow readiness, compliance guidance, commercial terms, payment setup and activation checks.",
      },
      {
        q: "Can clinician admin staff work remotely?",
        a:
          "Yes, where role permissions allow. Administrative users should access only the information required for their function and must comply with confidentiality, consent and platform rules.",
      },
    ],
  },
  {
    title: "Supported devices",
    icon: Watch,
    items: [
      {
        q: "Which devices are supported?",
        a:
          "Ambulant+ focuses on four supported device categories: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing. This avoids unsupported wearable sprawl and keeps device use mapped to defined Contactless Medicine workflows.",
      },
      {
        q: "What does the Health Monitor support?",
        a:
          "The Health Monitor supports multi-parameter vital-sign workflows such as blood pressure, heart rate, oxygen saturation, temperature, glucose and ECG-screening context where available and appropriate.",
      },
      {
        q: "What does the Digital Stethoscope support?",
        a:
          "The Digital Stethoscope supports heart and lung sound capture, playback and clinician review in device-supported remote consultations.",
      },
      {
        q: "What does the HD Otoscope support?",
        a:
          "The HD Otoscope supports image and video capture for ear assessment and selected visual-inspection workflows where remote review is clinically appropriate.",
      },
      {
        q: "What does NexRing support?",
        a:
          "NexRing supports longitudinal signals such as heart-rate trends, sleep, readiness, recovery, activity and temperature-variation context. It can support wellness and fertility-related features where configured and clinically appropriate.",
      },
      {
        q: "Are the devices certified or registered?",
        a:
          "The supported device set is understood to have manufacturer-supplied CE, regional FDA, TÜV and SAHPRA documentation. Public claims should still be tied to the exact device, documentation, jurisdiction, intended use and deployment context.",
      },
      {
        q: "Do device readings diagnose patients automatically?",
        a:
          "No. Device data supports clinician review and care navigation. It should not be treated as automatic diagnosis or a substitute for urgent, emergency or in-person care where required.",
      },
    ],
  },
  {
    title: "MedReach diagnostics",
    icon: TestTube2,
    items: [
      {
        q: "What is MedReach?",
        a:
          "MedReach is the Ambulant+ diagnostics operations layer for home phlebotomy, specimen collection, laboratory coordination, chain-of-custody visibility and result-routing workflows.",
      },
      {
        q: "Is MedReach a laboratory?",
        a:
          "No. MedReach coordinates diagnostics operations. Laboratory testing remains subject to participating laboratories, applicable standards, clinical indication and operational agreements.",
      },
      {
        q: "Who uses MedReach?",
        a:
          "MedReach supports patients, clinicians, phlebotomists, laboratories, medical aids, HMOs, employers and care programmes that need structured home diagnostics and result-routing workflows.",
      },
      {
        q: "Can MedReach support payer-funded diagnostics?",
        a:
          "Yes, where configured. MedReach can support diagnostic billable events, coverage workflows, payer-funded screening, chronic monitoring and programme reporting.",
      },
    ],
  },
  {
    title: "CarePort pharmacy fulfilment",
    icon: Store,
    items: [
      {
        q: "What is CarePort?",
        a:
          "CarePort is the Ambulant+ pharmacy fulfilment layer for eRx continuity, medicine preparation, SKU readiness, rider dispatch, patient updates, proof-of-delivery and payout visibility.",
      },
      {
        q: "Is CarePort a pharmacy?",
        a:
          "No. CarePort coordinates fulfilment workflows. Dispensing, counselling and pharmacy obligations remain subject to the participating pharmacy and applicable regulation.",
      },
      {
        q: "How does CarePort support medication adherence?",
        a:
          "CarePort connects eRx, pharmacy preparation, medicine delivery and proof-of-delivery with reminders and adherence workflows where configured. This helps medication continuity become visible rather than fragmented.",
      },
      {
        q: "Can riders use CarePort?",
        a:
          "Yes. CarePort supports verified rider workflows including handover, route progression, patient-update boundaries, proof-of-delivery, exception reporting and earnings visibility.",
      },
    ],
  },
  {
    title: "Medical aids, HMOs and sponsors",
    icon: Building2,
    items: [
      {
        q: "How does Ambulant+ help medical aids?",
        a:
          "Ambulant+ helps medical aids and HMOs fund earlier intervention, remote monitoring, medication adherence, diagnostics, pharmacy fulfilment, wellness rewards and claims visibility before avoidable complications become high-cost events.",
      },
      {
        q: "Can medical aids see member data?",
        a:
          "Visibility should be consent-aware, role-based and purpose-specific. Medical aids may need claims, authorisation, coverage and clinical-context visibility, while employers should generally receive aggregated or permissioned programme visibility rather than inappropriate patient-level disclosure.",
      },
      {
        q: "Can sponsors create reward programmes?",
        a:
          "Yes, where configured. Rewards can be linked to evidence such as medication adherence, activity, sleep, wellness participation, device engagement and programme milestones, subject to consent and sponsor rules.",
      },
      {
        q: "Can users sign up to medical-aid or sponsor offerings inside Ambulant+?",
        a:
          "Yes, where the client has enabled that route. Ambulant+ users may be able to view participating scheme, HMO, employer or sponsor offerings and begin eligibility or signup workflows from inside the platform.",
      },
    ],
  },
  {
    title: "Privacy, safety and governance",
    icon: ShieldCheck,
    items: [
      {
        q: "How is patient privacy protected?",
        a:
          "Ambulant+ is designed around protected workspaces, role-based access, consent-aware sharing, auditability and careful data-handling language. Final compliance depends on deployment, contracts, policies and operating jurisdiction.",
      },
      {
        q: "Can employers see patient-level clinical information?",
        a:
          "Not by default. Employer or corporate-sponsor visibility should be limited by consent, role, purpose and law. Programme dashboards should generally emphasise aggregated and purpose-specific reporting.",
      },
      {
        q: "Does Ambulant+ provide automatic diagnosis?",
        a:
          "No. Ambulant+ may support insights, trends and workflow prompts, but diagnosis, prescribing, referral and escalation remain clinician-led responsibilities.",
      },
      {
        q: "When should users seek urgent care instead?",
        a:
          "Users should seek urgent or emergency care immediately for severe, rapidly worsening, life-threatening or concerning symptoms. Ambulant+ should not delay emergency care.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            FAQ
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Frequently asked questions.
          </h1>

          <p className="mt-6 text-lg leading-9 text-slate-600">
            Direct answers for patients, clinicians, medical aids, HMOs, employers, laboratories,
            pharmacies, riders and enterprise partners evaluating Ambulant+ Contactless Medicine.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Contact team <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/demos"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
            >
              Request demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 md:px-6">
        {faqGroups.map(({ title, icon: Icon, items }) => (
          <section key={title} className="glass-panel rounded-[34px] p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {title}
              </h2>
            </div>

            <div className="mt-6 grid gap-4">
              {items.map((item) => (
                <div
                  key={item.q}
                  className="rounded-3xl border border-white/80 bg-white/78 p-5 shadow-sm"
                >
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{item.q}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Still deciding?
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                The best way to understand Ambulant+ is to walk through a real care journey.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Patients, clinicians, laboratories, pharmacies, riders, medical aids and partners
                can request a structured walkthrough built around the workflow they need to evaluate.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/demos"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
              >
                Request demo <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={`mailto:${site.supportEmail}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Email support <ArrowRight className="h-4 w-4" />
              </a>
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