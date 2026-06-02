import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Patient Account Access Guide | Ambulant+ Resources",
  description:
    "Learn how patients create an Ambulant+ account, choose standard or Premium access, sign in with email and password, use email OTP, set up passkeys and recover access safely.",
  keywords: [
    "Ambulant+ patient account",
    "Ambulant+ sign up",
    "patient app login",
    "patient account access",
    "passkey sign in",
    "email OTP login",
    "passwordless login healthcare",
    "health app passkey",
    "secure patient login",
    "Premium patient signup",
    "standard patient signup",
    "Contactless Medicine account",
    "personal health management account",
    "Ambulant+ resources",
  ],
  alternates: {
    canonical: absoluteUrl("/resources/patient-account-access"),
  },
  openGraph: {
    title: "Patient Account Access Guide | Ambulant+ Resources",
    description:
      "Standard signup, Premium signup, email/password login, email OTP, passkey setup, recovery and secure patient access guidance for Ambulant+.",
    url: absoluteUrl("/resources/patient-account-access"),
    siteName: site.name,
    images: [
      {
        url: absoluteUrl("/og/ambulant-og.webp"),
        width: 1200,
        height: 630,
        alt: "Ambulant+ secure patient account access guide",
      },
    ],
    locale: "en_ZA",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Patient Account Access Guide | Ambulant+ Resources",
    description:
      "How to create, secure and access an Ambulant+ patient account using password, email OTP and passkey where supported.",
    images: [absoluteUrl("/og/ambulant-og.webp")],
  },
};

const accountRoutes = [
  {
    title: "Standard patient account",
    body:
      "Create a protected patient workspace for your profile, appointments, records, care context, reminders, CarePort medicine fulfilment and MedReach diagnostics where available.",
    icon: UserRoundCheck,
    cta: "Create standard account",
    href: `${site.patientAppUrl}/auth/signup`,
  },
  {
    title: "Premium patient access",
    body:
      "Choose Premium where advanced health intelligence, richer trends, supported device pathways, care-centre features or eligible promotional bundles are available.",
    icon: BadgeCheck,
    cta: "Explore Premium signup",
    href: `${site.patientAppUrl}/auth/signup/premium`,
  },
  {
    title: "Returning patient sign-in",
    body:
      "Use your email and password, request a one-time email code or sign in with a passkey after you have added one from Security settings.",
    icon: LockKeyhole,
    cta: "Sign in to Patient App",
    href: `${site.patientAppUrl}/auth/login`,
  },
];

const setupSteps = [
  {
    title: "Choose your access route",
    body:
      "Start with a standard patient account or select Premium where premium services, device bundles or care-centre features are available for your pathway.",
    icon: CreditCard,
  },
  {
    title: "Create your identity profile",
    body:
      "Enter your name, email, date of birth, contact details and required address information so your workspace can support bookings, fulfilment and care coordination.",
    icon: UserRoundCheck,
  },
  {
    title: "Set a strong password",
    body:
      "Use a password with at least 8 characters, including uppercase, lowercase, number and symbol, then keep it private.",
    icon: KeyRound,
  },
  {
    title: "Complete profile readiness",
    body:
      "Add medical-aid details where supported, allergies, medication context, delivery preferences and other information needed for safer care workflows.",
    icon: WalletCards,
  },
  {
    title: "Add a passkey after first sign-in",
    body:
      "After you are inside the patient app, go to Settings → Security → Add passkey to enable faster future sign-in on supported devices.",
    icon: Fingerprint,
  },
  {
    title: "Use secure recovery options",
    body:
      "If you forget your password, use the password recovery flow. If you need passwordless access, request a one-time email code where supported.",
    icon: ShieldCheck,
  },
];

