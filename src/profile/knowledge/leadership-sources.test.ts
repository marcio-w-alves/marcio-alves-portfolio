import { describe, expect, it } from 'vitest';
import { createCitation } from '@/core/assistant/citations';
import { usedSources, type SourceEvidence } from '@/core/assistant/system2/sources';
import { buildCorpus } from '@/core/knowledge/corpus';
import { localize } from '@/core/knowledge/localize';
import { knowledge as source } from '.';

/** What each source vouches for when a search returns these passages of the record. */
function evidenceFrom(ids: readonly string[]): SourceEvidence[] {
  const knowledge = localize(source, 'en');
  const citation = createCitation(knowledge.sourceLabels);
  const chunks = buildCorpus(knowledge).filter((chunk) => ids.includes(chunk.id));
  return [...new Set(chunks.map((chunk) => chunk.source))].map((id) => ({
    source: citation(id),
    text: chunks
      .filter((chunk) => chunk.source === id)
      .map((chunk) => chunk.text)
      .join('\n'),
  }));
}

// The owner's own record: what a leadership search returns there is what FR-35 is about.
describe('usedSources — for what a leadership search returns from the record', () => {
  const retrieved = evidenceFrom([
    'notes:14.q6',
    'skills:leadership',
    'notes:8.1',
    'role:deel:1',
    'notes:8',
    'education',
    'role:roots:1',
    'role:roots:2',
  ]);

  it('cites the roles an English answer paraphrases, not the skill list or the degree', () => {
    const answer =
      'Yes. At Deel he helped lead and maintain the HRIS team responsible for the core HR tools product; at Roots he expanded the frontend team from a solo developer setup by recruiting and integrating three developers.';

    expect(usedSources(answer, retrieved).map(({ id }) => id)).toEqual([
      'resume.deel',
      'resume.roots',
    ]);
  });

  it('cites the note a Portuguese answer paraphrases, not the skill list or the degree', () => {
    const answer =
      'Sim. Na Roots, ajudou a expandir a equipe frontend de um para quatro engenheiros e coordenou entregas. Na Deel, ajudou a liderar e manter o time de HRIS.';

    expect(usedSources(answer, retrieved).map(({ id }) => id)).toEqual(['notes']);
  });
});
