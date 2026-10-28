'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '../cn';
import { useMessages } from '../i18n/i18n-provider';
import { Icon, type IconName } from '../primitives';
import {
  chooseTheme,
  storedChoice,
  subscribeToTheme,
  THEME_CHOICES,
  type ThemeChoice,
} from './theme';

const ICONS: Readonly<Record<ThemeChoice, IconName>> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
};

// The highlight reads the choice the pre-paint script wrote on <html>, so it
// is right on the first frame, before React knows the stored choice.
const SELECTED: Readonly<Record<ThemeChoice, string>> = {
  light:
    '[[data-theme-choice=light]_&]:bg-surface [[data-theme-choice=light]_&]:text-ink [[data-theme-choice=light]_&]:shadow-ring',
  dark: '[[data-theme-choice=dark]_&]:bg-surface [[data-theme-choice=dark]_&]:text-ink [[data-theme-choice=dark]_&]:shadow-ring',
  system:
    '[[data-theme-choice=system]_&]:bg-surface [[data-theme-choice=system]_&]:text-ink [[data-theme-choice=system]_&]:shadow-ring',
};

/**
 * Light, dark or the system's choice, as a native radio group: one Tab stop,
 * arrows to move, and the choice read back by every screen reader. The server
 * renders "system" checked; the stored choice takes over once it hydrates.
 */
export function ThemeSwitcher() {
  const { shell } = useMessages();
  const choice = useSyncExternalStore(subscribeToTheme, storedChoice, () => 'system' as const);
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{shell.theme.label}</legend>
      <div className="inline-flex gap-0.5 rounded-control bg-fill p-0.5">
        {THEME_CHOICES.map((option) => (
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
              checked={choice === option}
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
