import { z } from 'zod';
import type { KnowledgeSource } from './schema';

/**
 * What a profile's record must satisfy beyond its types: texts that are
 * really written, links that are really https, ids that are unique, and
 * references that resolve. A violation fails the build, the tests and every
 * script with a path that names the field, such as
 * `experience.2.metrics.0`.
 */

const text = z.string().regex(/\S/, 'Must not be empty');
const localized = z.strictObject({ en: text });
const texts = z.array(localized);
const httpsUrl = z.url({ protocol: /^https$/, error: 'Must be an absolute https URL' });

const metricSchema = z.strictObject({
  value: text,
  label: localized,
  context: text,
  source: text,
});

const roleSchema = z.strictObject({
  id: text,
  company: text,
  aliases: z.array(text).optional(),
  role: text,
  period: text,
  start: z.number(),
  end: z.number().nullable(),
  current: z.boolean(),
  engagement: z.enum(['employment', 'contract']),
  summary: localized,
  responsibilities: texts,
  leadership: texts,
  achievements: texts,
  focus: texts,
  metrics: z.array(text),
  highlights: texts.min(1),
  source: text,
  reference: z.strictObject({ encyclopediaTitle: text }).optional(),
});

const projectSchema = z.strictObject({
  id: text,
  name: text,
  category: localized,
  status: localized,
  live: z.boolean(),
  description: localized,
  scopeLabel: localized,
  scope: texts,
  platforms: texts,
  technologies: z.array(text),
  technologiesSource: text.optional(),
  considerations: texts,
  outcomes: texts,
  links: z.array(z.strictObject({ label: localized, url: httpsUrl })),
  source: text,
});

/** The committed product-site snapshot, which is read from JSON and checked like any input. */
export const sitePassagesSchema = z.array(
  z.strictObject({
    id: z.string().regex(/^site\/[\w-]+\/\d+$/, 'Must be site/<subject id>/<n>'),
    subject: z.strictObject({ kind: z.enum(['project', 'company']), id: text }),
    url: httpsUrl,
    fetchedAt: z.iso.date(),
    language: text,
    text,
  }),
);

const stackArea = z.strictObject({ area: localized, items: localized });

const practiceSchema = z.strictObject({
  designProcess: texts,
  decisionCriteria: texts,
  workflow: texts,
  caseStudies: z.record(z.string(), z.strictObject({ problem: localized, angles: texts })),
  skillDepth: z.array(stackArea),
  toolset: z.array(stackArea),
  fullStack: z.strictObject({ summary: localized, byCompany: texts, ownProducts: localized }),
  aiEngineering: z.strictObject({
    summary: localized,
    tools: texts,
    practices: texts,
    inProducts: localized,
  }),
  leadershipPractice: z.strictObject({ style: localized, balance: localized, habits: texts }),
  studies: texts,
  learningStyle: localized,
  productDepth: z.record(z.string(), localized),
  goals: z.strictObject({ roles: localized, mode: localized, challenges: localized }),
  interests: texts,
  careerArc: texts,
  frontendArchitecture: texts,
  performanceApproach: texts,
  qualityPractices: texts,
  mobileExplorations: localized,
});

