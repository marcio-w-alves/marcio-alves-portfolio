import type { KnowledgeSource } from '@/core/knowledge/schema';

/** Every colour of the design, each `--color-<token>` in the stylesheet. */
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
  | 'danger-ring';

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

/** How the site looks: its colours and the face its images are set in. */
export interface Brand {
  readonly colors: Readonly<Record<ColorToken, Hex>>;
  readonly imageFont: ImageFont;
}

/** What the pages are built from. The site-root binds the owner's profile; tests bind a fixture. */
export interface SiteProfile {
  readonly knowledge: KnowledgeSource;
  readonly brand: Brand;
}
