import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KnowledgeSource } from '@/core/knowledge/schema';
import type { Identity } from '@/profile/schema';

/**
 * Finds the owner's identifying words — name, contact, employers, products,
 * schools — in files that should work for anyone's profile. The terms are
 * read from a profile, never written here, so the check holds for a fork.
 */

export type TermKind = 'identity' | 'company' | 'product' | 'school';

export interface Term {
  readonly text: string;
  readonly kind: TermKind;
}

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

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
    ...knowledge.experience.map(({ company }): Term => ({ text: company, kind: 'company' })),
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

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-sensitive, and only as a whole word: "Roots" is a name, "uproots" is not. */
function matcher(term: Term): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped(term.text)}(?![\\p{L}\\p{N}_])`, 'u');
}

/** Every line that names the owner, as `file:line: "term" (kind)`. */
export function findOwnerLiterals(files: readonly SourceFile[], terms: readonly Term[]): string[] {
  const patterns = terms.map((term) => ({ term, pattern: matcher(term) }));
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .flatMap((line, index) =>
        patterns
          .filter(({ pattern }) => pattern.test(line))
          .map(({ term }) => `${path}:${String(index + 1)}: "${term.text}" (${term.kind})`),
      ),
  );
}

/** The repository's text files under the given paths, tracked or new, as git sees them. */
export function repositoryFiles(paths: readonly string[]): SourceFile[] {
  const listed = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...paths],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  return listed
    .split('\n')
    .filter(Boolean)
    .map((path) => ({ path, text: readFileSync(join(repositoryRoot, path), 'utf8') }))
    .filter(({ text }) => !text.includes('\0'));
}
