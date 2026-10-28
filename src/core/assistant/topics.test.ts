import { describe, expect, it } from 'vitest';
import { suggestedQuestions, suggestions, topicById } from './topics';

describe('topics — suggested questions', () => {
  it('carries each question with its tag and the short chip label written for it', () => {
    expect(suggestedQuestions('overview', 0, 2)).toEqual([
      { question: "Tell me about Marcio's career.", tag: 'Career', short: 'His career' },
      {
        question: 'What makes Marcio a strong Staff Engineer?',
        tag: 'Staff-level',
        short: 'Why Staff-level',
      },
    ]);
  });

  it('labels a chip with its tag where no shorter label is written', () => {
    expect(suggestedQuestions('skills', 1, 4).at(-1)).toEqual({
      question: 'How does he approach testing?',
      tag: 'Testing',
      short: 'Testing',
    });
  });

  it('rotates through the pool a page at a time, wrapping around at the end', () => {
    const pool = topicById('projects').questions.map((item) => item.question);
    expect(suggestions('projects', 0, 4)).toEqual(pool.slice(0, 4));
    expect(suggestions('projects', 1, 4)).toEqual([...pool.slice(4), ...pool.slice(0, 2)]);
  });

  it('falls back to the overview for a topic it does not know', () => {
    expect(suggestions('nonsense', 0, 3)).toEqual(suggestions('overview', 0, 3));
  });
});

describe('topics — introductions', () => {
  it('tells the live products apart from the concept', () => {
    expect(topicById('projects').intro).toBe(
      "Beyond his day job, Marcio builds his own products. EvCopilot, FormDaily and TargUp already have public sites, and FictionDraft is still a concept. Ask about any of them — I'll be clear about what's live versus planned.",
    );
  });
});
