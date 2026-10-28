import { describe, expect, it } from 'vitest';
import { MAX_QUESTION_LENGTH } from '@/core/chat/request';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { withMetric, withRole } from '@/testing/fixture-profile/variants';
import { createSiteContent } from './site-content';
import { workspaceView } from './workspace-view';

const content = createSiteContent(fixtureKnowledge, fixtureAnswers);

describe('workspaceView', () => {
  it('links every topic to its own page, the overview to the home page', () => {
    const { topics } = workspaceView(content);

    expect(topics.map(({ id, href }) => [id, href])).toEqual(
      TOPIC_IDS.map((id) => [id, id === 'overview' ? '/' : `/${id}`]),
    );
  });

  it('links no page beside the topics when the profile writes none', () => {
    expect(workspaceView(content).pages).toEqual([]);
  });

  it('links the page about the site when the profile writes one', () => {
    const about = { label: 'About', title: 'How it works', description: 'd', markdown: '## x' };
    const { pages } = workspaceView(createSiteContent(fixtureKnowledge, fixtureAnswers, about));
    expect(pages).toEqual([{ label: 'About', icon: 'layers', href: '/about-this-site' }]);
  });

  it.each(TOPIC_IDS)('opens the %s page on its own conversation and four suggestions', (topic) => {
    const view = workspaceView(content, topic);

    expect(view.topic).toBe(topic);
    expect(view.seed.topic).toBe(topic);
    expect(view.suggestions).toEqual(
      content.topicCatalog
        .suggestedQuestions(topic, 0, 4)
        .map(({ question, short }) => ({ question, label: short })),
    );
  });

  it('opens a topic page with its introduction, and the overview with none', () => {
    expect(workspaceView(content).seed.messages).toEqual([]);
    expect(workspaceView(content, 'experience').seed.messages).toHaveLength(1);
  });

  it("signs the answers with the assistant's name and monogram from the record", () => {
    expect(workspaceView(content).assistant).toEqual({ name: "Ada's assistant", initials: 'AR' });
  });

  it('caps a question at the length the API accepts', () => {
    expect(workspaceView(content).maxQuestionLength).toBe(MAX_QUESTION_LENGTH);
  });

  it('greets with the companies and the two metrics the record flags', () => {
    expect(workspaceView(content).welcome.evidence).toEqual({
      companies: ['Acme', 'Globex'],
      metrics: [
        { value: '40%', label: 'Faster builds' },
        { value: '2 → 6', label: 'Platform team grown' },
      ],
    });
  });

  it('follows the record when a flagged metric or a company changes', () => {
    const changed = withRole(
      withMetric(fixtureKnowledge, 'globex-team', {
        value: '2 → 9',
        label: { en: 'Team tripled' },
      }),
      'acme',
      { company: 'Acme Labs' },
    );

    const { evidence } = workspaceView(createSiteContent(changed, fixtureAnswers)).welcome;

    expect(evidence.companies).toEqual(['Acme Labs', 'Globex']);
    expect(evidence.metrics).toContainEqual({ value: '2 → 9', label: 'Team tripled' });
  });
});