const loginMethods = [
  {
    title: "Email and password",
    body:
      "The standard returning-patient method. Enter the email attached to your patient account and your password.",
    icon: Mail,
  },
  {
    title: "Email OTP",
    body:
      "Request a 6-digit sign-in code by email. The code is time-limited, can be used only once and should never be shared with anyone.",
    icon: MessageSquareText,
  },
  {
    title: "Passkey sign-in",
    body:
      "After setup, use your device unlock method, such as Face ID, fingerprint, Windows Hello, Android device lock, device PIN, password manager or security key where supported.",
    icon: Fingerprint,
  },
];

const passkeyFacts = [
  "A passkey must be added after you first sign in with email/password or email OTP.",
  "Passkey login is not a separate Face ID route or separate fingerprint route; it uses your device’s supported secure unlock method.",
  "Ambulant+ stores a public credential reference, not your fingerprint, face scan or device PIN.",
  "Your device keeps the private key securely and unlocks it locally after you confirm it is really you.",
  "If no passkey exists yet, sign in with email first and add one from Settings → Security.",
  "You can manage or remove passkeys from Security settings where enabled.",
];

const safeUseRules = [
  "Use your own email address and device for account setup wherever possible.",
  "Do not share your password, OTP code, device PIN or passkey confirmation with anyone.",
  "Ambulant+ staff should never ask for your password or one-time sign-in code.",
  "Use password reset only from the official Ambulant+ patient app flow or official email link.",
  "Keep your phone, tablet, computer and password manager protected with a device lock.",
  "In a medical emergency, contact local emergency services rather than relying on account access or remote consultation.",
];

const accountFaqs = [
  {
    question: "Do I need to create a passkey before I can use Ambulant+?",
    answer:
      "No. You first sign up or sign in using email and password or email OTP. After you are inside the patient app, you can add a passkey from Settings, then use passkey sign-in in future on supported devices.",
  },
  {
    question: "Does Ambulant+ store my fingerprint or face scan?",
    answer:
      "No. Ambulant+ does not store your fingerprint, face scan or device PIN. Your device uses those methods locally to unlock a private key. Ambulant+ stores the public credential reference needed to confirm the sign-in securely.",
  },
  {
    question: "What happens if I click Sign in with passkey before adding one?",
    answer:
      "No passkey will be available yet. Sign in with email and password or email OTP first, then add a passkey from Settings → Security.",
  },
  {
    question: "Can I still use email OTP if I forget my password?",
    answer:
      "Where supported, email OTP lets you request a one-time code for sign-in. You can also use the password recovery flow to reset your password safely.",
  },
  {
    question: "What is the difference between Standard and Premium signup?",
    answer:
      "Standard access is the starting patient workspace. Premium access may unlock advanced analytics, richer health trends, supported device insights, family or care-centre features and eligible promotional pathways where available.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: metadata.title,
  description: metadata.description,
  about: [
    "patient account access",
    "passkey sign in",
    "email OTP",
    "secure patient login",
    "Contactless Medicine",
  ],
  publisher: {
    "@type": "Organization",
    name: site.name,
    url: site.url,
  },
  inLanguage: "en-ZA",
  mainEntityOfPage: absoluteUrl("/resources/patient-account-access"),
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: accountFaqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Resources",
      item: absoluteUrl("/resources"),
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Patient Account Access",
      item: absoluteUrl("/resources/patient-account-access"),
    },
  ],
};

