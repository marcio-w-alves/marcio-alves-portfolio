import { LOCALE_SEGMENT } from '../../../src/core/i18n/locale';
import type { ProfileData } from '../../../src/profile/schema';
import { locate, type DecodedBundle } from '../bundle/decode';
import { DOCUMENTS, isAsset } from '../bundle/layout';
import { pointer, type BundleProblem } from '../bundle/problems';

/**
 * Every file the record links to (the photo, the résumé) is served by the
 * site from its own origin at that address, from a file of the bundle, and no
 * asset takes an address one of the site's own routes answers.
 */

const TOP_LEVEL_FILE = /^\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Names the site's own routes answer at its root, with or without an extension. */
const ROUTE_NAMES: ReadonlySet<string> = new Set([
  'api',
  'brand',
  'icon',
  'apple-icon',
  'robots',
  'sitemap',
  '_next',
  ...Object.values(LOCALE_SEGMENT),
]);

function routeName(path: string): string {
  return path.slice(1).split(/[./]/)[0] ?? '';
}

function pathProblems(data: ProfileData): BundleProblem[] {
  const seen = new Set<string>();
  return data.assets.flatMap(({ path }, index) => {
    const at = pointer([index, 'path']);
    const problems: BundleProblem[] = [];
    if (!TOP_LEVEL_FILE.test(path)) {
      problems.push({
        document: DOCUMENTS.assets,
        at,
        problem: `"${path}" is not a file at the site's root`,
        remedy: 'serve it at /<name>.<extension>',
      });
    } else if (ROUTE_NAMES.has(routeName(path))) {
      problems.push({
        document: DOCUMENTS.assets,
        at,
        problem: `"${path}" collides with one of the site's own addresses`,
        remedy: 'give it another name',
      });
    }
    if (seen.has(path)) {
      problems.push({
        document: DOCUMENTS.assets,
        at,
        problem: `"${path}" is served twice`,
        remedy: 'serve each address once',
      });
    }
    seen.add(path);
    return problems;
  });
}

function fileProblems(data: ProfileData, { documents }: DecodedBundle): BundleProblem[] {
  const declared = new Set(data.assets.map(({ file }) => file));
  const missingOrWrong = data.assets.flatMap(({ file, mediaType }, index) => {
    const document = documents.get(file);
    const at = pointer([index, 'file']);
    if (!document) {
      return [
        {
          document: DOCUMENTS.assets,
          at,
          problem: `"${file}" is not in the bundle`,
          remedy: 'add the file, or fix its name',
        },
      ];
    }
    if (document.mediaType === mediaType) return [];
    return [
      {
        document: DOCUMENTS.assets,
        at: pointer([index, 'mediaType']),
        problem: `"${file}" is ${document.mediaType}, not ${mediaType}`,
        remedy: 'state the media type of the file',
      },
    ];
  });
  const undeclared = [...documents.keys()]
    .filter((path) => isAsset(path) && !declared.has(path))
    .map((document) => ({
      document,
      problem: `is not served: ${DOCUMENTS.assets} does not name it`,
      remedy: `add it to ${DOCUMENTS.assets}, or remove it`,
    }));
  return [...missingOrWrong, ...undeclared];
}

function linkProblems(data: ProfileData): BundleProblem[] {
  const served = new Set(data.assets.map(({ path }) => path));
  const links = [
    { path: ['profile', 'photoUrl'], url: data.knowledge.profile.photoUrl },
    { path: ['contact', 'resumeUrl'], url: data.knowledge.contact.resumeUrl },
  ];
  return links
    .filter(({ url }) => url !== null && !served.has(url))
    .map(({ path, url }) => ({
      ...locate(['knowledge', ...path]),
      problem: `links to ${String(url)}, which ${DOCUMENTS.assets} does not serve`,
      remedy: `add the file to ${DOCUMENTS.assets} at that address`,
    }));
}

export function checkAssets(data: ProfileData, decoded: DecodedBundle): BundleProblem[] {
  return [...pathProblems(data), ...fileProblems(data, decoded), ...linkProblems(data)];
}
