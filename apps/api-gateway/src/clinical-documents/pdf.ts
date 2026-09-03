import { AMBULANT_CLINICAL_DOCUMENT_LOGO_PNG_BASE64 } from './logo';

export type PdfFont = 'regular' | 'bold' | 'italic';
export type Rgb = [number, number, number];

type TextOptions = {
  font?: PdfFont;
  size?: number;
  color?: Rgb;
  maxWidth?: number;
  lineHeight?: number;
};

type Page = { commands: string[] };


type EmbeddedPng = {
  width: number;
  height: number;
  bitsPerComponent: number;
  colors: number;
  stream: Buffer;
};

function embeddedLogoPng(): EmbeddedPng {
  const png = Buffer.from(AMBULANT_CLINICAL_DOCUMENT_LOGO_PNG_BASE64, 'base64');
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (png.length < 33 || !png.subarray(0, 8).equals(signature)) throw new Error('clinical_document_logo_png_invalid');

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitsPerComponent = 0;
  let colorType = -1;
  let compressionMethod = -1;
  let filterMethod = -1;
  let interlaceMethod = -1;
  const idat: Buffer[] = [];

  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const next = dataEnd + 4;
    if (dataEnd > png.length || next > png.length) throw new Error('clinical_document_logo_png_truncated');

    if (type === 'IHDR') {
      if (length !== 13) throw new Error('clinical_document_logo_png_ihdr_invalid');
      width = png.readUInt32BE(dataStart);
      height = png.readUInt32BE(dataStart + 4);
      bitsPerComponent = png[dataStart + 8];
      colorType = png[dataStart + 9];
      compressionMethod = png[dataStart + 10];
      filterMethod = png[dataStart + 11];
      interlaceMethod = png[dataStart + 12];
    } else if (type === 'IDAT') {
      idat.push(png.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = next;
  }

  if (
    width <= 0 ||
    height <= 0 ||
    bitsPerComponent !== 8 ||
    colorType !== 2 ||
    compressionMethod !== 0 ||
    filterMethod !== 0 ||
    interlaceMethod !== 0 ||
    !idat.length
  ) {
    throw new Error('clinical_document_logo_png_unsupported');
  }

  return {
    width,
    height,
    bitsPerComponent,
    colors: 3,
    stream: Buffer.concat(idat),
  };
}

function latinText(value: unknown) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function num(value: number) {
  return Number(value.toFixed(3)).toString();
}

export function hexToRgb(hex: string): Rgb {
  const raw = /^#[0-9a-f]{6}$/i.test(String(hex || '')) ? hex.slice(1) : '0AA7A8';
  return [parseInt(raw.slice(0, 2), 16) / 255, parseInt(raw.slice(2, 4), 16) / 255, parseInt(raw.slice(4, 6), 16) / 255];
}

function estimateTextWidth(text: string, size: number) {
  let units = 0;
  for (const ch of text) {
    if ('ilI.,:;!|\'`'.includes(ch)) units += 0.25;
    else if ('MW@#%&'.includes(ch)) units += 0.9;
    else if (ch === ' ') units += 0.28;
    else units += 0.53;
  }
  return units * size;
}

export function wrapText(text: unknown, maxWidth: number, size = 10) {
  const paragraphs = String(text ?? '').split(/\r?\n/);
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && estimateTextWidth(candidate, size) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export class ClinicalPdf {
  readonly width = 595.28;
  readonly height = 841.89;
  private pages: Page[] = [];
  private page: Page;

  constructor() {
    this.page = this.addPage();
  }

  addPage() {
    const page = { commands: [] as string[] };
    this.pages.push(page);
    this.page = page;
    return page;
  }

  pageCount() {
    return this.pages.length;
  }

  private y(top: number) {
    return this.height - top;
  }

  text(text: unknown, x: number, top: number, options: TextOptions = {}) {
    const font = options.font === 'bold' ? 'F2' : options.font === 'italic' ? 'F3' : 'F1';
    const size = options.size ?? 10;
    const color = options.color ?? [0.10, 0.14, 0.20];
    const maxWidth = options.maxWidth ?? this.width - x - 48;
    const lineHeight = options.lineHeight ?? size * 1.32;
    const lines = wrapText(text, maxWidth, size);
    lines.forEach((line, idx) => {
      this.page.commands.push(
        `BT /${font} ${num(size)} Tf ${num(color[0])} ${num(color[1])} ${num(color[2])} rg ${num(x)} ${num(this.y(top + idx * lineHeight))} Td (${latinText(line)}) Tj ET`,
      );
    });
    return top + Math.max(1, lines.length) * lineHeight;
  }

  line(x1: number, top1: number, x2: number, top2: number, color: Rgb = [0.82, 0.86, 0.89], width = 0.8) {
    this.page.commands.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} RG ${num(width)} w ${num(x1)} ${num(this.y(top1))} m ${num(x2)} ${num(this.y(top2))} l S`);
  }

  rect(x: number, top: number, width: number, height: number, stroke: Rgb = [0.82, 0.86, 0.89], fill?: Rgb, lineWidth = 0.8) {
    const y = this.height - top - height;
    if (fill) {
      this.page.commands.push(`${num(fill[0])} ${num(fill[1])} ${num(fill[2])} rg ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f`);
    }
    this.page.commands.push(`${num(stroke[0])} ${num(stroke[1])} ${num(stroke[2])} RG ${num(lineWidth)} w ${num(x)} ${num(y)} ${num(width)} ${num(height)} re S`);
  }

  fillRect(x: number, top: number, width: number, height: number, fill: Rgb) {
    const y = this.height - top - height;
    this.page.commands.push(`${num(fill[0])} ${num(fill[1])} ${num(fill[2])} rg ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f`);
  }

  logo(x: number, top: number, width: number, height: number) {
    const y = this.height - top - height;
    this.page.commands.push(`q ${num(width)} 0 0 ${num(height)} ${num(x)} ${num(y)} cm /I1 Do Q`);
  }

  build() {
    const logo = embeddedLogoPng();
    const objects: Buffer[] = [];
    const add = (value: string | Buffer) => {
      objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value, 'latin1'));
      return objects.length;
    };

    const catalogId = add('');
    const pagesId = add('');
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    const imageId = add(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent ${logo.bitsPerComponent} /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${logo.colors} /BitsPerComponent ${logo.bitsPerComponent} /Columns ${logo.width} >> /Length ${logo.stream.length} >>\nstream\n`, 'latin1'),
      logo.stream,
      Buffer.from('\nendstream', 'latin1'),
    ]));

    const pageIds: number[] = [];
    for (const page of this.pages) {
      const stream = Buffer.from(page.commands.join('\n'), 'latin1');
      const contentId = add(Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
        stream,
        Buffer.from('\nendstream', 'latin1'),
      ]));
      const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> /XObject << /I1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    }

    objects[catalogId - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, 'latin1');
    objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`, 'latin1');

    const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
    const offsets = [0];
    let offset = chunks[0].length;
    objects.forEach((obj, index) => {
      offsets[index + 1] = offset;
      const prefix = Buffer.from(`${index + 1} 0 obj\n`, 'latin1');
      const suffix = Buffer.from('\nendobj\n', 'latin1');
      chunks.push(prefix, obj, suffix);
      offset += prefix.length + obj.length + suffix.length;
    });
    const xrefOffset = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(chunks);
  }
}
