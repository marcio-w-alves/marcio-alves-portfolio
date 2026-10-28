import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createSiteContent } from '@/site/site-content';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { renderWithMessages } from '@/testing/ui-messages';
import { Sidebar, type SidebarLinks } from './sidebar';

const { knowledge, topicCatalog } = createSiteContent(fixtureKnowledge, fixtureAnswers);

const { profile, contact } = knowledge;

function renderSidebar(links: SidebarLinks = contact) {
  const handlers = { onNewConversation: vi.fn(), onClose: vi.fn() };
  renderWithMessages(
    <Sidebar
      profile={{ name: profile.name, title: profile.title }}
      topics={topicCatalog.topics.map(({ id, label, icon }) => ({
        id,
        label,
        icon,
        href: `/${id}`,
      }))}
      activeTopic="overview"
      links={links}
      {...handlers}
    />,
  );
  return { user: userEvent.setup(), ...handlers };
}

describe('Sidebar', () => {
  it('introduces the person by name and title', () => {
    renderSidebar();
    const sidebar = screen.getByRole('complementary', { name: 'Portfolio navigation' });
    expect(within(sidebar).getByText(profile.name)).toBeInTheDocument();
    expect(within(sidebar).getByText(profile.title)).toBeInTheDocument();
  });

  it('links every topic to its page and marks only the current one', () => {
    renderSidebar();
    const nav = screen.getByRole('navigation', { name: 'Topics' });
    const links = within(nav).getAllByRole('link');
    expect(links.filter((link) => link.getAttribute('aria-current') === 'page')).toEqual([
      within(nav).getByRole('link', { name: 'Overview' }),
    ]);
    expect(within(nav).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects',
    );
  });

  it('starts a new conversation from its icon button', async () => {
    const { user, onNewConversation } = renderSidebar();
    await user.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(onNewConversation).toHaveBeenCalledOnce();
  });

  it('invites contact by email, subject filled in, without printing the address', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
      'href',
      'mailto:ada@rivera.example?subject=Platform%20role',
    );
    expect(screen.queryByText(contact.email)).not.toBeInTheDocument();
  });

  it('opens LinkedIn and GitHub in a new tab and says so', () => {
    renderSidebar();
    const linkedin = screen.getByRole('link', { name: /^LinkedIn ?\(opens in a new tab\)$/ });
    expect(linkedin).toHaveAttribute('href', contact.linkedin);
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /^GitHub ?\(opens in a new tab\)$/ })).toHaveAttribute(
      'href',
      contact.github,
    );
  });

  it('says the résumé is coming while none is published, rather than linking to nothing', () => {
    renderSidebar({ ...contact, resumeUrl: null });
    expect(screen.queryByRole('link', { name: /Resume/ })).not.toBeInTheDocument();
    expect(screen.getByText('Resume')).toHaveTextContent('ResumeSoon');
  });

  it('links to the published résumé PDF in a new tab', () => {
    renderSidebar({ ...contact, resumeUrl: '/ada-rivera-cv.pdf' });
    const resume = screen.getByRole('link', {
      name: /^Resume ?\(PDF, opens in a new tab\)$/,
    });
    expect(resume).toHaveAttribute('href', '/ada-rivera-cv.pdf');
    expect(resume).toHaveAttribute('target', '_blank');
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();
  });
});
