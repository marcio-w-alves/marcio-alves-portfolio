import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createResponseKit, details, note, table } from '@/core/assistant/response-kit';
import type { AssistantEvent } from '@/core/chat/events';
import type { ComponentPart } from '@/core/chat/components';
import type { TopicId } from '@/core/chat/topic-id';
import { addExchange, applyEvent } from '@/core/conversation/conversation';
import type { Conversation, MessagePart } from '@/core/conversation/messages';
import { mapMessages } from '@/core/i18n/format';
import { createSiteContent } from '@/site/site-content';
import { workspaceView } from '@/site/workspace-view';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { fixtureUiMessages, renderWithMessages, withMessages } from '@/testing/ui-messages';
import { ChatWorkspace } from '../chat/chat-workspace';
import { ConversationsProvider } from '../chat/conversation-store';
import { JumpToLatest } from '../composer';
import { PageFailed } from '../status/page-failed';

/**
 * A pseudo-locale render: every catalog message is wrapped in ⟦…⟧ and every
 * piece of the record in ⟪…⟫. Any text a visitor or a screen reader meets
 * outside both was written into a component — a hard-coded string.
 */

const pseudoMessages = mapMessages(fixtureUiMessages, (message) => `⟦${message}⟧`);
const data = (text: string) => `⟪${text}⟫`;

// Keys whose values the interface looks things up by or links to, rather than shows.
const NOT_SHOWN = new Set(['id', 'tone', 'url', 'expanded', 'resumeUrl', 'component', 'type']);

function wrapData<T>(value: T): T {
  const visit = (item: unknown, key = ''): unknown => {
    if (NOT_SHOWN.has(key)) return item;
    if (typeof item === 'string') return data(item);
    if (Array.isArray(item)) return item.map((entry) => visit(entry));
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item).map(([name, entry]) => [name, visit(entry, name)]),
      );
    }
    return item;
  };
  return visit(value) as T;
}

const content = createSiteContent(fixtureKnowledge, fixtureAnswers);
const kit = createResponseKit(content.knowledge);

/** The page's props with every value from the record marked as data. */
function view(topic: TopicId) {
  const plain = workspaceView(content, topic);
  return {
    ...plain,
    profile: wrapData(plain.profile),
    welcome: wrapData(plain.welcome),
    assistant: wrapData(plain.assistant),
    suggestions: wrapData(plain.suggestions),
    topics: plain.topics.map((item) => ({ ...item, label: data(item.label) })),
    seed: { ...plain.seed, messages: plain.seed.messages.map(wrapMessage) },
  };
}

function wrapPart(part: MessagePart): MessagePart {
  if (part.type === 'text') return { ...part, text: data(part.text) };
  return { ...part, props: wrapData(part.props) } as MessagePart;
}

function wrapMessage<M extends Conversation['messages'][number]>(message: M): M {
  if (message.role === 'user') return { ...message, text: data(message.text) };
  return {
    ...message,
    parts: message.parts.map(wrapPart),
    followUps: message.followUps.map(data),
  };
}

const MARKDOWN = [
  data('An answer'),
  `### ${data('A heading')}`,
  `- ${data('An item')}`,
  `[${data('a link')}](https://example.com)`,
  // A fence's language cannot carry the marker, so the code block names none.
  '```',
  data('const a = 1;'),
  '```',
].join('\n\n');

const BLOCKS: readonly ComponentPart[] = [
  kit.metrics(Object.keys(content.knowledge.metrics)),
  {
    ...kit.timeline(),
    props: { ...kit.timeline().props, expanded: ['acme', 'globex'] },
  } as ComponentPart,
  kit.skills(),
  kit.projects(),
  kit.contactCard(),
  table(['Company'], [['Acme']], ''),
  note('inference', 'A note'),
  note('example', 'An example'),
  note('info', 'Info'),
  details('Why', 'Because'),
];

/** An exchange, driven through the conversation's own transitions, ending with `events`. */
function exchange(conversation: Conversation, events: readonly AssistantEvent[]) {
  const asked = addExchange(conversation, data('A question'));
  return events.reduce(
    (current, event) => applyEvent(current, asked.answerId, event),
    asked.conversation,
  );
}

