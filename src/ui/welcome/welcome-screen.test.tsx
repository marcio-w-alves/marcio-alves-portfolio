import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { createSiteContent } from '@/site/site-content';
import { workspaceView } from '@/site/workspace-view';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { WelcomeLayout } from './welcome-layout';
import { WelcomeScreen } from './welcome-screen';

const { welcome, links } = workspaceView(createSiteContent(fixtureKnowledge, fixtureAnswers));

function renderWelcome(contact = links) {
  return renderWithMessages(<WelcomeScreen welcome={welcome} links={contact} />);
}

describe('WelcomeScreen', () => {
  it('makes the greeting the page heading', () => {
    renderWelcome();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Hi, I'm Ada");
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('introduces the person with the documented copy', () => {
    renderWelcome();

    expect(screen.getByText('Platform engineer. Ask about my work.')).toBeInTheDocument();
  });

  it('backs the greeting, under the heading, with the companies and the two flagged metrics', () => {
    renderWelcome();

    const evidence = screen.getByRole('list', { name: 'Track record' });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.compareDocumentPosition(evidence)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      within(evidence)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Acme · Globex', '40% Faster builds', '2 → 6 Platform team grown']);
  });

  it('offers contact and the résumé, each linking where the record says', () => {
    renderWelcome();

    const contact = within(screen.getByRole('list', { name: 'Contact' }));
    expect(contact.getByRole('link', { name: 'Get in touch' })).toHaveAttribute(
      'href',
      'mailto:ada@rivera.example?subject=Platform%20role',
    );
    expect(
      contact.getByRole('link', { name: /^LinkedIn ?\(opens in a new tab\)$/ }),
    ).toHaveAttribute('href', 'https://www.linkedin.com/in/ada-rivera-example');
    expect(
      contact.getByRole('link', { name: /^Resume ?\(PDF, opens in a new tab\)$/ }),
    ).toHaveAttribute('href', '/ada-rivera-cv.pdf');
  });

  it('offers no résumé link while none is published', () => {
    renderWelcome({ ...links, resumeUrl: null });

    const contact = within(screen.getByRole('list', { name: 'Contact' }));
    expect(contact.getAllByRole('link')).toHaveLength(2);
    expect(contact.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
  });
});

describe('WelcomeLayout', () => {
  it('is a labelled region holding what it is given, in order', () => {
    renderWithMessages(
      <WelcomeLayout>
        <WelcomeScreen welcome={welcome} links={links} />
        <p>Composer</p>
      </WelcomeLayout>,
    );

    const region = screen.getByRole('region', { name: 'Welcome' });
    const heading = within(region).getByRole('heading', { level: 1 });
    const composer = within(region).getByText('Composer');
    expect(heading.compareDocumentPosition(composer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
