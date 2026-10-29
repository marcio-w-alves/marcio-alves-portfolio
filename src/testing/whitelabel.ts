import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { Term } from '@/profile/identifying-terms';

/**
 * Finds the owner's identifying words — name, contact, employers, products,
 * schools — in files that should work for anyone's profile. The terms are
 * read from a profile, never written here, so the check holds for a fork.
 */

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-sensitive, and only as a whole word: "Globex" is a name, "unGlobexed"
 * is not. The line is source text, so an escape before the term — the "\\n"
 * of 'a.\\nGlobex' — ends the word before it like a space would.
 */
function matcher(term: Term): RegExp {
  return new RegExp(
    `(?:(?<=\\\\[nrt])|(?<![\\p{L}\\p{N}_]))${escaped(term.text)}(?![\\p{L}\\p{N}_])`,
    'u',
  );
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
    .filter((path) => path && existsSync(join(repositoryRoot, path)))
    .map((path) => ({ path, text: readFileSync(join(repositoryRoot, path), 'utf8') }))
    .filter(({ text }) => !text.includes('\0'));
}

function stringLiterals(source: ts.SourceFile): { text: string; line: number }[] {
  const found: { text: string; line: number }[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      found.push({ text: node.text, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * Every string or template literal that repeats one of the record's figures,
 * as `file:line: "figure" (figure)`. Comments and regular expressions are not
 * literals, so a "50%" in a comment is no finding.
 */
export function findFigureLiterals(
  files: readonly SourceFile[],
  figures: readonly string[],
): string[] {
  const patterns = figures.map((figure) => ({
    figure,
    pattern: new RegExp(`(?<![\\d.])${escaped(figure)}(?!\\d)`),
  }));
  return files.flatMap(({ path, text }) =>
    stringLiterals(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)).flatMap(
      (literal) =>
        patterns
          .filter(({ pattern }) => pattern.test(literal.text))
          .map(({ figure }) => `${path}:${String(literal.line)}: "${figure}" (figure)`),
    ),
  );
}

// Any case, but a word ends where a lowercase letter cannot continue it, so the
// "hris" of "hrisRole" counts and the "hris" of "hristo" does not.
function wordPattern(word: string): RegExp {
  const letters = word.replace(
    /./gsu,
    (letter) => `[${escaped(letter.toLowerCase())}${escaped(letter.toUpperCase())}]`,
  );
  return new RegExp(`(?<![a-zA-Z])${letters}(?![a-z])`);
}

/** Every line that uses one of the owner's words, as `file:line: "word" (vocabulary)`. */
export function findOwnerWords(files: readonly SourceFile[], words: readonly string[]): string[] {
  const patterns = words.map((word) => ({ word, pattern: wordPattern(word) }));
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .flatMap((line, index) =>
        patterns
          .filter(({ pattern }) => pattern.test(line))
          .map(({ word }) => `${path}:${String(index + 1)}: "${word}" (vocabulary)`),
      ),
  );
}
