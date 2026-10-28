import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantMessage as Message } from '@/core/conversation/messages';
import { AssistantMessage } from './assistant-message';

function message(fields: Partial<Message>): Message {
  return {
    id: 'answer-1',
    role: 'assistant',
    kind: 'answer',
    status: 'done',
    parts: [],
    followUps: [],
    sources: [],
    related: null,
    intent: null,
    feedback: null,
    error: null,
    question: 'Q',
    topicId: null,
    ...fields,
  };
}

function renderMessage(fields: Partial<Message>) {
  const handlers = {
    onFollowUp: vi.fn(),
    onCopy: vi.fn(() => Promise.resolve(true)),
    onRetry: vi.fn(),
    onEdit: vi.fn(),
    onRate: vi.fn(),
    onViewRelated: vi.fn(),
    onAskFollowUp: vi.fn(),
  };
  render(
    <AssistantMessage
      message={message(fields)}
      assistantName="Ada's assistant"
      ownerFirstName="Ada"
      isLatest
      {...handlers}
    />,
  );
  return handlers;
}

describe('an answer', () => {
  it('is signed with the name the knowledge base gives the assistant', () => {
    renderMessage({ parts: [{ type: 'text', id: 'p0', text: 'Hello.' }] });
    const answer = screen.getByRole('article', {
      name: "Answer from Marcio's portfolio assistant",
    });
    expect(within(answer).getByText("Ada's assistant").tagName).toBe('STRONG');
  });

  it('cites the résumé once, however many of its sections the answer drew on', () => {
    renderMessage({
      parts: [{ type: 'text', id: 'p0', text: 'He led teams at Deel and Roots.' }],
      sources: [
        { id: 'resume.deel', label: 'Resume' },
        { id: 'resume.roots', label: 'Resume' },
        { id: 'principles', label: 'Engineering principles' },
      ],
    });
    expect(screen.getAllByText('Resume')).toHaveLength(1);
    expect(screen.getByText('Engineering principles')).toBeInTheDocument();
  });

  it('offers its follow-ups under a heading, and asks the one picked', async () => {
    const user = userEvent.setup();
    const handlers = renderMessage({
      parts: [{ type: 'text', id: 'p0', text: 'Hello.' }],
      followUps: ['How did he optimize performance?'],
    });
    const followUps = screen.getByRole('list', { name: 'Ask a follow-up' });
    await user.click(
      within(followUps).getByRole('button', { name: 'How did he optimize performance?' }),
    );
    expect(handlers.onFollowUp).toHaveBeenCalledWith('How did he optimize performance?');
  });
});

describe('an answer’s text', () => {
  it('renders headings, lists and inline formatting from the answer’s Markdown', () => {
    renderMessage({
      parts: [
        { type: 'text', id: 'p0', text: '### At Deel\n- Led **HRIS**\n- Cut load time by 50%' },
      ],
    });
    expect(screen.getByRole('heading', { level: 3, name: 'At Deel' })).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Led HRIS', 'Cut load time by 50%']);
    expect(screen.getByText('HRIS').tagName).toBe('STRONG');
  });

  it('shows code verbatim and copies it', async () => {
    const user = userEvent.setup();
    renderMessage({ parts: [{ type: 'text', id: 'p0', text: '```ts\nconst a = 1;\n```' }] });
    expect(screen.getByText('const a = 1;')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('const a = 1;');
  });

  it('never turns model text into markup', () => {
    renderMessage({
      parts: [
        {
          type: 'text',
          id: 'p0',
          text: '<img src=x onerror=alert(1)> [click](javascript:alert(1))',
        },
      ],
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });

  it('links only a Markdown https link, leaving a bare address as text', () => {
    renderMessage({
      parts: [
        {
          type: 'text',
          id: 'p0',
          text: 'See [his GitHub](https://github.com/marcio-w-alves), not https://evil.example/login.',
        },
      ],
    });
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://github.com/marcio-w-alves');
    expect(screen.getByText(/not https:\/\/evil\.example\/login\./)).toBeInTheDocument();
  });

  it('refuses a link with a script address, showing it as text', () => {
    renderMessage({ parts: [{ type: 'text', id: 'p0', text: '[click](javascript:alert(1))' }] });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('[click](javascript:alert(1))')).toBeInTheDocument();
  });
});

describe('while an answer arrives', () => {
  it('says it is reading the record before the first words', () => {
    renderMessage({ status: 'pending' });
    expect(screen.getByText(/Reading Ada.s documented experience/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Answer actions' })).not.toBeInTheDocument();
  });

  it('holds back actions and follow-ups until it is done', () => {
    renderMessage({
      status: 'streaming',
      parts: [{ type: 'text', id: 'p0', text: 'At Roots he' }],
      followUps: ['Next?'],
    });
    expect(screen.getByText(/At Roots he/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Answer actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next\?/ })).not.toBeInTheDocument();
  });
});

describe('a failed answer', () => {
  it('does not offer to resend a question the server cannot take, only to edit it', async () => {
    const user = userEvent.setup();
    const handlers = renderMessage({
      status: 'error',
      error: { code: 'rejected', retryable: false },
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('That question could not be sent.');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Edit question' }));
    expect(handlers.onEdit).toHaveBeenCalledWith('answer-1');
  });
});

describe('a topic introduction', () => {
  it('carries the topic and its suggestions, but no rating or sources', () => {
    render(
      <AssistantMessage
        message={message({
          kind: 'intro',
          topicId: 'experience',
          parts: [{ type: 'text', id: 'intro', text: 'Here is his experience.' }],
          followUps: ['What did he do at Roots?'],
          sources: [{ id: 'profile', label: 'Professional profile' }],
        })}
        assistantName="Ada's assistant"
        ownerFirstName="Ada"
        isLatest
        topicLabel="Experience"
        onFollowUp={vi.fn()}
        onCopy={vi.fn(() => Promise.resolve(true))}
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onRate={vi.fn()}
        onViewRelated={vi.fn()}
        onAskFollowUp={vi.fn()}
      />,
    );
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Suggested questions' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Answer actions' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });
});