function fullAnswer(): AssistantEvent[] {
  return [
    { type: 'start', intent: 'company:globex', related: { id: 'globex', company: data('Globex') } },
    { type: 'text-start', id: 't0' },
    { type: 'text-delta', id: 't0', delta: MARKDOWN },
    { type: 'text-end', id: 't0' },
    ...BLOCKS.map((block, index): AssistantEvent => {
      const { type: _part, ...component } = { ...block, props: wrapData(block.props) };
      return { type: 'component', id: `c${String(index)}`, ...component } as AssistantEvent;
    }),
    {
      type: 'finish',
      followUps: [data('A follow-up?')],
      sources: [{ id: 'cv', label: data('CV') }],
    },
  ];
}

function conversationInEveryState(): Conversation {
  const base = view('experience').seed;
  const failed = (error: Extract<AssistantEvent, { type: 'error' }>['error']) =>
    [{ type: 'error', error }] as const;
  return [
    failed({ code: 'rate_limited', retryable: true, retryAfterSeconds: 120 }),
    failed({ code: 'rate_limited', retryable: true }),
    failed({ code: 'rejected', retryable: false }),
    failed({ code: 'network', retryable: true }),
    fullAnswer(),
    [],
  ].reduce<Conversation>((conversation, events) => exchange(conversation, events), base);
}

/** The words on the page, and in its accessible names, that neither marker accounts for. */
function unmarkedText(container: HTMLElement): string[] {
  const stripped = (text: string) => {
    let rest = text;
    for (let previous = ''; previous !== rest;) {
      previous = rest;
      rest = rest.replace(/⟦[^⟦⟧]*⟧/g, ' ').replace(/⟪[^⟪⟫]*⟫/g, ' ');
    }
    return rest.match(/\p{L}+/gu) ?? [];
  };
  const named = [...container.querySelectorAll('*')].flatMap((element) =>
    ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'].flatMap((attribute) => {
      const value = element.getAttribute(attribute);
      return value === null
        ? []
        : stripped(value).map((word) => `${element.tagName.toLowerCase()}[${attribute}]: ${word}`);
    }),
  );
  return [...stripped(container.textContent).map((word) => `text: ${word}`), ...named];
}

function renderPseudo(ui: React.ReactElement) {
  return render(ui, { wrapper: withMessages(pseudoMessages) });
}

describe('every text the interface shows comes from the catalog or the record', () => {
  it('on the welcome screen, with the sidebar and the composer', () => {
    const { container } = renderPseudo(
      <ConversationsProvider>
        <ChatWorkspace {...view('overview')} />
      </ConversationsProvider>,
    );
    expect(unmarkedText(container)).toEqual([]);
  });

  it('in a conversation in every state, with the drawer open', async () => {
    const { container } = renderPseudo(
      <ConversationsProvider>
        <ChatWorkspace
          {...view('experience')}
          initialConversation={conversationInEveryState()}
          initialDrawerOpen
        />
      </ConversationsProvider>,
    );
    const user = userEvent.setup();
    const [helpful] = screen.getAllByRole('button', { name: pseudoMessages.actions.helpful });
    if (helpful) await user.click(helpful);
    const [copy] = screen.getAllByRole('button', { name: pseudoMessages.actions.copy });
    if (copy) await user.click(copy);

    expect(await screen.findAllByText(pseudoMessages.actions.thanks)).not.toHaveLength(0);
    expect(unmarkedText(container)).toEqual([]);
  });

  it('on the failed page and the jump to the latest message', () => {
    const failure = Object.assign(new Error('boom'), { digest: '42' });
    const { container } = renderPseudo(
      <>
        <PageFailed error={failure} retry={() => undefined} messages={pseudoMessages.pageFailed} />
        <JumpToLatest onClick={() => undefined} />
      </>,
    );
    expect(unmarkedText(container)).toEqual([]);
  });

  it('reports a planted string, in the text or in an accessible name', () => {
    const { container } = renderWithMessages(
      <p>
        {fixtureUiMessages.composer.send}
        <span aria-label="Close" />
      </p>,
    );
    expect(unmarkedText(container)).toEqual(
      expect.arrayContaining(['text: Send', 'text: question', 'span[aria-label]: Close']),
    );
  });
});
