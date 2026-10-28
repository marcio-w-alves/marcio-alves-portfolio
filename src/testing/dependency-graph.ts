import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise, type ICruiseResult, type IModule } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const fixturesRoot = join(repositoryRoot, 'src/architecture/fixtures');

/** A cruise of one `src` tree against the project's rules, and where that tree lives. */
export interface DependencyGraph {
  readonly baseDir: string;
  readonly result: ICruiseResult;
}

export interface Violation {
  readonly rule: string;
  readonly from: string;
  readonly to: string;
}

async function cruiseSource(baseDir: string): Promise<DependencyGraph> {
  const options = await extractDepcruiseOptions(join(repositoryRoot, '.dependency-cruiser.cjs'));
  const { output } = await cruise(
    ['src'],
    { ...options, baseDir },
    {},
    { tsConfig: extractTSConfig(join(repositoryRoot, 'tsconfig.json')) },
  );
  return { baseDir, result: output as ICruiseResult };
}

/** The repository's own `src`, checked exactly as `pnpm boundaries` checks it. */
export function cruiseRepository(): Promise<DependencyGraph> {
  return cruiseSource(repositoryRoot);
}

/** A tree under `src/architecture/fixtures/<name>`, checked against the same rules. */
export function cruiseFixture(name: string): Promise<DependencyGraph> {
  return cruiseSource(join(fixturesRoot, name));
}

export function violationsOf({ result }: DependencyGraph): Violation[] {
  return result.summary.violations.map(({ rule, from, to }) => ({ rule: rule.name, from, to }));
}

/**
 * Every `'use client'` module that reaches a forbidden module through its
 * imports, as the shortest import chain that gets there. Type-only imports
 * are erased before bundling, so they are not followed.
 */
export function clientPathsTo(
  { baseDir, result }: DependencyGraph,
  isForbidden: (source: string) => boolean,
): string[][] {
  const dependenciesOf = new Map(
    result.modules.map((module) => [
      module.source,
      module.dependencies
        .filter((dependency) => !dependency.dependencyTypes.includes('type-only'))
        .map((dependency) => dependency.resolved),
    ]),
  );
  return result.modules
    .filter((module) => isClientModule(baseDir, module))
    .map((module) => shortestPath(module.source, dependenciesOf, isForbidden))
    .filter((path) => path !== null);
}

function isClientModule(baseDir: string, module: IModule): boolean {
  if (!module.source.startsWith('src/')) return false;
  return /^\s*['"]use client['"]/.test(readFileSync(join(baseDir, module.source), 'utf8'));
}

function shortestPath(
  start: string,
  dependenciesOf: ReadonlyMap<string, readonly string[]>,
  isForbidden: (source: string) => boolean,
): string[] | null {
  const cameFrom = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    if (isForbidden(current)) return pathBack(current, cameFrom);
    for (const next of dependenciesOf.get(current) ?? []) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, current);
      queue.push(next);
    }
  }
  return null;
}

function pathBack(end: string, cameFrom: ReadonlyMap<string, string | null>): string[] {
  const path = [end];
  for (let step = cameFrom.get(end); step; step = cameFrom.get(step)) path.unshift(step);
  return path;
}
