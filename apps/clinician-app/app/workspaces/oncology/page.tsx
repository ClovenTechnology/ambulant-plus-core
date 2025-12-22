// apps/clinician-app/app/workspaces/oncology/page.tsx
'use client';

import React, { useMemo, useRef, useState } from 'react';

type TabKey =
  | 'overview'
  | 'staging'
  | 'treatment'
  | 'labs'
  | 'toxicity'
  | 'evidence';

type EvidenceItem = {
  id: string;
  kind: 'pdf' | 'image' | 'dicom' | 'lab' | 'note';
  title: string;
  status: 'ready' | 'processing' | 'failed';
  createdAt: string;
  source: 'upload' | 'integrated' | 'patient';
};

type RegimenCycle = {
  id: string;
  label: string; // e.g. "Cycle 1"
  date?: string;
  status: 'planned' | 'given' | 'held' | 'completed';
  notes?: string;
};

type Regimen = {
  id: string;
  name: string; // e.g. "FOLFOX"
  intent: 'curative' | 'palliative' | 'adjuvant' | 'neoadjuvant';
  line: '1L' | '2L' | '3L+' | 'unknown';
  startDate?: string;
  cycles: RegimenCycle[];
};

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { title, subtitle, right, children } = props;
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Pill(props: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' }) {
  const tone = props.tone ?? 'slate';
  const toneClass =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 ring-blue-100'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 ring-amber-100'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 ring-rose-100'
      : 'bg-slate-50 text-slate-700 ring-slate-100';

  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1', toneClass)}>
      {props.children}
    </span>
  );
}

function Label(props: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-slate-600">{props.children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'h-9 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none',
        'placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100',
        props.className
      )}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'min-h-[96px] w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none',
        'placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100',
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'h-9 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none',
        'focus:border-slate-300 focus:ring-2 focus:ring-slate-100',
        props.className
      )}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }) {
  const tone = props.tone ?? 'primary';
  const base =
    'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition active:scale-[0.99]';
  const styles =
    tone === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-500'
      : 'bg-white text-slate-700 hover:bg-slate-50 border';

  return (
    <button {...props} className={clsx(base, styles, props.className)} type={props.type ?? 'button'}>
      {props.children}
    </button>
  );
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'staging', label: 'Staging & Pathology' },
  { key: 'treatment', label: 'Treatment Plan' },
  { key: 'labs', label: 'Labs & Imaging' },
  { key: 'toxicity', label: 'Toxicity & Follow-up' },
  { key: 'evidence', label: 'Evidence' },
];

