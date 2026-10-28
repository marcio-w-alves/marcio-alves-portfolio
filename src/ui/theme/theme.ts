export type Theme = 'light' | 'dark';

/** What the switcher offers. Until the visitor picks one, the system's preference decides. */
export const THEMES: readonly Theme[] = ['light', 'dark'];

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const CHANGE_EVENT = 'themechange';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * The theme the visitor picked, or null while the system decides. Private
 * browsing or a blocked storage reads as null, and so does the "system" an
 * earlier version of the switcher stored.
 */
export function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

/** The theme in effect: the visitor's pick, else what their system prefers. */
export function currentTheme(): Theme {
  return storedTheme() ?? (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light');
}

function applyTheme(): void {
  document.documentElement.dataset.theme = currentTheme();
}

export function chooseTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Without storage the choice still applies to this page.
  }
  applyTheme();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Re-applies the theme when the pick or, while nothing is picked, the system preference changes. */
export function subscribeToTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const sync = () => {
    applyTheme();
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
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia(darkQuery).matches);
  root.dataset.theme = dark ? 'dark' : 'light';
}

/**
 * Runs in <head>, before the first paint, so a visitor who chose dark never
 * sees a flash of the light theme.
 */
export const THEME_SCRIPT = `(${applyStoredTheme.toString()})(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(DARK_QUERY)});`;
