import type { Locale } from '../../i18n/locale';
import { FILTERS, type FieldName } from './filters';

/**
 * The answer copy's template language: literal text with `{{ }}` tags that
 * name the record's facts. It is deliberately small and closed — paths into
 * the data it is given, a fixed list of filters, conditions and a handful of
 * blocks — so a template can say anything the record holds and nothing else,
 * and a checker can prove that before a page is built.
 */

export interface Position {
  readonly line: number;
  readonly column: number;
}

export type Segment =
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'index'; readonly path: Path };

/** `profile.title`, `role.id`, `.title` (the current item) or `.` alone. */
export interface Path {
  readonly relative: boolean;
  /** Empty for a relative path: `.` is the current item. */
  readonly root: string;
  readonly segments: readonly Segment[];
}

export type Operand =
  | { readonly kind: 'path'; readonly path: Path }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'integer'; readonly value: number };

export type FilterArgument =
  | { readonly kind: 'operand'; readonly operand: Operand }
  | { readonly kind: 'regex'; readonly pattern: RegExp }
  | { readonly kind: 'field'; readonly field: FieldName };

export interface FilterCall {
  readonly name: string;
  readonly args: readonly FilterArgument[];
}

export interface Pipeline {
  readonly operand: Operand;
  readonly filters: readonly FilterCall[];
}

export type Condition =
  | { readonly kind: 'or' | 'and'; readonly items: readonly Condition[] }
  | { readonly kind: 'not'; readonly item: Condition }
  | {
      readonly kind: 'test';
      readonly pipeline: Pipeline;
      readonly compare?: { readonly equal: boolean; readonly value: string };
    };

export interface Branch {
  readonly condition: Condition;
  readonly body: readonly TemplateNode[];
}

export type TemplateNode =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly pipeline: Pipeline; readonly at: Position }
  | {
      readonly kind: 'if';
      readonly branches: readonly Branch[];
      readonly otherwise: readonly TemplateNode[];
      readonly at: Position;
    }
  | {
      readonly kind: 'each';
      readonly pipeline: Pipeline;
      readonly separator: string;
      readonly body: readonly TemplateNode[];
      readonly at: Position;
    }
  | {
      readonly kind: 'list';
      readonly style: 'bullets' | 'numbered';
      readonly pipeline: Pipeline;
      readonly body: readonly TemplateNode[];
      readonly at: Position;
    }
  | {
      readonly kind: 'with';
      readonly pipeline: Pipeline;
      readonly body: readonly TemplateNode[];
      readonly otherwise: readonly TemplateNode[];
      readonly at: Position;
    };

export interface Template {
  /** Where the template was written: `<document>#<answer>.<field>`. */
  readonly origin: string;
  readonly nodes: readonly TemplateNode[];
}

/** A template that cannot be parsed or rendered, located to the line and column of its tag. */
export class TemplateError extends Error {
  constructor(origin: string, at: Position, problem: string) {
    super(`${origin}:${String(at.line)}:${String(at.column)}: ${problem}`);
    this.name = 'TemplateError';
  }
}

// Names that would reach an object's machinery instead of the data it holds.
const FORBIDDEN_NAMES = new Set(['__proto__', 'prototype', 'constructor']);
const KEYWORDS = new Set(['and', 'or', 'not', 'else', 'if']);
const MAX_REGEX_LENGTH = 200;

type Token =
  | { readonly type: 'name'; readonly value: string }
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'integer'; readonly value: number }
  | { readonly type: 'punct'; readonly value: string }
  | { readonly type: 'open' | 'close'; readonly value: string };

const NAME = /[A-Za-z_][A-Za-z0-9_-]*/y;
const INTEGER = /\d+/y;
const PUNCTUATION = ['==', '!=', '.', '[', ']', '|', '(', ')', '='];
const ESCAPES: Readonly<Record<string, string>> = { n: '\n', '"': '"', '\\': '\\' };

class Syntax extends Error {}

/** A syntax error before the template's origin is attached. */
class TemplateErrorAt extends Error {
  constructor(
    readonly at: Position,
    readonly problem: string,
  ) {
    super(problem);
  }
}

