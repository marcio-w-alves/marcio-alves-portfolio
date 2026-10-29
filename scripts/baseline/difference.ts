import { contrast, type JsonChange } from './json-diff';

export type DifferenceKind = 'missing' | 'unexpected' | 'changed';

/**
 * One way the target differs from the baseline, located by the input it
 * answers and the place inside it: `answer:<input>#parts[0].text`.
 */
export interface Difference {
  readonly location: string;
  readonly kind: DifferenceKind;
  readonly detail: string;
}

export function changed(location: string, detail: string): Difference {
  return { location, kind: 'changed', detail };
}

export function fromJsonChange(prefix: string, { path, baseline, target }: JsonChange): Difference {
  return changed(`${prefix}#${path}`, contrast(baseline, target));
}

/** What the baseline has and the target lacks, and the reverse. */
export function presence(
  kind: string,
  baselineIds: readonly string[],
  targetIds: readonly string[],
): { readonly differences: Difference[]; readonly common: string[] } {
  const inTarget = new Set(targetIds);
  const inBaseline = new Set(baselineIds);
  return {
    differences: [
      ...baselineIds
        .filter((id) => !inTarget.has(id))
        .map((id) => ({
          location: `${kind}:${id}`,
          kind: 'missing' as const,
          detail: 'in the baseline only',
        })),
      ...targetIds
        .filter((id) => !inBaseline.has(id))
        .map((id) => ({
          location: `${kind}:${id}`,
          kind: 'unexpected' as const,
          detail: 'in the target only',
        })),
    ],
    common: baselineIds.filter((id) => inTarget.has(id)),
  };
}

export function formatDifference({ location, kind, detail }: Difference): string {
  return `${kind.padEnd(10)} ${location}  ${detail}`;
}
