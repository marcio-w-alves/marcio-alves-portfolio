import { z } from 'zod';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
  type Translations,
} from '@/core/i18n/locale';
import type { KnowledgeSource, SiteSubject } from '@/core/knowledge/schema';
import { excludePattern } from '@/core/knowledge/product-sites';
import { figureMismatches, untranslated } from '@/core/knowledge/translations';
import { knowledgeRecordSchema } from '@/core/knowledge/validate';
import type { Brand, FontRole, FontStack, LocaleCopy } from '@/site/site-profile';
import { evaluationSchema, type Evaluation, type EvaluationCase } from './evaluation';

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
  /** Where the site's source code is published, for the page about the site. */
  readonly sourceRepository?: string;
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
  sourceRepository: httpsUrl.optional(),
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

/** A problem found in a profile, at its path, e.g. `['knowledge', 'experience', 0, 'start']`. */
export interface ProfileIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

function reportTo(context: z.RefinementCtx) {
  return ({ path, message }: ProfileIssue) => {
    context.addIssue({ code: 'custom', message, path: [...path] });
  };
}

/** Every passage of a site was read from a page the allow-list names, for the subject it names. */
export function sitePassageIssues({ siteAllowList, knowledge }: SitesAndPassages): ProfileIssue[] {
  const subjectOf = new Map(
    siteAllowList.flatMap(({ subject, urls }) => urls.map((url) => [url, subject])),
  );
  return knowledge.productSites.flatMap(({ url, subject }, index) => {
    const allowed = subjectOf.get(url);
    if (allowed?.kind === subject.kind && allowed.id === subject.id) return [];
    return [
      {
        message: `"${url}" is not on the site allow-list for ${subject.kind} "${subject.id}"`,
        path: ['knowledge', 'productSites', index, 'url'],
      },
    ];
  });
}

interface Publication {
  readonly locales: readonly Locale[];
  readonly knowledge: unknown;
  readonly copy: Partial<Record<Locale, unknown>>;
}

const count = (n: number, thing: string) => `${String(n)} ${thing}${n === 1 ? '' : 's'}`;

/**
 * How many figures differ, never which: this message is printed by builds, so
 * it reaches logs the record itself must not. The path says where to look.
 */
function describeMismatch(added: readonly string[], missing: readonly string[]): string {
  return [
    ...(added.length > 0
      ? [`states ${count(added.length, 'figure')} its English text does not`]
      : []),
    ...(missing.length > 0
      ? [`leaves out ${count(missing.length, 'figure')} its English text states`]
      : []),
  ].join('; ');
}

/**
 * A language is published only once the whole record is written in it, each
 * text saying what its English one says: the same numbers, dates and links,
 * none added and none left out.
 */
export function recordTranslationIssues({
  locales,
  knowledge,
}: Pick<Publication, 'locales' | 'knowledge'>): ProfileIssue[] {
  return locales
    .filter((locale) => locale !== DEFAULT_LOCALE)
    .flatMap((locale) => [
      ...untranslated(knowledge, locale).map((path) => ({
        message: `Publishing ${locale} needs this text in ${locale}`,
        path: ['knowledge', ...path],
      })),
      ...figureMismatches(knowledge, locale).map(({ path, added, missing }) => ({
        message: `A translation ${describeMismatch(added, missing)}`,
        path: ['knowledge', ...path],
      })),
    ]);
}

/** A language is published only once the copy is written in it, as well as the whole record. */
function checkPublishedLocalesWritten(publication: Publication, context: z.RefinementCtx) {
  for (const locale of publication.locales) {
    if (locale !== DEFAULT_LOCALE && !publication.copy[locale]) {
      context.addIssue({
        code: 'custom',
        message: `Publishing ${locale} needs its copy`,
        path: ['copy', locale],
      });
    }
  }
  recordTranslationIssues(publication).forEach(reportTo(context));
}

const copySchema = z.strictObject({
  answers: z.looseObject({}),
  ui: z.looseObject({}),
  site: z.looseObject({}),
  about: z.looseObject({}).optional(),
});

