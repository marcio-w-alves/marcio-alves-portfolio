import { isAlias, parseDocument, visit, type Scalar, type YAMLError } from 'yaml';
import type { BundleProblem } from './problems';

/**
 * YAML read strictly: YAML 1.2's core schema (so `yes` stays the word "yes"),
 * no duplicate keys, no merge keys, no tags, one document per file, and a
 * bounded number of aliases, so a bundle can neither surprise the reader nor
 * expand into more than it says.
 */

export const MAX_ALIASES = 100;
// The library's own guard against nested expansion (an alias of an alias of
// …): it weighs each alias by what it expands to, so it sits above the plain
// count of aliases, which MAX_ALIASES limits on its own.
const MAX_EXPANSION = 10 * MAX_ALIASES;

const OPTIONS = {
  version: '1.2',
  schema: 'core',
  uniqueKeys: true,
  merge: false,
  strict: true,
  resolveKnownTags: false,
  prettyErrors: true,
} as const;

type Parsed = { ok: true; value: unknown } | { ok: false; problems: BundleProblem[] };

const REMEDY = 'fix the YAML there';

function position(linePos: YAMLError['linePos']): string | undefined {
  const start = linePos?.[0];
  return start ? `${String(start.line)}:${String(start.col)}` : undefined;
}

function problemAt(document: string, at: string | undefined, problem: string): BundleProblem {
  return at === undefined
    ? { document, problem, remedy: REMEDY }
    : { document, at, problem, remedy: REMEDY };
}

function firstLine(message: string): string {
  return (message.split('\n')[0] ?? message).replace(/ at line \d+, column \d+:?$/, '');
}

export function parseYaml(document: string, text: string): Parsed {
  const parsed = parseDocument(text, OPTIONS);
  const problems = [...parsed.errors, ...parsed.warnings].map((error) =>
    problemAt(document, position(error.linePos), firstLine(error.message)),
  );
  let aliases = 0;
  visit(parsed, {
    Alias() {
      aliases += 1;
    },
    Pair(_key, pair) {
      const key = pair.key as Scalar | null;
      if (key !== null && !isAlias(key) && key.value === '<<') {
        const at = key.range ? lineColumn(text, key.range[0]) : undefined;
        problems.push(
          problemAt(document, at, 'Merge keys (<<) are not supported; write the keys out'),
        );
      }
    },
  });
  if (aliases > MAX_ALIASES) {
    problems.push(
      problemAt(
        document,
        undefined,
        `${String(aliases)} aliases; at most ${String(MAX_ALIASES)} are read`,
      ),
    );
  }
  if (problems.length > 0) return { ok: false, problems };
  try {
    return { ok: true, value: parsed.toJS({ maxAliasCount: MAX_EXPANSION }) };
  } catch (error) {
    return { ok: false, problems: [problemAt(document, undefined, (error as Error).message)] };
  }
}

function lineColumn(text: string, offset: number): string {
  const before = text.slice(0, offset).split('\n');
  return `${String(before.length)}:${String((before.at(-1)?.length ?? 0) + 1)}`;
}
