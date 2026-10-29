import type { Document } from '../workspace/workspace';
import { BUNDLE_FORMAT, copyDocumentOf, DOCUMENTS, KNOWLEDGE_DOCUMENTS } from './layout';
import { pointer, ProfileProblemsError, type BundleProblem } from './problems';
import { parseYaml } from './yaml';

/**
 * Turns a bundle's documents into the profile they spell, still unchecked:
 * each document parsed, the record put together from its files, and every
 * part kept with the document it came from, so a check can say where to fix a
 * problem. Nothing is validated here beyond what parsing needs.
 */

export interface DecodedBundle {
  readonly documents: ReadonlyMap<string, Document>;
  /** The profile's data in the shape of `ProfileData`, not yet validated. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Terms the privacy scan looks for that the record cannot give: phone, address, phrases. */
  readonly privacy: unknown;
  /** The long-form notes the record's note passages are generated from. */
  readonly knowledgeBase: string;
  /** `generated/knowledge-index.json`, parsed. */
  readonly index: unknown;
  /** `generated/retrieval-probes.json`, parsed. */
  readonly probeEmbeddings: unknown;
}

type Parsed = Map<string, unknown>;

const REQUIRED = [...Object.values(DOCUMENTS), ...Object.keys(KNOWLEDGE_DOCUMENTS)];

const text = (document: Document) => new TextDecoder().decode(document.bytes);

/** A document the layout requires, which reading the bundle has already made sure is there. */
export function documentAt(documents: ReadonlyMap<string, Document>, path: string): Document {
  const document = documents.get(path);
  if (!document) throw new Error(`The profile has no ${path}.`);
  return document;
}

export function decodeBundle(documents: ReadonlyMap<string, Document>): DecodedBundle {
  const parsed = parseDocuments(documents);
  const bundle = asRecord(parsed.get(DOCUMENTS.bundle));
  const locales = Array.isArray(bundle.locales) ? (bundle.locales as unknown[]) : [];
  const problems = [...knowledgeKeyProblems(parsed), ...copyLocaleProblems(documents, locales)];
  if (problems.length > 0) throw new ProfileProblemsError(problems);

  const markdown = (path: string) => text(documentAt(documents, path));
  return {
    documents,
    data: {
      locales: bundle.locales,
      identity: parsed.get(DOCUMENTS.identity),
      brand: parsed.get(DOCUMENTS.brand),
      knowledge: knowledgeOf(parsed, markdown(DOCUMENTS.notesGuide)),
      siteAllowList: parsed.get(DOCUMENTS.allowList),
      copy: copyOf(parsed),
      evaluation: {
        cases: parsed.get(DOCUMENTS.cases),
        calibration: parsed.get(DOCUMENTS.calibration),
      },
      retrievalProbes: parsed.get(DOCUMENTS.probes),
      assets: parsed.get(DOCUMENTS.assets),
    },
    privacy: parsed.get(DOCUMENTS.privacy),
    knowledgeBase: markdown(DOCUMENTS.knowledgeBase),
    index: parsed.get(DOCUMENTS.index),
    probeEmbeddings: parsed.get(DOCUMENTS.probeEmbeddings),
  };
}

/** The bundle format a set of documents is written in; throws unless it is the one this code reads. */
export function bundleFormatOf(documents: ReadonlyMap<string, Document>): number {
  const document = documents.get(DOCUMENTS.bundle);
  if (!document) {
    throw new ProfileProblemsError([
      {
        document: DOCUMENTS.bundle,
        problem: 'is missing',
        remedy: `add it, with \`format: ${String(BUNDLE_FORMAT)}\` and the published locales`,
      },
    ]);
  }
  const result = parseYaml(DOCUMENTS.bundle, text(document));
  if (!result.ok) throw new ProfileProblemsError(result.problems);
  const { format } = asRecord(result.value);
  if (format !== BUNDLE_FORMAT) {
    throw new ProfileProblemsError([
      {
        document: DOCUMENTS.bundle,
        at: '/format',
        problem: `this bundle is format ${String(format)}; this template reads format ${String(BUNDLE_FORMAT)}`,
        remedy: 'use the template version the bundle was written for, or upgrade the bundle',
      },
    ]);
  }
  return format;
}

function parseDocuments(documents: ReadonlyMap<string, Document>): Parsed {
  bundleFormatOf(documents);
  const problems: BundleProblem[] = REQUIRED.filter((path) => !documents.has(path)).map(
    (document) => ({ document, problem: 'is missing', remedy: 'add it; see profiles/README.md' }),
  );
  const parsed: Parsed = new Map();
  for (const [path, document] of documents) {
    if (document.mediaType === 'application/yaml') {
      const result = parseYaml(path, text(document));
      if (result.ok) parsed.set(path, result.value);
      else problems.push(...result.problems);
    } else if (document.mediaType === 'application/json') {
      try {
        parsed.set(path, JSON.parse(text(document)));
      } catch (error) {
        problems.push(invalidJson(path, error as Error));
      }
    }
  }
  if (problems.length > 0) throw new ProfileProblemsError(problems);
  return parsed;
}

