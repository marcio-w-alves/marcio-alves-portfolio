'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '../cn';
import { useMessages } from '../i18n/i18n-provider';
import { Icon, type IconName } from '../primitives';
import { chooseTheme, currentTheme, subscribeToTheme, THEMES, type Theme } from './theme';

const ICONS: Readonly<Record<Theme, IconName>> = {
  light: 'sun',
  dark: 'moon',
};

// The highlight reads the theme the pre-paint script wrote on <html>, so it is
// right on the first frame, before React knows which one is in effect.
const SELECTED: Readonly<Record<Theme, string>> = {
  light:
    '[[data-theme=light]_&]:bg-surface [[data-theme=light]_&]:text-ink [[data-theme=light]_&]:shadow-ring',
  dark: '[[data-theme=dark]_&]:bg-surface [[data-theme=dark]_&]:text-ink [[data-theme=dark]_&]:shadow-ring',
};

/**
 * Light or dark, as a native radio group: one Tab stop, arrows to move, and
 * the choice read back by every screen reader. Until the visitor picks one the
 * site follows their system, and the theme in effect is the one checked. The
 * server cannot know it, so it renders none checked.
 */
export function ThemeSwitcher() {
  const { shell } = useMessages();
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, () => null);
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{shell.theme.label}</legend>
      <div className="inline-flex gap-0.5 rounded-control bg-fill p-0.5">
        {THEMES.map((option) => (
          // Icons only: the name stays for screen readers and as the pointer's tooltip.
          <label
            key={option}
            title={shell.theme[option]}
            className={cn(
              'grid size-8 cursor-pointer place-items-center rounded-sm',
              'transition-[background-color,color,box-shadow] duration-fast ease-standard @max-compact/ma:size-11',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
              'text-ink-muted hover:text-ink',
              SELECTED[option],
            )}
          >
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => {
                chooseTheme(option);
              }}
              className="sr-only"
            />
            <Icon name={ICONS[option]} size="sm" />
            <span className="sr-only">{shell.theme[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
