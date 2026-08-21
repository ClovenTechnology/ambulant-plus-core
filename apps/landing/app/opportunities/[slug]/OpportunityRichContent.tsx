import type { ReactNode } from 'react';
import OpportunityMediaSlider from './OpportunityMediaSlider';
import type {
  PublicOpportunityContentBlock,
  PublicOpportunityContentDocument,
  PublicOpportunityFontStyle,
  PublicOpportunityMedia,
  PublicOpportunityTextSize,
} from '@/lib/public-opportunities';

function safeHref(value: unknown) {
  const text = String(value || '').trim();
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function inlineText(text: string): ReactNode[] {
  const source = String(text || '');
  const tokens: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\((?:https:\/\/[^)\s]+|\/(?!\/)[^)]*)\)|\*\*[^*]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*)/g;
  let offset = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(source))) {
    if (match.index > offset) tokens.push(source.slice(offset, match.index));
    const value = match[0];
    if (value.startsWith('[')) {
      const link = /^\[([^\]]+)\]\((.+)\)$/.exec(value);
      const href = safeHref(link?.[2]);
      tokens.push(href ? <a key={`i-${key++}`} href={href} rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined} className="font-medium text-cyan-700 underline decoration-cyan-200 underline-offset-4 hover:text-cyan-900">{link?.[1]}</a> : value);
    } else if (value.startsWith('**')) {
      tokens.push(<strong key={`i-${key++}`} className="font-semibold text-slate-900">{value.slice(2, -2)}</strong>);
    } else if (value.startsWith('~~')) {
      tokens.push(<del key={`i-${key++}`} className="decoration-slate-400">{value.slice(2, -2)}</del>);
    } else {
      tokens.push(<em key={`i-${key++}`}>{value.slice(1, -1)}</em>);
    }
    offset = match.index + value.length;
  }
  if (offset < source.length) tokens.push(source.slice(offset));
  return tokens;
}

function calloutClass(tone?: string) {
  const map: Record<string, string> = {
    navy: 'border-slate-300 bg-slate-900 text-white',
    teal: 'border-teal-200 bg-teal-50 text-slate-800',
    cyan: 'border-cyan-200 bg-cyan-50 text-slate-800',
    gold: 'border-amber-200 bg-amber-50 text-slate-800',
    warning: 'border-orange-200 bg-orange-50 text-slate-800',
    success: 'border-emerald-200 bg-emerald-50 text-slate-800',
  };
  return map[String(tone || '')] || 'border-slate-200 bg-slate-50 text-slate-800';
}

function fontClass(fontStyle?: PublicOpportunityFontStyle) {
  if (fontStyle === 'editorial') return "[font-family:Georgia,Cambria,'Times_New_Roman',serif]";
  if (fontStyle === 'humanist') return "[font-family:'Segoe_UI','Trebuchet_MS',Arial,sans-serif]";
  return 'font-sans';
}

function textSizeClass(textSize?: PublicOpportunityTextSize) {
  if (textSize === 'small') return 'text-[14px] leading-7';
  if (textSize === 'lead') return 'text-[19px] leading-8';
  return 'text-[16px] leading-8';
}

function headingAnchor(block: Extract<PublicOpportunityContentBlock, { type: 'heading' }>) {
  const id = String(block.id || '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 80);
  return id || `section-${block.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`;
}

function videoEmbed(urlValue: string) {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
      }
      const id = url.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : '';
    }
    return '';
  } catch {
    return '';
  }
}

