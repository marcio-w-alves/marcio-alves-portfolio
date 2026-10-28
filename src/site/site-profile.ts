import type { AboutPageCopy } from './about-page';
import type { AnswerSet } from '@/core/assistant/answer-set';
import type { Locale, Translations } from '@/core/i18n/locale';
import type { KnowledgeSource } from '@/core/knowledge/schema';
import type { CopyOverrides } from './site-messages';

/** Every colour of the design, each `--color-<token>` in the generated brand stylesheet. */
export type ColorToken =
  | 'bg'
  | 'ice'
  | 'surface'
  | 'fill'
  | 'fill-hover'
  | 'selection'
  | 'ink'
  | 'ink-muted'
  | 'ink-faint'
  | 'border'
  | 'border-strong'
  | 'border-hover'
  | 'accent'
  | 'accent-hover'
  | 'accent-soft'
  | 'danger'
  | 'danger-soft'
  | 'danger-ring'
  /** Text and icons set on the accent, such as a primary button's label. */
  | 'on-accent'
  /** What drop shadows and the drawer's backdrop are cast in. */
  | 'shadow';

export type Hex = `#${string}`;

/**
 * The face the generated images are set in. Their renderer reads WOFF files,
 * not the WOFF2 next/font serves the page, so each weight names its file
 * under `node_modules`.
 */
export interface ImageFont {
  readonly family: string;
  readonly files: Readonly<Record<400 | 600, string>>;
}

/** The stylesheet's font families: the body text, the headings, and code. */
export type FontRole = 'sans' | 'display' | 'mono';

/**
 * What a family falls back to after its own face, which `fonts.ts` loads, and
 * the OpenType features the face is set with, if any.
 */
export interface FontStack {
  readonly fallbacks: readonly string[];
  readonly featureSettings?: string;
}

/** How the site looks: its colours, its font families and the face its images are set in. */
export interface Brand {
  readonly colors: Readonly<Record<ColorToken, Hex>>;
  /** The same tokens for the dark theme. */
  readonly darkColors: Readonly<Record<ColorToken, Hex>>;
  readonly fonts: Readonly<Record<FontRole, FontStack>>;
  readonly imageFont: ImageFont;
}

/** What the site writes in one language: the answers around the record, and its own wording. */
export interface LocaleCopy extends CopyOverrides {
  readonly answers: AnswerSet;
  /** The page about the site itself; without it the site has none. */
  readonly about?: AboutPageCopy;
}

/** What the pages are built from. The site-root binds the owner's profile; tests bind a fixture. */
export interface SiteProfile {
  readonly knowledge: KnowledgeSource;
  readonly brand: Brand;
  readonly copy: Translations<LocaleCopy>;
}

/**
 * A language the profile has not written yet — only ever previewed, never
 * published (its validation sees to that) — reads the English answers and
 * record inside that language's default interface.
 */
export function copyIn({ copy }: SiteProfile, locale: Locale): LocaleCopy {
  return copy[locale] ?? { answers: copy.en.answers, ui: {}, site: {} };
}
