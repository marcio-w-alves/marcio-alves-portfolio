import { z } from 'zod';
import type { KnowledgeSource, Locale } from '@/core/knowledge/schema';
import { knowledgeRecordSchema } from '@/core/knowledge/validate';
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

export interface Profile {
  readonly identity: Identity;
  /** The languages the site is published in. */
  readonly locales: readonly Locale[];
  readonly knowledge: KnowledgeSource;
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

const profileSchema = z.strictObject({
  identity: identitySchema,
  locales: z.array(z.enum(['en'])).min(1),
  knowledge: knowledgeRecordSchema,
  evaluation: z.array(z.looseObject({ id: z.string().regex(/\S/) })),
});

/**
 * Fails, listing every problem by its path, when the profile is not one the
 * site can be built from. It runs wherever the profile is first read: the
 * build, the tests and every script.
 */
export function validateProfile(profile: Profile): Profile {
  profileSchema.parse(profile);
  return profile;
}
