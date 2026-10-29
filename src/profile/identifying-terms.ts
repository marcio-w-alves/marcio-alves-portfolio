import type { Vocabulary } from '@/core/assistant/system1/intents';
import type { KnowledgeSource } from '@/core/knowledge/schema';
import type { Identity } from './schema';

/**
 * What identifies the person a profile is about — name, contact, employers,
 * products, schools, and their own words — derived from the profile itself,
 * never written down, so every check built on it holds for anyone's profile.
 */

export type TermKind = 'identity' | 'company' | 'product' | 'school';

export interface Term {
  readonly text: string;
  readonly kind: TermKind;
}

function handleOf(profileUrl: string): string {
  return new URL(profileUrl).pathname.split('/').filter(Boolean).at(-1) ?? '';
}

export function ownerTerms(identity: Identity, knowledge: KnowledgeSource): Term[] {
  const { name, firstName, lastName, contact, siteHost, userAgentProduct } = identity;
  const identifying = [
    name,
    firstName,
    lastName,
    contact.email,
    contact.linkedin,
    contact.github,
    handleOf(contact.linkedin),
    handleOf(contact.github),
    siteHost,
    userAgentProduct,
  ];
  const terms: Term[] = [
    ...identifying.map((text): Term => ({ text, kind: 'identity' })),
    ...knowledge.experience.flatMap(({ company, aliases = [] }) =>
      [company, ...aliases].map((text): Term => ({ text, kind: 'company' })),
    ),
    ...knowledge.projects.map(({ name: product }): Term => ({ text: product, kind: 'product' })),
    ...[knowledge.education.school, knowledge.education.schoolShort].map((text): Term => ({
      text,
      kind: 'school',
    })),
  ];
  const skipped = new Set(identity.nonIdentifyingTerms);
  const unique = new Map(terms.map((term) => [term.text, term]));
  return [...unique.values()].filter((term) => term.text && !skipped.has(term.text));
}

/**
 * Words that are the owner's but not proper names a case-sensitive scan would
 * catch: the profile's vocabulary, the owner's names and the record's role and
 * project ids, in any case, as words of their own or as parts of an
 * identifier ("hrisRole").
 */
export function ownerWords(
  identity: Identity,
  knowledge: KnowledgeSource,
  vocabulary: Vocabulary,
): string[] {
  const vocabularyWords = Object.values(vocabulary)
    .flat()
    .flatMap(([pattern]) => pattern.source.replace(/\\[a-zA-Z]/g, ' ').match(/[a-z]{3,}/gi) ?? []);
  const skipped = new Set(identity.nonIdentifyingTerms);
  const recordIds = [
    ...knowledge.experience.filter((role) => !skipped.has(role.company)),
    ...knowledge.projects,
  ].map((entry) => entry.id);
  return [
    ...new Set(
      [identity.firstName, identity.lastName, ...vocabularyWords, ...recordIds].map((word) =>
        word.toLowerCase(),
      ),
    ),
  ];
}