interface Tag {
  readonly at: Position;
  readonly trimBefore: boolean;
  readonly trimAfter: boolean;
  /** Null for a comment. */
  readonly tokens: readonly Token[] | null;
}

function positionOf(source: string, offset: number): Position {
  const before = source.slice(0, offset).split('\n');
  return { line: before.length, column: (before.at(-1) ?? '').length + 1 };
}

function readString(body: string, start: number): { value: string; end: number } {
  let value = '';
  for (let index = start + 1; index < body.length; index += 1) {
    const char = body.charAt(index);
    if (char === '"') return { value, end: index + 1 };
    if (char === '\\') {
      const escaped = ESCAPES[body.charAt(index + 1)];
      if (escaped === undefined)
        throw new Syntax('Unknown escape in a string: use \\n, \\" or \\\\');
      value += escaped;
      index += 1;
    } else {
      value += char;
    }
  }
  throw new Syntax('Unclosed string');
}

function sticky(pattern: RegExp, text: string, at: number): string | null {
  pattern.lastIndex = at;
  return pattern.exec(text)?.[0] ?? null;
}

/** Reads one tag from `{{`, returning it and the offset after its `}}`. */
function readTag(source: string, start: number): { tag: Tag; end: number } {
  const at = positionOf(source, start);
  let index = start + 2;
  const trimBefore = source.charAt(index) === '~';
  if (trimBefore) index += 1;
  if (source.charAt(index) === '!') {
    const close = source.indexOf('}}', index);
    if (close < 0) throw new TemplateErrorAt(at, 'Unclosed tag: a comment needs its "}}"');
    const trimAfter = source.charAt(close - 1) === '~';
    return { tag: { at, trimBefore, trimAfter, tokens: null }, end: close + 2 };
  }
  const tokens: Token[] = [];
  try {
    for (;;) {
      while (/\s/.test(source.charAt(index))) index += 1;
      if (index >= source.length) throw new Syntax('Unclosed tag: missing "}}"');
      if (source.startsWith('~}}', index)) {
        return { tag: { at, trimBefore, trimAfter: true, tokens }, end: index + 3 };
      }
      if (source.startsWith('}}', index)) {
        return { tag: { at, trimBefore, trimAfter: false, tokens }, end: index + 2 };
      }
      const char = source.charAt(index);
      if (char === '"') {
        const { value, end } = readString(source, index);
        tokens.push({ type: 'string', value });
        index = end;
        continue;
      }
      if ((char === '#' || char === '/') && tokens.length === 0) {
        const name = sticky(NAME, source, index + 1);
        if (!name) throw new Syntax(`"${char}" must be followed by a block name`);
        tokens.push({ type: char === '#' ? 'open' : 'close', value: name });
        index += 1 + name.length;
        continue;
      }
      const name = sticky(NAME, source, index);
      if (name) {
        tokens.push({ type: 'name', value: name });
        index += name.length;
        continue;
      }
      const digits = sticky(INTEGER, source, index);
      if (digits) {
        tokens.push({ type: 'integer', value: Number(digits) });
        index += digits.length;
        continue;
      }
      const punct = PUNCTUATION.find((candidate) => source.startsWith(candidate, index));
      if (!punct) throw new Syntax(`Unexpected "${char}"`);
      tokens.push({ type: 'punct', value: punct });
      index += punct.length;
    }
  } catch (error) {
    if (error instanceof Syntax) throw new TemplateErrorAt(at, error.message);
    throw error;
  }
}

