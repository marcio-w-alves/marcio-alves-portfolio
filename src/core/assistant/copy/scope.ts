import type { Knowledge, Metric, Role } from '@/core/knowledge/schema';

/**
 * What a template may name: the record read in one language, its items by
 * id, and facts derived from it the same way for any profile — a role's
 * years, a metric's parts.
 */

export interface RoleFacts extends Role {
  /** The two ends of the role's period, as the period writes them. */
  readonly years: { readonly from: string; readonly to: string };
}

export interface MetricFacts extends Metric {
  /** The value without a leading "~" or a trailing "+": "30%+" → "30%". */
  readonly amount: string;
  /** For a change written "a → b". */
  readonly before?: string;
  readonly after?: string;
  /** How much a change of two counts grew: "1 → 4" → 3. */
  readonly delta?: number;
}

const CHANGE = ' → ';

function roleFacts(role: Role): RoleFacts {
  const [from = '', to = ''] = role.period.split(' — ');
  return { ...role, years: { from, to } };
}

function metricFacts(metric: Metric): MetricFacts {
  const amount = metric.value.replace(/^~|\+$/g, '');
  if (!metric.value.includes(CHANGE)) return { ...metric, amount };
  const [before = '', after = ''] = metric.value.split(CHANGE);
  const delta = Number.parseInt(after, 10) - Number.parseInt(before, 10);
  return Number.isNaN(delta)
    ? { ...metric, amount, before, after }
    : { ...metric, amount, before, after, delta };
}

function byId<Item extends { readonly id: string }>(items: readonly Item[]) {
  return Object.fromEntries(items.map((item) => [item.id, item])) as Readonly<Record<string, Item>>;
}

/** The names every template starts its paths from, over one record. */
export function recordRoots(knowledge: Knowledge): Readonly<Record<string, unknown>> {
  const { profile, contact, education, languages, certifications, skills, principles } = knowledge;
  return {
    first: profile.firstName,
    profile,
    contact,
    education,
    languages,
    certifications,
    skills,
    principles,
    practice: knowledge.practice,
    projects: knowledge.projects,
    experience: knowledge.experience,
    role: byId(knowledge.experience.map(roleFacts)),
    project: byId(knowledge.projects),
    metric: Object.fromEntries(
      Object.entries(knowledge.metrics).map(([metricId, metric]) => [
        metricId,
        metricFacts(metric),
      ]),
    ),
    skillGroup: byId(skills),
  };
}

/**
 * The root a parameterized answer's subject is read through: `role.company`
 * names the subject's field, `role.acme.company` still another role. A record
 * whose ids are also field names would make that ambiguous, so it is refused.
 */
export function subjectRoot(
  subject: object,
  others: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const shadowed = Object.keys(others).find((otherId) => Object.hasOwn(subject, otherId));
  if (shadowed) throw new Error(`The id "${shadowed}" is also the name of a field`);
  return { ...others, ...subject };
}

export function roleFactsOf(knowledge: Knowledge, roleId: string): RoleFacts {
  const role = knowledge.experience.find((item) => item.id === roleId);
  if (!role) throw new Error(`Unknown role "${roleId}".`);
  return roleFacts(role);
}
