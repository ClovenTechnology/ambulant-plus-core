import type { PublicOpportunity, PublicOpportunityType } from '@/lib/public-opportunities';

export const PUBLIC_TYPE_LABELS: Record<PublicOpportunityType, string> = {
  CAREER_JOB: 'Careers',
  INTERNSHIP_GRADUATE: 'Internships & graduate programmes',
  ONBOARDING: 'Onboarding',
  PARTNERSHIP: 'Partnerships',
  FRANCHISE: 'Franchise opportunities',
  VENDOR_PROVIDER: 'Vendors & providers',
  RESEARCH_PILOT: 'Research & pilots',
  CUSTOM: 'Other opportunities',
};

export function publicAvailabilityLabel(value: PublicOpportunity['availability']) {
  if (value === 'OPEN') return 'Open for applications';
  if (value === 'UPCOMING') return 'Opening soon';
  if (value === 'CLOSED') return 'Applications closed';
  return 'Not currently accepting applications';
}

export function publicAvailabilityClass(value: PublicOpportunity['availability']) {
  if (value === 'OPEN') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'UPCOMING') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (value === 'CLOSED') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function applicationCta(opportunity: PublicOpportunity) {
  if (opportunity.application.available && opportunity.application.href) {
    return {
      label: opportunity.ctaLabel?.trim() || (opportunity.application.mode === 'ENTERPRISE_FORM' ? 'Apply now' : 'Continue to application'),
      href: opportunity.application.href,
      external: opportunity.application.mode === 'EXTERNAL_URL',
      disabled: false,
    };
  }

  if (opportunity.availability === 'UPCOMING') {
    return { label: 'Applications not open yet', href: null, external: false, disabled: true };
  }
  if (opportunity.availability === 'CLOSED') {
    return { label: 'Applications closed', href: null, external: false, disabled: true };
  }
  if (opportunity.application.mode === 'NONE') {
    return { label: opportunity.ctaLabel?.trim() || 'No online application required', href: null, external: false, disabled: true };
  }
  return { label: 'Applications currently unavailable', href: null, external: false, disabled: true };
}

export function opportunityDateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
