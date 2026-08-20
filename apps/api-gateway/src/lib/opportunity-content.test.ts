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
      { id: 'intro', type: 'heading', level: 2, text: 'Introduction' },
      { id: 'body', type: 'paragraph', text: '<script>alert(1)</script> remains inert text' },
      { id: 'bad', type: 'html', html: '<b>not allowed</b>' },
      { id: 'cta', type: 'cta', label: 'Apply', href: 'javascript:alert(1)' },
    ],
  }) as any;

  assert.equal(document.version, 1);
  assert.equal(document.blocks.length, 2);
  assert.equal(document.blocks[0].type, 'heading');
  assert.equal(document.blocks[1].type, 'paragraph');
  assert.equal(document.blocks[1].text, '<script>alert(1)</script> remains inert text');
});

test('tracks inline media and meaningful content deterministically', () => {
  const document = normaliseOpportunityContentDocument({
    blocks: [
      { id: 'hero', type: 'image', mediaId: 'media_1', link: 'https://ambulantplus.co.za/' },
      { id: 'again', type: 'image', mediaId: 'media_1' },
      { id: 'body', type: 'paragraph', text: 'Clinical practice opportunity' },
    ],
  }) as any;

  assert.deepEqual(opportunityContentMediaIds(document), ['media_1']);
  assert.equal(opportunityContentHasMeaningfulContent(document), true);
});
