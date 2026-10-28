import type { SyntheticEvent } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { Button, ButtonLink, Eyebrow, Icon, IconButton, Tag, VisuallyHidden } from '.';

describe('Button', () => {
  it('runs its action when clicked', async () => {
    const onClick = vi.fn();
    renderWithMessages(<Button onClick={onClick}>New conversation</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not submit the form it sits in unless asked to', async () => {
    const onSubmit = vi.fn((event: SyntheticEvent) => {
      event.preventDefault();
    });
    renderWithMessages(
      <form onSubmit={onSubmit}>
        <Button>Copy</Button>
        <Button type="submit">Send</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('ignores clicks while disabled', async () => {
    const onClick = vi.fn();
    renderWithMessages(
      <Button disabled onClick={onClick}>
        Retry
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ButtonLink', () => {
  it('is a link to its destination, not a button', () => {
    renderWithMessages(
      <ButtonLink variant="primary" href="/resume.pdf">
        Download résumé
      </ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Download résumé' })).toHaveAttribute(
      'href',
      '/resume.pdf',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('is named by its label, since the icon alone says nothing', async () => {
    const onClick = vi.fn();
    renderWithMessages(<IconButton icon="copy" label="Copy answer" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy answer' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps its icon out of the accessibility tree', () => {
    renderWithMessages(<IconButton icon="menu" label="Open navigation" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('Icon', () => {
  it('is decorative', () => {
    const { container } = renderWithMessages(<Icon name="mail" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Eyebrow', () => {
  it('can be the heading of the section it labels', () => {
    renderWithMessages(<Eyebrow as="h2">Explore</Eyebrow>);
    expect(screen.getByRole('heading', { level: 2, name: 'Explore' })).toBeInTheDocument();
  });

  it('is a plain paragraph by default', () => {
    renderWithMessages(<Eyebrow>Explore</Eyebrow>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
  });
});

describe('Tag', () => {
  it('shows its label', () => {
    renderWithMessages(<Tag tone="accent">Current</Tag>);
    expect(screen.getByText('Current')).toBeInTheDocument();
  });
});

describe('VisuallyHidden', () => {
  it('gives an icon-only control its accessible name', () => {
    renderWithMessages(
      <a href="https://github.com/ada-rivera-example">
        <Icon name="code" />
        <VisuallyHidden>GitHub</VisuallyHidden>
      </a>,
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
  });
});