const localesSchema = z
  .array(z.enum(SUPPORTED_LOCALES))
  .refine((locales) => locales.includes(DEFAULT_LOCALE), {
    message: `Must include "${DEFAULT_LOCALE}", the language of the unprefixed addresses`,
  });

const profileSchema = z
  .strictObject({
    identity: identitySchema,
    locales: localesSchema,
    knowledge: knowledgeRecordSchema,
    siteAllowList: z.array(siteEntrySchema),
    brand: brandSchema,
    // Its shape is the type's to check: copy is code, written against the record.
    copy: z.strictObject({ en: copySchema, 'pt-BR': copySchema.optional() }),
    evaluation: z.array(z.looseObject({ id: z.string().regex(/\S/) })),
  })
  .superRefine((profile, context) => {
    sitePassageIssues(profile).forEach(reportTo(context));
  })
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

/**
 * The faces the template bundles, loaded with `next/font` (which needs literal
 * options, so a profile picks one of these rather than naming its own).
 */
export const FONT_FACES = ['inter', 'inter-tight', 'geist-mono'] as const;

export type FontFace = (typeof FONT_FACES)[number];

/** A font role as a profile writes it: which bundled face, then the stack after it. */
export interface FontStackData extends FontStack {
  readonly face: FontFace;
}

export interface BrandData extends Omit<Brand, 'fonts'> {
  readonly fonts: Readonly<Record<FontRole, FontStackData>>;
}

/**
 * One language's copy as the profile holds it: each document under
 * `copy/<locale>/`, keyed by its path there (`answers/career.yaml`,
 * `topics.yaml`), parsed but not yet read. The core's copy compiler gives it
 * meaning; until then it is passed through unchanged.
 */
export type CopyDocuments = Readonly<Record<string, unknown>>;

/** A file the site serves from its own origin, at `path`, with the bytes of the profile's `file`. */
export interface ProfileAsset {
  readonly file: string;
  readonly path: string;
  readonly mediaType: AssetMediaType;
}

export const ASSET_MEDIA_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number];

/**
 * The whole profile as data: what a profile bundle or the profile database
 * holds, decoded and checked, and what the site is built from. Everything a
 * profile states is here except the generated retrieval index and probe
 * embeddings, which stay the bytes they were written as.
 */
export interface ProfileData {
  readonly locales: readonly Locale[];
  readonly identity: Identity;
  readonly brand: BrandData;
  readonly knowledge: KnowledgeSource;
  readonly siteAllowList: readonly SiteEntry[];
  readonly copy: Translations<CopyDocuments>;
  readonly evaluation: Evaluation;
  /** Questions embedded beside the index, so a test can search it as a visitor would: id → question. */
  readonly retrievalProbes: Readonly<Record<string, string>>;
  readonly assets: readonly ProfileAsset[];
}

const copyDocumentsSchema = z.record(z.string(), z.unknown());

/** The shape of `ProfileData`. Rules across its parts are the profile checks', not this schema's. */
export const profileDataSchema = z.strictObject({
  locales: localesSchema,
  identity: identitySchema,
  brand: brandSchema.extend({
    fonts: z.strictObject({
      sans: fontStackSchema.extend({ face: z.enum(FONT_FACES) }),
      display: fontStackSchema.extend({ face: z.enum(FONT_FACES) }),
      mono: fontStackSchema.extend({ face: z.enum(FONT_FACES) }),
    }),
  }),
  knowledge: knowledgeRecordSchema,
  siteAllowList: z.array(siteEntrySchema),
  copy: z.strictObject({ en: copyDocumentsSchema, 'pt-BR': copyDocumentsSchema.optional() }),
  evaluation: evaluationSchema,
  retrievalProbes: z.record(
    z.string().regex(/^[A-Za-z][\w-]*$/, 'Must be an id'),
    z.string().regex(/\S/),
  ),
  assets: z.array(
    z.strictObject({
      file: z.string().startsWith('assets/'),
      path: z.string().startsWith('/'),
      mediaType: z.enum(ASSET_MEDIA_TYPES),
    }),
  ),
});
