import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Fragment } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatHandler } from '@/app/api/chat/chat-handler';
import { EVENT_STREAM_HEADERS, eventStream } from '@/app/api/chat/event-stream';
import { knowledge, topicCatalog } from '@/app/site-knowledge';
import { workspaceProps } from '@/app/workspace-props';
import type { AssistantEvent } from '@/core/assistant/assistant-event';
import { createAssistant } from '@/core/assistant/assistant';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import type { TopicId } from '@/core/assistant/topics';
import { createAnswerCache } from '@/infrastructure/budget/answer-cache';
import { createModelBudget } from '@/infrastructure/budget/model-budget';
import { ChatWorkspace } from './chat-workspace';
import { ConversationsProvider } from './conversation-store';

const CHAT_URL = `${window.location.origin}/api/chat`;

/** The real endpoint, answering from the fast path: what production does without a model key. */
const chatHandler = createChatHandler({
  assistant: createAssistant({
    fastPath: createFastPath(knowledge),
    modelAssistant: null,
    clock: { now: () => new Date() },
    reportError: () => undefined,
    budget: createModelBudget({ answersPerWindow: 100, windowMs: 60_000, dailyTokens: 1_000_000 }),
    answerCache: createAnswerCache({ ttlMs: 60_000, maxEntries: 10 }),
  }),
  reportError: () => undefined,
  requestLimiter: { admit: () => ({ allowed: true, retryAfterMs: 0 }) },
  reportRateLimited: () => undefined,
});

const server = setupServer(http.post(CHAT_URL, ({ request }) => chatHandler(request)));

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
/** Answers appear at once for a visitor who prefers reduced motion; most tests are about what, not how fast. */
function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(
      (query: string) =>
        ({
          matches: reduce && query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    ),
  );
}

beforeEach(() => {
  prefersReducedMotion(true);
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** The page as the server renders it: the workspace with the view built for its topic. */
function workspace(topic: TopicId = 'overview') {
  return <ChatWorkspace {...workspaceProps(topic)} />;
}

/** One page of the site, inside the store every page shares. */
function renderWorkspace(topic: TopicId = 'overview') {
  const view = render(workspace(topic), { wrapper: ConversationsProvider });
  return Object.assign(userEvent.setup(), {
    /** Swaps the page, as navigating does, keeping the store. */
    navigate: (to: TopicId) => {
      view.rerender(<Fragment key={to}>{workspace(to)}</Fragment>);
    },
  });
}

const topicsNav = () => screen.getByRole('navigation', { name: 'Topics' });
const composer = () =>
  screen.getByRole('textbox', { name: 'Ask the portfolio assistant a question' });
const conversation = () => screen.getByRole('list', { name: 'Conversation' });
function introduction(): HTMLElement {
  const [intro] = within(conversation()).getAllByRole('article');
  if (!intro) throw new Error('no introduction on the page');
  return intro;
}
function latestAnswer(): HTMLElement {
  const answer = within(conversation()).getAllByRole('article').at(-1);
  if (!answer) throw new Error('no answer in the conversation');
  return answer;
}

describe('the welcome screen', () => {
  it('greets the visitor with one main heading and the composer', () => {
    renderWorkspace();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(knowledge.welcome.heading);
    expect(composer()).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Suggested questions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'His career' })).toBeInTheDocument();
  });
});

