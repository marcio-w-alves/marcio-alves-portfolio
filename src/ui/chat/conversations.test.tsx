import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistant } from '@/core/assistant/assistant';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import type { Locale } from '@/core/i18n/locale';
import { createChatHandler } from '@/http/chat-handler';
import { createAnswerCache } from '@/infrastructure/budget/answer-cache';
import { createModelBudget } from '@/infrastructure/budget/model-budget';
import { createSiteContent } from '@/site/site-content';
import { workspaceView } from '@/site/workspace-view';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { fixturePortugueseUiMessages, fixtureUiMessages } from '@/testing/ui-messages';
import { I18nProvider } from '../i18n/i18n-provider';
import { ChatWorkspace } from './chat-workspace';
import { ConversationsProvider } from './conversation-store';

const CHAT_URL = `${window.location.origin}/api/chat`;
const ENGLISH_QUESTION = 'Tell me about her time at Globex, please.';
const PORTUGUESE_QUESTION = 'O que ela fez na Acme?';

const chatHandler = createChatHandler({
  assistant: createAssistant({
    fastPath: createFastPath(
      createSiteContent(fixtureKnowledge, fixtureAnswers, 'en').knowledge,
      fixtureAnswers,
    ),
    modelAssistant: null,
    clock: { now: () => new Date() },
    reportError: () => undefined,
    budget: createModelBudget({ answersPerWindow: 100, windowMs: 60_000, dailyTokens: 1_000_000 }),
    answerCache: createAnswerCache({ ttlMs: 60_000, maxEntries: 10 }),
  }),
  reportError: () => undefined,
  requestLimiter: { admit: () => ({ allowed: true, retryAfterMs: 0 }) },
  reportRateLimited: () => undefined,
  requestTimeoutMs: 60_000,
});

/** The language each request said its page was in, in the order they came. */
let askedIn: unknown[] = [];
/** Holds the next answer until released, as a slow answer would. */
let hold: Promise<void> | null = null;

const server = setupServer(
  http.post(CHAT_URL, async ({ request }) => {
    const body = (await request.clone().json()) as { locale?: unknown };
    askedIn.push(body.locale);
    if (hold) await hold;
    return chatHandler(request);
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
beforeEach(() => {
  askedIn = [];
  hold = null;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const MESSAGES = { en: fixtureUiMessages, 'pt-BR': fixturePortugueseUiMessages } as const;

/**
 * The experience page in a language, as the root layout and the site render it:
 * the providers stay mounted, the language's catalog changes, and the
 * workspace is keyed by language and topic.
 */
function experiencePage(locale: Locale) {
  const content = createSiteContent(fixtureKnowledge, fixtureAnswers, locale);
  return (
    <I18nProvider locale={locale} messages={MESSAGES[locale]}>
      <ConversationsProvider>
        <ChatWorkspace key={`${locale}:experience`} {...workspaceView(content, 'experience')} />
      </ConversationsProvider>
    </I18nProvider>
  );
}

function renderExperience() {
  const view = render(experiencePage('en'));
  return Object.assign(userEvent.setup(), {
    switchTo: (locale: Locale) => {
      view.rerender(experiencePage(locale));
    },
  });
}

const conversation = () => screen.getByRole('list', { name: /^(Conversation|Conversa)$/ });
function composer(): HTMLElement {
  const [first] = screen.getAllByRole('textbox');
  if (!first) throw new Error('no composer on the page');
  return first;
}

async function ask(user: ReturnType<typeof userEvent.setup>, question: string) {
  await user.type(composer(), `${question}{Enter}`);
  await within(conversation()).findByText(question);
}

async function answerSettles() {
  await waitFor(() => {
    expect(conversation()).toHaveAttribute('aria-busy', 'false');
  });
}

describe('conversations, kept per language and per page', () => {
  it("keeps each language's conversation on the same page, sending each page's language", async () => {
    const user = renderExperience();
    await ask(user, ENGLISH_QUESTION);
    await answerSettles();

    user.switchTo('pt-BR');
    expect(screen.queryByText(ENGLISH_QUESTION)).not.toBeInTheDocument();
    await ask(user, PORTUGUESE_QUESTION);
    await answerSettles();

    user.switchTo('en');
    expect(within(conversation()).getByText(ENGLISH_QUESTION)).toBeInTheDocument();
    expect(screen.queryByText(PORTUGUESE_QUESTION)).not.toBeInTheDocument();

    user.switchTo('pt-BR');
    expect(within(conversation()).getByText(PORTUGUESE_QUESTION)).toBeInTheDocument();
    expect(screen.queryByText(ENGLISH_QUESTION)).not.toBeInTheDocument();
    expect(askedIn).toEqual(['en', 'pt-BR']);
  });

  it('lets an answer still on its way finish while the visitor reads the other language', async () => {
    const gate = Promise.withResolvers<undefined>();
    hold = gate.promise;
    const release = () => {
      gate.resolve(undefined);
    };
    const user = renderExperience();
    await ask(user, ENGLISH_QUESTION);
    expect(conversation()).toHaveAttribute('aria-busy', 'true');

    user.switchTo('pt-BR');
    user.switchTo('en');
    release();

    await answerSettles();
    const answer = within(conversation()).getAllByRole('article').at(-1);
    expect(answer).toHaveTextContent('Globex');
    expect(askedIn).toHaveLength(1);
  });
});
