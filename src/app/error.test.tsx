import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import ErrorPage from './error';

/** What a Server Component error looks like once Next has stripped it for the browser. */
function serverError(digest: string): Error {
  return Object.assign(new Error('An error occurred in the Server Components render.'), { digest });
}

describe('error page', () => {
  it('says the page failed and what to do about it', () => {
    renderWithMessages(<ErrorPage error={new Error('boom')} retry={vi.fn()} reset={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'This page failed to load' })).toBeInTheDocument();
    expect(screen.getByText(/try again; if it keeps failing/i)).toBeInTheDocument();
  });

  it('tries again when asked', async () => {
    const retry = vi.fn();
    renderWithMessages(<ErrorPage error={new Error('boom')} retry={retry} reset={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('gives the reference that matches the server log, and never the raw error', () => {
    renderWithMessages(
      <ErrorPage error={serverError('3141592653')} retry={vi.fn()} reset={vi.fn()} />,
    );
    expect(screen.getByText('Reference 3141592653')).toBeInTheDocument();
    expect(screen.queryByText(/Server Components render/)).not.toBeInTheDocument();
  });

  it('shows no reference for an error thrown in the browser', () => {
    renderWithMessages(<ErrorPage error="not an Error" retry={vi.fn()} reset={vi.fn()} />);
    expect(screen.queryByText(/^Reference/)).not.toBeInTheDocument();
  });
});
