import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fixtureUiMessages, renderWithMessages } from '@/testing/ui-messages';
import { createAssistant } from '@/core/assistant/assistant';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import { createChatHandler } from '@/http/chat-handler';
import { createAnswerCache } from '@/infrastructure/budget/answer-cache';
import { createModelBudget } from '@/infrastructure/budget/model-budget';
import { createSiteContent } from '@/site/site-content';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { workspaceView } from '@/site/workspace-view';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { ConversationsProvider } from '@/ui/chat/conversation-store';

// The one definition, changed here as an edit to it would change it: both
// the composer the page renders and the endpoint's schema must follow.
vi.mock('@/core/chat/request', async (original) => ({
  ...(await original<typeof import('@/core/chat/request')>()),
  MAX_QUESTION_LENGTH: 7,
}));

const content = createSiteContent(fixtureKnowledge, fixtureAnswers, 'en');

const handle = createChatHandler({
  assistant: createAssistant({
    fastPath: createFastPath({ en: { knowledge: content.knowledge, answers: fixtureAnswers } }),
    modelAssistant: null,
    clock: { now: () => new Date() },
    reportError: () => undefined,
    budget: createModelBudget({
      answersPerWindow: 100,
      windowMs: 60_000,
      dailyTokens: 1_000_000,
      clientDailyTokens: 1_000_000,
    }),
    answerCache: createAnswerCache({ ttlMs: 60_000, maxEntries: 10 }),
  }),
  reportError: () => undefined,
  requestLimiter: { admit: () => ({ allowed: true, retryAfterMs: 0 }) },
  reportRateLimited: () => undefined,
  requestTimeoutMs: 60_000,
});

function ask(message: string): Promise<Response> {
  return handle(
    new Request('http://portfolio.test/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }),
  );
}

describe('one question limit', () => {
  it('caps what the composer takes', async () => {
    const user = userEvent.setup();
    renderWithMessages(<ChatWorkspace {...workspaceView(content)} />, {
      wrapper: ConversationsProvider,
    });
    const composer = screen.getByRole('textbox', { name: fixtureUiMessages.composer.label });

    await user.type(composer, 'abcdefgh');

    expect(composer).toHaveAttribute('maxLength', '7');
    expect(composer).toHaveValue('abcdefg');
  });

  it('caps what the endpoint accepts', async () => {
    const atLimit = await ask('abcdefg');
    const overLimit = await ask('abcdefgh');

    await atLimit.body?.cancel();

    expect(atLimit.status).toBe(200);
    expect(overLimit.status).toBe(400);
  });
});
