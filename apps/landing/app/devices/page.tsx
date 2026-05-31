import Link from "next/link";
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  Ear,
  HeartPulse,
  RadioTower,
  ShieldCheck,
  Stethoscope,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import DeviceShowcase from "@/components/DeviceShowcase";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import SectionShell from "@/components/SectionShell";

export const metadata = {
  title: "Device-supported Contactless Medicine",
  description:
    "Ambulant+ supports a defined connected-device ecosystem: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing, mapped to clinician-led Contactless Medicine workflows.",
  keywords: [
    "Health Monitor",
    "remote health monitor",
    "6 in 1 health monitor",
    "Digital Stethoscope",
    "digital stethoscope",
    "remote stethoscope",
    "digital auscultation",
    "remote auscultation",
    "HD Otoscope",
    "digital otoscope",
    "remote otoscope",
    "NexRing",
    "smart ring health monitor",
    "connected medical devices",
    "integrated medical hardware",
    "IoMT devices South Africa",
    "iomt devices South Africa",
    "Internet of Medical Things devices",
    "remote patient monitoring devices",
    "continuous vitals devices",
    "home vitals devices",
    "remote diagnostic devices",
    "clinical data devices",
    "device-supported telemedicine",
    "virtual consultation devices",
    "telemedicine with stethoscope",
    "telemedicine with otoscope",
    "telemedicine with vitals",
  ],
};

const deviceCategories: Array<{
  title: string;
  subtitle: string;
  body: string;
  icon: LucideIcon;
  measurements: string[];
  clinicalUse: string[];
}> = [
  {
    title: "Health Monitor",
    subtitle: "Multi-parameter home vital-sign workflow",
    body:
      "The Health Monitor supports structured capture of core physiological parameters so clinicians can review objective context during appropriate remote-care journeys.",
    icon: HeartPulse,
    measurements: [
      "Blood pressure",
      "Heart rate",
      "Blood oxygen saturation",
      "Body temperature",
      "Blood glucose where applicable",
      "ECG screening support",
    ],
    clinicalUse: [
      "Helps reduce reliance on patient estimates.",
      "Supports chronic-condition monitoring and follow-up.",
      "Provides structured vitals context for clinician review.",
    ],
  },
  {
    title: "Digital Stethoscope",
    subtitle: "Remote auscultation support",
    body:
      "The Digital Stethoscope supports capture, playback and clinician review of heart and lung sounds in device-supported virtual consultations.",
    icon: Stethoscope,
    measurements: [
      "Heart sounds",
      "Lung sounds",
      "Recorded auscultation clips",
      "Playback for review",
      "Remote sharing where enabled",
    ],
    clinicalUse: [
      "Extends the clinical examination beyond video alone.",
      "Supports respiratory and cardiovascular review workflows.",
      "Improves documentation and follow-up where sound capture is clinically useful.",
    ],
  },
  {
    title: "HD Otoscope",
    subtitle: "High-definition visual inspection workflow",
    body:
      "The HD Otoscope supports image and video capture for ear assessment and selected visual inspection workflows where remote review is appropriate.",
    icon: Ear,
    measurements: [
      "Ear canal imaging",
      "Still image capture",
      "Video-supported review",
      "Follow-up comparison",
      "Structured clinician visibility",
    ],
    clinicalUse: [
      "Adds visual inspection where standard video consultation is limited.",
      "Supports ENT review pathways where clinically appropriate.",
      "Helps document findings and treatment progress.",
    ],
  },
  {
    title: "NexRing",
    subtitle: "Longitudinal wearable signal layer",
    body:
      "NexRing supports longitudinal wellness and readiness signals, helping Ambulant+ understand how a patient’s physiology changes beyond a single appointment.",
    icon: Watch,
    measurements: [
      "Heart-rate trends",
      "HRV-style readiness context",
      "Sleep and recovery signals",
      "Activity patterns",
      "Sleep SpO₂ where supported",
      "Temperature-variation context",
    ],
    clinicalUse: [
      "Supports trend-aware care rather than isolated snapshots.",
      "Adds recovery, sleep and activity context to patient journeys.",
      "Can support fertility and wellness features where configured and clinically appropriate.",
    ],
  },
];

const comparisonRows = [
  {
    need: "Vital signs",
    telemedicine: "Often unavailable or self-reported",
    contactless: "Measured through supported Health Monitor workflows",
  },
  {
    need: "Heart and lung sounds",
    telemedicine: "Usually unavailable",
    contactless: "Captured through Digital Stethoscope workflows",
  },
  {
    need: "Ear and selected visual inspection",
    telemedicine: "Limited by ordinary camera quality",
    contactless: "Supported by HD Otoscope image and video workflows",
  },
  {
    need: "Longitudinal trends",
    telemedicine: "Rarely available in structured form",
    contactless: "Supported by NexRing and connected patient records",
  },
  {
    need: "Care continuity",
    telemedicine: "Often separated from fulfilment and diagnostics",
    contactless: "Connected to MedReach, CarePort and InsightCore pathways",
  },
];

const governanceNotes = [
  "Device data supports clinician-led review; it does not create automatic diagnosis.",
  "Physical examination, urgent care or emergency services remain necessary where clinically indicated.",
  "Device availability, configuration and intended use depend on deployment, jurisdiction and supporting documentation.",
  "Manufacturer-supplied CE, regional FDA, TÜV and SAHPRA documentation can be referenced where applicable for the relevant device and market.",
  "Ambulant+ should avoid claiming approval, certification or clearance beyond the exact documentation available for each device, module and intended use.",
];

const patientBenefits = [
  "More complete remote-care preparation before consultation.",
  "Clearer tracking of vitals, symptoms, medication adherence and daily health context.",
  "Fewer avoidable trips where remote review is clinically appropriate.",
  "Better continuity between consultation, diagnostics, pharmacy fulfilment and follow-up.",
];

