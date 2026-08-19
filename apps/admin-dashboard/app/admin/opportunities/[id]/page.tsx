'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Archive, ExternalLink, Eye, ImagePlus, PauseCircle, PlayCircle, Save, Trash2, XCircle } from 'lucide-react';
import {
  OPPORTUNITY_APPLICATION_MODES,
  OPPORTUNITY_LOCATION_MODES,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_VISIBILITIES,
  STATUS_LABELS,
  TYPE_LABELS,
  datetimeLocalToIso,
  humanizeOpportunityError,
  parseTags,
  toDatetimeLocal,
  type AdminOpportunity,
  type OpportunityApplicationMode,
  type OpportunityLocationMode,
  type OpportunityType,
  type OpportunityVisibility,
} from '../opportunity-ui';
import { uploadManagedImage } from '@/lib/managed-image-upload';

export const dynamic = 'force-dynamic';

type FormOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
  versions?: Array<{ id: string; versionNumber: number; state: string; accessMode: string }>;
};

type GalleryDraft = {
  key: string;
  file: File;
  altText: string;
  caption: string;
};

const MAX_GALLERY_IMAGES = 8;

const PUBLIC_SITE = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://ambulantplus.co.za').replace(/\/+$/, '');

function emptyToNull(value: string) {
  return value.trim() ? value.trim() : null;
}

