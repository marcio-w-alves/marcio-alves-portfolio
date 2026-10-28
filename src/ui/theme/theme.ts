/** What the visitor picked: a theme, or whatever their system prefers. */
export type ThemeChoice = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const CHANGE_EVENT = 'themechange';

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** The stored choice; private browsing or a blocked storage reads as "system". */
export function storedChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isChoice(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): Theme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(choice, window.matchMedia(DARK_QUERY).matches);
  root.dataset.themeChoice = choice;
}

export function chooseTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Without storage the choice still applies to this page.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Re-applies the theme when the choice or, under "system", the system preference changes. */
export function subscribeToTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const sync = () => {
    applyTheme(storedChoice());
    onChange();
  };
  media.addEventListener('change', sync);
  window.addEventListener('storage', sync);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener('change', sync);
    window.removeEventListener('storage', sync);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Applies the stored choice to <html>. It runs as the inline script below,
 * so it may use nothing from outside its own body: no imports, no closures.
 */
export function applyStoredTheme(storageKey: string, darkQuery: string): void {
  const root = document.documentElement;
  let choice = 'system';
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') choice = stored;
  } catch {
    // Blocked storage leaves the system's preference in charge.
  }
  root.dataset.themeChoice = choice;
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia(darkQuery).matches);
  root.dataset.theme = dark ? 'dark' : 'light';
}

/**
 * Runs in <head>, before the first paint, so a visitor who chose dark never
 * sees a flash of the light theme.
 */
export const THEME_SCRIPT = `(${applyStoredTheme.toString()})(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(DARK_QUERY)});`;
