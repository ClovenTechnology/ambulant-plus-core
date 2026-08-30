'use client';

import type {
  PatientClinicalContext,
  PatientContextStatus,
} from './patientContext';

function text(value: unknown, fallback = '—') {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function date(value: unknown) {
  if (!value) return 'Date not recorded';
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : String(value);
}

function badgeClass(value: unknown) {
  const state = String(value ?? '').toLowerCase();
  if (state.includes('active') || state.includes('current')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (state.includes('resolv') || state.includes('remission') || state.includes('inactive')) {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs italic text-slate-500">{children}</div>;
}

export default function LongitudinalHistory({
  context,
  status,
  error,
}: {
  context: PatientClinicalContext | null;
  status: PatientContextStatus;
  error?: string | null;
}) {
  if (status === 'simulation') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Simulation session: production longitudinal patient records are intentionally not loaded.
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="text-sm text-slate-500">Loading authorised longitudinal patient context…</div>;
  }

  if (status !== 'ready' || !context) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
        <div className="font-semibold">Longitudinal record unavailable</div>
        <div className="mt-1 text-xs leading-relaxed">
          Do not interpret this as “no history”. Allergy, medication, condition, case and prior-result status could not be verified
          {error ? ` (${error})` : ''}.
        </div>
      </div>
    );
  }

  const conditions = context.conditions || [];
  const activeConditions = conditions.filter((item) => {
    const state = String(item.state || item.status || '').toLowerCase();
    return state === 'active' || state.includes('active') || state.includes('current');
  });
  const historicalConditions = conditions.filter((item) => !activeConditions.includes(item));
  const medications = context.medications || [];
  const allergies = context.allergies || [];
  const cases = context.cases || [];
  const encounters = context.encounters || [];
  const labs = context.labResults || [];
  const operations = context.operations || [];
  const vaccinations = context.vaccinations || [];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] text-blue-900">
        Authorised encounter-linked snapshot · {new Date(context.observedAt).toLocaleString()} · Active and resolved history retained.
      </div>

      <Section title="Conditions" count={conditions.length}>
        {conditions.length ? (
          <div className="space-y-2">
            {[...activeConditions, ...historicalConditions].map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{item.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass(item.status)}`}>
                    {text(item.status, 'Status unverified')}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                    {item.onAmbulant ? 'Ambulant+ record' : text(item.source, 'Source not recorded')}
                  </span>
                </div>
                <div className="mt-1 text-slate-600">
                  Diagnosed {date(item.diagnosedAt)}
                  {item.clinician ? ` · ${item.clinician}` : ''}
                  {item.facility ? ` · ${item.facility}` : ''}
                </div>
                {item.notes ? <div className="mt-1 whitespace-pre-wrap text-slate-600">{item.notes}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No longitudinal conditions are recorded in the authorised record.</Empty>
        )}
      </Section>

      <Section title="Allergies" count={allergies.length}>
        {allergies.length ? (
          <div className="space-y-1 text-xs">
            {allergies.map((item) => (
              <div key={item.id} className="rounded-lg border border-rose-100 bg-rose-50/50 px-2 py-2">
                <span className="font-semibold text-slate-900">{item.substance}</span>
                {item.reaction ? ` · ${item.reaction}` : ''}
                {item.severity ? ` · ${item.severity}` : ''}
                {item.status ? ` · ${item.status}` : ''}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No allergy records are present in the verified feed.</Empty>
        )}
      </Section>

      <Section title="Medications" count={medications.length}>
        {medications.length ? (
          <div className="space-y-1 text-xs">
            {medications.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2">
                <span className="font-semibold text-slate-900">{item.name}</span>
                {item.dose ? ` · ${item.dose}` : ''}
                {item.frequency ? ` · ${item.frequency}` : ''}
                {item.route ? ` · ${item.route}` : ''}
                {item.status ? ` · ${item.status}` : ''}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No medication records are present in the verified feed.</Empty>
        )}
      </Section>

      <Section title="Clinical cases" count={cases.length}>
        {cases.length ? (
          <div className="space-y-1 text-xs">
            {cases.map((item) => (
              <div key={String(item.id)} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2">
                <div className="font-semibold text-slate-900">{text(item.title, 'Clinical case')}</div>
                <div className="text-slate-600">
                  {text(item.status, 'status unknown')} · opened {date(item.openedAt)}
                  {item.closedAt ? ` · closed ${date(item.closedAt)}` : ''}
                </div>
                {item.summary ? <div className="mt-1 text-slate-600">{String(item.summary)}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No clinical cases are recorded.</Empty>
        )}
      </Section>

      <Section title="Prior encounters & diagnoses" count={encounters.length}>
        {encounters.length ? (
          <div className="space-y-2 text-xs">
            {encounters.slice(0, 30).map((item) => (
              <div key={String(item.id)} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    {date(item.consultationStartedAt || item.createdAt)}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeClass(item.status)}`}>
                    {text(item.status, 'status unknown')}
                  </span>
                </div>
                {Array.isArray(item.diagnoses) && item.diagnoses.length ? (
                  <div className="mt-1 space-y-0.5 text-slate-700">
                    {item.diagnoses.slice(0, 8).map((dx: any) => (
                      <div key={String(dx.id)}>
                        <span className="font-mono">{text(dx.icd10)}</span>
                        {dx.description ? ` · ${dx.description}` : ''}
                        {dx.status ? ` · ${dx.status}` : ''}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 text-slate-500">No coded diagnosis recorded for this encounter.</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No previous encounters are recorded.</Empty>
        )}
      </Section>

      <Section title="Recent lab results" count={labs.length}>
        {labs.length ? (
          <div className="space-y-1 text-xs">
            {labs.slice(0, 40).map((item) => (
              <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2">
                <span className="font-semibold text-slate-900">{text(item.name, 'Lab result')}</span>
                <span className="text-slate-700">
                  {item.valueNum !== null && item.valueNum !== undefined ? `${item.valueNum}${item.unit ? ` ${item.unit}` : ''}` : text(item.flag, 'Result recorded')}
                  {' · '}{date(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No structured lab results are recorded.</Empty>
        )}
      </Section>

      <Section title="Procedures / operations" count={operations.length}>
        {operations.length ? (
          <div className="space-y-1 text-xs">
            {operations.map((item) => (
              <div key={String(item.id)} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2">
                <span className="font-semibold text-slate-900">{text(item.title, 'Procedure')}</span>
                {' · '}{date(item.date || item.createdAt)}
                {item.facility ? ` · ${item.facility}` : ''}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No procedures or operations are recorded.</Empty>
        )}
      </Section>

      <Section title="Vaccinations" count={vaccinations.length}>
        {vaccinations.length ? (
          <div className="space-y-1 text-xs">
            {vaccinations.map((item) => (
              <div key={String(item.id)} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2">
                <span className="font-semibold text-slate-900">{text(item.vaccine, 'Vaccination')}</span>
                {' · '}{date(item.date || item.createdAt)}
                {item.facility ? ` · ${item.facility}` : ''}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No vaccinations are recorded.</Empty>
        )}
      </Section>
    </div>
  );
}
