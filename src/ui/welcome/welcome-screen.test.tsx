import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { createSiteContent } from '@/site/site-content';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { WelcomeLayout } from './welcome-layout';
import { WelcomeScreen } from './welcome-screen';

const { knowledge } = createSiteContent(fixtureKnowledge, fixtureAnswers);

const { welcome } = knowledge;

describe('WelcomeScreen', () => {
  it('makes the greeting the page heading', () => {
    renderWithMessages(<WelcomeScreen welcome={welcome} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Hi, I'm Ada");
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('introduces the person with the documented copy', () => {
    renderWithMessages(<WelcomeScreen welcome={welcome} />);

    expect(screen.getByText('Platform engineer. Ask about my work.')).toBeInTheDocument();
  });
});

describe('WelcomeLayout', () => {
  it('is a labelled region holding what it is given, in order', () => {
    renderWithMessages(
      <WelcomeLayout>
        <WelcomeScreen welcome={welcome} />
        <p>Composer</p>
      </WelcomeLayout>,
    );

    const region = screen.getByRole('region', { name: 'Welcome' });
    const heading = within(region).getByRole('heading', { level: 1 });
    const composer = within(region).getByText('Composer');
    expect(heading.compareDocumentPosition(composer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
