import { Prisma } from '@prisma/client';

export const OPPORTUNITY_CONTENT_SCHEMA_VERSION = 1;
export const OPPORTUNITY_CONTENT_BLOCK_LIMIT = 120;

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'numberedList',
  'image',
  'imageSlider',
  'video',
  'quote',
  'callout',
  'divider',
  'cta',
  'faq',
  'accordion',
  'steps',
  'features',
  'table',
]);

const FONT_STYLES = new Set(['modern', 'editorial', 'humanist']);
const TEXT_SIZES = new Set(['small', 'body', 'lead']);

function cleanText(value: unknown, max: number) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  return text ? text.slice(0, max) : '';
}

function cleanId(value: unknown, fallback: string) {
  const id = String(value ?? '').trim().replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 80);
  return id || fallback;
}

function cleanHttpsOrRelativeUrl(value: unknown) {
  const text = cleanText(value, 2048);
  if (!text) return '';
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function cleanVideoUrl(value: unknown) {
  const text = cleanText(value, 2048);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') return url.toString();
    if (host === 'vimeo.com' || host === 'player.vimeo.com') return url.toString();
    return '';
  } catch {
    return '';
  }
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean);
}

function cleanFontStyle(value: unknown) {
  const fontStyle = String(value || 'modern');
  return FONT_STYLES.has(fontStyle) ? fontStyle : 'modern';
}

function cleanTextSize(value: unknown) {
  const textSize = String(value || 'body');
  return TEXT_SIZES.has(textSize) ? textSize : 'body';
}

function cleanPairItems(value: unknown, maxItems: number, firstMax: number, secondMax: number, firstKey: string, secondKey: string) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item: any) => {
      const first = cleanText(item?.[firstKey], firstMax);
      const second = cleanText(item?.[secondKey], secondMax);
      return first || second ? { [firstKey]: first, [secondKey]: second } : null;
    })
    .filter(Boolean);
}

function normaliseBlock(raw: any, index: number) {
  const type = cleanText(raw?.type, 32);
  if (!BLOCK_TYPES.has(type)) return null;
  const id = cleanId(raw?.id, `block-${index + 1}`);

  if (type === 'paragraph') {
    const text = cleanText(raw?.text, 10000);
    return text
      ? { id, type, text, textSize: cleanTextSize(raw?.textSize), fontStyle: cleanFontStyle(raw?.fontStyle) }
      : null;
  }

  if (type === 'heading') {
    const text = cleanText(raw?.text, 500);
    if (!text) return null;
    const level = [2, 3, 4].includes(Number(raw?.level)) ? Number(raw.level) : 2;
    return { id, type, level, text, fontStyle: cleanFontStyle(raw?.fontStyle) };
  }

  if (type === 'bulletList' || type === 'numberedList') {
    const items = cleanStringArray(raw?.items, 40, 1500);
    return items.length
      ? { id, type, items, textSize: cleanTextSize(raw?.textSize), fontStyle: cleanFontStyle(raw?.fontStyle) }
      : null;
  }

  if (type === 'image') {
    const mediaId = cleanText(raw?.mediaId, 240);
    if (!mediaId) return null;
    const caption = cleanText(raw?.caption, 500);
    const size = ['compact', 'normal', 'wide'].includes(String(raw?.size)) ? String(raw.size) : 'normal';
    const align = ['left', 'center', 'right'].includes(String(raw?.align)) ? String(raw.align) : 'center';
    const link = cleanHttpsOrRelativeUrl(raw?.link);
    const focalX = Math.max(0, Math.min(100, Number.isFinite(Number(raw?.focalX)) ? Number(raw.focalX) : 50));
    const focalY = Math.max(0, Math.min(100, Number.isFinite(Number(raw?.focalY)) ? Number(raw.focalY) : 50));
    return {
      id,
      type,
      mediaId,
      ...(caption ? { caption } : {}),
      size,
      align,
      focalX,
      focalY,
      ...(link ? { link } : {}),
    };
  }

  if (type === 'imageSlider') {
    if (!Array.isArray(raw?.items)) return null;
    const items = raw.items
      .slice(0, 12)
      .map((item: any) => {
        const mediaId = cleanText(item?.mediaId, 240);
        if (!mediaId) return null;
        const caption = cleanText(item?.caption, 500);
        return { mediaId, ...(caption ? { caption } : {}) };
      })
      .filter(Boolean);
    if (!items.length) return null;
    const intervalSeconds = [3, 5, 7, 10].includes(Number(raw?.intervalSeconds)) ? Number(raw.intervalSeconds) : 5;
    const aspect = ['landscape', 'square', 'portrait'].includes(String(raw?.aspect)) ? String(raw.aspect) : 'landscape';
    return {
      id,
      type,
      items,
      autoplay: raw?.autoplay === true,
      intervalSeconds,
      aspect,
      showDots: raw?.showDots !== false,
      showArrows: raw?.showArrows !== false,
    };
  }

  if (type === 'video') {
    const url = cleanVideoUrl(raw?.url);
    const title = cleanText(raw?.title, 240);
    if (!url || !title) return null;
    const caption = cleanText(raw?.caption, 500);
    const aspect = ['16:9', '4:3', '1:1'].includes(String(raw?.aspect)) ? String(raw.aspect) : '16:9';
    return { id, type, url, title, ...(caption ? { caption } : {}), aspect };
  }

  if (type === 'quote') {
    const text = cleanText(raw?.text, 4000);
    if (!text) return null;
    const attribution = cleanText(raw?.attribution, 240);
    return { id, type, text, ...(attribution ? { attribution } : {}), fontStyle: cleanFontStyle(raw?.fontStyle) };
  }

  if (type === 'callout') {
    const title = cleanText(raw?.title, 240);
    const text = cleanText(raw?.text, 5000);
    if (!title && !text) return null;
    const tone = ['default', 'navy', 'teal', 'cyan', 'gold', 'warning', 'success'].includes(String(raw?.tone))
      ? String(raw.tone)
      : 'default';
    return {
      id,
      type,
      ...(title ? { title } : {}),
      ...(text ? { text } : {}),
      tone,
      textSize: cleanTextSize(raw?.textSize),
      fontStyle: cleanFontStyle(raw?.fontStyle),
    };
  }

  if (type === 'divider') return { id, type };

  if (type === 'cta') {
    const label = cleanText(raw?.label, 120);
    const href = cleanHttpsOrRelativeUrl(raw?.href);
    if (!label || !href) return null;
    const style = ['primary', 'secondary', 'text'].includes(String(raw?.style)) ? String(raw.style) : 'primary';
    return { id, type, label, href, style };
  }

  if (type === 'faq') {
    const items = cleanPairItems(raw?.items, 20, 240, 3000, 'question', 'answer');
    return items.length ? { id, type, items } : null;
  }

  if (type === 'accordion') {
    const items = cleanPairItems(raw?.items, 20, 240, 4000, 'title', 'body');
    if (!items.length) return null;
    const style = ['bordered', 'minimal'].includes(String(raw?.style)) ? String(raw.style) : 'bordered';
    return { id, type, items, style };
  }

  if (type === 'steps' || type === 'features') {
    const items = cleanPairItems(raw?.items, 20, 240, 3000, 'title', 'body');
    if (!items.length) return null;
    if (type === 'features') {
      const columns = [2, 3, 4].includes(Number(raw?.columns)) ? Number(raw.columns) : 2;
      const style = ['cards', 'minimal'].includes(String(raw?.style)) ? String(raw.style) : 'cards';
      return { id, type, items, columns, style };
    }
    return { id, type, items };
  }

  if (type === 'table') {
    const columns = cleanStringArray(raw?.columns, 8, 160);
    if (!columns.length) return null;
    const rows = Array.isArray(raw?.rows)
      ? raw.rows
          .slice(0, 40)
          .map((row: unknown) => {
            const values = cleanStringArray(row, columns.length, 1000);
            while (values.length < columns.length) values.push('');
            return values.slice(0, columns.length);
          })
      : [];
    return { id, type, columns, rows };
  }

  return null;
}

