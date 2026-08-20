'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Eye,
  History,
  ImagePlus,
  List,
  ListOrdered,
  Monitor,
  Plus,
  Quote,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import { uploadManagedImage } from '@/lib/managed-image-upload';
import {
  humanizeOpportunityError,
  type AdminOpportunity,
  type OpportunityContentBlock,
  type OpportunityContentDocument,
  type OpportunityMedia,
} from '../opportunity-ui';

type Revision = {
  id: string;
  revisionNumber: number;
  kind: 'AUTOSAVE' | 'MANUAL' | 'PUBLISHED' | 'RESTORED';
  contentDocument: OpportunityContentDocument | null;
  showFaq: boolean;
  createdAt: string;
  createdByProfile?: { name?: string | null; email?: string | null } | null;
};

type Props = {
  opportunityId: string;
  editable: boolean;
  document: OpportunityContentDocument | null | undefined;
  revision: number;
  showFaq: boolean;
  legacyDescription?: string | null;
  contentImages?: OpportunityMedia[];
  onSaved: (opportunity: AdminOpportunity) => void;
  onError: (message: string) => void;
};

const MAX_BLOCKS = 120;

function uid(prefix = 'block') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalDocument(document: OpportunityContentDocument | null | undefined, legacyDescription?: string | null): OpportunityContentDocument {
  if (document?.version === 1 && Array.isArray(document.blocks)) {
    return { version: 1, blocks: document.blocks };
  }
  const legacy = String(legacyDescription || '').trim();
  return {
    version: 1,
    blocks: legacy ? [{ id: uid('legacy'), type: 'paragraph', text: legacy }] : [],
  };
}

function createBlock(type: string): OpportunityContentBlock {
  const id = uid();
  switch (type) {
    case 'heading': return { id, type: 'heading', level: 2, text: 'Section heading' };
    case 'bulletList': return { id, type: 'bulletList', items: ['First point'] };
    case 'numberedList': return { id, type: 'numberedList', items: ['First step'] };
    case 'quote': return { id, type: 'quote', text: 'Add a meaningful quote.', attribution: '' };
    case 'callout': return { id, type: 'callout', title: 'Key point', text: 'Add supporting context.', tone: 'teal' };
    case 'divider': return { id, type: 'divider' };
    case 'cta': return { id, type: 'cta', label: 'Learn more', href: '/', style: 'primary' };
    case 'faq': return { id, type: 'faq', items: [{ question: 'Question', answer: 'Answer' }] };
    case 'steps': return { id, type: 'steps', items: [{ title: 'Step 1', body: 'Describe this step.' }] };
    case 'features': return { id, type: 'features', items: [{ title: 'Feature', body: 'Describe this feature.' }] };
    case 'table': return { id, type: 'table', columns: ['Column 1', 'Column 2'], rows: [['', '']] };
    default: return { id, type: 'paragraph', text: '' };
  }
}

function blockLabel(block: OpportunityContentBlock) {
  switch (block.type) {
    case 'heading': return `H${block.level}`;
    case 'bulletList': return 'Bulleted list';
    case 'numberedList': return 'Numbered list';
    case 'image': return 'Image';
    case 'quote': return 'Quote';
    case 'callout': return 'Callout';
    case 'divider': return 'Divider';
    case 'cta': return 'CTA';
    case 'faq': return 'FAQ';
    case 'steps': return 'Steps';
    case 'features': return 'Feature grid';
    case 'table': return 'Comparison table';
    default: return 'Paragraph';
  }
}