describe('asking a question', () => {
  it('shows the question and streams the answer from the server, with sources and follow-ups', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');

    expect(await within(conversation()).findByText('What did he do at Roots?')).toBeInTheDocument();
    const answer = await screen.findByRole('group', { name: 'Answer actions' });
    expect(latestAnswer()).toHaveTextContent('Roots');
    expect(within(latestAnswer()).getByText('Sources')).toBeInTheDocument();
    expect(
      within(latestAnswer()).getByRole('list', { name: 'Ask a follow-up' }),
    ).toBeInTheDocument();
    expect(answer).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Answer ready');
  });

  it('empties the composer once the question is sent', async () => {
    const user = renderWorkspace();
    await user.type(composer(), "Tell me about Marcio's career.{Enter}");
    await screen.findByRole('group', { name: 'Answer actions' });
    expect(composer()).toHaveValue('');
  });

  it('asks a suggested question in one click', async () => {
    const user = renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'His career' }));
    await screen.findByRole('group', { name: 'Answer actions' });
    expect(within(conversation()).getByText("Tell me about Marcio's career.")).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conversation');
  });

  it('asks a follow-up from under the answer', async () => {
    const user = renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'His career' }));
    await screen.findByRole('group', { name: 'Answer actions' });
    const followUps = within(latestAnswer()).getByRole('list', { name: 'Ask a follow-up' });
    const [first] = within(followUps).getAllByRole('button');
    if (!first) throw new Error('no follow-ups');
    const question = first.textContent;
    await user.click(first);
    expect(await within(conversation()).findAllByRole('article')).toHaveLength(2);
    expect(within(conversation()).getByText(question)).toBeInTheDocument();
  });

  it('offers the related experience', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    await user.click(await screen.findByRole('button', { name: 'View Roots experience' }));
    expect(
      await within(conversation()).findByText('Tell me about his time at Roots.'),
    ).toBeInTheDocument();
  });

  it('records a rating and lets it be taken back', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    const helpful = await screen.findByRole('button', { name: 'Helpful' });
    await user.click(helpful);
    expect(helpful).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Thanks for the feedback')).toBeInTheDocument();
    await user.click(helpful);
    expect(helpful).toHaveAttribute('aria-pressed', 'false');
  });

  it('copies the answer as plain text', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain('Roots');
    expect(copied).not.toContain('**');
  });
});

describe('an answer as it is typed', () => {
  beforeEach(() => {
    prefersReducedMotion(false);
  });

  const actions = () => screen.queryByRole('group', { name: 'Answer actions' });

  it('thinks first, then types the answer out, and offers its actions once it is all there', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'How did he grow the team at Roots?{Enter}');

    expect(
      within(latestAnswer()).getByText(/Reading Marcio.s documented experience/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument();

    await waitFor(() => {
      const typed = latestAnswer().textContent;
      expect(typed).toContain('As Lead');
      expect(typed).not.toContain('grew the frontend team');
    });
    expect(actions()).not.toBeInTheDocument();

    expect(
      await screen.findByRole('group', { name: 'Answer actions' }, { timeout: 8000 }),
    ).toBeVisible();
    expect(latestAnswer()).toHaveTextContent(/grew the frontend team/);
    expect(screen.getByRole('button', { name: 'Send question' })).toBeInTheDocument();
  }, 10_000);

  it('shows the rest at once when the visitor stops it mid-typing', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'How did he grow the team at Roots?{Enter}');
    await waitFor(() => {
      expect(latestAnswer()).toHaveTextContent('As Lead');
    });

    await user.click(screen.getByRole('button', { name: 'Stop generating' }));

    expect(latestAnswer()).toHaveTextContent(/grew the frontend team/);
    expect(actions()).toBeVisible();
  });
});

describe('one question at a time', () => {
  it('lets nothing else be asked from another page while an answer is on its way', async () => {
    server.use(
      http.post(CHAT_URL, async () => {
        await delay('infinite');
        return new HttpResponse(null);
      }),
    );
    const user = renderWorkspace('skills');
    await user.type(composer(), 'How does he approach testing?{Enter}');

    user.navigate('overview');

    expect(screen.getByRole('button', { name: 'His career' })).toBeDisabled();
    await user.type(composer(), 'What did he do at Roots?');
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
    expect(
      screen.getByText('Another answer is on its way. Send this once it is done.'),
    ).toBeVisible();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('list', { name: 'Conversation' })).not.toBeInTheDocument();
  });
});

