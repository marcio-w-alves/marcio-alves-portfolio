import { z } from 'zod';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
  type Translations,
} from '@/core/i18n/locale';
import type { KnowledgeSource, SiteSubject } from '@/core/knowledge/schema';
import { excludePattern } from '@/core/knowledge/product-sites';
import { addedFigures, untranslated } from '@/core/knowledge/translations';
import { knowledgeRecordSchema } from '@/core/knowledge/validate';
import type { Brand, LocaleCopy } from '@/site/site-profile';
import type { EvaluationCase } from './evaluation/cases';

/** Who the site is about. Every value here identifies the owner, which is why it lives in one place. */
export interface Identity {
  readonly name: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly initials: string;
  readonly contact: {
    readonly email: string;
    readonly linkedin: string;
    readonly github: string;
  };
  /** The domain the site is published at. */
  readonly siteHost: string;
  /** How the site names itself in the User-Agent of the requests it makes. */
  readonly userAgentProduct: string;
  /**
   * Names in the record that are ordinary words rather than the owner's, such
   * as a "Freelance" employer: the whitelabel check lets them appear anywhere.
   */
  readonly nonIdentifyingTerms: readonly string[];
}

/**
 * A public site `pnpm sites:ingest` may read. Only these exact pages are
 * fetched: nothing is crawled and no link is followed.
 */
export interface SiteEntry {
  readonly subject: SiteSubject;
  readonly urls: readonly string[];
  /**
   * Paragraphs left out every time the site is read: written exactly, or as a
   * regular expression between slashes. For text that is not about the
   * product — a founder's biography, a client's testimonial, an error message.
   */
  readonly excludes?: readonly string[];
  /** Whose site it is, why reading it is fine, and when that was last checked. */
  readonly termsNote: string;
}

export interface Profile {
  readonly identity: Identity;
  /**
   * The languages the site is published in: English, and each other language
   * once its copy and every text of the record are written in it.
   */
  readonly locales: readonly Locale[];
  readonly knowledge: KnowledgeSource;
  /** The public pages the record's `productSites` passages are read from. */
  readonly siteAllowList: readonly SiteEntry[];
  /** The colours and image face the pages, the share image and the tab icon are drawn in. */
  readonly brand: Brand;
  /** What the site writes around the record's facts, per language. */
  readonly copy: Translations<LocaleCopy>;
  /** The conversations `pnpm eval:assistant` holds the assistant to. */
  readonly evaluation: readonly EvaluationCase[];
}

const httpsUrl = z.url({ protocol: /^https$/, error: 'Must be an absolute https URL' });

const identitySchema = z.strictObject({
  name: z.string().regex(/\S/),
  firstName: z.string().regex(/\S/),
  lastName: z.string().regex(/\S/),
  initials: z.string().regex(/\S/),
  contact: z.strictObject({ email: z.email(), linkedin: httpsUrl, github: httpsUrl }),
  siteHost: z.hostname(),
  userAgentProduct: z.string().regex(/^[\w.-]+$/, 'Must be a User-Agent product token'),
  nonIdentifyingTerms: z.array(z.string()),
});

const fontStackSchema = z.strictObject({
  fallbacks: z.array(z.string().regex(/\S/)),
  featureSettings: z.string().regex(/\S/).optional(),
});

const brandSchema = z.strictObject({
  colors: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}$/, 'Must be a #rrggbb colour')),
  darkColors: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}$/, 'Must be a #rrggbb colour')),
  fonts: z.strictObject({ sans: fontStackSchema, display: fontStackSchema, mono: fontStackSchema }),
  imageFont: z.strictObject({
    family: z.string().regex(/\S/),
    files: z.strictObject({ 400: z.string().endsWith('.woff'), 600: z.string().endsWith('.woff') }),
  }),
});

function compiles(exclude: string): boolean {
  try {
    excludePattern(exclude);
    return true;
  } catch {
    return false;
  }
}

