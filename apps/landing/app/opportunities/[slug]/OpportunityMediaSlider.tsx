'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicOpportunityMedia } from '@/lib/public-opportunities';

type Slide = { mediaId: string; caption?: string };

type Props = {
  slides: Slide[];
  media: PublicOpportunityMedia[];
  autoplay?: boolean;
  intervalSeconds?: 3 | 5 | 7 | 10;
  aspect?: 'landscape' | 'square' | 'portrait';
  showDots?: boolean;
  showArrows?: boolean;
};

function aspectClass(value?: string) {
  if (value === 'square') return 'aspect-square';
  if (value === 'portrait') return 'aspect-[4/5]';
  return 'aspect-[16/9]';
}

export default function OpportunityMediaSlider({
  slides,
  media,
  autoplay = false,
  intervalSeconds = 5,
  aspect = 'landscape',
  showDots = true,
  showArrows = true,
}: Props) {
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const resolved = useMemo(
    () => slides.map((slide) => ({ slide, media: mediaById.get(slide.mediaId) })).filter((item) => Boolean(item.media?.imageUrl)),
    [mediaById, slides],
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (index >= resolved.length) setIndex(0);
  }, [index, resolved.length]);

  useEffect(() => {
    if (!autoplay || paused || resolved.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % resolved.length);
    }, Math.max(3, intervalSeconds) * 1000);
    return () => window.clearInterval(timer);
  }, [autoplay, intervalSeconds, paused, resolved.length]);

  if (!resolved.length) return null;
  const current = resolved[index] || resolved[0];

  const go = (next: number) => {
    const count = resolved.length;
    if (!count) return;
    setIndex(((next % count) + count) % count);
  };

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden rounded-2xl border bg-slate-950 shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      aria-roledescription="carousel"
      aria-label="Image slider"
    >
      <div className={`relative ${aspectClass(aspect)}`}>
        <img
          src={current.media?.imageUrl || ''}
          alt={current.media?.altText || ''}
          className="h-full w-full object-cover"
        />
        {showArrows && resolved.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 px-3 py-2 text-lg text-white backdrop-blur hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 px-3 py-2 text-lg text-white backdrop-blur hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {(current.slide.caption || current.media?.caption) ? (
        <div className="border-t border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-200">
          {current.slide.caption || current.media?.caption}
        </div>
      ) : null}

      {showDots && resolved.length > 1 ? (
        <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-slate-950 px-4 py-3">
          {resolved.map((item, dotIndex) => (
            <button
              key={`${item.slide.mediaId}-${dotIndex}`}
              type="button"
              onClick={() => setIndex(dotIndex)}
              aria-label={`Show image ${dotIndex + 1}`}
              aria-current={dotIndex === index ? 'true' : undefined}
              className={`h-2.5 w-2.5 rounded-full ${dotIndex === index ? 'bg-white' : 'bg-white/35 hover:bg-white/60'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
