import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normaliseOpportunityContentDocument,
  opportunityContentHasMeaningfulContent,
  opportunityContentMediaIds,
} from './opportunity-content';

test('normalises governed Publishing Studio blocks and rejects arbitrary HTML authority', () => {
  const document = normaliseOpportunityContentDocument({
    version: 99,
    blocks: [
      { id: 'intro', type: 'heading', level: 2, text: 'Introduction', fontStyle: 'editorial' },
      { id: 'body', type: 'paragraph', text: '<script>alert(1)</script> remains inert text', textSize: 'lead' },
      { id: 'bad', type: 'html', html: '<b>not allowed</b>' },
      { id: 'cta', type: 'cta', label: 'Apply', href: 'javascript:alert(1)' },
    ],
  }) as any;

  assert.equal(document.version, 1);
  assert.equal(document.blocks.length, 2);
  assert.equal(document.blocks[0].type, 'heading');
  assert.equal(document.blocks[0].fontStyle, 'editorial');
  assert.equal(document.blocks[1].type, 'paragraph');
  assert.equal(document.blocks[1].textSize, 'lead');
  assert.equal(document.blocks[1].text, '<script>alert(1)</script> remains inert text');
});

test('tracks inline and slider media deterministically', () => {
  const document = normaliseOpportunityContentDocument({
    blocks: [
      { id: 'hero', type: 'image', mediaId: 'media_1', link: 'https://ambulantplus.co.za/' },
      { id: 'slider', type: 'imageSlider', items: [{ mediaId: 'media_2' }, { mediaId: 'media_1' }] },
      { id: 'body', type: 'paragraph', text: 'Clinical practice opportunity' },
    ],
  }) as any;

  assert.deepEqual(opportunityContentMediaIds(document), ['media_1', 'media_2']);
  assert.equal(opportunityContentHasMeaningfulContent(document), true);
});

test('accepts only governed explainer-video providers', () => {
  const document = normaliseOpportunityContentDocument({
    blocks: [
      { id: 'youtube', type: 'video', title: 'Explainer', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { id: 'vimeo', type: 'video', title: 'Overview', url: 'https://vimeo.com/123456789' },
      { id: 'bad', type: 'video', title: 'Unsafe', url: 'https://example.com/video.mp4' },
    ],
  }) as any;

  assert.equal(document.blocks.length, 2);
  assert.equal(document.blocks[0].type, 'video');
  assert.equal(document.blocks[1].type, 'video');
});

test('normalises controlled grid and accordion settings', () => {
  const document = normaliseOpportunityContentDocument({
    blocks: [
      { id: 'grid', type: 'features', columns: 4, style: 'minimal', items: [{ title: 'One', body: 'Body' }] },
      { id: 'accordion', type: 'accordion', style: 'minimal', items: [{ title: 'Details', body: 'More' }] },
    ],
  }) as any;

  assert.equal(document.blocks[0].columns, 4);
  assert.equal(document.blocks[0].style, 'minimal');
  assert.equal(document.blocks[1].type, 'accordion');
});
