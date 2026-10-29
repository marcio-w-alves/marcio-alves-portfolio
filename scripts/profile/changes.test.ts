import { describe, expect, it } from 'vitest';
import { changesBetween, describeChanges, groupOf } from './changes';
import type { Document } from './workspace/workspace';

/**
 * What `pnpm profile diff` says before an import writes anything. It has to
 * name enough for the owner to recognise his own edit — the document and the
 * ids in it — and no more: the same output goes into a public build log.
 */

const yaml = (text: string): Document => ({
  mediaType: 'application/yaml',
  bytes: new TextEncoder().encode(text),
});

const pdf = (byte: number): Document => ({
  mediaType: 'application/pdf',
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, byte]),
});

const before = new Map<string, Document>([
  ['privacy.yaml', yaml('phrases:\n  - a phrase\n')],
  ['retrieval/probes.yaml', yaml('whereNow: Where does she work?\nhowLong: For how long?\n')],
  ['knowledge/practice.yaml', yaml('practice:\n  careerArc:\n    - grew\n')],
  ['assets/photo.pdf', pdf(1)],
  ['copy/en/answers/career.yaml', yaml('career:\n  parts: []\n')],
]);

describe('the changes between two profiles', () => {
  it('finds nothing between a profile and itself', () => {
    expect(changesBetween(before, new Map(before))).toEqual([]);
  });

  it('names the top-level keys that differ in a structured document', () => {
    const after = new Map(before);
    after.set(
      'retrieval/probes.yaml',
      yaml('whereNow: Where is she now?\nhowLong: For how long?\n'),
    );

    expect(changesBetween(before, after)).toEqual([
      { path: 'retrieval/probes.yaml', kind: 'changed', keys: ['whereNow'] },
    ]);
  });

  it('names an added and a removed key as changes to their document', () => {
    const after = new Map(before);
    after.set('privacy.yaml', yaml('phrases:\n  - a phrase\nphone:\n  - +1 555 0100\n'));

    expect(changesBetween(before, after)).toEqual([
      { path: 'privacy.yaml', kind: 'changed', keys: ['phone'] },
    ]);
  });

  it('reports a binary document as changed as a whole', () => {
    const after = new Map(before);
    after.set('assets/photo.pdf', pdf(2));

    expect(changesBetween(before, after)).toEqual([
      { path: 'assets/photo.pdf', kind: 'changed', keys: [] },
    ]);
  });

  it('reports what was added and what is gone', () => {
    const after = new Map(before);
    after.delete('knowledge/practice.yaml');
    after.set('assets/resume.pdf', pdf(3));

    expect(changesBetween(before, after)).toEqual([
      { path: 'assets/resume.pdf', kind: 'added', keys: [] },
      { path: 'knowledge/practice.yaml', kind: 'removed', keys: [] },
    ]);
  });

  it('reports a document whose media type changed, with the same bytes', () => {
    const after = new Map(before);
    const document = before.get('privacy.yaml');
    if (!document) throw new Error('The fixture lost a document.');
    after.set('privacy.yaml', { ...document, mediaType: 'text/markdown' });

    expect(changesBetween(before, after)).toMatchObject([
      { path: 'privacy.yaml', kind: 'changed' },
    ]);
  });
});

describe('how the changes read', () => {
  it('groups them by what they are, and prints ids, never values', () => {
    const after = new Map(before);
    after.set('copy/en/answers/career.yaml', yaml('career:\n  parts: [{text: new prose}]\n'));
    after.set('privacy.yaml', yaml('phrases:\n  - a secret phrase\n'));
    after.delete('assets/photo.pdf');

    const lines = describeChanges(changesBetween(before, after));

    expect(lines).toEqual([
      'assets',
      '  assets/photo.pdf removed',
      'copy (en)',
      '  copy/en/answers/career.yaml changed: career',
      'profile',
      '  privacy.yaml changed: phrases',
    ]);
    expect(lines.join('\n')).not.toContain('new prose');
    expect(lines.join('\n')).not.toContain('secret phrase');
  });

  const groups = [
    { path: 'identity.yaml', group: 'profile' },
    { path: 'knowledge/experience.yaml', group: 'record' },
    { path: 'knowledge/knowledge-base.md', group: 'record' },
    { path: 'copy/pt-BR/topics.yaml', group: 'copy (pt-BR)' },
    { path: 'generated/knowledge-index.json', group: 'generated files' },
    { path: 'assets/photo.jpg', group: 'assets' },
    { path: 'sites/allow-list.yaml', group: 'product sites' },
    { path: 'evaluation/cases.yaml', group: 'evaluation' },
    { path: 'retrieval/probes.yaml', group: 'retrieval' },
  ];

  it.each(groups)('files $path under $group', ({ path, group }) => {
    expect(groupOf(path)).toBe(group);
  });
});