export default function PublishingStudio(props: Props) {
  const [doc, setDoc] = useState<OpportunityContentDocument>(() => normalDocument(props.document, props.legacyDescription));
  const [currentRevision, setCurrentRevision] = useState(Math.max(0, props.revision || 0));
  const [faqVisible, setFaqVisible] = useState(props.showFaq !== false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<'edit' | 'desktop' | 'mobile'>('edit');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [selectedMediaAlt, setSelectedMediaAlt] = useState('');
  const [selectedMediaCaption, setSelectedMediaCaption] = useState('');
  const [mediaItems, setMediaItems] = useState<OpportunityMedia[]>(props.contentImages || []);
  const savingRef = useRef(false);

  useEffect(() => {
    setDoc(normalDocument(props.document, props.legacyDescription));
    setCurrentRevision(Math.max(0, props.revision || 0));
    setFaqVisible(props.showFaq !== false);
    setDirty(false);
    setSaveState('idle');
    setMediaItems(props.contentImages || []);
  }, [props.opportunityId, props.document, props.revision, props.showFaq, props.legacyDescription]);

  const selected = useMemo(
    () => doc.blocks.find((block) => block.id === selectedId) || null,
    [doc.blocks, selectedId],
  );

  const mediaById = useMemo(
    () => new Map(mediaItems.map((image) => [image.id, image])),
    [mediaItems],
  );

  const selectedMedia = selected?.type === 'image' ? mediaById.get(selected.mediaId) : undefined;

  useEffect(() => {
    setSelectedMediaAlt(selectedMedia?.altText || '');
    setSelectedMediaCaption(selectedMedia?.caption || '');
  }, [selectedMedia?.id, selectedMedia?.altText, selectedMedia?.caption]);

  const mutate = useCallback((updater: (document: OpportunityContentDocument) => OpportunityContentDocument) => {
    setDoc((current) => updater(current));
    setDirty(true);
    setSaveState('idle');
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<OpportunityContentBlock>) => {
    mutate((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.id === id ? ({ ...block, ...patch } as OpportunityContentBlock) : block),
    }));
  }, [mutate]);

  const insertBlock = useCallback((type: string) => {
    if (!props.editable || doc.blocks.length >= MAX_BLOCKS) return;
    const block = createBlock(type);
    mutate((current) => ({ ...current, blocks: [...current.blocks, block] }));
    setSelectedId(block.id);
  }, [doc.blocks.length, mutate, props.editable]);

  const moveBlock = useCallback((id: string, delta: -1 | 1) => {
    mutate((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...current, blocks };
    });
  }, [mutate]);

  const removeBlock = useCallback((id: string) => {
    mutate((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== id) }));
    setSelectedId((current) => current === id ? null : current);
  }, [mutate]);

  const saveDocument = useCallback(async (kind: 'AUTOSAVE' | 'MANUAL' | 'RESTORED' = 'AUTOSAVE', override?: { document: OpportunityContentDocument; showFaq: boolean }) => {
    if (!props.editable || savingRef.current) return;
    savingRef.current = true;
    setSaveState('saving');
    try {
      const bodyDocument = override?.document || doc;
      const bodyFaq = override?.showFaq ?? faqVisible;
      const response = await fetch(`/api/admin/opportunities/${encodeURIComponent(props.opportunityId)}/content`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          document: bodyDocument,
          showFaq: bodyFaq,
          expectedRevision: currentRevision,
          kind,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.opportunity) {
        throw new Error(json?.error || 'opportunity_content_save_failed');
      }
      const nextRevision = Number(json.revision ?? json.opportunity.contentRevision ?? currentRevision + 1);
      setCurrentRevision(nextRevision);
      setDoc(normalDocument(json.opportunity.contentDocument, props.legacyDescription));
      setFaqVisible(json.opportunity.showFaq !== false);
      setDirty(false);
      setSaveState('saved');
      props.onSaved(json.opportunity);
      window.setTimeout(() => setSaveState((value) => value === 'saved' ? 'idle' : value), 1800);
    } catch (error: any) {
      setSaveState('error');
      props.onError(humanizeOpportunityError(error?.message));
    } finally {
      savingRef.current = false;
    }
  }, [currentRevision, doc, faqVisible, props]);

  useEffect(() => {
    if (!dirty || !props.editable || savingRef.current) return;
    const timer = window.setTimeout(() => void saveDocument('AUTOSAVE'), 1400);
    return () => window.clearTimeout(timer);
  }, [dirty, doc, faqVisible, props.editable, saveDocument]);

  async function loadRevisions() {
    setHistoryBusy(true);
    try {
      const response = await fetch(`/api/admin/opportunities/${encodeURIComponent(props.opportunityId)}/revisions`, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || 'opportunity_revisions_failed');
      }
      setRevisions(json.items);
    } catch (error: any) {
      props.onError(humanizeOpportunityError(error?.message));
    } finally {
      setHistoryBusy(false);
    }
  }

  async function restoreRevision(revision: Revision) {
    if (!props.editable || !window.confirm(`Restore revision ${revision.revisionNumber}? A new revision will be created; history is preserved.`)) return;
    const restored = normalDocument(revision.contentDocument, props.legacyDescription);
    setDoc(restored);
    setFaqVisible(revision.showFaq !== false);
    setDirty(false);
    await saveDocument('RESTORED', { document: restored, showFaq: revision.showFaq !== false });
    await loadRevisions();
  }

  async function uploadInlineImage() {
    if (!props.editable || !uploadFile || !uploadAlt.trim()) return;
    setUploadBusy(true);
    try {
      const json = await uploadManagedImage({
        file: uploadFile,
        presignUrl: `/api/admin/opportunities/${encodeURIComponent(props.opportunityId)}/media/presign`,
        confirmUrl: `/api/admin/opportunities/${encodeURIComponent(props.opportunityId)}/media/confirm`,
        confirmBody: { altText: uploadAlt.trim(), caption: uploadCaption.trim() || null },
      });
      const media = json?.media;
      if (!media?.id) throw new Error('opportunity_content_media_confirm_failed');
      const mediaId = String(media.id);
      if (selected?.type === 'image') {
        updateBlock(selected.id, {
          mediaId,
          caption: uploadCaption.trim() || undefined,
          focalX: selected.focalX ?? 50,
          focalY: selected.focalY ?? 50,
        });
      } else {
        const block: OpportunityContentBlock = {
          id: uid(),
          type: 'image',
          mediaId,
          ...(uploadCaption.trim() ? { caption: uploadCaption.trim() } : {}),
          size: 'normal',
          align: 'center',
          focalX: 50,
          focalY: 50,
        };
        mutate((current) => ({ ...current, blocks: [...current.blocks, block] }));
        setSelectedId(block.id);
      }
      setUploadFile(null);
      setUploadAlt('');
      setUploadCaption('');
      setMediaItems((items) => [
        ...items.filter((item) => item.id !== String(media.id)),
        {
          id: String(media.id),
          imageUrl: media.imageUrl || null,
          altText: media.altText || uploadAlt.trim(),
          caption: media.caption || uploadCaption.trim() || null,
          sortOrder: media.sortOrder || 0,
        },
      ]);
    } catch (error: any) {
      props.onError(humanizeOpportunityError(error?.message));
    } finally {
      setUploadBusy(false);
    }
  }

  async function saveSelectedMediaDetails() {
    if (!props.editable || !selectedMedia?.id || !selectedMediaAlt.trim()) return;
    setUploadBusy(true);
    try {
      const response = await fetch(
        `/api/admin/opportunities/${encodeURIComponent(props.opportunityId)}/media/${encodeURIComponent(selectedMedia.id)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ altText: selectedMediaAlt.trim(), caption: selectedMediaCaption.trim() || null }),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'opportunity_content_media_update_failed');
      setMediaItems((items) => items.map((item) => item.id === selectedMedia.id ? { ...item, altText: selectedMediaAlt.trim(), caption: selectedMediaCaption.trim() || null } : item));
    } catch (error: any) {
      props.onError(humanizeOpportunityError(error?.message));
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100/70 shadow-sm">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Sparkles className="h-4 w-4 text-cyan-700" /> Publishing Studio V2</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span>Revision {currentRevision}</span>
            <span>·</span>
            <span>{doc.blocks.length}/{MAX_BLOCKS} blocks</span>
            <span>·</span>
            <span className={saveState === 'error' ? 'text-rose-600' : saveState === 'saving' ? 'text-amber-600' : saveState === 'saved' ? 'text-emerald-700' : ''}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : dirty ? 'Unsaved changes' : 'Up to date'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setPreview('edit')} className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${preview === 'edit' ? 'bg-slate-950 text-white' : 'border bg-white'}`}><Type className="mr-1 inline h-3.5 w-3.5" />Edit</button>
          <button type="button" onClick={() => setPreview('desktop')} className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${preview === 'desktop' ? 'bg-slate-950 text-white' : 'border bg-white'}`}><Monitor className="mr-1 inline h-3.5 w-3.5" />Desktop</button>
          <button type="button" onClick={() => setPreview('mobile')} className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${preview === 'mobile' ? 'bg-slate-950 text-white' : 'border bg-white'}`}><Smartphone className="mr-1 inline h-3.5 w-3.5" />Mobile</button>
          <button type="button" onClick={() => { setHistoryOpen((v) => !v); if (!historyOpen) void loadRevisions(); }} className="rounded-lg border bg-white px-2.5 py-2 text-xs font-semibold"><History className="mr-1 inline h-3.5 w-3.5" />History</button>
          {props.editable ? <button type="button" disabled={saveState === 'saving'} onClick={() => void saveDocument('MANUAL')} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save className="mr-1 inline h-3.5 w-3.5" />Save now</button> : null}
        </div>
      </div>

      {historyOpen ? (
        <div className="border-b bg-white px-4 py-4">
          <div className="flex items-center justify-between"><div className="font-semibold text-slate-900">Revision history</div><button type="button" onClick={() => void loadRevisions()} className="text-xs font-semibold text-cyan-700">Refresh</button></div>
          {historyBusy ? <div className="mt-3 text-sm text-slate-500">Loading revisions…</div> : (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {revisions.length ? revisions.map((revision) => (
                <div key={revision.id} className="min-w-[210px] rounded-xl border bg-slate-50 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">Revision {revision.revisionNumber}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px]">{revision.kind}</span></div>
                  <div className="mt-1 text-slate-500">{new Date(revision.createdAt).toLocaleString()}</div>
                  <div className="mt-1 truncate text-slate-400">{revision.createdByProfile?.name || revision.createdByProfile?.email || 'Staff'}</div>
                  {props.editable ? <button type="button" onClick={() => void restoreRevision(revision)} className="mt-2 inline-flex items-center gap-1 font-semibold text-cyan-700"><RotateCcw className="h-3.5 w-3.5" />Restore</button> : null}
                </div>
              )) : <div className="text-sm text-slate-500">No saved revisions yet.</div>}
            </div>
          )}
        </div>
      ) : null}

      {preview !== 'edit' ? (
        <div className="p-5 md:p-8">
          <div className={`mx-auto bg-white shadow-sm ${preview === 'mobile' ? 'max-w-[390px] rounded-[34px] border-[8px] border-slate-900 p-5' : 'max-w-[880px] rounded-3xl border p-8'}`}>
            <StudioPreview document={doc} mediaById={mediaById} />
          </div>
        </div>
      ) : (
        <div className="grid min-h-[640px] lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <div className="border-r border-slate-200">
            <div className="flex flex-wrap gap-1.5 border-b bg-white px-4 py-3">
              <InsertButton icon={<Type className="h-3.5 w-3.5" />} label="Paragraph" disabled={!props.editable} onClick={() => insertBlock('paragraph')} />
              <InsertButton label="H2" disabled={!props.editable} onClick={() => insertBlock('heading')} />
              <InsertButton icon={<List className="h-3.5 w-3.5" />} label="Bullets" disabled={!props.editable} onClick={() => insertBlock('bulletList')} />
              <InsertButton icon={<ListOrdered className="h-3.5 w-3.5" />} label="Numbers" disabled={!props.editable} onClick={() => insertBlock('numberedList')} />
              <InsertButton icon={<Quote className="h-3.5 w-3.5" />} label="Quote" disabled={!props.editable} onClick={() => insertBlock('quote')} />
              <InsertButton label="Callout" disabled={!props.editable} onClick={() => insertBlock('callout')} />
              <InsertButton label="CTA" disabled={!props.editable} onClick={() => insertBlock('cta')} />
              <InsertButton label="FAQ" disabled={!props.editable} onClick={() => insertBlock('faq')} />
              <InsertButton label="Steps" disabled={!props.editable} onClick={() => insertBlock('steps')} />
              <InsertButton label="Features" disabled={!props.editable} onClick={() => insertBlock('features')} />
              <InsertButton label="Table" disabled={!props.editable} onClick={() => insertBlock('table')} />
              <InsertButton label="Divider" disabled={!props.editable} onClick={() => insertBlock('divider')} />
            </div>
            <div className="space-y-3 p-4 md:p-6">
              {doc.blocks.length ? doc.blocks.map((block, index) => (
                <div key={block.id} onClick={() => setSelectedId(block.id)} className={`group rounded-2xl border bg-white p-4 shadow-sm transition ${selectedId === block.id ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{blockLabel(block)}</span>
                    {props.editable ? <div className="flex gap-1 opacity-70 group-hover:opacity-100">
                      <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, -1); }} disabled={index === 0} className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, 1); }} disabled={index === doc.blocks.length - 1} className="rounded-lg border p-1.5 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); removeBlock(block.id); }} className="rounded-lg border border-rose-200 p-1.5 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div> : null}
                  </div>
                  <BlockEditor block={block} editable={props.editable} media={block.type === 'image' ? mediaById.get(block.mediaId) : undefined} onChange={(patch) => updateBlock(block.id, patch)} />
                </div>
              )) : (
                <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-cyan-700" />
                  <h3 className="mt-3 font-semibold text-slate-900">Build the publication</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Insert structured blocks for headings, prose, imagery, callouts, steps, FAQs and comparisons. Content is validated and rendered without arbitrary HTML.</p>
                  {props.editable ? <button type="button" onClick={() => insertBlock('paragraph')} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Add first block</button> : null}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5 bg-white p-4 md:p-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Inspector</div>
              <h3 className="mt-1 font-semibold text-slate-950">{selected ? blockLabel(selected) : 'Publication settings'}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{selected ? 'Select fields in the canvas to edit content. Layout-specific options appear here.' : 'Select a block to inspect it, or manage publication-wide settings below.'}</p>
            </div>

            {selected?.type === 'heading' ? (
              <label className="block space-y-1 text-xs"><span className="font-medium">Heading level</span><select disabled={!props.editable} value={selected.level} onChange={(event) => updateBlock(selected.id, { level: Number(event.target.value) as 2 | 3 | 4 })} className="w-full rounded-xl border px-3 py-2 text-sm"><option value={2}>H2</option><option value={3}>H3</option><option value={4}>H4</option></select></label>
            ) : null}

            {selected?.type === 'callout' ? (
              <label className="block space-y-1 text-xs"><span className="font-medium">Tone</span><select disabled={!props.editable} value={selected.tone || 'default'} onChange={(event) => updateBlock(selected.id, { tone: event.target.value as any })} className="w-full rounded-xl border px-3 py-2 text-sm">{['default','navy','teal','cyan','gold','warning','success'].map((tone) => <option key={tone} value={tone}>{tone}</option>)}</select></label>
            ) : null}

            {selected?.type === 'image' ? (
              <div className="space-y-3 rounded-2xl border bg-slate-50 p-3 text-xs">
                <div className="font-semibold">Image presentation</div>
                <label className="block space-y-1"><span>Display size</span><select disabled={!props.editable} value={selected.size || 'normal'} onChange={(event) => updateBlock(selected.id, { size: event.target.value as any })} className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm"><option value="compact">Compact</option><option value="normal">Normal</option><option value="wide">Wide</option></select></label>
                <label className="block space-y-1"><span>Alignment</span><select disabled={!props.editable} value={selected.align || 'center'} onChange={(event) => updateBlock(selected.id, { align: event.target.value as any })} className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
                <label className="block space-y-1"><span>Focal point X ({Math.round(selected.focalX ?? 50)}%)</span><input disabled={!props.editable} type="range" min="0" max="100" value={selected.focalX ?? 50} onChange={(event) => updateBlock(selected.id, { focalX: Number(event.target.value) })} className="w-full" /></label>
                <label className="block space-y-1"><span>Focal point Y ({Math.round(selected.focalY ?? 50)}%)</span><input disabled={!props.editable} type="range" min="0" max="100" value={selected.focalY ?? 50} onChange={(event) => updateBlock(selected.id, { focalY: Number(event.target.value) })} className="w-full" /></label>
                <label className="block space-y-1"><span>Optional link</span><input disabled={!props.editable} value={selected.link || ''} onChange={(event) => updateBlock(selected.id, { link: event.target.value })} placeholder="https://… or /path" className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm" /></label>
                {selectedMedia ? <div className="space-y-2 border-t pt-3">
                  <div className="font-semibold">Asset accessibility</div>
                  <input disabled={!props.editable} value={selectedMediaAlt} onChange={(event) => setSelectedMediaAlt(event.target.value)} placeholder="Required alt text" className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm" />
                  <input disabled={!props.editable} value={selectedMediaCaption} onChange={(event) => setSelectedMediaCaption(event.target.value)} placeholder="Asset caption" className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm" />
                  {props.editable ? <button type="button" disabled={uploadBusy || !selectedMediaAlt.trim()} onClick={() => void saveSelectedMediaDetails()} className="w-full rounded-lg border bg-white px-2.5 py-2 font-semibold disabled:opacity-40">Save image details</button> : null}
                </div> : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-sm font-semibold">FAQ presentation</div><p className="mt-1 text-xs text-slate-500">Reuse the governed AEO questions as the public FAQ section and structured metadata.</p></div>
                <input type="checkbox" disabled={!props.editable} checked={faqVisible} onChange={(event) => { setFaqVisible(event.target.checked); setDirty(true); }} className="mt-1 h-4 w-4" />
              </div>
            </div>

            {props.editable ? (
              <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3">
                <div><div className="text-sm font-semibold text-slate-900">{selected?.type === 'image' ? 'Replace selected image' : 'Insert inline image'}</div><p className="mt-1 text-xs leading-5 text-slate-500">Uses the same managed Opportunity media authority as Featured and Additional images. Replacements preserve revision history.</p></div>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} className="block w-full text-xs" />
                <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} placeholder="Required alt text" className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm" />
                <input value={uploadCaption} onChange={(event) => setUploadCaption(event.target.value)} placeholder="Optional caption" className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm" />
                <button type="button" disabled={uploadBusy || !uploadFile || !uploadAlt.trim()} onClick={() => void uploadInlineImage()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><ImagePlus className="h-3.5 w-3.5" />{uploadBusy ? 'Uploading…' : selected?.type === 'image' ? 'Upload & replace' : 'Upload & insert'}</button>
              </div>
            ) : null}

            <div className="rounded-2xl border p-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700"><Clock3 className="h-3.5 w-3.5" />Autosave</div>
              <p className="mt-1 leading-5">Edits are debounced and saved as governed revisions. Publishing creates an immutable public snapshot.</p>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function InsertButton({ label, icon, disabled, onClick }: { label: string; icon?: ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">{icon}{label}</button>;
}

function TextArea({ value, onChange, disabled, placeholder, rows = 3 }: { value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string; rows?: number }) {
  return <textarea disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50" />;
}

function BlockEditor({ block, editable, media, onChange }: { block: OpportunityContentBlock; editable: boolean; media?: OpportunityMedia; onChange: (patch: Partial<OpportunityContentBlock>) => void }) {
  if (block.type === 'paragraph') return <TextArea disabled={!editable} value={block.text} onChange={(text) => onChange({ text })} placeholder="Write a paragraph. Use **bold**, *italic* and [links](https://example.com) for controlled inline emphasis." rows={5} />;
  if (block.type === 'heading') return <input disabled={!editable} value={block.text} onChange={(event) => onChange({ text: event.target.value })} className="w-full border-0 bg-transparent text-2xl font-semibold tracking-tight outline-none disabled:text-slate-700" />;
  if (block.type === 'bulletList' || block.type === 'numberedList') return <TextArea disabled={!editable} value={block.items.join('\n')} onChange={(value) => onChange({ items: value.split('\n') })} placeholder="One item per line" rows={Math.max(3, block.items.length + 1)} />;
  if (block.type === 'image') return <figure className="overflow-hidden rounded-xl border bg-slate-50">{media?.imageUrl ? <img src={media.imageUrl} alt={media.altText || ''} className="max-h-80 w-full object-cover" /> : <div className="p-8 text-center text-sm text-slate-500">Inline image asset unavailable.</div>}<div className="p-3"><input disabled={!editable} value={block.caption || media?.caption || ''} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Optional caption override" className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm" /></div></figure>;
  if (block.type === 'quote') return <div className="space-y-2 border-l-4 border-cyan-500 pl-4"><TextArea disabled={!editable} value={block.text} onChange={(text) => onChange({ text })} rows={3} /><input disabled={!editable} value={block.attribution || ''} onChange={(event) => onChange({ attribution: event.target.value })} placeholder="Attribution" className="w-full rounded-lg border px-2.5 py-2 text-sm" /></div>;
  if (block.type === 'callout') return <div className="space-y-2 rounded-xl bg-cyan-50 p-3"><input disabled={!editable} value={block.title || ''} onChange={(event) => onChange({ title: event.target.value })} placeholder="Callout title" className="w-full rounded-lg border bg-white px-2.5 py-2 font-semibold" /><TextArea disabled={!editable} value={block.text || ''} onChange={(text) => onChange({ text })} rows={3} /></div>;
  if (block.type === 'divider') return <div className="py-4"><hr className="border-slate-300" /></div>;
  if (block.type === 'cta') return <div className="grid gap-2 md:grid-cols-2"><input disabled={!editable} value={block.label} onChange={(event) => onChange({ label: event.target.value })} placeholder="Button label" className="rounded-lg border px-2.5 py-2 text-sm" /><input disabled={!editable} value={block.href} onChange={(event) => onChange({ href: event.target.value })} placeholder="https://… or /path" className="rounded-lg border px-2.5 py-2 text-sm" /></div>;
  if (block.type === 'faq') return <PairListEditor editable={editable} items={block.items.map((item) => ({ a: item.question, b: item.answer }))} labels={['Question','Answer']} onChange={(items) => onChange({ items: items.map((item) => ({ question: item.a, answer: item.b })) })} />;
  if (block.type === 'steps' || block.type === 'features') return <PairListEditor editable={editable} items={block.items.map((item) => ({ a: item.title, b: item.body }))} labels={['Title','Body']} onChange={(items) => onChange({ items: items.map((item) => ({ title: item.a, body: item.b })) })} />;
  if (block.type === 'table') return <TableEditor editable={editable} block={block} onChange={onChange} />;
  return null;
}

function PairListEditor({ editable, items, labels, onChange }: { editable: boolean; items: Array<{ a: string; b: string }>; labels: [string,string]; onChange: (items: Array<{ a: string; b: string }>) => void }) {
  return <div className="space-y-2">{items.map((item, index) => <div key={index} className="grid gap-2 rounded-xl border bg-slate-50 p-2 md:grid-cols-[1fr_2fr_auto]"><input disabled={!editable} value={item.a} onChange={(event) => onChange(items.map((entry, i) => i === index ? { ...entry, a: event.target.value } : entry))} placeholder={labels[0]} className="rounded-lg border bg-white px-2.5 py-2 text-sm" /><textarea disabled={!editable} value={item.b} onChange={(event) => onChange(items.map((entry, i) => i === index ? { ...entry, b: event.target.value } : entry))} placeholder={labels[1]} className="min-h-16 rounded-lg border bg-white px-2.5 py-2 text-sm" />{editable ? <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="rounded-lg border border-rose-200 px-2 text-xs text-rose-700">Remove</button> : null}</div>)}{editable ? <button type="button" onClick={() => onChange([...items, { a: '', b: '' }])} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Add item</button> : null}</div>;
}

function TableEditor({ editable, block, onChange }: { editable: boolean; block: Extract<OpportunityContentBlock,{type:'table'}>; onChange: (patch: Partial<OpportunityContentBlock>) => void }) {
  const columns = block.columns;
  const rows = block.rows;
  return <div className="overflow-x-auto"><table className="min-w-full border-separate border-spacing-1 text-sm"><thead><tr>{columns.map((column, index) => <th key={index}><input disabled={!editable} value={column} onChange={(event) => onChange({ columns: columns.map((value, i) => i === index ? event.target.value : value) })} className="w-full min-w-32 rounded-lg border bg-slate-100 px-2 py-2 text-left font-semibold" /></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((_, columnIndex) => <td key={columnIndex}><input disabled={!editable} value={row[columnIndex] || ''} onChange={(event) => onChange({ rows: rows.map((values, r) => r === rowIndex ? columns.map((__, c) => c === columnIndex ? event.target.value : values[c] || '') : values) })} className="w-full min-w-32 rounded-lg border px-2 py-2" /></td>)}</tr>)}</tbody></table>{editable ? <div className="mt-2 flex gap-2"><button type="button" onClick={() => onChange({ columns: [...columns, `Column ${columns.length + 1}`], rows: rows.map((row) => [...row, '']) })} disabled={columns.length >= 8} className="rounded-lg border px-2 py-1 text-xs">Add column</button><button type="button" onClick={() => onChange({ rows: [...rows, columns.map(() => '')] })} className="rounded-lg border px-2 py-1 text-xs">Add row</button></div> : null}</div>;
}

function StudioPreview({ document, mediaById }: { document: OpportunityContentDocument; mediaById: Map<string, OpportunityMedia> }) {
  return <div className="space-y-5 text-slate-700">{document.blocks.map((block) => {
    if (block.type === 'paragraph') return <p key={block.id} className="whitespace-pre-wrap leading-7">{block.text}</p>;
    if (block.type === 'heading') { const cls = block.level === 2 ? 'text-2xl' : block.level === 3 ? 'text-xl' : 'text-lg'; return <div key={block.id} className={`${cls} font-semibold tracking-tight text-slate-950`}>{block.text}</div>; }
    if (block.type === 'bulletList' || block.type === 'numberedList') { const Tag = block.type === 'bulletList' ? 'ul' : 'ol'; return <Tag key={block.id} className={`space-y-2 pl-6 ${block.type === 'bulletList' ? 'list-disc' : 'list-decimal'}`}>{block.items.map((item,index) => <li key={index}>{item}</li>)}</Tag>; }
    if (block.type === 'image') { const media = mediaById.get(block.mediaId); return media?.imageUrl ? <figure key={block.id}><img src={media.imageUrl} alt={media.altText} className="w-full rounded-xl" /><figcaption className="mt-2 text-xs text-slate-500">{block.caption || media.caption}</figcaption></figure> : null; }
    if (block.type === 'quote') return <blockquote key={block.id} className="border-l-4 border-cyan-500 pl-4 text-lg italic">{block.text}{block.attribution ? <footer className="mt-2 text-sm not-italic text-slate-500">— {block.attribution}</footer> : null}</blockquote>;
    if (block.type === 'callout') return <div key={block.id} className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">{block.title ? <div className="font-semibold text-slate-950">{block.title}</div> : null}<p className="mt-1">{block.text}</p></div>;
    if (block.type === 'divider') return <hr key={block.id} />;
    if (block.type === 'cta') return <div key={block.id}><span className="inline-flex rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white">{block.label}</span></div>;
    if (block.type === 'faq') return <div key={block.id} className="divide-y rounded-xl border">{block.items.map((item,index) => <div key={index} className="p-3"><div className="font-semibold text-slate-950">{item.question}</div><p className="mt-1 text-sm">{item.answer}</p></div>)}</div>;
    if (block.type === 'steps' || block.type === 'features') return <div key={block.id} className="grid gap-3 md:grid-cols-2">{block.items.map((item,index) => <div key={index} className="rounded-xl border p-4"><div className="font-semibold text-slate-950">{block.type === 'steps' ? `${index + 1}. ` : ''}{item.title}</div><p className="mt-1 text-sm">{item.body}</p></div>)}</div>;
    if (block.type === 'table') return <div key={block.id} className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr>{block.columns.map((col,index) => <th key={index} className="border bg-slate-50 p-2 text-left">{col}</th>)}</tr></thead><tbody>{block.rows.map((row,ri) => <tr key={ri}>{block.columns.map((_,ci) => <td key={ci} className="border p-2">{row[ci]}</td>)}</tr>)}</tbody></table></div>;
    return null;
  })}</div>;
}