const knowledgeSchema = z.strictObject({
  profile: z.strictObject({
    name: text,
    firstName: text,
    initials: text,
    title: localized,
    yearsLabel: localized,
    careerStartYear: z.number().int(),
    specializations: texts,
    summary: localized,
    context: localized,
    focus: localized,
    location: z.strictObject({ country: localized, city: text.nullable() }),
    availability: localized,
    source: text,
  }),
  welcome: z.strictObject({
    heading: localized,
    description: localized,
    placeholder: localized,
    helper: localized,
    evidence: z.strictObject({ roles: z.array(text).min(1), metrics: z.tuple([text, text]) }),
  }),
  assistant: z.strictObject({ name: localized, initials: text }),
  contact: z.strictObject({
    email: z.email(),
    linkedin: httpsUrl,
    github: httpsUrl,
    resumeUrl: z.string().startsWith('/').nullable(),
  }),
  principles: z.array(z.strictObject({ title: localized, text: localized, source: text })),
  metrics: z.record(z.string(), metricSchema),
  experience: z.array(roleSchema).min(1),
  skills: z
    .array(z.strictObject({ id: text, title: localized, items: texts, source: text }))
    .min(1),
  certifications: z.array(z.strictObject({ name: text, issuer: text, source: text })),
  projects: z.array(projectSchema).min(1),
  education: z.strictObject({
    degree: localized,
    school: text,
    schoolShort: text,
    location: localized,
    year: z.number().int(),
    source: text,
  }),
  languages: z.array(
    z.strictObject({
      name: localized,
      level: z.enum(['Native', 'Fluent', 'Intermediate']),
      source: text,
    }),
  ),
  practice: practiceSchema,
  sourceLabels: z.record(z.string(), localized),
  notes: z.strictObject({
    source: text,
    guide: text,
    passages: z.array(z.strictObject({ id: text, text })),
  }),
  productSites: sitePassagesSchema,
  references: z.strictObject({
    technologies: z
      .record(z.string(), text.nullable())
      .refine((technologies) => Object.keys(technologies).length > 0, 'Must list a technology'),
  }),
});

type Path = (string | number)[];
type Report = (message: string, path: Path) => void;

function checkUniqueIds(list: readonly { readonly id: string }[], at: string, report: Report) {
  const seen = new Set<string>();
  list.forEach(({ id }, index) => {
    if (seen.has(id)) report(`Duplicate id "${id}"`, [at, index, 'id']);
    seen.add(id);
  });
}

function checkRoleDates(source: KnowledgeSource, report: Report) {
  let openEnded = 0;
  source.experience.forEach((role, index) => {
    const previous = source.experience[index - 1];
    if (previous && role.start > previous.start) {
      report('Roles must be listed newest first', ['experience', index, 'start']);
    }
    if (role.end !== null && role.start > role.end) {
      report('A role cannot end before it starts', ['experience', index, 'end']);
    }
    if (role.current !== (role.end === null)) {
      report('Only a role without an end is current', ['experience', index, 'current']);
    }
    if (role.end === null && ++openEnded > 1) {
      report('Only one role may have no end', ['experience', index, 'end']);
    }
  });
}

function checkMetrics(source: KnowledgeSource, report: Report) {
  source.experience.forEach((role, index) => {
    role.metrics.forEach((id, position) => {
      const metric = source.metrics[id];
      if (!metric) report(`Unknown metric "${id}"`, ['experience', index, 'metrics', position]);
      else if (metric.context !== role.company) {
        report(`Must name the company that produced it, "${role.company}"`, [
          'metrics',
          id,
          'context',
        ]);
      }
    });
  });
}

/** The evidence line names roles and metrics the record holds. */
function checkEvidence(source: KnowledgeSource, report: Report) {
  const { roles, metrics } = source.welcome.evidence;
  const known = new Set(source.experience.map((role) => role.id));
  roles.forEach((id, position) => {
    if (!known.has(id)) report(`Unknown role "${id}"`, ['welcome', 'evidence', 'roles', position]);
  });
  metrics.forEach((id, position) => {
    if (!(id in source.metrics)) {
      report(`Unknown metric "${id}"`, ['welcome', 'evidence', 'metrics', position]);
    }
  });
}

type Citation = [id: string, path: Path];

function citedBy(section: string, entries: readonly { readonly source: string }[]): Citation[] {
  return entries.map((entry, index) => [entry.source, [section, index, 'source']]);
}

