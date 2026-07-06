import Link from 'next/link';

export const metadata = {
  title: 'Flexible Payment and Pay Later Options | Ambulant+ Clinician',
  description:
    'Flexible instalment and pay later information for Ambulant+ clinician onboarding.',
};

const sections = [
  {
    title: 'Commitment to Complete Payments',
    body: [
      'By selecting the extended payment option, the clinician confirms their commitment to settle the full onboarding fee of R26,500 in accordance with the selected payment schedule.',
      'Payments commence on the 1st calendar month following training commencement.',
      'The selected instalment plan forms part of the clinician’s onboarding agreement.',
      'Requests to adjust payment arrangements must be submitted to finance@cloventechnology.com and are subject to approval.',
    ],
    subheading: 'Where applicable:',
    bullets: [
      'Debit Order users will be required to complete a Debit Order Mandate.',
      'EFT and Card users will receive scheduled payment links or instructions.',
    ],
  },
  {
    title: 'Platform Access & Activation',
    body: [
      'The extended payment option provides phased access to the Ambulant+ platform.',
    ],
    bullets: [
      'Training access is granted upon receipt of the initial commitment payment.',
      'Platform features, device activation, and advanced tools are progressively enabled in line with payment compliance.',
      'Full platform activation and certification are confirmed upon settlement of the final instalment.',
    ],
  },
  {
    title: 'Late or Missed Payments',
    body: [
      'Failure to make scheduled payments may result in temporary suspension of platform access.',
      'Repeated or unresolved non-payment may lead to permanent account deactivation, withdrawal of platform privileges, and recall or disabling of issued IoMT devices where applicable.',
    ],
  },
  {
    title: 'Device Dispatch & Practice Commencement',
    body: [
      'IoMT device dispatch and full clinical activation are aligned with onboarding progress and payment adherence.',
      'Clinicians may commence practice after completing training and meeting minimum activation requirements.',
      'Continued access remains conditional on compliance with the agreed payment plan.',
    ],
  },
];

export default function FlexiblePaymentAndPayLaterPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-800">
            Ambulant+ Clinician Onboarding
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Flexible instalments and pay later options
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            These terms explain how extended payment arrangements, phased platform access,
            device dispatch, and onboarding activation work for clinicians who choose a
            flexible payment or pay later pathway.
          </p>

          <div className="mt-8 space-y-5">
            {sections.map((section) => (
              <section key={section.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-black text-slate-950">{section.title}</h2>

                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                  {section.body.map((item) => (
                    <p key={item}>{item}</p>
                  ))}

                  {section.subheading ? (
                    <p className="font-extrabold text-slate-800">{section.subheading}</p>
                  ) : null}

                  {section.bullets?.length ? (
                    <ul className="list-disc space-y-2 pl-5">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
            <h2 className="font-black">Important note</h2>
            <p className="mt-2">
              Clinicians who complete onboarding via full or flexible payment receive immediate
              full activation and priority processing. The Pay Later option is intended for
              flexibility and may involve phased access.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <Link href="/auth/signup" className="rounded-full bg-indigo-600 px-5 py-2 font-extrabold text-white hover:bg-indigo-700">
              Return to clinician application
            </Link>
            <Link href="/terms" className="rounded-full border border-slate-200 bg-white px-5 py-2 font-extrabold text-slate-700 hover:bg-slate-50">
              Terms
            </Link>
            <Link href="/privacy" className="rounded-full border border-slate-200 bg-white px-5 py-2 font-extrabold text-slate-700 hover:bg-slate-50">
              Privacy policy
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