const siteEntrySchema = z.strictObject({
  subject: z.strictObject({ kind: z.enum(['project', 'company']), id: z.string().regex(/\S/) }),
  urls: z.array(httpsUrl).min(1),
  excludes: z
    .array(z.string().regex(/\S/).refine(compiles, 'Must be a valid regular expression'))
    .optional(),
  termsNote: z.string().regex(/\S/),
});

interface SitesAndPassages {
  readonly siteAllowList: readonly Pick<SiteEntry, 'subject' | 'urls'>[];
  readonly knowledge: Pick<KnowledgeSource, 'productSites'>;
}

/** Every passage of a site was read from a page the allow-list names, for the subject it names. */
function checkSitePassagesAllowed(
  { siteAllowList, knowledge }: SitesAndPassages,
  context: z.RefinementCtx,
) {
  const subjectOf = new Map(
    siteAllowList.flatMap(({ subject, urls }) => urls.map((url) => [url, subject])),
  );
  knowledge.productSites.forEach(({ url, subject }, index) => {
    const allowed = subjectOf.get(url);
    if (allowed?.kind !== subject.kind || allowed.id !== subject.id) {
      context.addIssue({
        code: 'custom',
        message: `"${url}" is not on the site allow-list for ${subject.kind} "${subject.id}"`,
        path: ['knowledge', 'productSites', index, 'url'],
      });
    }
  });
}

interface Publication {
  readonly locales: readonly Locale[];
  readonly knowledge: unknown;
  readonly copy: Partial<Record<Locale, unknown>>;
}

/**
 * A language is published only once the copy and the whole record are written
 * in it, each text saying what its English one says: no number, date or link
 * of its own.
 */
function checkPublishedLocalesWritten(
  { locales, knowledge, copy }: Publication,
  context: z.RefinementCtx,
) {
  for (const locale of locales) {
    if (locale === DEFAULT_LOCALE) continue;
    if (!copy[locale]) {
      context.addIssue({
        code: 'custom',
        message: `Publishing ${locale} needs its copy`,
        path: ['copy', locale],
      });
    }
    for (const path of untranslated(knowledge, locale)) {
      context.addIssue({
        code: 'custom',
        message: `Publishing ${locale} needs this text in ${locale}`,
        path: ['knowledge', ...path],
      });
    }
    for (const { path, figures } of addedFigures(knowledge, locale)) {
      context.addIssue({
        code: 'custom',
        message: `A translation states only what its English text does, not ${figures.join(', ')}`,
        path: ['knowledge', ...path],
      });
    }
  }
}

const copySchema = z.strictObject({
  answers: z.looseObject({}),
  ui: z.looseObject({}),
  site: z.looseObject({}),
  about: z.looseObject({}).optional(),
});

const profileSchema = z
  .strictObject({
    identity: identitySchema,
    locales: z
      .array(z.enum(SUPPORTED_LOCALES))
      .refine((locales) => locales.includes(DEFAULT_LOCALE), {
        message: `Must include "${DEFAULT_LOCALE}", the language of the unprefixed addresses`,
      }),
    knowledge: knowledgeRecordSchema,
    siteAllowList: z.array(siteEntrySchema),
    brand: brandSchema,
    // Its shape is the type's to check: copy is code, written against the record.
    copy: z.strictObject({ en: copySchema, 'pt-BR': copySchema.optional() }),
    evaluation: z.array(z.looseObject({ id: z.string().regex(/\S/) })),
  })
  .superRefine(checkSitePassagesAllowed)
  .superRefine(checkPublishedLocalesWritten);

/**
 * Fails, listing every problem by its path, when the profile is not one the
 * site can be built from. It runs wherever the profile is first read: the
 * build, the tests and every script.
 */
export function validateProfile(profile: Profile): Profile {
  profileSchema.parse(profile);
  return profile;
}