export default function AdminOpportunityDetailPage({ params }: { params: { id: string } }) {
  const [opportunity, setOpportunity] = useState<AdminOpportunity | null>(null);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<OpportunityType>('CUSTOM');
  const [visibility, setVisibility] = useState<OpportunityVisibility>('PUBLIC');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageNonce, setImageNonce] = useState(0);
  const [featuredPickerKey, setFeaturedPickerKey] = useState(0);
  const [galleryDrafts, setGalleryDrafts] = useState<GalleryDraft[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [tags, setTags] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [audienceLabel, setAudienceLabel] = useState('');
  const [commitmentLabel, setCommitmentLabel] = useState('');
  const [commercialLabel, setCommercialLabel] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [departmentLabel, setDepartmentLabel] = useState('');
  const [locationMode, setLocationMode] = useState<OpportunityLocationMode | ''>('');
  const [locationLabel, setLocationLabel] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [applicationMode, setApplicationMode] = useState<OpportunityApplicationMode>('NONE');
  const [applicationFormId, setApplicationFormId] = useState('');
  const [externalApplicationUrl, setExternalApplicationUrl] = useState('');
  const [featured, setFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [aeoSummary, setAeoSummary] = useState('');
  const [aeoQuestions, setAeoQuestions] = useState<Array<{ question: string; answer: string }>>([]);

  function hydrate(row: AdminOpportunity) {
    setOpportunity(row);
    setTitle(row.title || '');
    setKey(row.key || '');
    setSlug(row.slug || '');
    setType(row.type || 'CUSTOM');
    setVisibility(row.visibility || 'PUBLIC');
    setSummary(row.summary || '');
    setDescription(row.description || '');
    setImageAlt(row.imageAlt || '');
    setImageFile(null);
    setGalleryDrafts([]);
    setTags((row.tags || []).join(', '));
    setReferenceCode(row.referenceCode || '');
    setAudienceLabel(row.audienceLabel || '');
    setCommitmentLabel(row.commitmentLabel || '');
    setCommercialLabel(row.commercialLabel || '');
    setCtaLabel(row.ctaLabel || '');
    setDepartmentLabel(row.departmentLabel || '');
    setLocationMode(row.locationMode || '');
    setLocationLabel(row.locationLabel || '');
    setCountryCode(row.countryCode || '');
    setOpensAt(toDatetimeLocal(row.opensAt));
    setClosesAt(toDatetimeLocal(row.closesAt));
    setApplicationMode(row.applicationMode || 'NONE');
    setApplicationFormId(row.applicationFormId || '');
    setExternalApplicationUrl(row.externalApplicationUrl || '');
    setFeatured(Boolean(row.featured));
    setSortOrder(String(row.sortOrder ?? 0));
    setSeoTitle(row.seoTitle || '');
    setSeoDescription(row.seoDescription || '');
    setAeoSummary(row.aeoSummary || '');
    setAeoQuestions(Array.isArray(row.aeoQuestions) ? row.aeoQuestions : []);
  }

  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/opportunities/${encodeURIComponent(params.id)}`, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.opportunity) {
        throw new Error(json?.error || 'opportunity_detail_failed');
      }
      hydrate(json.opportunity);
      setCanDelete(Boolean(json.permissions?.canDelete));
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function loadForms() {
    try {
      const response = await fetch('/api/admin/forms?pageSize=100&status=ACTIVE', { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.ok && Array.isArray(json.items)) {
        setForms(json.items);
      }
    } catch {
      setForms([]);
    }
  }

  useEffect(() => {
    void Promise.all([load(), loadForms()]);
  }, [params.id]);

  const editable = opportunity?.status === 'DRAFT' || opportunity?.status === 'PAUSED';
  const publicPreviewUrl = opportunity ? `${PUBLIC_SITE}/opportunities/${encodeURIComponent(opportunity.slug)}` : '';
  const hasImage = Boolean(opportunity?.imageUrl);
  const imagePreviewUrl = opportunity?.imageUrl
    ? `${opportunity.imageUrl}${opportunity.imageUrl.includes('?') ? '&' : '?'}v=${imageNonce}`
    : '';
  const galleryImages = opportunity?.galleryImages || [];
  const gallerySlotsRemaining = Math.max(0, MAX_GALLERY_IMAGES - galleryImages.length);

  const readiness = useMemo(() => {
    const items = [
      { label: 'Title and public slug', ok: Boolean(title.trim() && slug.trim()) },
      { label: 'Featured image', ok: !hasImage || Boolean(imageAlt.trim()) },
      { label: 'Application target', ok: applicationMode === 'NONE' || (applicationMode === 'ENTERPRISE_FORM' ? Boolean(applicationFormId.trim()) : /^https:\/\//i.test(externalApplicationUrl.trim())) },
      { label: 'Opening / closing window', ok: !opensAt || !closesAt || new Date(closesAt).getTime() > new Date(opensAt).getTime() },
    ];
    return items;
  }, [title, slug, hasImage, imageAlt, applicationMode, applicationFormId, externalApplicationUrl, opensAt, closesAt]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editable) return;
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/opportunities/${encodeURIComponent(params.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          key,
          slug,
          type,
          visibility,
          summary: emptyToNull(summary),
          description: emptyToNull(description),
          imageAlt: hasImage ? emptyToNull(imageAlt) : null,
          tags: parseTags(tags),
          referenceCode: emptyToNull(referenceCode),
          audienceLabel: emptyToNull(audienceLabel),
          commitmentLabel: emptyToNull(commitmentLabel),
          commercialLabel: emptyToNull(commercialLabel),
          ctaLabel: emptyToNull(ctaLabel),
          departmentLabel: emptyToNull(departmentLabel),
          locationMode: locationMode || null,
          locationLabel: emptyToNull(locationLabel),
          countryCode: emptyToNull(countryCode)?.toUpperCase() || null,
          opensAt: datetimeLocalToIso(opensAt),
          closesAt: datetimeLocalToIso(closesAt),
          applicationMode,
          applicationFormId: applicationMode === 'ENTERPRISE_FORM' ? emptyToNull(applicationFormId) : null,
          externalApplicationUrl: applicationMode === 'EXTERNAL_URL' ? emptyToNull(externalApplicationUrl) : null,
          featured,
          sortOrder: Number.parseInt(sortOrder || '0', 10) || 0,
          seoTitle: emptyToNull(seoTitle),
          seoDescription: emptyToNull(seoDescription),
          aeoSummary: emptyToNull(aeoSummary),
          aeoQuestions,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.opportunity) {
        throw new Error(json?.error || 'opportunity_update_failed');
      }
      hydrate(json.opportunity);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function generateDiscovery() {
    if (!opportunity || !editable) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/opportunities/${encodeURIComponent(params.id)}/discovery`,
        { method: 'POST' },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.opportunity) {
        throw new Error(json?.error || 'opportunity_discovery_generation_failed');
      }
      hydrate(json.opportunity);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: 'PUBLISH' | 'PAUSE' | 'CLOSE' | 'ARCHIVE') {
    if (!opportunity) return;

    if (action === 'ARCHIVE' && !window.confirm('Archive this opportunity? Existing audit history is preserved.')) return;
    if (action === 'CLOSE' && !window.confirm('Close this opportunity now? Public applications will stop.')) return;

    let reason: string | null = null;
    if (action === 'PAUSE' || action === 'CLOSE') {
      reason = window.prompt(action === 'PAUSE' ? 'Optional pause reason' : 'Optional closing reason') || null;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/opportunities/${encodeURIComponent(params.id)}/state`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.opportunity) {
        throw new Error(json?.error || 'opportunity_state_transition_failed');
      }
      hydrate(json.opportunity);
      setCanDelete(false);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function uploadOpportunityImage() {
    if (!imageFile || !editable) return;
    if (!imageAlt.trim()) { setError('Add meaningful alt text before uploading the image.'); return; }
    setBusy(true);
    setError('');
    try {
      const json = await uploadManagedImage({
        file: imageFile,
        presignUrl: `/api/admin/opportunities/${encodeURIComponent(params.id)}/image/presign`,
        confirmUrl: `/api/admin/opportunities/${encodeURIComponent(params.id)}/image/confirm`,
        confirmBody: { imageAlt: imageAlt.trim() },
      });
      if (json?.opportunity) hydrate(json.opportunity);
      else await load();
      setImageFile(null);
      setFeaturedPickerKey((value) => value + 1);
      setImageNonce((value) => value + 1);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function removeOpportunityImage() {
    if (!editable || !hasImage || !window.confirm('Remove this opportunity image?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/opportunities/${encodeURIComponent(params.id)}/image`, {
        method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'opportunity_image_delete_failed');
      await load();
      setImageNonce((value) => value + 1);
    } catch (err: any) { setError(humanizeOpportunityError(err?.message)); setBusy(false); }
  }

  function chooseGalleryFiles(files: FileList | null) {
    const selected = Array.from(files || []).slice(0, gallerySlotsRemaining);
    setGalleryDrafts(
      selected.map((file, index) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        altText: '',
        caption: '',
      })),
    );
  }

  async function uploadGalleryImages() {
    if (!editable || galleryDrafts.length === 0) return;
    if (galleryDrafts.some((item) => !item.altText.trim())) {
      setError('Add meaningful alt text for every additional image before uploading.');
      return;
    }
    if (galleryDrafts.length > gallerySlotsRemaining) {
      setError(`You can add only ${gallerySlotsRemaining} more ${gallerySlotsRemaining === 1 ? 'image' : 'images'}.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      let lastOpportunity: AdminOpportunity | null = null;
      for (const item of galleryDrafts) {
        const json = await uploadManagedImage({
          file: item.file,
          presignUrl: `/api/admin/opportunities/${encodeURIComponent(params.id)}/gallery/presign`,
          confirmUrl: `/api/admin/opportunities/${encodeURIComponent(params.id)}/gallery/confirm`,
          confirmBody: {
            altText: item.altText.trim(),
            caption: emptyToNull(item.caption),
          },
        });
        if (json?.opportunity) lastOpportunity = json.opportunity;
      }
      if (lastOpportunity) hydrate(lastOpportunity);
      else await load();
      setGalleryDrafts([]);
      setImageNonce((value) => value + 1);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function removeGalleryImage(imageId: string) {
    if (!editable || !window.confirm('Remove this additional image?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/opportunities/${encodeURIComponent(params.id)}/gallery/${encodeURIComponent(imageId)}`,
        { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'opportunity_gallery_delete_failed');
      }
      if (json?.opportunity) hydrate(json.opportunity);
      else await load();
      setImageNonce((value) => value + 1);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function saveGalleryImage(
    imageId: string,
    altText: string,
    caption: string,
    sortOrder: number,
  ) {
    if (!editable) return;
    if (!altText.trim()) {
      setError('Add meaningful alt text before saving the image.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/opportunities/${encodeURIComponent(params.id)}/gallery/${encodeURIComponent(imageId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ altText: altText.trim(), caption: emptyToNull(caption), sortOrder }),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok || !json?.opportunity) {
        throw new Error(json?.error || 'opportunity_gallery_update_failed');
      }
      hydrate(json.opportunity);
    } catch (err: any) {
      setError(humanizeOpportunityError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!opportunity || !canDelete) return;
    const confirmation = window.prompt(`Permanently delete “${opportunity.title}”? This cannot be undone. Type DELETE to continue.`);
    if (confirmation !== 'DELETE') return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/opportunities/${encodeURIComponent(params.id)}`, {
        method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'opportunity_delete_failed');
      window.location.assign('/admin/opportunities');
    } catch (err: any) { setError(humanizeOpportunityError(err?.message)); setBusy(false); }
  }

  if (!opportunity && busy) {
    return <main className="p-6 text-sm text-slate-500">Loading opportunity…</main>;
  }

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link href="/admin/opportunities" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Opportunities
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{opportunity?.title || 'Opportunity'}</h1>
            {opportunity?.featured ? <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Featured</span> : null}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {opportunity ? `${STATUS_LABELS[opportunity.status]} · ${TYPE_LABELS[opportunity.type]} · ${opportunity.key}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {opportunity && opportunity.status === 'PUBLISHED' ? (
            <button type="button" onClick={() => transition('PAUSE')} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><PauseCircle className="h-4 w-4" /> Pause to edit</button>
          ) : null}
          {opportunity && (opportunity.status === 'DRAFT' || opportunity.status === 'PAUSED') ? (
            <button type="button" onClick={() => transition('PUBLISH')} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><PlayCircle className="h-4 w-4" /> {opportunity.status === 'PAUSED' ? 'Resume publication' : 'Publish'}</button>
          ) : null}
          {opportunity && (opportunity.status === 'PUBLISHED' || opportunity.status === 'PAUSED') ? (
            <button type="button" onClick={() => transition('CLOSE')} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-700"><XCircle className="h-4 w-4" /> Close</button>
          ) : null}
          {opportunity && (opportunity.status === 'DRAFT' || opportunity.status === 'CLOSED') ? (
            <button type="button" onClick={() => transition('ARCHIVE')} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><Archive className="h-4 w-4" /> Archive</button>
          ) : null}
          {opportunity && opportunity.status === 'PUBLISHED' && opportunity.visibility !== 'INTERNAL' ? (
            <a href={publicPreviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><Eye className="h-4 w-4" /> Public view <ExternalLink className="h-3.5 w-3.5" /></a>
          ) : null}
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!editable && opportunity ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {opportunity.status === 'PUBLISHED'
            ? 'Pause this published opportunity before making changes.'
            : 'This opportunity is not editable in its current lifecycle state.'}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={save} className="space-y-6">
          <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="text-lg font-semibold">Identity & discovery</h2></div>
            <label className="space-y-1 text-sm"><span className="font-medium">Title</span><input disabled={!editable} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Type</span><select disabled={!editable} value={type} onChange={(e) => setType(e.target.value as OpportunityType)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50">{OPPORTUNITY_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Stable key</span><input disabled={!editable} value={key} onChange={(e) => setKey(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono text-xs disabled:bg-slate-50" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Public slug</span><input disabled={!editable} value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono text-xs disabled:bg-slate-50" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Visibility</span><select disabled={!editable} value={visibility} onChange={(e) => setVisibility(e.target.value as OpportunityVisibility)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50">{OPPORTUNITY_VISIBILITIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Reference code</span><input disabled={!editable} value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="AMB-GP-2026-04" /></label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Tags (comma separated, max 12)</span><input disabled={!editable} value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="Graduate, Clinical operations, Johannesburg" /></label>
          </section>

          <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="text-lg font-semibold">Public content</h2></div>
            <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Summary</span><textarea disabled={!editable} value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-24 w-full rounded-xl border p-3 disabled:bg-slate-50" /></label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Description</span><textarea disabled={!editable} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-64 w-full rounded-xl border p-3 disabled:bg-slate-50" placeholder="Plain-text opportunity details, eligibility, expectations and next steps." /></label>

            <div className="space-y-3 md:col-span-2">
              <div>
                <div className="text-sm font-medium">Featured image</div>
                <p className="mt-1 text-xs text-slate-500">This is the lead image used on opportunity cards, social previews and the top of the public page. JPEG, PNG or WebP; maximum 8 MB.</p>
              </div>
              {imagePreviewUrl ? <div className="overflow-hidden rounded-2xl border bg-slate-50"><img src={imagePreviewUrl} alt={imageAlt || 'Opportunity image preview'} className="max-h-72 w-full object-cover" /></div> : null}
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{hasImage ? 'Choose a replacement featured image' : 'Choose featured image'}</span>
                <input
                  key={featuredPickerKey}
                  disabled={!editable || busy}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setImageFile(file);
                    if (file && hasImage) setImageAlt('');
                  }}
                  className="block w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50"
                />
              </label>

              {imageFile ? (
                <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-medium text-slate-600">{imageFile.name}</div>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Alt text <span className="text-rose-600">*</span></span>
                    <input
                      disabled={!editable || busy}
                      value={imageAlt}
                      onChange={(event) => setImageAlt(event.target.value)}
                      className="w-full rounded-xl border bg-white px-3 py-2 disabled:bg-slate-100"
                      placeholder="Required accessible description"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={uploadOpportunityImage}
                      disabled={!editable || busy || !imageAlt.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {hasImage ? 'Upload replacement' : 'Upload featured image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setFeaturedPickerKey((value) => value + 1);
                        setImageAlt(opportunity?.imageAlt || '');
                      }}
                      disabled={busy}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                    >
                      Cancel selection
                    </button>
                  </div>
                </div>
              ) : (
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Featured image alt text</span>
                  <input
                    disabled={!editable || !hasImage}
                    value={imageAlt}
                    onChange={(event) => setImageAlt(event.target.value)}
                    className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50"
                    placeholder={hasImage ? 'Describe the current image for people using screen readers' : 'Choose an image first'}
                  />
                </label>
              )}

              {hasImage ? (
                <button
                  type="button"
                  onClick={removeOpportunityImage}
                  disabled={!editable || busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove featured image
                </button>
              ) : null}
            </div>

            <div className="space-y-4 border-t pt-5 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Additional images</div>
                  <p className="mt-1 text-xs text-slate-500">Add up to {MAX_GALLERY_IMAGES} more images. They appear as a gallery on the published opportunity and up to two previews can appear on listing cards.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{galleryImages.length}/{MAX_GALLERY_IMAGES} used</span>
              </div>

              {galleryImages.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {galleryImages.map((image) => (
                    <GalleryImageEditor
                      key={image.id}
                      image={image}
                      editable={Boolean(editable)}
                      busy={busy}
                      nonce={imageNonce}
                      onSave={saveGalleryImage}
                      onRemove={removeGalleryImage}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-slate-500">No additional images yet.</div>
              )}

              {editable && gallerySlotsRemaining > 0 ? (
                <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Choose additional images</span>
                    <input
                      disabled={busy}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => chooseGalleryFiles(event.target.files)}
                      className="block w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                    <span className="text-xs text-slate-500">You can add {gallerySlotsRemaining} more {gallerySlotsRemaining === 1 ? 'image' : 'images'}.</span>
                  </label>

                  {galleryDrafts.map((item, index) => (
                    <div key={item.key} className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-2">
                      <div className="text-xs font-medium text-slate-600 md:col-span-2">{item.file.name}</div>
                      <label className="space-y-1 text-sm"><span>Alt text</span><input value={item.altText} onChange={(event) => setGalleryDrafts((items) => items.map((entry, i) => i === index ? { ...entry, altText: event.target.value } : entry))} className="w-full rounded-xl border px-3 py-2" placeholder="Required accessible description" /></label>
                      <label className="space-y-1 text-sm"><span>Caption</span><input value={item.caption} onChange={(event) => setGalleryDrafts((items) => items.map((entry, i) => i === index ? { ...entry, caption: event.target.value } : entry))} className="w-full rounded-xl border px-3 py-2" placeholder="Optional public caption" /></label>
                    </div>
                  ))}

                  {galleryDrafts.length ? <button type="button" onClick={uploadGalleryImages} disabled={busy || galleryDrafts.some((item) => !item.altText.trim())} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><ImagePlus className="h-4 w-4" /> Upload {galleryDrafts.length} {galleryDrafts.length === 1 ? 'image' : 'images'}</button> : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="text-lg font-semibold">Listing labels</h2><p className="mt-1 text-sm text-slate-500">Generic labels keep careers, partnerships, franchises and research opportunities within one model.</p></div>
            <label className="space-y-1 text-sm"><span className="font-medium">Audience</span><input disabled={!editable} value={audienceLabel} onChange={(e) => setAudienceLabel(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="HPCSA-registered clinicians" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Commitment</span><input disabled={!editable} value={commitmentLabel} onChange={(e) => setCommitmentLabel(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="Flexible / Part-time / Project-based" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Commercial / compensation label</span><input disabled={!editable} value={commercialLabel} onChange={(e) => setCommercialLabel(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="Stipend provided / Commercial terms by agreement" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">CTA label</span><input disabled={!editable} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="Apply now" /></label>
          </section>

          <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="text-lg font-semibold">Location & availability</h2></div>
            <label className="space-y-1 text-sm"><span className="font-medium">Department / programme</span><input disabled={!editable} value={departmentLabel} onChange={(e) => setDepartmentLabel(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Location mode</span><select disabled={!editable} value={locationMode} onChange={(e) => setLocationMode(e.target.value as OpportunityLocationMode | '')} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50"><option value="">Not specified</option>{OPPORTUNITY_LOCATION_MODES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Location label</span><input disabled={!editable} value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="Johannesburg / Remote across South Africa" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Country code</span><input disabled={!editable} value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="w-full rounded-xl border px-3 py-2 uppercase disabled:bg-slate-50" placeholder="ZA" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Opens at</span><input disabled={!editable} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Closes at</span><input disabled={!editable} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" /></label>
            <label className="flex items-center gap-2 text-sm"><input disabled={!editable} type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Feature this opportunity</label>
            <label className="space-y-1 text-sm"><span className="font-medium">Sort order</span><input disabled={!editable} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" /></label>
          </section>

          <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="text-lg font-semibold">Application route</h2><p className="mt-1 text-sm text-slate-500">Choose how applicants should apply. External application links must use HTTPS.</p></div>
            <label className="space-y-1 text-sm"><span className="font-medium">Application mode</span><select disabled={!editable} value={applicationMode} onChange={(e) => setApplicationMode(e.target.value as OpportunityApplicationMode)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50">{OPPORTUNITY_APPLICATION_MODES.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>
            {applicationMode === 'ENTERPRISE_FORM' ? (
              <label className="space-y-1 text-sm"><span className="font-medium">Enterprise Form</span>
                {forms.length ? (
                  <select disabled={!editable} value={applicationFormId} onChange={(e) => setApplicationFormId(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50"><option value="">Select form</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.name} · /forms/{form.slug}</option>)}</select>
                ) : (
                  <input disabled={!editable} value={applicationFormId} onChange={(e) => setApplicationFormId(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono text-xs disabled:bg-slate-50" placeholder="Enterprise Form ID" />
                )}
              </label>
            ) : null}
            {applicationMode === 'EXTERNAL_URL' ? <label className="space-y-1 text-sm"><span className="font-medium">External HTTPS URL</span><input disabled={!editable} value={externalApplicationUrl} onChange={(e) => setExternalApplicationUrl(e.target.value)} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" placeholder="https://…" /></label> : null}
          </section>

          <section className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-2">
            <div className="flex flex-wrap items-start justify-between gap-3 md:col-span-2">
              <div>
                <h2 className="text-lg font-semibold">Search & answer discovery</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">Generate people-first SEO and answer-ready content from the opportunity information above. You can edit the generated wording; ordinary saves preserve your edits.</p>
              </div>
              {editable ? <button type="button" onClick={generateDiscovery} disabled={busy} className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Generate SEO & AEO</button> : null}
            </div>
            <label className="space-y-1 text-sm"><span className="font-medium">SEO title</span><input disabled={!editable} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={240} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50" /><span className="text-xs text-slate-400">{seoTitle.length}/240</span></label>
            <label className="space-y-1 text-sm"><span className="font-medium">SEO description</span><textarea disabled={!editable} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={500} className="min-h-24 w-full rounded-xl border p-3 disabled:bg-slate-50" /><span className="text-xs text-slate-400">{seoDescription.length}/500</span></label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Answer-ready summary (AEO)</span><textarea disabled={!editable} value={aeoSummary} onChange={(e) => setAeoSummary(e.target.value)} maxLength={1200} className="min-h-28 w-full rounded-xl border p-3 disabled:bg-slate-50" /><span className="text-xs text-slate-400">A concise, visible summary designed to answer the main user question directly. {aeoSummary.length}/1200</span></label>
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-medium">Common questions</div><p className="mt-1 text-xs text-slate-500">These questions and answers are shown publicly. Keep them factual and consistent with the opportunity.</p></div>
                {editable ? <button type="button" onClick={() => setAeoQuestions((items) => [...items, { question: '', answer: '' }].slice(0, 12))} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Add question</button> : null}
              </div>
              {aeoQuestions.map((item, index) => <div key={index} className="grid gap-2 rounded-2xl border bg-slate-50 p-3 md:grid-cols-[1fr_2fr_auto]">
                <input disabled={!editable} value={item.question} onChange={(e) => setAeoQuestions((items) => items.map((entry, i) => i === index ? { ...entry, question: e.target.value } : entry))} placeholder="Question" className="rounded-xl border bg-white px-3 py-2 text-sm" />
                <textarea disabled={!editable} value={item.answer} onChange={(e) => setAeoQuestions((items) => items.map((entry, i) => i === index ? { ...entry, answer: e.target.value } : entry))} placeholder="Answer" className="min-h-12 rounded-xl border bg-white px-3 py-2 text-sm" />
                {editable ? <button type="button" onClick={() => setAeoQuestions((items) => items.filter((_, i) => i !== index))} className="self-start rounded-lg border border-rose-200 px-2 py-2 text-xs font-semibold text-rose-700">Remove</button> : null}
              </div>)}
            </div>
          </section>

          {editable ? <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save opportunity</button> : null}
        </form>

        <aside className="space-y-4">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Publication readiness</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Complete these items before publishing.</p>
            <div className="mt-4 space-y-2">
              {readiness.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{item.label}</span><span className={item.ok ? 'text-emerald-700' : 'text-rose-700'}>{item.ok ? 'Ready' : 'Needs attention'}</span></div>)}
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Lifecycle</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-400">Status</dt><dd className="font-medium">{opportunity ? STATUS_LABELS[opportunity.status] : '—'}</dd></div>
              <div><dt className="text-slate-400">Published</dt><dd>{opportunity?.publishedAt ? new Date(opportunity.publishedAt).toLocaleString() : '—'}</dd></div>
              <div><dt className="text-slate-400">Paused</dt><dd>{opportunity?.pausedAt ? new Date(opportunity.pausedAt).toLocaleString() : '—'}</dd></div>
              <div><dt className="text-slate-400">Closed</dt><dd>{opportunity?.closedAt ? new Date(opportunity.closedAt).toLocaleString() : '—'}</dd></div>
              {opportunity?.statusReason ? <div><dt className="text-slate-400">Reason</dt><dd className="whitespace-pre-wrap">{opportunity.statusReason}</dd></div> : null}
            </dl>
          </section>

          {applicationMode === 'ENTERPRISE_FORM' ? <section className="rounded-3xl border bg-white p-5 text-sm shadow-sm"><h2 className="font-semibold">Form dependency</h2><p className="mt-2 text-slate-500">Publishing requires an active form with a published public version that is accepting submissions.</p><Link href="/admin/forms" className="mt-3 inline-flex text-teal-700 hover:underline">Open Enterprise Forms</Link></section> : null}

          {canDelete ? <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm"><h2 className="font-semibold text-rose-900">Super Admin</h2><p className="mt-2 text-rose-700">This never-published draft has no applications and can be permanently deleted.</p><button type="button" onClick={deleteDraft} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-700 disabled:opacity-40"><Trash2 className="h-4 w-4" />Delete permanently</button></section> : null}
        </aside>
      </div>
    </main>
  );
}

function GalleryImageEditor({
  image,
  editable,
  busy,
  nonce,
  onSave,
  onRemove,
}: {
  image: NonNullable<AdminOpportunity['galleryImages']>[number];
  editable: boolean;
  busy: boolean;
  nonce: number;
  onSave: (imageId: string, altText: string, caption: string, sortOrder: number) => Promise<void>;
  onRemove: (imageId: string) => Promise<void>;
}) {
  const [altText, setAltText] = useState(image.altText || '');
  const [caption, setCaption] = useState(image.caption || '');
  const [sortOrder, setSortOrder] = useState(String(image.sortOrder ?? 0));
  const url = image.imageUrl
    ? `${image.imageUrl}${image.imageUrl.includes('?') ? '&' : '?'}v=${nonce}`
    : '';

  useEffect(() => {
    setAltText(image.altText || '');
    setCaption(image.caption || '');
    setSortOrder(String(image.sortOrder ?? 0));
  }, [image.id, image.altText, image.caption, image.sortOrder]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      {url ? <img src={url} alt={image.altText || ''} className="h-40 w-full object-cover" /> : null}
      <div className="space-y-3 p-3">
        <label className="block space-y-1 text-xs"><span className="font-medium">Alt text</span><input disabled={!editable || busy} value={altText} onChange={(event) => setAltText(event.target.value)} className="w-full rounded-lg border px-2.5 py-2 text-sm disabled:bg-slate-50" /></label>
        <label className="block space-y-1 text-xs"><span className="font-medium">Caption</span><input disabled={!editable || busy} value={caption} onChange={(event) => setCaption(event.target.value)} className="w-full rounded-lg border px-2.5 py-2 text-sm disabled:bg-slate-50" /></label>
        <label className="block space-y-1 text-xs"><span className="font-medium">Order</span><input disabled={!editable || busy} type="number" min="0" max="999" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="w-full rounded-lg border px-2.5 py-2 text-sm disabled:bg-slate-50" /></label>
        {editable ? <div className="flex gap-2"><button type="button" disabled={busy || !altText.trim()} onClick={() => void onSave(image.id, altText, caption, Number.parseInt(sortOrder || '0', 10) || 0)} className="flex-1 rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:opacity-40">Save</button><button type="button" disabled={busy} onClick={() => void onRemove(image.id)} className="rounded-lg border border-rose-200 px-2.5 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">Remove</button></div> : null}
      </div>
    </div>
  );
}