export default function OncologyWorkspacePage() {
  // --- Mock encounter context (safe demo defaults)
  const patient = useMemo(
    () => ({
      name: 'Demo Patient',
      age: 54,
      sex: 'F' as const,
      mrn: 'MRN-ONC-00421',
      caseId: 'CASE-ONC-2025-0019',
    }),
    []
  );

  const [tab, setTab] = useState<TabKey>('overview');

  // --- Core oncology fields
  const [primaryDx, setPrimaryDx] = useState('Breast carcinoma (suspected)');
  const [site, setSite] = useState('Breast');
  const [laterality, setLaterality] = useState<'left' | 'right' | 'bilateral' | 'na'>('left');
  const [histology, setHistology] = useState('Invasive ductal carcinoma');
  const [grade, setGrade] = useState<'1' | '2' | '3' | 'unknown'>('2');

  // TNM + stage
  const [tStage, setTStage] = useState('T2');
  const [nStage, setNStage] = useState('N1');
  const [mStage, setMStage] = useState('M0');
  const [overallStage, setOverallStage] = useState<'I' | 'II' | 'III' | 'IV' | 'unknown'>('II');

  // Biomarkers
  const [er, setEr] = useState<'pos' | 'neg' | 'unknown'>('pos');
  const [pr, setPr] = useState<'pos' | 'neg' | 'unknown'>('pos');
  const [her2, setHer2] = useState<'pos' | 'neg' | 'equivocal' | 'unknown'>('unknown');
  const [ki67, setKi67] = useState('20');

  // Performance status & goals
  const [ecog, setEcog] = useState<0 | 1 | 2 | 3 | 4>(1);
  const [intent, setIntent] = useState<'curative' | 'palliative' | 'adjuvant' | 'neoadjuvant'>('curative');

  // Notes
  const [assessment, setAssessment] = useState(
    'Patient presents for initial oncology consult. Review biopsy, stage with imaging, and confirm receptor status.'
  );
  const [plan, setPlan] = useState(
    '1) Confirm pathology + biomarkers\n2) Order staging imaging\n3) Discuss treatment intent and options\n4) Baseline labs and supportive care plan'
  );
  const [tumorBoardNote, setTumorBoardNote] = useState(
    'Consider multidisciplinary tumor board review once imaging and HER2 result are available.'
  );

  // Regimen + cycles
  const [regimens, setRegimens] = useState<Regimen[]>([
    {
      id: uid('reg'),
      name: 'AC → T (demo)',
      intent: 'neoadjuvant',
      line: '1L',
      startDate: '',
      cycles: [
        { id: uid('cyc'), label: 'Cycle 1', status: 'planned', date: '' },
        { id: uid('cyc'), label: 'Cycle 2', status: 'planned', date: '' },
      ],
    },
  ]);

  // Labs / imaging trackers
  const [baselineLabs, setBaselineLabs] = useState({
    fbc: 'Pending',
    uec: 'Pending',
    lft: 'Pending',
    tumorMarkers: 'N/A',
  });
  const [imaging, setImaging] = useState({
    ct: 'Not ordered',
    pet: 'Not ordered',
    mri: 'Ordered',
    mammo: 'Available',
  });

  // Toxicity checklist + follow-up
  const [tox, setTox] = useState({
    nausea: false,
    neuropathy: false,
    mucositis: false,
    neutropenia: false,
    fatigue: true,
    rash: false,
  });
  const [followUp, setFollowUp] = useState('2 weeks');
  const [safetyNet, setSafetyNet] = useState(
    'Advise patient to seek urgent care for fever, uncontrolled vomiting, new chest pain, or severe shortness of breath.'
  );

  // Evidence
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([
    { id: uid('ev'), kind: 'pdf', title: 'Biopsy report (demo)', status: 'ready', createdAt: 'Today', source: 'integrated' },
    { id: uid('ev'), kind: 'image', title: 'Mammogram images (demo)', status: 'processing', createdAt: 'Today', source: 'integrated' },
    { id: uid('ev'), kind: 'note', title: 'Referral letter (demo)', status: 'ready', createdAt: 'Yesterday', source: 'patient' },
  ]);

  const summaryBadges = useMemo(() => {
    const mTone = overallStage === 'IV' ? 'rose' : overallStage === 'III' ? 'amber' : 'emerald';
    return {
      stage: <Pill tone={mTone}>{`Stage ${overallStage}`}</Pill>,
      tnm: <Pill>{`${tStage} ${nStage} ${mStage}`}</Pill>,
      ecog: <Pill tone={ecog <= 1 ? 'emerald' : ecog === 2 ? 'amber' : 'rose'}>{`ECOG ${ecog}`}</Pill>,
      intent: <Pill tone="blue">{intent}</Pill>,
    };
  }, [overallStage, tStage, nStage, mStage, ecog, intent]);

  function addRegimen() {
    setRegimens((prev) => [
      ...prev,
      {
        id: uid('reg'),
        name: 'New regimen',
        intent,
        line: prev.length === 0 ? '1L' : '2L',
        startDate: '',
        cycles: [{ id: uid('cyc'), label: 'Cycle 1', status: 'planned', date: '' }],
      },
    ]);
  }

  function addCycle(regId: string) {
    setRegimens((prev) =>
      prev.map((r) => {
        if (r.id !== regId) return r;
        const n = r.cycles.length + 1;
        return {
          ...r,
          cycles: [...r.cycles, { id: uid('cyc'), label: `Cycle ${n}`, status: 'planned', date: '' }],
        };
      })
    );
  }

  function removeRegimen(regId: string) {
    setRegimens((prev) => prev.filter((r) => r.id !== regId));
  }

  function onUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const items: EvidenceItem[] = Array.from(files).slice(0, 10).map((f) => ({
      id: uid('ev'),
      kind: f.type.includes('pdf') ? 'pdf' : f.type.startsWith('image/') ? 'image' : 'note',
      title: f.name,
      status: 'ready',
      createdAt: 'Just now',
      source: 'upload',
    }));
    setEvidence((prev) => [...items, ...prev]);
  }

  return (
    <div className="min-h-[calc(100vh-56px)] w-full bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Oncology Workspace</div>
              <div className="mt-1 text-xs text-slate-500">
                Case <span className="font-medium text-slate-700">{patient.caseId}</span> · MRN{' '}
                <span className="font-medium text-slate-700">{patient.mrn}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {summaryBadges.stage}
              {summaryBadges.tnm}
              {summaryBadges.ecog}
              {summaryBadges.intent}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">{patient.name}</span>{' '}
              <span className="text-slate-500">·</span> {patient.age}y <span className="text-slate-500">·</span>{' '}
              {patient.sex}
              <div className="mt-1 text-xs text-slate-500">
                Primary Dx: <span className="text-slate-700">{primaryDx}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button tone="ghost" onClick={() => setTab('evidence')}>
                View Evidence
              </Button>
              <Button
                onClick={() => {
                  // Demo: lightweight “save” affordance without wiring
                  // Your real app can wire this to API + audit later.
                  // eslint-disable-next-line no-alert
                  alert('Saved (demo). Wire this to your API when ready.');
                }}
              >
                Save Workspace
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx(
                'rounded-full px-3 py-1.5 text-sm transition',
                tab === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left main */}
          <div className="lg:col-span-8">
            {tab === 'overview' ? (
              <div className="space-y-4">
                <SectionCard
                  title="Clinical Summary"
                  subtitle="Assessment + plan snapshot for the consult"
                  right={<Pill tone="blue">Consult-ready</Pill>}
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label>Primary diagnosis</Label>
                      <Input value={primaryDx} onChange={(e) => setPrimaryDx(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Site</Label>
                        <Input value={site} onChange={(e) => setSite(e.target.value)} />
                      </div>
                      <div>
                        <Label>Laterality</Label>
                        <Select value={laterality} onChange={(e) => setLaterality(e.target.value as any)}>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                          <option value="bilateral">Bilateral</option>
                          <option value="na">N/A</option>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Assessment</Label>
                      <TextArea value={assessment} onChange={(e) => setAssessment(e.target.value)} />
                    </div>
                    <div>
                      <Label>Plan</Label>
                      <TextArea value={plan} onChange={(e) => setPlan(e.target.value)} />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Tumor Board" subtitle="MDT summary note (demo)">
                  <TextArea value={tumorBoardNote} onChange={(e) => setTumorBoardNote(e.target.value)} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button tone="ghost" onClick={() => setTumorBoardNote((v) => `${v}\n- Pathology review requested`)}>
                      Add: Pathology review
                    </Button>
                    <Button tone="ghost" onClick={() => setTumorBoardNote((v) => `${v}\n- Radiology staging discussion`)}>
                      Add: Radiology discussion
                    </Button>
                    <Button tone="ghost" onClick={() => setTumorBoardNote((v) => `${v}\n- Surgical referral / planning`)}>
                      Add: Surgery planning
                    </Button>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {tab === 'staging' ? (
              <div className="space-y-4">
                <SectionCard title="Pathology" subtitle="Histology + grade + biomarkers">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label>Histology</Label>
                      <Input value={histology} onChange={(e) => setHistology(e.target.value)} />
                    </div>
                    <div>
                      <Label>Grade</Label>
                      <Select value={grade} onChange={(e) => setGrade(e.target.value as any)}>
                        <option value="1">Grade 1</option>
                        <option value="2">Grade 2</option>
                        <option value="3">Grade 3</option>
                        <option value="unknown">Unknown</option>
                      </Select>
                    </div>

                    <div className="grid grid-cols-4 gap-3 md:col-span-2">
                      <div>
                        <Label>ER</Label>
                        <Select value={er} onChange={(e) => setEr(e.target.value as any)}>
                          <option value="pos">Positive</option>
                          <option value="neg">Negative</option>
                          <option value="unknown">Unknown</option>
                        </Select>
                      </div>
                      <div>
                        <Label>PR</Label>
                        <Select value={pr} onChange={(e) => setPr(e.target.value as any)}>
                          <option value="pos">Positive</option>
                          <option value="neg">Negative</option>
                          <option value="unknown">Unknown</option>
                        </Select>
                      </div>
                      <div>
                        <Label>HER2</Label>
                        <Select value={her2} onChange={(e) => setHer2(e.target.value as any)}>
                          <option value="pos">Positive</option>
                          <option value="neg">Negative</option>
                          <option value="equivocal">Equivocal</option>
                          <option value="unknown">Unknown</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Ki-67 %</Label>
                        <Input value={ki67} onChange={(e) => setKi67(e.target.value)} inputMode="numeric" />
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="TNM & Stage" subtitle="Quick staging controls for consult + MDT">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>T</Label>
                        <Input value={tStage} onChange={(e) => setTStage(e.target.value)} />
                      </div>
                      <div>
                        <Label>N</Label>
                        <Input value={nStage} onChange={(e) => setNStage(e.target.value)} />
                      </div>
                      <div>
                        <Label>M</Label>
                        <Input value={mStage} onChange={(e) => setMStage(e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <Label>Overall stage</Label>
                      <Select value={overallStage} onChange={(e) => setOverallStage(e.target.value as any)}>
                        <option value="I">Stage I</option>
                        <option value="II">Stage II</option>
                        <option value="III">Stage III</option>
                        <option value="IV">Stage IV</option>
                        <option value="unknown">Unknown</option>
                      </Select>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {summaryBadges.stage}
                        {summaryBadges.tnm}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label>Performance status (ECOG)</Label>
                      <Select value={String(ecog)} onChange={(e) => setEcog(Number(e.target.value) as any)}>
                        <option value="0">0 – Fully active</option>
                        <option value="1">1 – Restricted strenuous activity</option>
                        <option value="2">2 – Ambulatory, unable to work</option>
                        <option value="3">3 – Limited self-care</option>
                        <option value="4">4 – Completely disabled</option>
                      </Select>
                    </div>

                    <div>
                      <Label>Treatment intent</Label>
                      <Select value={intent} onChange={(e) => setIntent(e.target.value as any)}>
                        <option value="curative">Curative</option>
                        <option value="adjuvant">Adjuvant</option>
                        <option value="neoadjuvant">Neoadjuvant</option>
                        <option value="palliative">Palliative</option>
                      </Select>
                    </div>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {tab === 'treatment' ? (
              <div className="space-y-4">
                <SectionCard
                  title="Regimens"
                  subtitle="Plan, track cycles, and document per-cycle decisions"
                  right={
                    <Button onClick={addRegimen} tone="primary">
                      Add regimen
                    </Button>
                  }
                >
                  <div className="space-y-3">
                    {regimens.map((r) => (
                      <div key={r.id} className="rounded-xl border bg-slate-50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-[240px] flex-1">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <Label>Regimen name</Label>
                                <Input
                                  value={r.name}
                                  onChange={(e) =>
                                    setRegimens((prev) =>
                                      prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x))
                                    )
                                  }
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label>Intent</Label>
                                  <Select
                                    value={r.intent}
                                    onChange={(e) =>
                                      setRegimens((prev) =>
                                        prev.map((x) => (x.id === r.id ? { ...x, intent: e.target.value as any } : x))
                                      )
                                    }
                                  >
                                    <option value="curative">Curative</option>
                                    <option value="adjuvant">Adjuvant</option>
                                    <option value="neoadjuvant">Neoadjuvant</option>
                                    <option value="palliative">Palliative</option>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Line</Label>
                                  <Select
                                    value={r.line}
                                    onChange={(e) =>
                                      setRegimens((prev) =>
                                        prev.map((x) => (x.id === r.id ? { ...x, line: e.target.value as any } : x))
                                      )
                                    }
                                  >
                                    <option value="1L">1L</option>
                                    <option value="2L">2L</option>
                                    <option value="3L+">3L+</option>
                                    <option value="unknown">?</option>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Start date</Label>
                                  <Input
                                    type="date"
                                    value={r.startDate ?? ''}
                                    onChange={(e) =>
                                      setRegimens((prev) =>
                                        prev.map((x) => (x.id === r.id ? { ...x, startDate: e.target.value } : x))
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button tone="ghost" onClick={() => addCycle(r.id)}>
                              Add cycle
                            </Button>
                            <Button tone="danger" onClick={() => removeRegimen(r.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 overflow-hidden rounded-lg border bg-white">
                          <div className="grid grid-cols-12 border-b bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
                            <div className="col-span-4">Cycle</div>
                            <div className="col-span-3">Date</div>
                            <div className="col-span-3">Status</div>
                            <div className="col-span-2">Notes</div>
                          </div>

                          {r.cycles.map((c) => (
                            <div key={c.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                              <div className="col-span-4">
                                <Input
                                  value={c.label}
                                  onChange={(e) =>
                                    setRegimens((prev) =>
                                      prev.map((x) => {
                                        if (x.id !== r.id) return x;
                                        return {
                                          ...x,
                                          cycles: x.cycles.map((cc) =>
                                            cc.id === c.id ? { ...cc, label: e.target.value } : cc
                                          ),
                                        };
                                      })
                                    )
                                  }
                                />
                              </div>
                              <div className="col-span-3">
                                <Input
                                  type="date"
                                  value={c.date ?? ''}
                                  onChange={(e) =>
                                    setRegimens((prev) =>
                                      prev.map((x) => {
                                        if (x.id !== r.id) return x;
                                        return {
                                          ...x,
                                          cycles: x.cycles.map((cc) =>
                                            cc.id === c.id ? { ...cc, date: e.target.value } : cc
                                          ),
                                        };
                                      })
                                    )
                                  }
                                />
                              </div>
                              <div className="col-span-3">
                                <Select
                                  value={c.status}
                                  onChange={(e) =>
                                    setRegimens((prev) =>
                                      prev.map((x) => {
                                        if (x.id !== r.id) return x;
                                        return {
                                          ...x,
                                          cycles: x.cycles.map((cc) =>
                                            cc.id === c.id ? { ...cc, status: e.target.value as any } : cc
                                          ),
                                        };
                                      })
                                    )
                                  }
                                >
                                  <option value="planned">Planned</option>
                                  <option value="given">Given</option>
                                  <option value="held">Held</option>
                                  <option value="completed">Completed</option>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Input
                                  placeholder="Optional"
                                  value={c.notes ?? ''}
                                  onChange={(e) =>
                                    setRegimens((prev) =>
                                      prev.map((x) => {
                                        if (x.id !== r.id) return x;
                                        return {
                                          ...x,
                                          cycles: x.cycles.map((cc) =>
                                            cc.id === c.id ? { ...cc, notes: e.target.value } : cc
                                          ),
                                        };
                                      })
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {regimens.length === 0 ? (
                      <div className="rounded-lg border bg-white p-4 text-sm text-slate-600">
                        No regimens yet. Add one to start planning.
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {tab === 'labs' ? (
              <div className="space-y-4">
                <SectionCard title="Baseline Labs" subtitle="Track key labs before treatment">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <Label>FBC</Label>
                      <Input
                        value={baselineLabs.fbc}
                        onChange={(e) => setBaselineLabs((v) => ({ ...v, fbc: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>U&amp;E / Creat</Label>
                      <Input
                        value={baselineLabs.uec}
                        onChange={(e) => setBaselineLabs((v) => ({ ...v, uec: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>LFT</Label>
                      <Input
                        value={baselineLabs.lft}
                        onChange={(e) => setBaselineLabs((v) => ({ ...v, lft: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Tumor markers</Label>
                      <Input
                        value={baselineLabs.tumorMarkers}
                        onChange={(e) => setBaselineLabs((v) => ({ ...v, tumorMarkers: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button tone="ghost" onClick={() => setBaselineLabs({ fbc: 'Ordered', uec: 'Ordered', lft: 'Ordered', tumorMarkers: 'N/A' })}>
                      Mark ordered
                    </Button>
                    <Button tone="ghost" onClick={() => setBaselineLabs({ fbc: 'Available', uec: 'Available', lft: 'Available', tumorMarkers: 'N/A' })}>
                      Mark available
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard title="Imaging" subtitle="Quick staging + response monitoring">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <Label>CT</Label>
                      <Input value={imaging.ct} onChange={(e) => setImaging((v) => ({ ...v, ct: e.target.value }))} />
                    </div>
                    <div>
                      <Label>PET</Label>
                      <Input value={imaging.pet} onChange={(e) => setImaging((v) => ({ ...v, pet: e.target.value }))} />
                    </div>
                    <div>
                      <Label>MRI</Label>
                      <Input value={imaging.mri} onChange={(e) => setImaging((v) => ({ ...v, mri: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Other</Label>
                      <Input
                        value={imaging.mammo}
                        onChange={(e) => setImaging((v) => ({ ...v, mammo: e.target.value }))}
                      />
                    </div>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {tab === 'toxicity' ? (
              <div className="space-y-4">
                <SectionCard title="Toxicity Screen" subtitle="Simple symptom flags for demo (wire to PROs later)">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {(
                      [
                        ['fatigue', 'Fatigue'],
                        ['nausea', 'Nausea/Vomiting'],
                        ['neuropathy', 'Neuropathy'],
                        ['mucositis', 'Mucositis'],
                        ['neutropenia', 'Neutropenia/Fever'],
                        ['rash', 'Rash'],
                      ] as const
                    ).map(([k, label]) => {
                      const checked = (tox as any)[k] as boolean;
                      return (
                        <label
                          key={k}
                          className={clsx(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                            checked ? 'bg-amber-50 border-amber-200' : 'bg-white'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setTox((v) => ({ ...v, [k]: e.target.checked }))}
                          />
                          <span className="text-slate-800">{label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label>Follow-up interval</Label>
                      <Input value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                    </div>
                    <div>
                      <Label>Safety net advice</Label>
                      <TextArea value={safetyNet} onChange={(e) => setSafetyNet(e.target.value)} />
                    </div>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {tab === 'evidence' ? (
              <div className="space-y-4">
                <SectionCard
                  title="Evidence"
                  subtitle="Uploads + integrated artifacts (demo list)"
                  right={
                    <div className="flex gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => onUploadFiles(e.target.files)}
                      />
                      <Button tone="ghost" onClick={() => fileRef.current?.click()}>
                        Upload
                      </Button>
                    </div>
                  }
                >
                  <div className="overflow-hidden rounded-lg border bg-white">
                    <div className="grid grid-cols-12 border-b bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
                      <div className="col-span-5">Title</div>
                      <div className="col-span-2">Kind</div>
                      <div className="col-span-2">Source</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-1">When</div>
                    </div>
                    {evidence.map((ev) => (
                      <div key={ev.id} className="grid grid-cols-12 items-center px-3 py-2 text-sm">
                        <div className="col-span-5 text-slate-900">{ev.title}</div>
                        <div className="col-span-2 text-slate-600">{ev.kind}</div>
                        <div className="col-span-2 text-slate-600">{ev.source}</div>
                        <div className="col-span-2">
                          <Pill
                            tone={ev.status === 'ready' ? 'emerald' : ev.status === 'processing' ? 'amber' : 'rose'}
                          >
                            {ev.status}
                          </Pill>
                        </div>
                        <div className="col-span-1 text-xs text-slate-500">{ev.createdAt}</div>
                      </div>
                    ))}
                    {evidence.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-slate-600">No evidence yet.</div>
                    ) : null}
                  </div>
                </SectionCard>
              </div>
            ) : null}
          </div>

          {/* Right rail */}
          <div className="lg:col-span-4">
            <div className="space-y-4">
              <SectionCard title="Quick Clinician Tools" subtitle="Fast controls for the consult">
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>T</Label>
                      <Input value={tStage} onChange={(e) => setTStage(e.target.value)} />
                    </div>
                    <div>
                      <Label>N</Label>
                      <Input value={nStage} onChange={(e) => setNStage(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>M</Label>
                      <Input value={mStage} onChange={(e) => setMStage(e.target.value)} />
                    </div>
                    <div>
                      <Label>Stage</Label>
                      <Select value={overallStage} onChange={(e) => setOverallStage(e.target.value as any)}>
                        <option value="I">I</option>
                        <option value="II">II</option>
                        <option value="III">III</option>
                        <option value="IV">IV</option>
                        <option value="unknown">?</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>ECOG</Label>
                      <Select value={String(ecog)} onChange={(e) => setEcog(Number(e.target.value) as any)}>
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Intent</Label>
                      <Select value={intent} onChange={(e) => setIntent(e.target.value as any)}>
                        <option value="curative">Curative</option>
                        <option value="adjuvant">Adjuvant</option>
                        <option value="neoadjuvant">Neoadjuvant</option>
                        <option value="palliative">Palliative</option>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {summaryBadges.stage}
                    {summaryBadges.ecog}
                    {summaryBadges.intent}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Biomarkers" subtitle="At-a-glance (demo)">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>ER</Label>
                    <Select value={er} onChange={(e) => setEr(e.target.value as any)}>
                      <option value="pos">Positive</option>
                      <option value="neg">Negative</option>
                      <option value="unknown">Unknown</option>
                    </Select>
                  </div>
                  <div>
                    <Label>PR</Label>
                    <Select value={pr} onChange={(e) => setPr(e.target.value as any)}>
                      <option value="pos">Positive</option>
                      <option value="neg">Negative</option>
                      <option value="unknown">Unknown</option>
                    </Select>
                  </div>
                  <div>
                    <Label>HER2</Label>
                    <Select value={her2} onChange={(e) => setHer2(e.target.value as any)}>
                      <option value="pos">Positive</option>
                      <option value="neg">Negative</option>
                      <option value="equivocal">Equivocal</option>
                      <option value="unknown">Unknown</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Ki-67 %</Label>
                    <Input value={ki67} onChange={(e) => setKi67(e.target.value)} inputMode="numeric" />
                  </div>
                </div>

                <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
                  Tip: later you can wire these to structured pathology imports and lock edits behind audit trail.
                </div>
              </SectionCard>

              <SectionCard title="Safety & Follow-up" subtitle="Demo quick sheet">
                <div className="text-sm text-slate-800">
                  Follow-up: <span className="font-semibold">{followUp}</span>
                </div>
                <div className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">{safetyNet}</div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
