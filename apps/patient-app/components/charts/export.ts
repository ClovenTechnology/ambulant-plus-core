// apps/patient-app/components/charts/export.ts
export async function exportCsv(filename: string, rows: Record<string, any>[]) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const csv = [keys.join(',')]
    .concat(rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export function exportSvgAsPng(svg: SVGSVGElement, filename = 'chart.png') {
  const xml = new XMLSerializer().serializeToString(svg);
  const svg64 = window.btoa(unescape(encodeURIComponent(xml)));
  const b64Start = 'data:image/svg+xml;base64,';
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = svg.viewBox.baseVal.width;
    canvas.height = svg.viewBox.baseVal.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    });
  };
  img.src = b64Start + svg64;
}

/* PDF export using html2canvas + jspdf */
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportElementAsPdf(element: HTMLElement, filename = 'export.pdf') {
  // render element to canvas (high quality)
  const canvas = await html2canvas(element, { scale: Math.min(window.devicePixelRatio || 1, 2) });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}

/* Share helper: tries native share, else falls back to email download */
export async function shareFile({ blob, filename, text }: { blob: Blob; filename: string; text?: string }) {
  const file = new File([blob], filename, { type: blob.type });
  // Web Share API Level 2 (files)
  // @ts-ignore
  if (navigator.share && (navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
    try {
      // @ts-ignore
      await navigator.share({ files: [file], text, title: filename });
      return true;
    } catch {
      // fall through
    }
  }

  // fallback: create blob URL and open mailto with attachment not possible; use download + mailto prefilled
  const url = URL.createObjectURL(blob);
  // open download
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  // open mailto as best-effort with text and url
  const mailto = `mailto:?subject=${encodeURIComponent(filename)}&body=${encodeURIComponent(text || '')}%0A%0ADownload:%20${encodeURIComponent(url)}`;
  window.open(mailto, '_blank');
  return false;
}
