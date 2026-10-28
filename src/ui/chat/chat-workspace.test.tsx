import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { topics } from '@/core/assistant/topics';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { ChatWorkspace } from './chat-workspace';

function renderWorkspace() {
  const { profile, contact } = knowledgeBase;
  render(
    <ChatWorkspace
      profile={{ name: profile.name, title: profile.title, initials: profile.initials }}
      links={contact}
      topics={topics.map(({ id, label, icon }) => ({ id, label, icon }))}
    />,
  );
}

const topicsNav = () => screen.getByRole('navigation', { name: 'Topics' });

describe('topic navigation', () => {
  it('starts on the overview', () => {
    renderWorkspace();
    expect(within(topicsNav()).getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('moves the current topic and opens the conversation on it', async () => {
    renderWorkspace();
    await userEvent.click(within(topicsNav()).getByRole('button', { name: 'Experience' }));
    expect(within(topicsNav()).getByRole('button', { name: 'Experience' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(topicsNav()).getByRole('button', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByText('Conversation ·', { exact: false })).toHaveTextContent(
      'Conversation · Experience',
    );
  });

  it('starts over on the same topic', async () => {
    renderWorkspace();
    await userEvent.click(within(topicsNav()).getByRole('button', { name: 'Projects' }));
    const [sidebarButton] = screen.getAllByRole('button', { name: 'New conversation' });
    if (!sidebarButton) throw new Error('no new conversation button');
    await userEvent.click(sidebarButton);
    expect(screen.queryByText('Conversation ·', { exact: false })).not.toBeInTheDocument();
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
    renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(within(topicsNav()).getByRole('button', { name: 'Overview' })).toHaveFocus();
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');
  });

  it('closes on Escape and gives focus back to the menu button', async () => {
    renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(menu);
    await userEvent.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
  });

  it('closes with its close button', async () => {
    renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(menu);
    await userEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });

  it('closes once a topic is chosen', async () => {
    renderWorkspace();
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(menu);
    await userEvent.click(within(topicsNav()).getByRole('button', { name: 'Achievements' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });
});