const clinicianBenefits = [
  "Objective device context instead of video-only consultation.",
  "Structured patient data before, during and after review.",
  "Audio, image and vital-sign workflows mapped to clinical documentation.",
  "Clear escalation boundaries when remote care is not sufficient.",
];

export default function DevicesPage() {
  return (
    <main>
      <VisualHero
        eyebrow="Supported devices"
        title="Device-supported workflows for clinical care beyond the clinic."
        body="Ambulant+ focuses on a defined Contactless Medicine device ecosystem — Health Monitor, Digital Stethoscope, HD Otoscope and NexRing — each mapped to clinician-led workflows, patient context and governance boundaries."
        imageSrc="/visuals/devices/device-ecosystem.webp"
        imageAlt="Ambulant+ defined contactless medicine device ecosystem"
        primaryCta={{ label: "Discuss device pathways", href: "/contact" }}
        secondaryCta={{ label: "View clinician workflow", href: "/clinicians" }}
        overlayTitle="Device scope"
        overlayItems={[
          { label: "Health Monitor", value: "Vitals, ECG and multi-parameter review." },
          { label: "Digital Stethoscope", value: "Heart and lung auscultation workflow." },
          { label: "HD Otoscope + NexRing", value: "Image-supported review and longitudinal signals." },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Why devices matter
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Contactless Medicine closes the clinical-context gap in ordinary telemedicine.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              Standard telemedicine is often limited to video, voice and patient self-reporting.
              Ambulant+ extends remote care with supported IoMT workflows so clinicians can review
              vitals, auscultation, visual inspection and longitudinal trends where appropriate.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/features"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Explore features <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/clinical-disclaimer"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Clinical boundaries <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[36px] p-5 md:p-6">
            <div className="rounded-[30px] bg-slate-950 p-6 text-white">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
                <span>Remote examination inputs</span>
                <RadioTower className="h-4 w-4" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {["Vitals", "Auscultation", "Visual inspection", "Longitudinal trends"].map((item) => (
                  <div key={item} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                    <CheckCircle2 className="h-5 w-5 text-cyan-200" />
                    <div className="mt-3 font-semibold text-white">{item}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Structured signal layer for clinician-led interpretation.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <DeviceShowcase />

      <SectionShell
        eyebrow="Defined device ecosystem"
        title="Four device categories. One governed clinical workflow."
        body="Ambulant+ avoids unsupported wearable sprawl. Each supported device category has a clear purpose inside the care journey."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {deviceCategories.map(({ title, subtitle, body, icon: Icon, measurements, clinicalUse }) => (
            <div key={title} className="glass-panel rounded-[34px] p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h3>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
                    {subtitle}
                  </div>
                </div>
              </div>

              <p className="mt-5 text-sm leading-8 text-slate-600">{body}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/70 bg-white/78 p-5">
                  <div className="text-sm font-semibold text-slate-950">Signals supported</div>
                  <div className="mt-3 grid gap-2">
                    {measurements.map((item) => (
                      <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/70 bg-white/78 p-5">
                  <div className="text-sm font-semibold text-slate-950">Clinical value</div>
                  <div className="mt-3 grid gap-2">
                    {clinicalUse.map((item) => (
                      <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Telemedicine gap analysis
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                The difference is not the video call. It is the clinical input layer.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Contactless Medicine is designed around the inputs that are usually missing from
                ordinary remote consultations: objective vitals, remote examination tools, trend
                context, diagnostics and fulfilment coordination.
              </p>
            </div>

            <div className="grid gap-3">
              {comparisonRows.map((row) => (
                <div key={row.need} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <div className="text-sm font-semibold text-white">{row.need}</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Standard telemedicine
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{row.telemedicine}</p>
                    </div>
                    <div className="rounded-2xl bg-cyan-300/10 p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
                        Ambulant+ Contactless Medicine
                      </div>
                      <p className="mt-2 text-sm leading-6 text-cyan-50">{row.contactless}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <WorkflowTimeline
        eyebrow="Device workflow"
        title="Signals become useful when the workflow is governed."
        body="Ambulant+ treats device data as structured context for appropriate care workflows, not as standalone automatic diagnosis."
        steps={[
          { title: "Prepare", body: "Patient profile, consent, device readiness and care context are prepared before review." },
          { title: "Pair", body: "Supported devices are connected through approved setup pathways." },
          { title: "Capture", body: "Vitals, auscultation, otoscopy or longitudinal signals are collected depending on the device." },
          { title: "Review", body: "Readings are presented in a structured patient or clinician workspace for interpretation." },
          { title: "Document", body: "Relevant signals can be attached to care notes, reports or follow-up actions where appropriate." },
          { title: "Escalate", body: "Patients are directed to urgent or in-person care where device-supported remote review is not sufficient." },
        ]}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-2 md:px-6 md:py-16">
        <div className="glass-panel rounded-[34px] p-7">
          <Activity className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            What patients gain
          </h2>
          <div className="mt-5 grid gap-3">
            {patientBenefits.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[34px] p-7">
          <ShieldCheck className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            What clinicians gain
          </h2>
          <div className="mt-5 grid gap-3">
            {clinicianBenefits.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Regulatory and clinical boundaries"
        title="Device confidence must stay tied to exact documentation, jurisdiction and intended use."
        body="Ambulant+ can present device certification and registration information where documentation supports it, while avoiding blanket claims that could misrepresent the regulatory position of a device, module or market."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {governanceNotes.map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-white/70 bg-white/78 p-5 text-sm leading-7 text-slate-600 shadow-sm"
            >
              {item}
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}