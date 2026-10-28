import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithMessages } from '@/testing/ui-messages';
import { applyStoredTheme, THEME_SCRIPT } from './theme';
import { ThemeSwitcher } from './theme-switcher';

function prefersDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: dark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('ThemeSwitcher', () => {
  it('offers light, dark and automatic as one labelled group, automatic by default', () => {
    renderWithMessages(<ThemeSwitcher />);

    const group = screen.getByRole('group', { name: 'Theme' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['system', 'light', 'dark']);
    expect(within(group).getByRole('radio', { name: 'Auto' })).toBeChecked();
  });

  it('switches the page to dark and remembers it', async () => {
    renderWithMessages(<ThemeSwitcher />);

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Dark' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  it('follows the system again on Auto', async () => {
    prefersDark(true);
    renderWithMessages(<ThemeSwitcher />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('light');

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('system');
  });

  it('shows the remembered choice', () => {
    window.localStorage.setItem('theme', 'dark');
    renderWithMessages(<ThemeSwitcher />);

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });
});

describe('the pre-paint theme script', () => {
  function run() {
    applyStoredTheme('theme', '(prefers-color-scheme: dark)');
    return document.documentElement.dataset.theme;
  }

  it('is the very function the page runs before painting', () => {
    expect(THEME_SCRIPT).toContain(applyStoredTheme.toString());
    expect(THEME_SCRIPT).toMatch(/\("theme", "\(prefers-color-scheme: dark\)"\);$/);
  });

  it('applies a remembered choice before anything renders', () => {
    window.localStorage.setItem('theme', 'dark');
    expect(run()).toBe('dark');
  });

  it("follows the system's preference without a choice", () => {
    prefersDark(true);
    expect(run()).toBe('dark');
    prefersDark(false);
    expect(run()).toBe('light');
  });

  it('lets an explicit light choice win over a dark system', () => {
    prefersDark(true);
    window.localStorage.setItem('theme', 'light');
    expect(run()).toBe('light');
  });
});
