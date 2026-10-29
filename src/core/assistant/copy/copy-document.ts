import { z } from 'zod';
import { TOPIC_IDS } from '../../chat/topic-id';
import { SCORED_INTENTS } from '../system1/intents';

/**
 * The shape of a profile's copy documents, per language: the answers, the
 * topic pages, the router vocabulary, the answers' card labels, shared facts
 * and strings, the interface overrides and the about page. Every text is a
 * template (`template.ts`) except the labels and the overrides, which keep the
 * interface's single-brace `{firstName}` placeholders the browser fills.
 *
 * The documents sit at these paths under a bundle's `copy/<locale>/`:
 * `answers/*.yaml` (one top-level key per answer id; the split into files is
 * free), `topics.yaml`, `vocabulary.yaml`, `labels.yaml`, `facts.yaml`,
 * `ui.yaml`, `site.yaml` and `about.yaml` (the last two optional with facts).
 */

/** Decoded documents by path relative to `copy/<locale>/`, as the bundle reader hands them over. */
export type CopyDocuments = Readonly<Record<string, unknown>>;

const template = z.string();
const name = z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/, 'Must be a name');
const id = z.string().regex(/\S/);

/** A field of a parameterized answer may differ by the role or project it is about. */
function byId<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.strictObject({ byId: z.record(id, schema), default: schema })]);
}

const when = z.string().optional();
const ids = z.array(id);
const all = z.literal('all');
const from = z.strictObject({ from: z.string() });

const partSchema = z.union([
  z.strictObject({ text: template, when }),
  z.strictObject({
    note: z.strictObject({ tone: z.enum(['inference', 'example', 'info']), text: template }),
    when,
  }),
  z.strictObject({ details: z.strictObject({ summary: template, text: template }), when }),
  z.strictObject({
    table: z.strictObject({
      columns: z.array(template),
      rows: z.union([
        z.array(z.array(template)),
        z.strictObject({ each: z.string(), cells: z.array(template) }),
      ]),
      caption: template.optional(),
    }),
    when,
  }),
  z.strictObject({ metrics: z.union([all, ids, from]), when }),
  z.strictObject({ timeline: z.union([all, ids]), when }),
  z.strictObject({ skills: z.union([all, ids]), when }),
  z.strictObject({ projects: z.union([all, ids, from]), when }),
  z.strictObject({ contactCard: z.literal(true), when }),
  z.strictObject({ contactOnce: z.literal(true), when }),
]);

export type PartDocument = z.infer<typeof partSchema>;

/**
 * Where an answer is credited from: a source id (or a template naming one),
 * one that applies only `when` a condition holds, or a set the core computes —
 * `$roles` (every role's source), `$sites` (the public pages read about the
 * answer's role or project) and `$evidence` (where a technology appears).
 */
const sourceSchema = z.union([template, z.strictObject({ id: template, when: z.string() })]);

const stringsSchema = z.record(name, byId(z.union([template, z.record(z.string(), template)])));

const answerSchema = z.strictObject({
  parts: z.array(partSchema),
  followUps: byId(z.array(template)),
  sources: z.array(sourceSchema),
  related: template.optional(),
  /** True by default; a condition where it depends on the answer's subject. */
  grounded: z.union([z.boolean(), z.string()]).optional(),
  strings: stringsSchema.optional(),
  /** Why this translation names other facts than its English twin. */
  factsDiffer: z.string().regex(/\S/, 'Say why the facts differ').optional(),
  /** The skill groups an answer about an undocumented technology shows and cites instead. */
  fallbackSkillGroups: ids.optional(),
});

export type AnswerDocument = z.infer<typeof answerSchema>;

/** The answers that are not scored intents, each bound by the core to its own parameters. */
export const FIXED_ANSWERS = [
  'greeting',
  'privateInfo',
  'offPurpose',
  'unknown',
  'slowDown',
  'company',
  'project',
  'technology',
] as const;

export type FixedAnswer = (typeof FIXED_ANSWERS)[number];

const ANSWER_IDS = new Set<string>([...SCORED_INTENTS, ...FIXED_ANSWERS]);

export const answersDocumentSchema = z
  .record(z.string(), answerSchema)
  .superRefine((answers, context) => {
    for (const answerId of Object.keys(answers)) {
      if (!ANSWER_IDS.has(answerId)) {
        context.addIssue({
          code: 'custom',
          message: `"${answerId}" is not an answer the assistant gives`,
          path: [answerId],
        });
      }
    }
  });

const topicSchema = z.strictObject({
  label: template,
  intro: template,
  description: template,
  questions: z.array(
    z.strictObject({ question: template, tag: template, short: template.optional() }),
  ),
  page: z.array(partSchema),
  factsDiffer: z.string().regex(/\S/, 'Say why the facts differ').optional(),
});

export type TopicDocument = z.infer<typeof topicSchema>;

export const topicsDocumentSchema = z.strictObject(
  Object.fromEntries(TOPIC_IDS.map((topic) => [topic, topicSchema])) as Record<
    (typeof TOPIC_IDS)[number],
    typeof topicSchema
  >,
);

const ruleSchema = z.strictObject({
  pattern: z.string().min(1),
  weight: z.number().positive(),
  flags: z
    .string()
    .regex(/^[iu]*$/, 'Flags may only be i and u')
    .optional(),
});

export const vocabularyDocumentSchema = z.partialRecord(
  z.enum(SCORED_INTENTS),
  z.array(ruleSchema),
);

const label = z.string().regex(/\S/);

export const labelsDocumentSchema = z.strictObject({
  roleSections: z.strictObject({
    responsibilities: label,
    impact: label,
    leadership: label,
    achievements: label,
    focus: label,
  }),
  badges: z.strictObject({ current: label, contract: label }),
  cards: z.strictObject({
    metrics: label,
    skills: label,
    skillsUnit: label,
    timeline: label,
    table: label,
  }),
  project: z.strictObject({
    card: label,
    platforms: label,
    technologies: label,
    considerations: label,
    outcomes: label,
  }),
  notes: z.strictObject({ inference: label, example: label, info: label }),
  links: z.strictObject({ opensInNewTab: label, pdfOpensInNewTab: label }),
  contact: z.strictObject({
    heading: label,
    text: label,
    email: label,
    linkedin: label,
    resume: label,
    github: label,
  }),
});

export const factsDocumentSchema = z.strictObject({
  /** Named parts of a record text, read once by a regular expression that must match exactly once. */
  extract: z
    .record(
      name,
      z.strictObject({
        from: z.string(),
        pattern: z.string().min(1),
        groups: z.array(name).min(1),
      }),
    )
    .optional(),
  /** Strings every answer and topic may read, such as how a language's level is written. */
  strings: stringsSchema.optional(),
  /**
   * The intents this profile chooses not to answer. The router still scores
   * them from its generic rules, so an answer that simply went missing is a
   * defect; naming it here says the omission is meant, and the fast path
   * leaves those questions to the model.
   */
  omit: z.array(z.enum(SCORED_INTENTS)).optional(),
});

/** An interface catalog's overrides: messages, plurals and lists, nested as the catalog nests them. */
export interface CatalogOverrides {
  readonly [key: string]: string | readonly string[] | CatalogOverrides;
}

export const overridesDocumentSchema: z.ZodType<CatalogOverrides> = z.lazy(() =>
  z.record(z.string(), z.union([z.string(), z.array(z.string()), overridesDocumentSchema])),
);

export const aboutDocumentSchema = z.strictObject({
  label: template,
  title: template,
  description: template,
  markdown: template,
});