/** Reads the tokens of one tag; every method throws `Syntax` at the first problem. */
class TokenReader {
  private index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly locale: Locale,
  ) {}

  peek(offset = 0): Token | undefined {
    return this.tokens[this.index + offset];
  }

  done(): boolean {
    return this.index >= this.tokens.length;
  }

  expectEnd(): void {
    const token = this.peek();
    if (token) throw new Syntax(`Unexpected ${describe(token)}`);
  }

  private next(): Token {
    const token = this.peek();
    if (!token) throw new Syntax('The tag ends too early');
    this.index += 1;
    return token;
  }

  private isPunct(value: string): boolean {
    const token = this.peek();
    return token?.type === 'punct' && token.value === value;
  }

  private isName(value: string): boolean {
    const token = this.peek();
    return token?.type === 'name' && token.value === value;
  }

  private skipPunct(value: string): void {
    if (!this.isPunct(value)) throw new Syntax(`Expected "${value}"`);
    this.index += 1;
  }

  /** Steps over a token already looked at: a block's `#name` or `/name`, an `else`, an `if`. */
  skip(): void {
    this.index += 1;
  }

  isKeyword(value: string): boolean {
    return this.isName(value);
  }

  path(): Path {
    let relative = false;
    let root = '';
    if (this.isPunct('.')) {
      relative = true;
      this.index += 1;
      const token = this.peek();
      if (token?.type !== 'name') return { relative, root, segments: [] };
    } else {
      const token = this.next();
      if (token.type !== 'name' || KEYWORDS.has(token.value)) {
        throw new Syntax(`Expected a path, found ${describe(token)}`);
      }
      root = checkedName(token.value);
    }
    const segments: Segment[] = [];
    if (relative) segments.push({ kind: 'name', name: this.name() });
    for (;;) {
      if (this.isPunct('.')) {
        this.index += 1;
        segments.push({ kind: 'name', name: this.name() });
      } else if (this.isPunct('[')) {
        this.index += 1;
        segments.push({ kind: 'index', path: this.path() });
        this.skipPunct(']');
      } else {
        return { relative, root, segments };
      }
    }
  }

  private name(): string {
    const token = this.next();
    if (token.type !== 'name') throw new Syntax(`Expected a name, found ${describe(token)}`);
    return checkedName(token.value);
  }

  operand(): Operand {
    const token = this.peek();
    if (token?.type === 'string') {
      this.index += 1;
      return { kind: 'string', value: token.value };
    }
    if (token?.type === 'integer') {
      this.index += 1;
      return { kind: 'integer', value: token.value };
    }
    return { kind: 'path', path: this.path() };
  }

  pipeline(): Pipeline {
    const operand = this.operand();
    const filters: FilterCall[] = [];
    while (this.isPunct('|')) {
      this.index += 1;
      filters.push(this.filter());
    }
    return { operand, filters };
  }

  private startsArgument(): boolean {
    const token = this.peek();
    if (!token) return false;
    if (token.type === 'string' || token.type === 'integer') return true;
    if (token.type === 'punct') return token.value === '.';
    if (token.type !== 'name' || KEYWORDS.has(token.value)) return false;
    const after = this.peek(1);
    return !(after?.type === 'punct' && after.value === '=');
  }

  private filter(): FilterCall {
    const name = this.name();
    const spec = FILTERS[name];
    if (!spec) throw new Syntax(`Unknown filter "${name}"`);
    if (spec.locales && !spec.locales.includes(this.locale)) {
      throw new Syntax(`${name} has no ${this.locale} form`);
    }
    const args: FilterArgument[] = [];
    while (this.startsArgument()) args.push(this.argument(spec.args[args.length]));
    if (args.length !== spec.args.length) {
      throw new Syntax(
        `Filter "${name}" takes ${String(spec.args.length)} argument(s), got ${String(args.length)}`,
      );
    }
    return { name, args };
  }

  private argument(kind: 'value' | 'regex' | 'field' | undefined): FilterArgument {
    const operand = this.operand();
    if (kind === 'regex') {
      if (operand.kind !== 'string') throw new Syntax('A regular expression must be a string');
      return { kind: 'regex', pattern: compiledRegex(operand.value) };
    }
    if (kind === 'field') {
      if (operand.kind === 'string') return { kind: 'field', field: checkedName(operand.value) };
      if (operand.kind === 'path' && !operand.path.relative && operand.path.segments.length === 0) {
        return { kind: 'field', field: operand.path.root };
      }
      throw new Syntax('A field must be a name');
    }
    return { kind: 'operand', operand };
  }

  condition(): Condition {
    const items = [this.conjunction()];
    while (this.isKeyword('or')) {
      this.index += 1;
      items.push(this.conjunction());
    }
    return items.length === 1 && items[0] ? items[0] : { kind: 'or', items };
  }

  private conjunction(): Condition {
    const items = [this.negation()];
    while (this.isKeyword('and')) {
      this.index += 1;
      items.push(this.negation());
    }
    return items.length === 1 && items[0] ? items[0] : { kind: 'and', items };
  }

  private negation(): Condition {
    if (this.isKeyword('not')) {
      this.index += 1;
      return { kind: 'not', item: this.negation() };
    }
    if (this.isPunct('(')) {
      this.index += 1;
      const inner = this.condition();
      this.skipPunct(')');
      return inner;
    }
    const pipeline = this.pipeline();
    const token = this.peek();
    if (token?.type === 'punct' && (token.value === '==' || token.value === '!=')) {
      this.index += 1;
      const value = this.next();
      if (value.type !== 'string') throw new Syntax('A comparison compares with a string');
      return {
        kind: 'test',
        pipeline,
        compare: { equal: token.value === '==', value: value.value },
      };
    }
    return { kind: 'test', pipeline };
  }

  /** `sep=", "` after an `#each`. */
  separator(): string {
    if (!this.isKeyword('sep')) return '';
    this.index += 1;
    this.skipPunct('=');
    const token = this.next();
    if (token.type !== 'string') throw new Syntax('sep= takes a string');
    return token.value;
  }
}

