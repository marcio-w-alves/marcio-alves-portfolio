/** One value that differs between two JSON documents, at its path (`parts[1].text`). */
export interface JsonChange {
  readonly path: string;
  /** Undefined where that side has no value at the path. */
  readonly baseline: unknown;
  readonly target: unknown;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function diffJson(baseline: unknown, target: unknown, path = ''): JsonChange[] {
  if (Array.isArray(baseline) && Array.isArray(target)) return diffArrays(baseline, target, path);
  if (isObject(baseline) && isObject(target)) return diffObjects(baseline, target, path);
  return Object.is(baseline, target) ? [] : [{ path, baseline, target }];
}

function diffArrays(baseline: readonly unknown[], target: readonly unknown[], path: string) {
  const length = Math.max(baseline.length, target.length);
  return Array.from({ length }, (_, index) =>
    diffJson(baseline[index], target[index], `${path}[${String(index)}]`),
  ).flat();
}

function diffObjects(baseline: Json, target: Json, path: string) {
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(target)])].sort();
  return keys.flatMap((key) => diffJson(baseline[key], target[key], childPath(path, key)));
}

function childPath(path: string, key: string): string {
  if (!IDENTIFIER.test(key)) return `${path}[${JSON.stringify(key)}]`;
  return path ? `${path}.${key}` : key;
}

const SHOWN = 120;

/** Context kept before the first differing character of two long texts. */
const LEAD = 30;

/** A value as a report line shows it: JSON, cut short. */
function shown(value: unknown): string {
  if (value === undefined) return '(absent)';
  const text = JSON.stringify(value);
  return text.length > SHOWN ? `${text.slice(0, SHOWN)}…` : text;
}

/** Two values as a report line shows them; two long texts from just before where they part. */
export function contrast(baseline: unknown, target: unknown): string {
  if (typeof baseline !== 'string' || typeof target !== 'string') {
    return `${shown(baseline)} → ${shown(target)}`;
  }
  const [before, after] = [JSON.stringify(baseline), JSON.stringify(target)];
  let common = 0;
  while (common < before.length && before[common] === after[common]) common += 1;
  const start = Math.max(0, common - LEAD);
  const excerpt = (text: string) => {
    const end = Math.min(text.length, start + SHOWN);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
  };
  return `${excerpt(before)} → ${excerpt(after)}`;
}