export default function PatientAccountAccessResourcePage() {
  return (
    <main>
      <Script
        id="patient-account-access-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Script
        id="patient-account-access-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Script
        id="patient-account-access-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl">
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:text-slate-950"
          >
            ← Back to resources
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
                Patient account access
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-6xl">
                Create, protect and access your Ambulant+ patient workspace.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
                Ambulant+ patient access is designed around safe identity, clear recovery options and future-ready sign-in. Patients can create a standard or Premium account, sign in with email and password, request a one-time email code, and add a passkey for faster access on supported devices.
              </p>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
                This guide explains how each access method works, what patients should set up first, how passkeys protect privacy and what to do if a sign-in method is not available yet.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={site.patientAppUrl}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
                >
                  Access Patient App <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  href="/resources/find-a-doctor-and-book-appointment"
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800 shadow-sm"
                >
                  Next: book appointment <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Secure access model
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                One account. Multiple safe ways to sign in.
              </h2>
              <div className="mt-6 grid gap-3">
                {[
                  "Create a standard or Premium patient account.",
                  "Sign in with email and password or email OTP.",
                  "Add passkey from Settings → Security after first sign-in.",
                  "Use passkey login with device unlock where supported.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/10 p-4">
                    <CheckCircle2 className="mb-2 h-5 w-5 text-cyan-200" />
                    <p className="text-sm leading-7 text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Account routes"
        title="Choose the right starting point."
        body="Patient access starts with the pathway that matches your needs. Standard access gets you into the protected workspace; Premium access is for enhanced personal-health management where available."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {accountRoutes.map(({ title, body, icon: Icon, cta, href }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              <a
                href={href}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"
              >
                {cta} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Setup sequence
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            The safest patient account flow is stepwise.
          </h2>
          <p className="mt-5 text-sm leading-8 text-slate-600 md:text-base">
            Ambulant+ should guide patients from basic account creation to richer security, profile readiness and care continuity without making passkey setup feel like a barrier.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {setupSteps.map(({ title, body, icon: Icon }) => (
            <div key={title} className="rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-sm">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-[34px] bg-cyan-50/70 p-6 md:p-8">
            <Smartphone className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
              Sign-in methods patients can understand.
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              The login page should keep the language simple: password, email OTP and passkey where supported. Passkey is the secure umbrella term; Face ID, fingerprint and device lock are examples of device unlock methods.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {loginMethods.map(({ title, body, icon: Icon }) => (
              <div key={title} className="glass-panel rounded-[30px] p-6">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[34px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
            <Fingerprint className="h-8 w-8 text-cyan-200" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">
              How passkey sign-in works.
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-300">
              Sign in with passkey lets patients access their Ambulant+ patient account using the secure unlock method already supported by their device, browser, password manager or security key.
            </p>
            <div className="mt-6 rounded-3xl border border-cyan-200/20 bg-white/10 p-5">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
                Setup path
              </div>
              <p className="mt-3 text-sm leading-8 text-slate-200">
                Sign in first → open Settings → Security → Add passkey → confirm with device unlock → use Sign in with passkey next time.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {passkeyFacts.map((item) => (
              <div key={item} className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-cyan-700" />
                <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6 md:p-8">
          <LockKeyhole className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Privacy wording for patients.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-700 md:text-base">
            Ambulant+ does not store your fingerprint, face scan or device PIN. Your fingerprint or face scan never leaves your device. Your device only confirms securely that it is really you, then Ambulant+ uses the public credential reference to complete sign-in.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-panel rounded-[34px] p-6 md:p-8">
            <ShieldCheck className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
              Safe account habits.
            </h2>
            <div className="mt-6 space-y-3">
              {safeUseRules.slice(0, 5).map((item) => (
                <div key={item} className="rounded-2xl bg-cyan-50/70 p-4">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
            <AlertTriangle className="h-8 w-8 text-cyan-200" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">
              Account access is not emergency care.
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-300">
              Ambulant+ helps patients access their protected workspace and remote-care tools. It is not an emergency service. If symptoms are severe, rapidly worsening or life-threatening, contact local emergency services immediately.
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-4">
              <AlertTriangle className="mb-2 h-5 w-5 text-cyan-200" />
              <p className="text-sm leading-7 text-slate-200">{safeUseRules[5]}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Questions patients ask
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Clear answers reduce login anxiety.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {accountFaqs.map((item) => (
            <div key={item.question} className="glass-panel rounded-[30px] p-6">
              <h3 className="text-lg font-semibold text-slate-950">{item.question}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <CTA />
        </div>
      </section>
    </main>
  );
}