/**
 * Where the JSON stops being JSON, and nothing else: V8's message quotes the
 * source, and these documents hold the record's prose, which must never reach
 * a public build log.
 */
function invalidJson(document: string, error: Error): BundleProblem {
  const position = /at position \d+ \(line (\d+) column (\d+)\)/.exec(error.message);
  const at = position ? `${String(position[1])}:${String(position[2])}` : undefined;
  const problem = 'is not valid JSON';
  const remedy = 'fix the JSON there';
  return at === undefined ? { document, problem, remedy } : { document, at, problem, remedy };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Each record document holds exactly its own parts of the record, at the top level. */
function knowledgeKeyProblems(parsed: Parsed): BundleProblem[] {
  return Object.entries(KNOWLEDGE_DOCUMENTS).flatMap(([document, keys]) => {
    const value = parsed.get(document);
    const present = Object.keys(asRecord(value));
    const expected: readonly string[] = keys;
    return [
      ...present
        .filter((key) => !expected.includes(key))
        .map((key) => ({
          document,
          at: pointer([key]),
          problem: `"${key}" does not belong in this document`,
          remedy: `it holds ${expected.join(', ')}`,
        })),
      ...expected
        .filter((key) => !present.includes(key))
        .map((key) => ({
          document,
          at: pointer([key]),
          problem: `"${key}" is missing`,
          remedy: 'add it; see profiles/example for its shape',
        })),
    ];
  });
}

/** Copy is written only for the languages the profile publishes. */
function copyLocaleProblems(
  documents: ReadonlyMap<string, Document>,
  locales: readonly unknown[],
): BundleProblem[] {
  return [...documents.keys()].flatMap((path) => {
    const copy = copyDocumentOf(path);
    if (!copy || locales.includes(copy.locale)) return [];
    return [
      {
        document: path,
        problem: `${copy.locale} is not a published locale`,
        remedy: `add ${copy.locale} to the locales of ${DOCUMENTS.bundle}, or remove its copy`,
      },
    ];
  });
}

function knowledgeOf(parsed: Parsed, notesGuide: string): Record<string, unknown> {
  const parts = Object.keys(KNOWLEDGE_DOCUMENTS).map((document) => asRecord(parsed.get(document)));
  return {
    ...Object.fromEntries(parts.flatMap((part) => Object.entries(part))),
    notes: {
      source: 'notes',
      guide: notesGuide.replace(/\n$/, ''),
      passages: parsed.get(DOCUMENTS.notes),
    },
    productSites: asRecord(parsed.get(DOCUMENTS.snapshot)).entries,
  };
}

// D2: once the copy is data, an English copy with no documents is a hard
// error — a profile cannot answer anything without it.
function copyOf(parsed: Parsed): Record<string, Record<string, unknown>> {
  const copy: Record<string, Record<string, unknown>> = { en: {} };
  for (const [path, value] of parsed) {
    const document = copyDocumentOf(path);
    if (document) copy[document.locale] = { ...copy[document.locale], [document.name]: value };
  }
  return copy;
}

/** The document, and the place in it, that a path into the decoded data came from. */
export function locate(path: readonly PropertyKey[]): { document: string; at: string } {
  const [part, ...rest] = path;
  const [key, ...within] = rest;
  switch (part) {
    case 'locales':
      return { document: DOCUMENTS.bundle, at: pointer(path) };
    case 'identity':
      return { document: DOCUMENTS.identity, at: pointer(rest) };
    case 'brand':
      return { document: DOCUMENTS.brand, at: pointer(rest) };
    case 'siteAllowList':
      return { document: DOCUMENTS.allowList, at: pointer(rest) };
    case 'retrievalProbes':
      return { document: DOCUMENTS.probes, at: pointer(rest) };
    case 'assets':
      return { document: DOCUMENTS.assets, at: pointer(rest) };
    case 'evaluation':
      return {
        document: key === 'calibration' ? DOCUMENTS.calibration : DOCUMENTS.cases,
        at: pointer(within),
      };
    case 'copy': {
      const [name, ...inside] = within;
      return { document: `copy/${String(key)}/${String(name)}`, at: pointer(inside) };
    }
    case 'knowledge':
      return locateInRecord(rest);
    default:
      return { document: DOCUMENTS.bundle, at: pointer(path) };
  }
}

function locateInRecord(path: readonly PropertyKey[]): { document: string; at: string } {
  const [key, ...within] = path;
  if (key === 'productSites')
    return { document: DOCUMENTS.snapshot, at: pointer(['entries', ...within]) };
  if (key === 'notes') {
    const [field, ...inside] = within;
    if (field === 'guide') return { document: DOCUMENTS.notesGuide, at: '' };
    return { document: DOCUMENTS.notes, at: pointer(field === 'passages' ? inside : within) };
  }
  const document =
    Object.entries(KNOWLEDGE_DOCUMENTS).find(
      ([, keys]) => key !== undefined && (keys as readonly PropertyKey[]).includes(key),
    )?.[0] ?? 'knowledge/profile.yaml';
  return { document, at: pointer(path) };
}
