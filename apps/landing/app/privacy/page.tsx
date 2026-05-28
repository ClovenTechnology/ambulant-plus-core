export const metadata = {
  title: "Privacy Policy",
  description: "Ambulant+ privacy policy for public websites and protected platform workspaces.",
};

const sections = [
  ["Scope", "This Privacy Policy explains how Ambulant+ may collect, use, store and share personal information when users visit the public website or use connected Ambulant+ applications and protected workspaces."],
  ["Information we may process", "Depending on the service used, information may include account details, contact details, profile information, care preferences, appointment data, device-supported readings, medication records, support communications and technical logs."],
  ["Health-related information", "Health-related information is treated as sensitive information and is processed only where a lawful, operational, clinical, safety, consented or contracted basis applies."],
  ["How information is used", "Information may be used to provide services, support care workflows, manage accounts, coordinate bookings, support diagnostics and fulfilment operations, communicate with users, improve platform reliability and meet legal or governance obligations."],
  ["Lawful basis and consent", "Processing may be based on consent, contract performance, legitimate operational purposes, legal obligations, vital interests, healthcare operations or another lawful basis depending on jurisdiction and deployment context."],
  ["Sharing and role-based access", "Information may be shared with authorised clinicians, care teams, pharmacy fulfilment partners, delivery partners, laboratory partners, clients or sponsors only where appropriate permissions, contracts, role restrictions and legal bases apply."],
  ["Security and governance", "Ambulant+ is designed around protected access, environment-specific configuration, role-based permissions, auditability and responsible data handling."],
  ["Retention", "Information is retained only for as long as needed for the relevant purpose, legal requirement, operational need, clinical governance requirement or dispute-resolution requirement."],
  ["User rights", "Users may have rights to access, correct, delete, restrict or object to processing of their information, subject to legal and clinical-record limitations."],
  ["International transfers", "Where data is processed across borders, appropriate safeguards should be implemented according to applicable law and contractual controls."],
  ["Contact", "Privacy questions can be sent to the support or privacy contact published by Ambulant+."],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-20">
      <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Legal</div>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Privacy Policy</h1>
      <p className="mt-6 text-base leading-8 text-slate-600">
        This page sets out the current public privacy position for Ambulant+. Where a specific application, clinical service, partner programme or jurisdiction applies, additional privacy notices may be presented in the relevant protected workspace.
      </p>
      <div className="mt-8 grid gap-4">
        {sections.map(([title, body]) => (
          <section key={title} className="glass-panel rounded-[28px] p-6">
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-8 text-slate-600">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
