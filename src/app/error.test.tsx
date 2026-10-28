import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ErrorPage from './error';
import NotFound from './not-found';

/** What a Server Component error looks like once Next has stripped it for the browser. */
function serverError(digest: string): Error {
  return Object.assign(new Error('An error occurred in the Server Components render.'), { digest });
}

describe('error page', () => {
  it('says the page failed and what to do about it', () => {
    render(<ErrorPage error={new Error('boom')} retry={vi.fn()} reset={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'This page failed to load' })).toBeInTheDocument();
    expect(screen.getByText(/try again; if it keeps failing/i)).toBeInTheDocument();
  });

  it('tries again when asked', async () => {
    const retry = vi.fn();
    render(<ErrorPage error={new Error('boom')} retry={retry} reset={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('gives the reference that matches the server log, and never the raw error', () => {
    render(<ErrorPage error={serverError('3141592653')} retry={vi.fn()} reset={vi.fn()} />);
    expect(screen.getByText('Reference 3141592653')).toBeInTheDocument();
    expect(screen.queryByText(/Server Components render/)).not.toBeInTheDocument();
  });

  it('shows no reference for an error thrown in the browser', () => {
    render(<ErrorPage error="not an Error" retry={vi.fn()} reset={vi.fn()} />);
    expect(screen.queryByText(/^Reference/)).not.toBeInTheDocument();
  });
});

describe('not-found page', () => {
  it('says nothing is here and leads back home', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });
});
