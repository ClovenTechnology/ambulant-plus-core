import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Ear,
  Eye,
  FileText,
  ShieldCheck,
  Smartphone,
  Stethoscope,
} from "lucide-react";
import CTA from "@/components/CTA";

export const metadata: Metadata = {
  title: "HD Otoscope Workflow Guide | Ambulant+ Resources",
  description:
    "Learn how the Ambulant+ HD Otoscope supports remote ear, nose, throat and skin assessment workflows through clinician-led virtual care, image capture, notes, review and escalation boundaries.",
  keywords: [
    "HD otoscope workflow",
    "digital otoscope",
    "connected otoscope",
    "remote ENT assessment",
    "virtual ear assessment",
    "remote otoscopy",
    "ear canal image capture",
    "skin image capture",
    "Contactless Medicine otoscope",
    "Ambulant+ HD Otoscope",
    "remote consultation devices",
    "IoMT otoscope",
    "home diagnostics",
  ],
  alternates: {
    canonical: "https://ambulantplus.co.za/resources/hd-otoscope-workflow",
  },
};

const setupSteps = [
  {
    title: "Charge and inspect the device",
    body:
      "Before first use, fully charge the HD Otoscope using the supplied cable and confirm that the device, camera tip and accessories are clean, intact and ready for guided use.",
  },
  {
    title: "Launch the supported app workflow",
    body:
      "Open the relevant Ambulant+ or supported device workflow on the mobile device, tablet or computer being used for the consultation.",
  },
  {
    title: "Choose the correct examination mode",
    body:
      "Use the otoscope workflow for ear canal review where appropriate. Depending on available attachments and workflow configuration, image capture may also support selected nose, throat or skin review pathways.",
  },
  {
    title: "Capture clear images or video",
    body:
      "Use steady positioning, adequate lighting and clinician guidance. Avoid force, deep insertion or repeated attempts if the patient is uncomfortable.",
  },
  {
    title: "Add notes and share for review",
    body:
      "Images or video clips may be saved with patient context, notes and timestamps, then reviewed during or after the virtual consultation where the workflow allows.",
  },
  {
    title: "Escalate when needed",
    body:
      "Remote otoscopy supports clinical context, but it does not replace urgent in-person assessment where there is severe pain, trauma, bleeding, sudden hearing loss, facial weakness, mastoid swelling or systemic illness.",
  },
];

const useCases = [
  "Ear pain review where remote assessment is clinically appropriate.",
  "Follow-up of suspected otitis externa or otitis media after clinician advice.",
  "Visual support for ear canal obstruction, wax concerns or discharge review.",
  "Selected throat, nostril or skin image capture where the supported workflow allows.",
  "Paediatric review support when parents or carers need guided visual documentation.",
  "Clinician comparison between baseline and follow-up images where saved records are available.",
];

const safetyBoundaries = [
  "Do not insert the device deeply into the ear canal.",
  "Do not use force if the patient has pain, bleeding, discharge or distress.",
  "Do not use remote otoscopy as a substitute for emergency or urgent clinical assessment.",
  "Do not present images as an automatic diagnosis; they support clinician-led review.",
  "Seek urgent care for severe ear pain, swelling behind the ear, fever, neurological symptoms, sudden hearing loss or trauma.",
  "Use age-appropriate, consent-aware and privacy-aware workflows for children and vulnerable patients.",
];

const workflowBenefits = [
  {
    title: "Better visual context",
    body:
      "Remote consultation becomes more useful when the clinician can review selected images rather than relying only on symptom description.",
    icon: Eye,
  },
  {
    title: "Structured follow-up",
    body:
      "Saved images can help compare a concern over time, especially when treatment response or deterioration needs review.",
    icon: FileText,
  },
  {
    title: "Patient convenience",
    body:
      "When appropriate, patients may avoid unnecessary travel for simple visual review or follow-up while still preserving escalation boundaries.",
    icon: Smartphone,
  },
  {
    title: "Clinician-led judgement",
    body:
      "The HD Otoscope supports clinical context. It does not replace the clinician, in-person examination or urgent care when needed.",
    icon: Stethoscope,
  },
];

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700"
        >
          Back to resources <ArrowRight className="h-4 w-4 rotate-180" />
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Device workflow guide
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-6xl">
              HD Otoscope workflow guide.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              The Ambulant+ HD Otoscope workflow supports clinician-led remote
              review by adding visual context to selected ear, nose, throat and
              skin-related concerns where remote assessment is appropriate.
            </p>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              It is designed to support better virtual consultation, saved image
              review and follow-up comparison — while preserving clear clinical
              escalation boundaries.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/devices"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Explore devices <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact?type=device-support"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Ask for setup help <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[36px] bg-slate-950 p-6 text-white shadow-glow">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
              Quick workflow
            </div>

            <div className="mt-6 space-y-3">
              {[
                "Charge the HD Otoscope before first use.",
                "Open the supported app or consultation workflow.",
                "Use clinician guidance for safe image capture.",
                "Save images or video with notes where available.",
                "Escalate if symptoms require in-person or urgent care.",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Setup sequence
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Use the device carefully, clearly and with clinical purpose.
          </h2>
          <p className="mt-5 text-sm leading-8 text-slate-600 md:text-base">
            The HD Otoscope should be used to support clinician-led assessment,
            not to encourage unguided self-diagnosis.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {setupSteps.map((step, index) => (
            <div key={step.title} className="glass-panel rounded-[30px] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[34px] bg-cyan-50/70 p-6 md:p-8">
            <Ear className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
              Typical remote-care use cases.
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              HD Otoscope workflows are most useful when visual context can
              improve a clinician-led virtual consultation or follow-up review.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {useCases.map((item) => (
              <div key={item} className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-sm">
                <Camera className="h-5 w-5 text-cyan-700" />
                <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="rounded-[36px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Safety boundaries
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                Remote visual review must never become reckless self-diagnosis.
              </h2>
              <p className="mt-5 text-sm leading-8 text-slate-300 md:text-base">
                The HD Otoscope adds context to care. It does not replace clinical
                judgement, emergency care, or in-person examination where needed.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {safetyBoundaries.map((item) => (
                <div key={item} className="rounded-3xl bg-white/10 p-5">
                  <AlertTriangle className="h-5 w-5 text-cyan-200" />
                  <p className="mt-3 text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {workflowBenefits.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6 md:p-8">
          <ShieldCheck className="h-7 w-7 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Clinical reminder.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
            Use HD Otoscope images as supportive information for clinician-led
            review. Seek urgent medical attention where symptoms are severe,
            worsening, associated with trauma, neurological symptoms, systemic
            illness, sudden hearing loss or significant distress.
          </p>
        </div>

        <div className="mt-8">
          <CTA />
        </div>
      </section>
    </main>
  );
}