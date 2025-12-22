export default function PrivacyPolicyPage() {
  const updated = '22 December 2025 • 13:04:00';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Privacy Policy</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ambulant+ (Powered by Cloven Technology group) • Last updated: <span className="font-semibold">{updated}</span>
            </p>
          </div>

          <a
            href="/auth/signup"
            className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100 sm:inline-block"
          >
            Back to Sign Up
          </a>
        </div>

        <div className="mt-8 space-y-10 text-sm leading-relaxed text-slate-700">
          {/* 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">1) Who we are</h2>
            <p>
              This Privacy Policy explains how Ambulant+ and its affiliated entities (collectively, <span className="font-semibold">“Cloven Technology,” “we,” “us”</span>)
              collect, use, disclose, transfer, store, and protect your personal information when you use our websites,
              mobile applications, patient and clinician portals, connected device integrations (IoMT), and related services (collectively, the <span className="font-semibold">“Services”</span>).
            </p>
            <p>
              Ambulant+ is a healthcare technology platform supporting virtual consultations, care coordination,
              integrated logistics (e.g., e-prescription fulfillment and delivery; lab logistics), and optional connected
              device data streaming for remote monitoring.
            </p>
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <span className="font-extrabold">Important:</span> Ambulant+ is not an emergency service. If you believe you
              are experiencing a medical emergency, contact your local emergency number immediately.
            </p>
          </section>

          {/* 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">2) Scope and roles (Controller / Operator)</h2>
            <p>
              Depending on how you use the Services, we may act as a <span className="font-semibold">data controller / responsible party</span> (deciding why and how data is processed) or as an <span className="font-semibold">operator / processor</span> (processing data on behalf of a clinic, clinician, employer program, insurer, or partner).
              Where we act as a processor/operator, the relevant partner’s privacy notices may also apply.
            </p>
            <p>
              Clinicians on Ambulant+ may operate as independent healthcare providers or under clinics/practices. They may
              have their own recordkeeping and privacy obligations under applicable healthcare regulations and professional
              rules. We encourage you to review any provider or clinic notices presented to you in the Services.
            </p>
          </section>

          {/* 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">3) Information we collect</h2>

            <div className="rounded-3xl border border-slate-200 p-5">
              <div className="font-extrabold text-slate-950">A. Information you provide</div>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <span className="font-semibold">Account & identity data:</span> name, email, phone number (if added), password (stored as a secure hash), authentication tokens, profile preferences.
                </li>
                <li>
                  <span className="font-semibold">Patient-provided health information:</span> symptoms, history, medications, allergies, vitals entered manually, uploaded documents/images, care notes you add, and family/dependent profiles where you are authorized to manage them.
                </li>
                <li>
                  <span className="font-semibold">Communications:</span> messages to clinicians/support, feedback, survey responses, call/chat content where enabled and consented.
                </li>
                <li>
                  <span className="font-semibold">Payments & billing:</span> transaction metadata, invoices/receipts, refunds, and payer details required for billing; payment card data is typically handled by regulated payment processors, not stored directly by us.
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <div className="font-extrabold text-slate-950">B. Data from devices and integrations (IoMT / Health platforms)</div>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <span className="font-semibold">Device telemetry & vitals:</span> readings such as heart rate, SpO₂, temperature, blood pressure trends, and other physiological signals depending on connected devices and permissions.
                </li>
                <li>
                  <span className="font-semibold">Integration data:</span> data imported from Apple Health, Google Fit, Samsung Health, or device SDKs when you connect them and grant permissions.
                </li>
                <li>
                  <span className="font-semibold">Streaming session metadata:</span> connection state, timestamps, device identifiers, network quality metrics, and technical logs necessary to provide stable real-time sessions.
                </li>
              </ul>
              <p className="mt-3 text-xs text-slate-600">
                Note: Some device data is optional and only collected if you connect a device/integration and consent to the requested permissions.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <div className="font-extrabold text-slate-950">C. Information collected automatically</div>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <span className="font-semibold">Usage & log data:</span> pages/screens visited, feature usage, timestamps, clicks, error logs, crash reports.
                </li>
                <li>
                  <span className="font-semibold">Device & browser data:</span> OS, device model, app version, IP address, language, approximate region, identifiers needed for security/fraud prevention.
                </li>
                <li>
                  <span className="font-semibold">Cookies & similar technologies:</span> for session management, security, preferences, and analytics (see Cookies section below).
                </li>
              </ul>
            </div>
          </section>

          {/* 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">4) Sensitive health data</h2>
            <p>
              Health information is generally considered sensitive or “special category” data. We handle it with
              heightened safeguards and only process it when a lawful basis applies (for example: to provide healthcare
              services you request, with your consent, to comply with legal obligations, or as permitted by applicable
              health laws).
            </p>
          </section>

          {/* 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">5) How we use information</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-semibold">To provide the Services:</span> create accounts, authenticate users, enable virtual visits, manage scheduling, support messaging, store and display your health records and documents, and enable connected device features you activate.
              </li>
              <li>
                <span className="font-semibold">Clinical safety & care continuity:</span> support clinician workflows, documentation, clinical reconciliation, and continuity across visits.
              </li>
              <li>
                <span className="font-semibold">Operations:</span> customer support, quality assurance, incident response, platform reliability, performance monitoring, and capacity planning.
              </li>
              <li>
                <span className="font-semibold">Security & fraud prevention:</span> detect suspicious activity, prevent abuse, protect accounts, and maintain audit logs.
              </li>
              <li>
                <span className="font-semibold">Billing & finance:</span> process payments, generate invoices/receipts, manage refunds/chargebacks, perform accounting and financial reporting.
              </li>
              <li>
                <span className="font-semibold">Compliance & legal:</span> meet regulatory obligations, respond to lawful requests, enforce terms, and handle disputes.
              </li>
              <li>
                <span className="font-semibold">Product improvement:</span> improve features and usability; where feasible, we use aggregated or de-identified data for analytics and research-like insights.
              </li>
              <li>
                <span className="font-semibold">InsightCore / AI-assisted features:</span> generate wellness/clinical insights, surface trends, and support clinician review and feedback loops. We do not intend for AI output to replace clinician judgement.
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">6) Legal bases (high-level)</h2>
            <p>
              Depending on your location and how you use the Services, our processing is based on one or more of the
              following: performance of a contract (providing the Services), your consent (for optional features and
              sensitive data where required), compliance with legal obligations, protection of vital interests, legitimate
              interests (security, fraud prevention, service improvement), and where applicable, health-related lawful
              bases permitted by healthcare regulations.
            </p>
          </section>

          {/* 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">7) When we share information</h2>
            <p>We do not sell your personal information. We may share information in the following situations:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-semibold">With clinicians and care teams</span> you choose to engage with, to deliver consultations and continuity of care.
              </li>
              <li>
                <span className="font-semibold">With logistics and care services</span> (e.g., eRx delivery, lab collection/logistics) when you request or authorize such services.
              </li>
              <li>
                <span className="font-semibold">With service providers</span> who help operate our platform (hosting, databases, monitoring, communications, support tools) under contractual confidentiality and security requirements.
              </li>
              <li>
                <span className="font-semibold">With payment processors</span> to complete transactions, manage fraud, and issue refunds.
              </li>
              <li>
                <span className="font-semibold">With legal/regulatory authorities</span> when required by law, court order, or to protect rights, safety, and security.
              </li>
              <li>
                <span className="font-semibold">Business transfers</span> (merger, acquisition, financing, reorganization) subject to appropriate protections.
              </li>
              <li>
                <span className="font-semibold">With your consent</span> or at your direction (for example, exporting records to another provider).
              </li>
            </ul>
          </section>

          {/* 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">8) Data integrity, audit trails, and “ledger” concepts</h2>
            <p>
              To support trust, integrity, and clinical-grade traceability, we may use tamper-evident logging or ledger-like
              mechanisms. Where used, we aim to minimize what is written to such systems (for example, storing references,
              hashes, or audit metadata rather than raw medical content). Certain audit records may be difficult or impossible
              to delete without compromising integrity; in such cases we restrict access, expire keys, and/or de-identify
              records where appropriate and lawful.
            </p>
          </section>

          {/* 9 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">9) Retention</h2>
            <p>
              We keep information only as long as necessary for the purposes described in this policy, including providing
              the Services, maintaining security and auditability, meeting clinical documentation needs, billing, dispute
              resolution, and complying with legal obligations. Retention periods can vary by jurisdiction and the type of
              record (for example: clinical records may be subject to minimum retention periods).
            </p>
          </section>

          {/* 10 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">10) Security (Tech + Ops)</h2>
            <p>
              We implement administrative, technical, and physical safeguards designed to protect your information, including:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Encryption in transit (TLS) and encryption at rest where appropriate.</li>
              <li>Role-based access controls and least-privilege permissions.</li>
              <li>Security logging, monitoring, rate limiting, and anomaly detection.</li>
              <li>Environment separation (development/staging/production) and secure secret management.</li>
              <li>Regular patching, dependency management, and secure SDLC practices.</li>
              <li>Incident response processes and operational runbooks.</li>
            </ul>
            <p className="text-xs text-slate-600">
              No system can be guaranteed 100% secure. You play a role too: use a strong password, enable available
              security features, and keep devices updated.
            </p>
          </section>

          {/* 11 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">11) International transfers</h2>
            <p>
              We may process and store information in countries where we or our providers operate. Where required, we use
              appropriate safeguards for cross-border transfers (such as contractual protections and equivalent security
              measures) consistent with applicable law.
            </p>
          </section>

          {/* 12 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">12) Your rights and choices</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Access and obtain a copy of your personal information.</li>
              <li>Correct inaccurate or incomplete information.</li>
              <li>Delete information (where legally permissible) or request de-identification.</li>
              <li>Object to certain processing or request restriction.</li>
              <li>Withdraw consent for optional processing (where applicable).</li>
              <li>Data portability (where applicable).</li>
            </ul>
            <p>
              You can typically update profile details in-app. For other requests, contact us using the details below.
            </p>
          </section>

          {/* 13 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">13) Cookies and analytics</h2>
            <p>
              We use cookies/local storage and similar technologies to keep you signed in, remember preferences, secure the
              platform, and understand usage patterns. Where required, we provide controls for consent and opt-out. Some
              cookies are strictly necessary for the Services to function.
            </p>
          </section>

          {/* 14 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">14) Children and dependent profiles</h2>
            <p>
              Ambulant+ is generally intended for users who can consent to healthcare services under applicable law. Where
              dependent profiles are supported (for example, a parent/guardian managing a child), we require appropriate
              authority and may request additional verification. If you believe a minor has provided information without
              proper authorization, contact us.
            </p>
          </section>

          {/* 15 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">15) Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will post the updated version and revise the “Last updated”
              date. If changes are material, we may provide additional notice within the Services.
            </p>
          </section>

          {/* 16 */}
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-950">16) Contact</h2>
            <p>
              For privacy questions, requests, or complaints, contact:
            </p>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="font-extrabold text-slate-950">Our Privacy Office</div>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="font-semibold">Email:</span> privacy@cloventechnology.com
                </li>
                <li>
                  <span className="font-semibold">Address:</span> 0B Meadowbrook Ln, Epsom Downs, Bryanston 2152
                </li>
                <li>
                  <span className="font-semibold">Information and Data Protection Officer:</span> Lerato Teeke
                </li>
              </ul>
              <p className="mt-3 text-xs text-slate-600">
                If you are in a region with a regulator (e.g., an Information Regulator / Data Protection Authority), you may also have the right to lodge a complaint with that authority.
              </p>
            </div>
          </section>

          <div className="pt-2 text-xs text-slate-500">
            This document was last updated on 22 DEcember 2025 and digitally signed by Lerato Teeke. © 2025 Cloven Technology Inc. San Francisco, CA
          </div>
        </div>
      </div>
    </main>
  );
}
