'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Props = {
  href?: string;          // preferred fallback
  fallbackHref?: string;  // 2nd fallback
  children?: React.ReactNode;
  className?: string;
};

export default function BackLink({
  href = '/auto-triage',
  fallbackHref = '/myCare',
  children = '← Back',
  className = 'text-sm text-teal-700 hover:underline inline-flex items-center gap-1'
}: Props) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(href || fallbackHref);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={goBack} className={className} aria-label="Go back">
        {children}
      </button>
      {/* for middle-click as a11y fallback */}
      <Link href={href} className="sr-only">Back</Link>
    </span>
  );
}