export default function OpportunityRichContent({
  document,
  contentImages = [],
}: {
  document: PublicOpportunityContentDocument;
  contentImages?: PublicOpportunityMedia[];
}) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const media = new Map(contentImages.map((item) => [item.id, item]));
  const headings = blocks
    .filter((block): block is Extract<PublicOpportunityContentBlock, { type: 'heading' }> => block.type === 'heading' && Boolean(block.text?.trim()))
    .map((block) => ({ id: headingAnchor(block), label: block.text, level: block.level }));

  return (
    <div className="mt-10 border-t pt-10">
      {headings.length >= 2 ? (
        <>
          <details className="mb-8 rounded-2xl border bg-slate-50 p-4 lg:hidden">
            <summary className="cursor-pointer font-semibold text-slate-900">On this page</summary>
            <nav className="mt-3 space-y-2 text-sm">
              {headings.map((heading) => <a key={heading.id} href={`#${heading.id}`} className={`block text-slate-600 hover:text-cyan-800 ${heading.level >= 3 ? 'pl-3' : ''}`}>{heading.label}</a>)}
            </nav>
          </details>
          <nav aria-label="On this page" className="mb-10 hidden rounded-2xl border bg-slate-50 p-5 lg:block">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">On this page</div>
            <div className="mt-3 grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
              {headings.map((heading) => <a key={heading.id} href={`#${heading.id}`} className={`text-slate-600 hover:text-cyan-800 ${heading.level >= 3 ? 'pl-3' : ''}`}>{heading.label}</a>)}
            </div>
          </nav>
        </>
      ) : null}

      <div className="mx-auto max-w-[820px] space-y-7">
        {blocks.map((block) => <Block key={block.id} block={block} media={media} contentImages={contentImages} />)}
      </div>
    </div>
  );
}