describe('stopping an answer', () => {
  it('stops a slow answer and gives the send button back', async () => {
    server.use(
      http.post(CHAT_URL, async () => {
        await delay('infinite');
        return new HttpResponse(null);
      }),
    );
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    expect(await screen.findByText(/Reading Marcio.s documented experience/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(within(latestAnswer()).getByText('Response stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send question' })).toBeInTheDocument();
  });
});

describe('an answer in flight when another is retried, edited or dropped', () => {
  const failedQuestion = 'What did he do at Roots?';
  const streamingQuestion = 'How does he approach testing?';

  /** Answers each request with the next responder, in the order the questions are sent. */
  function respondInTurn(...responders: ((request: Request) => Response | Promise<Response>)[]) {
    server.use(
      http.post(CHAT_URL, ({ request }) => {
        const respond = responders.shift() ?? chatHandler;
        return respond(request);
      }),
    );
  }

  const failure = () => HttpResponse.json({}, { status: 500 });

  /**
   * Streams "Part" of an answer and holds the rest until released. The rest
   * reaching the page would mean the answer was never cancelled.
   */
  function heldMidStream() {
    const rest = Promise.withResolvers<undefined>();
    async function* events(): AsyncGenerator<AssistantEvent> {
      yield { type: 'start', intent: 'testing', related: null };
      yield { type: 'text-start', id: 'text-1' };
      yield { type: 'text-delta', id: 'text-1', delta: 'Part' };
      await rest.promise;
      yield { type: 'text-delta', id: 'text-1', delta: ' arrived late' };
      yield { type: 'text-end', id: 'text-1' };
      yield { type: 'finish', followUps: [], sources: [] };
    }
    const respond = () =>
      new HttpResponse(
        eventStream(events(), () => undefined),
        { headers: EVENT_STREAM_HEADERS },
      );
    return {
      respond,
      releaseRest: () => {
        rest.resolve(undefined);
      },
    };
  }

  /** The real endpoint, held back until released. */
  function realAnswerOnRelease() {
    const gate = Promise.withResolvers<undefined>();
    const respond = async (request: Request) => {
      await gate.promise;
      return chatHandler(request);
    };
    return {
      respond,
      release: () => {
        gate.resolve(undefined);
      },
    };
  }

  async function failThenStream(user: ReturnType<typeof renderWorkspace>) {
    await user.type(composer(), `${failedQuestion}{Enter}`);
    const alert = await screen.findByRole('alert');
    await user.type(composer(), `${streamingQuestion}{Enter}`);
    await within(latestAnswer()).findByText('Part');
    return alert;
  }

  const answers = () => within(conversation()).getAllByRole('article');
  function answerAt(index: number): HTMLElement {
    const answer = answers()[index];
    if (!answer) throw new Error(`no answer at ${String(index)}`);
    return answer;
  }

  it('stops the streaming answer when an older one is retried, and streams only the retry', async () => {
    const streaming = heldMidStream();
    const retried = realAnswerOnRelease();
    respondInTurn(failure, streaming.respond, retried.respond);
    const user = renderWorkspace();
    const alert = await failThenStream(user);

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    // The failed exchange is asked again at the end, so the interrupted answer comes first.
    const interrupted = answerAt(0);
    expect(interrupted).toHaveTextContent('Part');
    expect(within(interrupted).getByText('Response stopped')).toBeInTheDocument();
    expect(within(answerAt(1)).queryByText('Response stopped')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument();

    streaming.releaseRest();
    retried.release();

    expect(
      await within(latestAnswer()).findByRole('group', { name: 'Answer actions' }),
    ).toBeInTheDocument();
    expect(latestAnswer()).toHaveTextContent('Roots');
    expect(interrupted).not.toHaveTextContent('arrived late');
    expect(conversation()).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('button', { name: 'Send question' })).toBeInTheDocument();
  });

  it('stops the streaming answer when an older question is taken back to edit', async () => {
    const streaming = heldMidStream();
    respondInTurn(failure, streaming.respond);
    const user = renderWorkspace();
    const alert = await failThenStream(user);

    await user.click(within(alert).getByRole('button', { name: 'Edit question' }));

    expect(composer()).toHaveValue(failedQuestion);
    expect(answers()).toHaveLength(1);
    const interrupted = answerAt(0);
    expect(interrupted).toHaveTextContent('Part');
    expect(within(interrupted).getByText('Response stopped')).toBeInTheDocument();
    expect(conversation()).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Response stopped');

    streaming.releaseRest();
    await user.keyboard('{Enter}');

    expect(
      await within(latestAnswer()).findByRole('group', { name: 'Answer actions' }),
    ).toBeInTheDocument();
    expect(interrupted).not.toHaveTextContent('arrived late');
  });

  it.each([
    [
      'Start over',
      () =>
        within(screen.getByRole('complementary', { name: 'Portfolio navigation' })).getByRole(
          'button',
          { name: 'New conversation' },
        ),
    ],
    ['Stop generating', () => screen.getByRole('button', { name: 'Stop generating' })],
  ])('ends the streaming answer the same way with %s', async (_, control) => {
    const streaming = heldMidStream();
    respondInTurn(failure, streaming.respond);
    const user = renderWorkspace();
    await failThenStream(user);

    await user.click(control());
    streaming.releaseRest();
    await user.type(composer(), 'What did he do at Roots?{Enter}');

    expect(
      await within(latestAnswer()).findByRole('group', { name: 'Answer actions' }),
    ).toBeInTheDocument();
    expect(conversation()).not.toHaveTextContent('arrived late');
    expect(screen.getByRole('button', { name: 'Send question' })).toBeInTheDocument();
  });
});

describe('when an answer fails', () => {
  function failOnce() {
    server.use(http.post(CHAT_URL, () => HttpResponse.json({}, { status: 500 }), { once: true }));
  }

  it('says what failed and retries the same question', async () => {
    failOnce();
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load this answer");
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await screen.findByRole('group', { name: 'Answer actions' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(conversation()).getAllByText('What did he do at Roots?')).toHaveLength(1);
  });

  it('hands the question back to the composer to edit', async () => {
    failOnce();
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    await user.click(
      within(await screen.findByRole('alert')).getByRole('button', { name: 'Edit question' }),
    );
    expect(composer()).toHaveValue('What did he do at Roots?');
    expect(composer()).toHaveFocus();
  });

  it('puts the visitor in the composer to ask a follow-up', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Ask follow-up' }));
    expect(composer()).toHaveFocus();
  });
});

describe('topic pages', () => {
  const topicLink = (name: string) => within(topicsNav()).getByRole('link', { name });

  it('marks the overview as the current page on the home page', () => {
    renderWorkspace();
    expect(topicLink('Overview')).toHaveAttribute('aria-current', 'page');
    expect(topicLink('Experience')).toHaveAttribute('href', '/experience');
  });

  it('opens a topic page on its introduction and its part of the record, without asking the server', () => {
    server.use(http.post(CHAT_URL, () => HttpResponse.error()));
    renderWorkspace('experience');
    expect(topicLink('Experience')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Experience');
    expect(latestAnswer()).toHaveTextContent(topicCatalog.topicById('experience').intro);
    expect(within(latestAnswer()).getByText('Toptal')).toBeInTheDocument();
    expect(
      within(latestAnswer()).getByRole('list', { name: 'Suggested questions' }),
    ).toBeInTheDocument();
  });

  it('keeps each page to its own conversation, and finds each as it was on coming back', async () => {
    const user = renderWorkspace();
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    await within(conversation()).findByText(/grew the frontend team/);

    user.navigate('projects');
    expect(screen.queryByText('What did he do at Roots?')).not.toBeInTheDocument();
    expect(introduction()).toHaveTextContent(topicCatalog.topicById('projects').intro);

    user.navigate('overview');
    expect(within(conversation()).getByText('What did he do at Roots?')).toBeInTheDocument();
  });

  it('answers a question asked on a topic page beneath that page', async () => {
    const user = renderWorkspace('skills');
    await user.type(composer(), 'How did he grow the team at Roots?{Enter}');
    await within(conversation()).findByText(/grew the frontend team/);
    expect(introduction()).toHaveTextContent(topicCatalog.topicById('skills').intro);
  });

  it('starts a topic page over on its introduction, not on the welcome screen', async () => {
    const user = renderWorkspace('projects');
    await user.type(composer(), 'What did he do at Roots?{Enter}');
    await within(conversation()).findByText(/grew the frontend team/);
    const [sidebarButton] = screen.getAllByRole('button', { name: 'New conversation' });
    if (!sidebarButton) throw new Error('no new conversation button');
    await user.click(sidebarButton);
    expect(screen.queryByText('What did he do at Roots?')).not.toBeInTheDocument();
    expect(introduction()).toHaveTextContent(topicCatalog.topicById('projects').intro);
    expect(screen.getByRole('status')).toHaveTextContent('New conversation started');
  });
});

describe('navigation drawer', () => {
  it('opens with focus on the first topic and shuts the rest of the page off', async () => {
    const user = renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(within(topicsNav()).getByRole('link', { name: 'Overview' })).toHaveFocus();
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');
  });

  it('closes on Escape and gives focus back to the menu button', async () => {
    const user = renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(menu);
    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
  });

  it('closes with its close button', async () => {
    const user = renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(menu);
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });
});
