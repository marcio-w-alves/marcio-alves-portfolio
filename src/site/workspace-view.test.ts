import { describe, expect, it } from 'vitest';
import { MAX_QUESTION_LENGTH } from '@/core/chat/request';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import { profile } from '@/profile';
import { createSiteContent } from './site-content';
import { workspaceView } from './workspace-view';

// The topics' copy is still written for the owner's record, so these assert
// how the view is built from it, never what it says.
const content = createSiteContent(profile.knowledge, profile.copy.en.answers);

describe('workspaceView', () => {
  it('links every topic to its own page, the overview to the home page', () => {
    const { topics } = workspaceView(content);

    expect(topics.map(({ id, href }) => [id, href])).toEqual(
      TOPIC_IDS.map((id) => [id, id === 'overview' ? '/' : `/${id}`]),
    );
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

  it('caps a question at the length the API accepts', () => {
    expect(workspaceView(content).maxQuestionLength).toBe(MAX_QUESTION_LENGTH);
  });
});