function Block({ block, media, contentImages }: { block: PublicOpportunityContentBlock; media: Map<string, PublicOpportunityMedia>; contentImages: PublicOpportunityMedia[] }) {
  if (block.type === 'paragraph') {
    return <p className={`whitespace-pre-wrap text-slate-700 ${textSizeClass(block.textSize)} ${fontClass(block.fontStyle)}`}>{inlineText(block.text)}</p>;
  }

  if (block.type === 'heading') {
    const id = headingAnchor(block);
    const font = fontClass(block.fontStyle);
    if (block.level === 3) return <h3 id={id} className={`scroll-mt-24 pt-3 text-2xl font-semibold tracking-tight text-slate-950 ${font}`}>{inlineText(block.text)}</h3>;
    if (block.level === 4) return <h4 id={id} className={`scroll-mt-24 pt-2 text-xl font-semibold tracking-tight text-slate-950 ${font}`}>{inlineText(block.text)}</h4>;
    return <h2 id={id} className={`scroll-mt-24 pt-4 text-3xl font-semibold tracking-tight text-slate-950 ${font}`}>{inlineText(block.text)}</h2>;
  }

  if (block.type === 'bulletList' || block.type === 'numberedList') {
    const ListTag = block.type === 'bulletList' ? 'ul' : 'ol';
    return <ListTag className={`space-y-3 pl-6 text-slate-700 ${textSizeClass(block.textSize)} ${fontClass(block.fontStyle)} ${block.type === 'bulletList' ? 'list-disc' : 'list-decimal'}`}>{block.items.map((item, index) => <li key={index} className="pl-1">{inlineText(item)}</li>)}</ListTag>;
  }

  if (block.type === 'image') {
    const image = media.get(block.mediaId);
    if (!image?.imageUrl) return null;
    const width = block.size === 'compact' ? 'max-w-lg' : block.size === 'wide' ? 'max-w-5xl' : 'max-w-[820px]';
    const alignment = block.align === 'left' ? 'mr-auto' : block.align === 'right' ? 'ml-auto' : 'mx-auto';
    const figure = (
      <figure className={`${width} ${alignment}`}>
        <img src={image.imageUrl} alt={image.altText || ''} style={{ objectPosition: `${block.focalX ?? 50}% ${block.focalY ?? 50}%` }} className="max-h-[680px] w-full rounded-2xl border object-cover shadow-sm" />
        {(block.caption || image.caption) ? <figcaption className="mt-3 text-sm leading-6 text-slate-500">{block.caption || image.caption}</figcaption> : null}
      </figure>
    );
    const href = safeHref(block.link);
    return href ? <a href={href} rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined} className="block">{figure}</a> : figure;
  }

  if (block.type === 'imageSlider') {
    return <OpportunityMediaSlider slides={block.items} media={contentImages} autoplay={block.autoplay} intervalSeconds={block.intervalSeconds} aspect={block.aspect} showDots={block.showDots} showArrows={block.showArrows} />;
  }

  if (block.type === 'video') {
    const embed = videoEmbed(block.url);
    if (!embed) return null;
    const aspectClass = block.aspect === '1:1' ? 'aspect-square' : block.aspect === '4:3' ? 'aspect-[4/3]' : 'aspect-video';
    return (
      <figure>
        <div className={`overflow-hidden rounded-2xl border bg-black shadow-sm ${aspectClass}`}>
          <iframe
            src={embed}
            title={block.title}
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full"
          />
        </div>
        {block.caption ? <figcaption className="mt-3 text-sm leading-6 text-slate-500">{inlineText(block.caption)}</figcaption> : null}
      </figure>
    );
  }

  if (block.type === 'quote') {
    return <blockquote className={`rounded-r-2xl border-l-4 border-cyan-500 bg-cyan-50/50 py-5 pl-6 pr-5 text-xl leading-8 text-slate-800 ${fontClass(block.fontStyle)}`}><p>{inlineText(block.text)}</p>{block.attribution ? <footer className="mt-3 text-sm font-medium not-italic text-slate-500">— {block.attribution}</footer> : null}</blockquote>;
  }

  if (block.type === 'callout') {
    return <aside className={`rounded-2xl border p-5 ${calloutClass(block.tone)} ${fontClass(block.fontStyle)}`}>{block.title ? <h3 className="font-semibold">{inlineText(block.title)}</h3> : null}{block.text ? <p className={`mt-2 whitespace-pre-wrap ${textSizeClass(block.textSize)}`}>{inlineText(block.text)}</p> : null}</aside>;
  }

  if (block.type === 'divider') return <hr className="my-10 border-slate-200" />;

  if (block.type === 'cta') {
    const href = safeHref(block.href);
    if (!href) return null;
    const cls = block.style === 'text'
      ? 'text-cyan-700 underline underline-offset-4'
      : block.style === 'secondary'
        ? 'rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900'
        : 'rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white';
    return <div className="py-2"><a href={href} rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined} className={`inline-flex ${cls}`}>{block.label}</a></div>;
  }

  if (block.type === 'faq') {
    return <section className="rounded-2xl border bg-white"><div className="divide-y">{block.items.map((item, index) => <details key={index} className="group p-5"><summary className="cursor-pointer list-none font-semibold text-slate-900">{item.question}</summary><p className="mt-3 text-[15px] leading-7 text-slate-600">{inlineText(item.answer)}</p></details>)}</div></section>;
  }

  if (block.type === 'accordion') {
    const wrapper = block.style === 'minimal' ? 'divide-y border-y' : 'divide-y rounded-2xl border bg-white';
    return <section className={wrapper}>{block.items.map((item, index) => <details key={index} className="group p-5"><summary className="cursor-pointer list-none font-semibold text-slate-900">{inlineText(item.title)}</summary><p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-slate-600">{inlineText(item.body)}</p></details>)}</section>;
  }

  if (block.type === 'steps') {
    return <ol className="space-y-4">{block.items.map((item, index) => <li key={index} className="grid grid-cols-[42px_1fr] gap-4 rounded-2xl border bg-white p-5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white">{index + 1}</span><div><h3 className="font-semibold text-slate-950">{item.title}</h3><p className="mt-2 text-[15px] leading-7 text-slate-600">{inlineText(item.body)}</p></div></li>)}</ol>;
  }

  if (block.type === 'features') {
    const columns = block.columns === 4 ? 'lg:grid-cols-4' : block.columns === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2';
    const cardClass = block.style === 'minimal' ? 'border-t border-slate-200 py-4' : 'rounded-2xl border bg-white p-5';
    return <div className={`grid gap-4 ${columns}`}>{block.items.map((item, index) => <article key={index} className={cardClass}><div className="font-semibold text-slate-950">{inlineText(item.title)}</div><p className="mt-2 text-[15px] leading-7 text-slate-600">{inlineText(item.body)}</p></article>)}</div>;
  }

  if (block.type === 'table') {
    return <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full border-collapse text-left text-sm"><thead className="bg-slate-50"><tr>{block.columns.map((column, index) => <th key={index} className="border-b px-4 py-3 font-semibold text-slate-900">{column}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b last:border-b-0">{block.columns.map((_, colIndex) => <td key={colIndex} className="px-4 py-3 align-top leading-6 text-slate-600">{inlineText(row[colIndex] || '')}</td>)}</tr>)}</tbody></table></div>;
  }

  return null;
}
