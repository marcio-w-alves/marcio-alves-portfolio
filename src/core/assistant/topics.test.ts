import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { createResponseKit } from './response-kit';
import { createTopicIntro } from './topic-pages';
import { createTopicCatalog, TOPIC_IDS } from './topics';

const kit = createResponseKit(localize(fixtureKnowledge, 'en'));
const copy = fixtureAnswers.topics(kit);
const catalog = createTopicCatalog(copy);
const { suggestedQuestions, suggestions, topicById, topics } = catalog;

describe('topics — the pages the profile writes', () => {
  it('lists every page in the site order, with the label and introduction the copy gives it', () => {
    expect(topics.map((topic) => topic.id)).toEqual(TOPIC_IDS);
    expect(topicById('experience')).toMatchObject({
      label: 'Experience',
      icon: 'briefcase',
      intro: '3 roles since 2012.',
    });
  });

  it("opens a page on its introduction, then the copy's part of the record", () => {
    const intro = createTopicIntro(catalog)('experience');
    expect(intro.parts[0]).toEqual({ type: 'text', text: '3 roles since 2012.' });
    expect(intro.parts.slice(1)).toEqual(copy.experience.page);
    expect(intro.parts[1]).toMatchObject({ type: 'component', component: 'timeline' });
  });
});

describe('topics — suggested questions', () => {
  it('carries each question with its tag and its chip label: the short one written for it, else the tag', () => {
    expect(suggestedQuestions('overview', 0, 2)).toEqual([
      { question: "Tell me about Ada's career.", tag: 'Career', short: 'Her career' },
      { question: 'Did she lead the payroll team?', tag: 'Payroll', short: 'Payroll' },
    ]);
  });

  it('rotates through the pool a page at a time, wrapping around at the end', () => {
    const pool = topicById('overview').questions.map((item) => item.question);
    expect(suggestions('overview', 0, 2)).toEqual(pool.slice(0, 2));
    expect(suggestions('overview', 1, 2)).toEqual([pool[2], pool[0]]);
  });

  it('falls back to the overview for a topic it does not know', () => {
    expect(suggestions('nonsense', 0, 3)).toEqual(suggestions('overview', 0, 3));
  });
});
