import type { Locale } from '../../i18n/locale';
import { bullets, numbered } from '../response-kit';
import { FILTERS, FilterProblem, isTruthy } from './filters';
import {
  TemplateError,
  type Condition,
  type FilterCall,
  type Operand,
  type Path,
  type Pipeline,
  type Position,
  type Template,
  type TemplateNode,
} from './template';

/**
 * Renders templates over the data they are given, strictly: a path that does
 * not exist, an object written into text, a filter on the wrong kind of value
 * is an error naming the template and the tag, never an empty string.
 *
 * In `check` mode every branch is walked whatever its condition, so a path in
 * a branch the record does not take today is still proven to exist. What a
 * path reads from nothing there (an absent item, an untaken `#with`) is not
 * known, and passes.
 */

export type Mode = 'render' | 'check';

/** A value computed only when a template reads it: a string of the copy, an extraction. */
export class Lazy {
  constructor(readonly get: (mode: Mode) => unknown) {}
}

export interface Scope {
  readonly locale: Locale;
  readonly mode: Mode;
  /** The names a path may start with. */
  readonly names: Readonly<Record<string, unknown>>;
}

const UNKNOWN = Symbol('unknown');
const MISSING = Symbol('missing');

interface Frame {
  readonly scope: Scope;
  readonly origin: string;
  readonly at: Position;
  /** The item `.` names inside a block; absent at the top. */
  readonly current?: { readonly value: unknown };
}

function fail(frame: Frame, problem: string): never {
  throw new TemplateError(frame.origin, frame.at, problem);
}

function pathText(path: Path): string {
  const segments = path.segments
    .map((segment) =>
      segment.kind === 'name' ? `.${segment.name}` : `[${pathText(segment.path)}]`,
    )
    .join('');
  return path.relative ? segments || '.' : `${path.root}${segments}`;
}

function unwrap(value: unknown, frame: Frame): unknown {
  return value instanceof Lazy ? value.get(frame.scope.mode) : value;
}

function startOf(path: Path, frame: Frame): unknown {
  if (path.relative) {
    if (!frame.current) fail(frame, `"${pathText(path)}" is outside any block`);
    return frame.current.value;
  }
  if (!Object.hasOwn(frame.scope.names, path.root)) fail(frame, `Unknown name "${path.root}"`);
  return frame.scope.names[path.root];
}

/**
 * Follows a path through own data properties only. A key looked up in
 * brackets may be absent where `missingAllowed` (a condition asking whether
 * it is there); every other absent name is an error.
 */
function resolve(path: Path, frame: Frame, missingAllowed: boolean): unknown {
  let value = unwrap(startOf(path, frame), frame);
  for (const segment of path.segments) {
    if (value === UNKNOWN) return UNKNOWN;
    let key: string;
    if (segment.kind === 'name') {
      key = segment.name;
    } else {
      const index = resolve(segment.path, frame, false);
      if (index === UNKNOWN) return UNKNOWN;
      if (typeof index !== 'string' && typeof index !== 'number') {
        fail(frame, `"${pathText(segment.path)}" cannot be used as a key`);
      }
      key = String(index);
    }
    if (value === null || value === undefined) {
      if (frame.scope.mode === 'check') return UNKNOWN;
      fail(frame, `"${pathText(path)}" reads "${key}" of nothing`);
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      fail(frame, `"${pathText(path)}" reads "${key}" of something that has no fields`);
    }
    if (!Object.hasOwn(value, key)) {
      if (missingAllowed && segment.kind === 'index') return MISSING;
      fail(frame, `Unknown path "${pathText(path)}": there is no "${key}"`);
    }
    value = unwrap((value as Readonly<Record<string, unknown>>)[key], frame);
  }
  return value;
}

function operandValue(operand: Operand, frame: Frame, missingAllowed: boolean): unknown {
  if (operand.kind === 'path') return resolve(operand.path, frame, missingAllowed);
  return operand.value;
}

function applyFilter(input: unknown, call: FilterCall, frame: Frame): unknown {
  const spec = FILTERS.get(call.name);
  if (!spec) fail(frame, `Unknown filter "${call.name}"`);
  const args = call.args.map((arg) => {
    if (arg.kind === 'regex') return arg.pattern;
    if (arg.kind === 'field') return arg.field;
    return operandValue(arg.operand, frame, false);
  });
  if (args.includes(UNKNOWN)) return UNKNOWN;
  try {
    return spec.apply(input, args, frame.scope.locale);
  } catch (error) {
    if (error instanceof FilterProblem) fail(frame, error.message);
    throw error;
  }
}

