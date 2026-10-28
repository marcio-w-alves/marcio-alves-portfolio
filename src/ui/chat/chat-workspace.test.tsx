import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createChatHandler } from '@/app/api/chat/chat-handler';
import { createAssistant } from '@/core/assistant/assistant';
import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import { topicById, topics } from '@/core/assistant/topics';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { createAnswerCache } from '@/infrastructure/budget/answer-cache';
import { createModelBudget } from '@/infrastructure/budget/model-budget';
import { ChatWorkspace } from './chat-workspace';

const CHAT_URL = `${window.location.origin}/api/chat`;

/** The real endpoint, answering from the fast path: what production does without a model key. */
const chatHandler = createChatHandler({
  assistant: createAssistant({
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
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function renderWorkspace() {
  const { profile, contact, welcome } = knowledgeBase;
  render(
    <ChatWorkspace
      profile={{ name: profile.name, title: profile.title, initials: profile.initials }}
      links={contact}
      topics={topics.map(({ id, label, icon }) => ({ id, label, icon }))}
      welcome={welcome}
      maxQuestionLength={MAX_QUESTION_LENGTH}
    />,
  );
  return userEvent.setup();
}

const topicsNav = () => screen.getByRole('navigation', { name: 'Topics' });
const composer = () =>
  screen.getByRole('textbox', { name: 'Ask the portfolio assistant a question' });
const conversation = () => screen.getByRole('list', { name: 'Conversation' });
function latestAnswer(): HTMLElement {
  const answer = within(conversation()).getAllByRole('article').at(-1);
  if (!answer) throw new Error('no answer in the conversation');
  return answer;
}

describe('the welcome screen', () => {
  it('greets the visitor with one main heading and the composer', () => {
    renderWorkspace();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      knowledgeBase.welcome.heading,
    );
    expect(composer()).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: "Tell me about Marcio's career." }),
    ).toBeInTheDocument();
  });

  it('offers other questions on request', async () => {
    const user = renderWorkspace();
    await user.click(screen.getByRole('button', { name: 'More questions' }));
    expect(
      screen.queryByRole('button', { name: "Tell me about Marcio's career." }),
    ).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: "Tell me about Marcio's career." }));
    await screen.findByRole('group', { name: 'Answer actions' });
    expect(within(conversation()).getByText("Tell me about Marcio's career.")).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Conversation');
  });

  it('asks a follow-up from under the answer', async () => {
    const user = renderWorkspace();
    await user.click(screen.getByRole('button', { name: "Tell me about Marcio's career." }));
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

describe('topic navigation', () => {
  it('starts on the overview', () => {
    renderWorkspace();
    expect(within(topicsNav()).getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('opens a topic with its introduction and suggestions, without asking the server', async () => {
    server.use(http.post(CHAT_URL, () => HttpResponse.error()));
    const user = renderWorkspace();
    await user.click(within(topicsNav()).getByRole('button', { name: 'Experience' }));
    expect(within(topicsNav()).getByRole('button', { name: 'Experience' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByText('Conversation ·', { exact: false })).toHaveTextContent(
      'Conversation · Experience',
    );
    expect(latestAnswer()).toHaveTextContent(topicById('experience').intro);
    expect(
      within(latestAnswer()).getByRole('list', { name: 'Suggested questions' }),
    ).toBeInTheDocument();
  });

  it('starts over on the same topic', async () => {
    const user = renderWorkspace();
    await user.click(within(topicsNav()).getByRole('button', { name: 'Projects' }));
    const [sidebarButton] = screen.getAllByRole('button', { name: 'New conversation' });
    if (!sidebarButton) throw new Error('no new conversation button');
    await user.click(sidebarButton);
    expect(screen.queryByRole('list', { name: 'Conversation' })).not.toBeInTheDocument();
    expect(within(topicsNav()).getByRole('button', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('New conversation started');
  });
});

describe('profile links', () => {
  it('links to LinkedIn, GitHub and email, opening external profiles in a new tab', () => {
    renderWorkspace();
    const linkedin = screen.getByRole('link', { name: /LinkedIn/ });
    expect(linkedin).toHaveAttribute('href', knowledgeBase.contact.linkedin);
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAccessibleName(/^LinkedIn ?\(opens in a new tab\)$/);
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
      'href',
      knowledgeBase.contact.github,
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      `mailto:${knowledgeBase.contact.email}`,
    );
  });

  it('says the résumé is coming rather than linking to nothing', () => {
    renderWorkspace();
    expect(screen.queryByRole('link', { name: /Download resume/ })).not.toBeInTheDocument();
    expect(screen.getByText('Soon')).toBeInTheDocument();
  });
});

describe('navigation drawer', () => {
  it('opens with focus on the first topic and shuts the rest of the page off', async () => {
    const user = renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(within(topicsNav()).getByRole('button', { name: 'Overview' })).toHaveFocus();
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

  it('closes once a topic is chosen', async () => {
    const user = renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(menu);
    await user.click(within(topicsNav()).getByRole('button', { name: 'Achievements' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });
});