/** Every source the record cites has a label, so an answer can always credit it. */
function checkSources(source: KnowledgeSource, report: Report) {
  const cited: Citation[] = [
    [source.profile.source, ['profile', 'source']],
    [source.education.source, ['education', 'source']],
    [source.notes.source, ['notes', 'source']],
    ...citedBy('experience', source.experience),
    ...citedBy('projects', source.projects),
    ...citedBy('skills', source.skills),
    ...citedBy('principles', source.principles),
    ...citedBy('certifications', source.certifications),
    ...citedBy('languages', source.languages),
    ...Object.entries(source.metrics).map(([id, metric]): Citation => [
      metric.source,
      ['metrics', id, 'source'],
    ]),
  ];
  for (const [id, path] of cited) {
    if (!(id in source.sourceLabels)) report(`Unknown source "${id}"`, path);
  }
}

/** A section retrieval cites as one passage needs one source for all its entries. */
function checkSharedSource(
  section: 'certifications' | 'languages',
  entries: readonly { readonly source: string }[],
  report: Report,
) {
  const [first] = entries;
  entries.forEach((entry, index) => {
    if (first && entry.source !== first.source) {
      report(`Must cite "${first.source}", like the rest of the section`, [
        section,
        index,
        'source',
      ]);
    }
  });
}

function checkPracticeReferences(source: KnowledgeSource, report: Report) {
  const roles = new Set(source.experience.map((role) => role.id));
  for (const id of Object.keys(source.practice.caseStudies)) {
    if (!roles.has(id)) report(`Unknown role "${id}"`, ['practice', 'caseStudies', id]);
  }
  for (const project of source.projects) {
    if (!(project.id in source.practice.productDepth)) {
      report(`Every project needs one`, ['practice', 'productDepth', project.id]);
    }
  }
}

/** A site passage is about something the record holds: one of its projects or companies. */
function checkSiteSubjects(source: KnowledgeSource, report: Report) {
  const known = {
    project: new Set(source.projects.map((project) => project.id)),
    company: new Set(source.experience.map((role) => role.id)),
  };
  source.productSites.forEach(({ subject }, index) => {
    if (!known[subject.kind].has(subject.id)) {
      report(`Unknown ${subject.kind} "${subject.id}"`, ['productSites', index, 'subject', 'id']);
    }
  });
}

/** A project lists technologies only where the record or its own site states them. */
function checkTechnologiesSources(source: KnowledgeSource, report: Report) {
  source.projects.forEach((project, index) => {
    if (project.technologies.length === 0) return;
    const stated = project.technologiesSource;
    const ownPages = source.productSites
      .filter(({ subject }) => subject.kind === 'project' && subject.id === project.id)
      .map(({ url }) => url);
    if (stated === undefined) {
      report('Technologies need the source that states them', [
        'projects',
        index,
        'technologiesSource',
      ]);
    } else if (!(stated in source.sourceLabels) && !ownPages.includes(stated)) {
      report(`Must be a source of the record or a page of the project's site, not "${stated}"`, [
        'projects',
        index,
        'technologiesSource',
      ]);
    }
  });
}

/** The record's schema, for a caller that validates it as part of something larger. */
export const knowledgeRecordSchema = knowledgeSchema.superRefine((parsed, context) => {
  const source = parsed as KnowledgeSource;
  const report: Report = (message, path) => {
    context.addIssue({ code: 'custom', message, path });
  };
  checkUniqueIds(source.experience, 'experience', report);
  checkUniqueIds(source.projects, 'projects', report);
  checkUniqueIds(source.skills, 'skills', report);
  checkRoleDates(source, report);
  checkMetrics(source, report);
  checkEvidence(source, report);
  checkSources(source, report);
  checkSharedSource('certifications', source.certifications, report);
  checkSharedSource('languages', source.languages, report);
  checkPracticeReferences(source, report);
  checkUniqueIds(source.productSites, 'productSites', report);
  checkSiteSubjects(source, report);
  checkTechnologiesSources(source, report);
});

/** Returns the record unchanged, or throws a `ZodError` listing every violation by path. */
export function validateKnowledge(source: KnowledgeSource): KnowledgeSource {
  knowledgeRecordSchema.parse(source);
  return source;
}