function describe(token: Token): string {
  if (token.type === 'string') return `the string "${token.value}"`;
  if (token.type === 'open') return `"#${token.value}"`;
  if (token.type === 'close') return `"/${token.value}"`;
  return `"${String(token.value)}"`;
}

function checkedName(name: string): string {
  if (FORBIDDEN_NAMES.has(name)) throw new Syntax(`"${name}" cannot be read`);
  return name;
}

function compiledRegex(source: string): RegExp {
  if (source.length > MAX_REGEX_LENGTH) {
    throw new Syntax(`A regular expression may be at most ${String(MAX_REGEX_LENGTH)} characters`);
  }
  try {
    return new RegExp(source);
  } catch {
    throw new Syntax(`Invalid regular expression "${source}"`);
  }
}

type BlockName = 'if' | 'each' | 'bullets' | 'numbered' | 'with';

/** A block still being read, and where its nodes are going. */
interface OpenBlock {
  readonly name: BlockName;
  readonly at: Position;
  readonly finish: (block: OpenBlock) => TemplateNode;
  readonly branches: { condition: Condition; body: TemplateNode[] }[];
  body: TemplateNode[];
  otherwise: TemplateNode[] | null;
}

const BLOCKS = new Set<string>(['if', 'each', 'bullets', 'numbered', 'with']);

class TemplateParser {
  private readonly root: TemplateNode[] = [];
  private readonly open: OpenBlock[] = [];
  private trimNext = false;

  constructor(private readonly locale: Locale) {}

  private get target(): TemplateNode[] {
    const block = this.open.at(-1);
    if (!block) return this.root;
    return block.otherwise ?? block.body;
  }

  text(text: string): void {
    const kept = this.trimNext ? text.trimStart() : text;
    this.trimNext = false;
    if (kept) this.target.push({ kind: 'text', text: kept });
  }

  tag(tag: Tag): void {
    if (tag.trimBefore) this.trimPrevious();
    if (tag.tokens) this.read(new TokenReader(tag.tokens, this.locale), tag.at);
    this.trimNext = tag.trimAfter;
  }

  private trimPrevious(): void {
    const target = this.target;
    const last = target.at(-1);
    if (last?.kind !== 'text') return;
    const trimmed = last.text.trimEnd();
    target.pop();
    if (trimmed) target.push({ kind: 'text', text: trimmed });
  }

  private read(reader: TokenReader, at: Position): void {
    const first = reader.peek();
    if (first?.type === 'open') {
      this.openBlock(reader, first.value, at);
      return;
    }
    if (first?.type === 'close') {
      this.closeBlock(reader, first.value);
      return;
    }
    if (reader.isKeyword('else')) {
      this.otherwise(reader);
      return;
    }
    if (reader.done()) throw new Syntax('An empty tag');
    const pipeline = reader.pipeline();
    reader.expectEnd();
    this.target.push({ kind: 'value', pipeline, at });
  }