export function normaliseOpportunityContentDocument(value: unknown): Prisma.InputJsonObject | null {
  if (value === null || value === undefined || value === '') return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_opportunity_content_document');
  }

  const blocks = Array.isArray((value as any).blocks) ? (value as any).blocks : null;
  if (!blocks) throw new Error('invalid_opportunity_content_document');
  if (blocks.length > OPPORTUNITY_CONTENT_BLOCK_LIMIT) {
    throw new Error('opportunity_content_block_limit_reached');
  }

  const normalised = blocks
    .map((block: unknown, index: number) => normaliseBlock(block, index))
    .filter(Boolean);

  return {
    version: OPPORTUNITY_CONTENT_SCHEMA_VERSION,
    blocks: normalised as unknown as Prisma.InputJsonValue,
  };
}

export function opportunityContentHasMeaningfulContent(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const blocks = Array.isArray((value as any).blocks) ? (value as any).blocks : [];
  return blocks.some((block: any) => {
    if (!block || typeof block !== 'object') return false;
    if (block.type === 'divider' || block.type === 'image' || block.type === 'video') return true;
    if (block.type === 'imageSlider') return Array.isArray(block.items) && block.items.length > 0;
    if (typeof block.text === 'string' && block.text.trim()) return true;
    if (typeof block.label === 'string' && block.label.trim()) return true;
    return Array.isArray(block.items) && block.items.length > 0;
  });
}

export function opportunityContentMediaIds(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const blocks = Array.isArray((value as any).blocks) ? (value as any).blocks : [];
  const ids: string[] = [];
  for (const block of blocks) {
    if (block?.type === 'image') {
      const id = cleanText(block?.mediaId, 240);
      if (id) ids.push(id);
    }
    if (block?.type === 'imageSlider' && Array.isArray(block?.items)) {
      for (const item of block.items) {
        const id = cleanText(item?.mediaId, 240);
        if (id) ids.push(id);
      }
    }
  }
  return Array.from(new Set(ids));
}
