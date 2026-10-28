import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The custom `@theme` tokens tailwind-merge cannot know about. Unregistered,
 * `text-13` reads as a colour, so `cn('text-13', 'text-ink-muted')` would
 * silently drop the font size. A test keeps this list in step with globals.css.
 */
export const THEME_TOKENS = {
  text: [
    '11',
    '11.5',
    '12',
    '12.5',
    '13',
    '13.5',
    '14',
    '14.5',
    '15',
    '15.5',
    '16',
    '16.5',
    'display',
    'subhead',
    '17',
    '18',
    '26',
    '30',
    'code',
  ],
  leading: [
    'display',
    'heading',
    'compact',
    'label',
    'body',
    'prose',
    'subhead',
    'figure',
    'caption',
    'reading',
  ],
  tracking: [
    'display',
    'subhead',
    'name',
    'mono',
    'avatar',
    'monogram',
    'label',
    'figure',
    'title',
    'caps',
  ],
  'font-weight': ['book'],
  radius: [
    'kbd',
    'mark',
    'control',
    'mark-lg',
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    'pill',
    'code',
    'card',
  ],
} as const;

const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...THEME_TOKENS.text],
      leading: [...THEME_TOKENS.leading],
      tracking: [...THEME_TOKENS.tracking],
      'font-weight': [...THEME_TOKENS['font-weight']],
      radius: [...THEME_TOKENS.radius],
    },
  },
});

export function cn(...classes: ClassValue[]): string {
  return merge(clsx(classes));
}
