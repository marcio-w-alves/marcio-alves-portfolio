import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { profile } from '@/profile';
import { createSiteContent } from '@/site/site-content';
import { WelcomeLayout } from './welcome-layout';
import { WelcomeScreen } from './welcome-screen';

const { knowledge } = createSiteContent(profile.knowledge);

const { welcome } = knowledge;

describe('WelcomeScreen', () => {
  it('makes the greeting the page heading', () => {
    render(<WelcomeScreen welcome={welcome} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Hi, I'm Marcio");
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('introduces Marcio with the documented copy', () => {
    render(<WelcomeScreen welcome={welcome} />);

    expect(
      screen.getByText(
        'Staff-level frontend engineer with 10+ years in React, TypeScript and frontend architecture. Ask anything about my work.',
      ),
    ).toBeInTheDocument();
  });
});

describe('WelcomeLayout', () => {
  it('is a labelled region holding what it is given, in order', () => {
    render(
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
