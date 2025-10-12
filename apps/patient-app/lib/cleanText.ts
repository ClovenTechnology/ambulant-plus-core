// apps/patient-app/lib/cleanText.ts
/**
 * Fix common mojibake (UTF-8 seen as Windows-1252), smart quotes, and normalize.
 * Keep this tiny & fast — call it on any text coming from mock JSON or unknown sources.
 */
export default function cleanText(input: unknown): string {
  if (input == null) return '';
  let s = String(input);

  // Known mojibake fixes (UTF-8 seen as CP-1252)
  // â€™  ’  |  â€œ  “  |  â€  ”  |  â€“  –  |  â€”  —  |  â€¢  •  |  â€¦  …
  s = s
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€\u009d|â€ /g, '”')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€¢/g, '•')
    .replace(/â€¦/g, '…');

  // Fallback straight to ASCII quotes/dashes if you prefer:
  // s = s.replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/–|—/g,'-');

  // Trim weird whitespace and normalize
  s = s.replace(/\s+/g, ' ').trim();
  try { s = s.normalize('NFC'); } catch {}
  return s;
}