  private openBlock(reader: TokenReader, name: string, at: Position): void {
    if (!BLOCKS.has(name)) throw new Syntax(`Unknown block "#${name}"`);
    const block = name as BlockName;
    reader.skip();
    if (block === 'if') {
      const condition = reader.condition();
      reader.expectEnd();
      this.push(block, at, [{ condition, body: [] }], ({ branches, otherwise }) => ({
        kind: 'if',
        branches,
        otherwise: otherwise ?? [],
        at,
      }));
      return;
    }
    const pipeline = reader.pipeline();
    const separator = block === 'each' ? reader.separator() : '';
    reader.expectEnd();
    this.push(block, at, [], ({ body, otherwise }) => {
      if (block === 'each') return { kind: 'each', pipeline, separator, body, at };
      if (block === 'with') return { kind: 'with', pipeline, body, otherwise: otherwise ?? [], at };
      return { kind: 'list', style: block, pipeline, body, at };
    });
  }

  private push(
    name: BlockName,
    at: Position,
    branches: OpenBlock['branches'],
    finish: OpenBlock['finish'],
  ): void {
    const body = branches[0]?.body ?? [];
    this.open.push({ name, at, finish, branches, body, otherwise: null });
  }

  private otherwise(reader: TokenReader): void {
    reader.skip();
    const block = this.open.at(-1);
    if (!block || (block.name !== 'if' && block.name !== 'with') || block.otherwise) {
      throw new Syntax('"else" outside an #if or #with');
    }
    if (block.name === 'if' && reader.isKeyword('if')) {
      reader.skip();
      const condition = reader.condition();
      reader.expectEnd();
      const body: TemplateNode[] = [];
      block.branches.push({ condition, body });
      block.body = body;
      return;
    }
    reader.expectEnd();
    block.otherwise = [];
  }

  private closeBlock(reader: TokenReader, name: string): void {
    reader.skip();
    reader.expectEnd();
    const block = this.open.at(-1);
    if (block?.name !== name) {
      throw new Syntax(block ? `"/${name}" closes "#${block.name}"` : `"/${name}" closes nothing`);
    }
    this.open.pop();
    this.target.push(block.finish(block));
  }

  finish(): TemplateNode[] {
    const unclosed = this.open.at(-1);
    if (unclosed) throw new TemplateErrorAt(unclosed.at, `"#${unclosed.name}" is never closed`);
    return this.root;
  }
}

/** Parses a template; every problem is a `TemplateError` naming the line and column of its tag. */
export function parseTemplate(source: string, origin: string, locale: Locale): Template {
  const parser = new TemplateParser(locale);
  let index = 0;
  try {
    for (;;) {
      const open = source.indexOf('{{', index);
      if (open < 0) break;
      parser.text(source.slice(index, open));
      const { tag, end } = readTag(source, open);
      try {
        parser.tag(tag);
      } catch (error) {
        if (error instanceof Syntax) throw new TemplateErrorAt(tag.at, error.message);
        throw error;
      }
      index = end;
    }
    parser.text(source.slice(index));
    return { origin, nodes: parser.finish() };
  } catch (error) {
    if (error instanceof TemplateErrorAt) throw new TemplateError(origin, error.at, error.problem);
    throw error;
  }
}

const WHOLE: Position = { line: 1, column: 1 };

function readExpression<T>(
  source: string,
  origin: string,
  locale: Locale,
  read: (reader: TokenReader) => T,
): T {
  try {
    const wrapped = `{{${source}}}`;
    const { tag, end } = readTag(wrapped, 0);
    if (end !== wrapped.length || !tag.tokens) throw new Syntax('Expected one expression');
    const reader = new TokenReader(tag.tokens, locale);
    const value = read(reader);
    reader.expectEnd();
    return value;
  } catch (error) {
    if (error instanceof Syntax) throw new TemplateError(origin, WHOLE, error.message);
    if (error instanceof TemplateErrorAt) throw new TemplateError(origin, WHOLE, error.problem);
    throw error;
  }
}

/** A condition written on its own, as a part's `when` is: `role.metrics and not role.current`. */
export function parseCondition(source: string, origin: string, locale: Locale): Condition {
  return readExpression(source, origin, locale, (reader) => reader.condition());
}

/** A value written on its own, as a part's `from` is: `role.metrics`. */
export function parsePipeline(source: string, origin: string, locale: Locale): Pipeline {
  return readExpression(source, origin, locale, (reader) => reader.pipeline());
}