function evaluate(pipeline: Pipeline, frame: Frame, missingAllowed = false): unknown {
  let value = operandValue(
    pipeline.operand,
    frame,
    missingAllowed && pipeline.filters.length === 0,
  );
  for (const call of pipeline.filters) {
    if (value === UNKNOWN) return UNKNOWN;
    value = applyFilter(value, call, frame);
  }
  return value;
}

function test(condition: Condition, frame: Frame): boolean {
  switch (condition.kind) {
    case 'or':
      return condition.items.map((item) => test(item, frame)).some(Boolean);
    case 'and':
      return condition.items.map((item) => test(item, frame)).every(Boolean);
    case 'not':
      return !test(condition.item, frame);
    case 'test': {
      const value = evaluate(condition.pipeline, frame, true);
      if (value === UNKNOWN) return false;
      if (!condition.compare) return value !== MISSING && isTruthy(value);
      if (value === MISSING || value === null || value === undefined) {
        return !condition.compare.equal;
      }
      if (typeof value !== 'string' && typeof value !== 'number') {
        fail(frame, `A ${kind(value)} cannot be compared with "${condition.compare.value}"`);
      }
      return (String(value) === condition.compare.value) === condition.compare.equal;
    }
  }
}

function kind(value: unknown): string {
  return Array.isArray(value) ? 'list' : typeof value;
}

function written(value: unknown, frame: Frame): string {
  if (value === UNKNOWN) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (frame.scope.mode === 'check') return '';
  if (value === null || value === undefined) fail(frame, 'Nothing to write here');
  fail(frame, `A ${kind(value)} cannot be written as text; add a filter`);
}

function itemsOf(value: unknown, frame: Frame): readonly unknown[] {
  if (value === UNKNOWN) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) return Object.values(value);
  if (frame.scope.mode === 'check') return [];
  fail(frame, `A ${value === null ? 'missing value' : kind(value)} cannot be iterated`);
}

function inside(frame: Frame, value: unknown): Frame {
  return { ...frame, current: { value } };
}

function renderNode(node: TemplateNode, frame: Frame): string {
  if (node.kind === 'text') return node.text;
  const at = { ...frame, at: node.at };
  const checking = frame.scope.mode === 'check';
  switch (node.kind) {
    case 'value':
      return written(evaluate(node.pipeline, at), at);
    case 'if': {
      if (checking) {
        node.branches.forEach((branch) => {
          test(branch.condition, at);
          renderNodes(branch.body, frame);
        });
        renderNodes(node.otherwise, frame);
        return '';
      }
      const taken = node.branches.find((branch) => test(branch.condition, at));
      return renderNodes(taken ? taken.body : node.otherwise, frame);
    }
    case 'each':
      return itemsOf(evaluate(node.pipeline, at), at)
        .map((item) => renderNodes(node.body, inside(frame, item)))
        .join(node.separator);
    case 'list': {
      const items = itemsOf(evaluate(node.pipeline, at), at).map((item) =>
        renderNodes(node.body, inside(frame, item)),
      );
      return node.style === 'bullets' ? bullets(items) : numbered(items);
    }
    case 'with': {
      // Like #if, #with asks whether something is there, so a key it looks up may be absent.
      const found = evaluate(node.pipeline, at, true);
      const value = found === MISSING ? null : found;
      if (checking) {
        renderNodes(node.body, inside(frame, isTruthy(value) ? value : UNKNOWN));
        renderNodes(node.otherwise, frame);
        return '';
      }
      return isTruthy(value)
        ? renderNodes(node.body, inside(frame, value))
        : renderNodes(node.otherwise, frame);
    }
  }
}

function renderNodes(nodes: readonly TemplateNode[], frame: Frame): string {
  return nodes.map((node) => renderNode(node, frame)).join('');
}

const START: Position = { line: 1, column: 1 };

/** The template's text over the scope's data; `current` is what `.` names, as in a table's rows. */
export function renderTemplate(
  template: Template,
  scope: Scope,
  current?: { readonly value: unknown },
): string {
  const frame: Frame = { scope, origin: template.origin, at: START };
  return renderNodes(template.nodes, current ? { ...frame, current } : frame);
}

/** Whether a condition holds over the scope's data. */
export function holds(condition: Condition, origin: string, scope: Scope): boolean {
  return test(condition, { scope, origin, at: START });
}

/** A value read on its own; `null` where check mode cannot know it. */
export function valueOf(pipeline: Pipeline, origin: string, scope: Scope): unknown {
  const value = evaluate(pipeline, { scope, origin, at: START });
  return value === UNKNOWN ? null : value;
}
