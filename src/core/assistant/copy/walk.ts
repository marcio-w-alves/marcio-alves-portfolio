import type {
  PreparedAnswer,
  PreparedPart,
  PreparedSource,
  PreparedTopic,
  StringValue,
  Variant,
} from './prepare';
import type { Condition, Operand, Path, Pipeline, Template, TemplateNode } from './template';

/**
 * Reads what a prepared copy says without rendering it: the paths each
 * template names, and the text it writes literally.
 */

/** Everything an answer or a topic is written with. */
export interface Writing {
  readonly templates: readonly Template[];
  readonly conditions: readonly Condition[];
  readonly pipelines: readonly Pipeline[];
}

function variantValues<T>(variant: Variant<T>): T[] {
  return [...Object.values(variant.byId), variant.fallback];
}

function stringTemplates(value: StringValue): Template[] {
  return 'nodes' in value && Array.isArray(value.nodes)
    ? [value as Template]
    : Object.values(value as Readonly<Record<string, Template>>);
}

function partWriting(part: PreparedPart): Writing {
  const conditions = part.when ? [part.when] : [];
  switch (part.kind) {
    case 'text':
    case 'note':
      return { templates: [part.text], conditions, pipelines: [] };
    case 'details':
      return { templates: [part.summary, part.text], conditions, pipelines: [] };
    case 'table': {
      const { rows } = part;
      const byRow = Array.isArray(rows);
      const cells = byRow
        ? (rows as readonly (readonly Template[])[]).flat()
        : (rows as { cells: readonly Template[] }).cells;
      return {
        templates: [...part.columns, ...cells, ...(part.caption ? [part.caption] : [])],
        conditions,
        pipelines: byRow ? [] : [(rows as { each: Pipeline }).each],
      };
    }
    case 'metrics':
    case 'projects':
      return {
        templates: [],
        conditions,
        pipelines: typeof part.ids === 'object' && 'operand' in part.ids ? [part.ids] : [],
      };
    default:
      return { templates: [], conditions, pipelines: [] };
  }
}

function sourceWriting(source: PreparedSource): Writing {
  if (source.kind === 'set') return { templates: [], conditions: [], pipelines: [] };
  return { templates: [source.id], conditions: source.when ? [source.when] : [], pipelines: [] };
}

function merged(writings: readonly Writing[]): Writing {
  return {
    templates: writings.flatMap((writing) => writing.templates),
    conditions: writings.flatMap((writing) => writing.conditions),
    pipelines: writings.flatMap((writing) => writing.pipelines),
  };
}

export function stringsWriting(strings: Readonly<Record<string, Variant<StringValue>>>): Writing {
  return {
    templates: Object.values(strings).flatMap((variant) =>
      variantValues(variant).flatMap(stringTemplates),
    ),
    conditions: [],
    pipelines: [],
  };
}

export function answerWriting(answer: PreparedAnswer): Writing {
  return merged([
    ...answer.parts.map(partWriting),
    ...answer.sources.map(sourceWriting),
    {
      templates: [
        ...variantValues(answer.followUps).flat(),
        ...(answer.related ? [answer.related] : []),
      ],
      conditions: typeof answer.grounded === 'boolean' ? [] : [answer.grounded.condition],
      pipelines: [],
    },
    stringsWriting(answer.strings),
  ]);
}

export function topicWriting(topic: PreparedTopic): Writing {
  return merged([
    ...topic.page.map(partWriting),
    {
      templates: [
        topic.label,
        topic.intro,
        topic.description,
        ...topic.questions.flatMap(({ question, tag, short }) => [
          question,
          tag,
          ...(short ? [short] : []),
        ]),
      ],
      conditions: [],
      pipelines: [],
    },
  ]);
}

function pathText(path: Path): string {
  const segments = path.segments
    .map((segment) => (segment.kind === 'name' ? `.${segment.name}` : '[]'))
    .join('');
  return path.relative ? segments || '.' : `${path.root}${segments}`;
}

/** A path and the paths it looks keys up by, `strings.*` left out: they are words, not facts. */
function pathsOfPath(path: Path): string[] {
  const inner = path.segments.flatMap((segment) =>
    segment.kind === 'index' ? pathsOfPath(segment.path) : [],
  );
  return path.root === 'strings' ? inner : [pathText(path), ...inner];
}

function pathsOfOperand(operand: Operand): string[] {
  return operand.kind === 'path' ? pathsOfPath(operand.path) : [];
}

function pathsOfPipeline(pipeline: Pipeline): string[] {
  return [
    ...pathsOfOperand(pipeline.operand),
    ...pipeline.filters.flatMap((call) =>
      call.args.flatMap((arg) => (arg.kind === 'operand' ? pathsOfOperand(arg.operand) : [])),
    ),
  ];
}

function pathsOfCondition(condition: Condition): string[] {
  if (condition.kind === 'test') return pathsOfPipeline(condition.pipeline);
  if (condition.kind === 'not') return pathsOfCondition(condition.item);
  return condition.items.flatMap(pathsOfCondition);
}

function pathsOfNodes(nodes: readonly TemplateNode[]): string[] {
  return nodes.flatMap((node): string[] => {
    switch (node.kind) {
      case 'text':
        return [];
      case 'value':
        return pathsOfPipeline(node.pipeline);
      case 'if':
        return [
          ...node.branches.flatMap((branch) => [
            ...pathsOfCondition(branch.condition),
            ...pathsOfNodes(branch.body),
          ]),
          ...pathsOfNodes(node.otherwise),
        ];
      case 'with':
        return [
          ...pathsOfPipeline(node.pipeline),
          ...pathsOfNodes(node.body),
          ...pathsOfNodes(node.otherwise),
        ];
      default:
        return [...pathsOfPipeline(node.pipeline), ...pathsOfNodes(node.body)];
    }
  });
}

/** The facts a piece of copy names, as normalized paths: `role.acme.company`, `.title`. */
export function factPaths(writing: Writing): Set<string> {
  return new Set([
    ...writing.templates.flatMap((template) => pathsOfNodes(template.nodes)),
    ...writing.conditions.flatMap(pathsOfCondition),
    ...writing.pipelines.flatMap(pathsOfPipeline),
  ]);
}

function pipelineLiterals(pipeline: Pipeline): string[] {
  const operands = [
    pipeline.operand,
    ...pipeline.filters.flatMap((call) =>
      call.args.flatMap((arg) => (arg.kind === 'operand' ? [arg.operand] : [])),
    ),
  ];
  return operands.flatMap((operand) => (operand.kind === 'string' ? [operand.value] : []));
}

/**
 * The text a template writes as it is: its literal segments and the strings
 * it writes or passes to a filter. A string a condition compares with only
 * guards prose, so it is not stated, and is left out.
 */
export function literalTexts(nodes: readonly TemplateNode[]): string[] {
  return nodes.flatMap((node): string[] => {
    switch (node.kind) {
      case 'text':
        return [node.text];
      case 'value':
        return pipelineLiterals(node.pipeline);
      case 'if':
        return [
          ...node.branches.flatMap((branch) => literalTexts(branch.body)),
          ...literalTexts(node.otherwise),
        ];
      case 'with':
        return [...literalTexts(node.body), ...literalTexts(node.otherwise)];
      case 'each':
        return [node.separator, ...literalTexts(node.body)];
      case 'list':
        return literalTexts(node.body);
    }
  });
}
