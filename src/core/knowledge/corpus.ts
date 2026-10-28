import { siteLabel, siteSourceId } from './product-sites';
import type { Knowledge, Project, SitePassage } from './schema';

/**
 * The knowledge base flattened into categorized passages for retrieval.
 *
 * Each resume statement is its own passage, carrying its company, role and
 * period in the text, so a match is precise and still says where the fact
 * comes from. The owner's knowledge-base document follows as its own passages
 * (see notes.ts): the résumé records what they did, the notes add how they
 * work, what they study and build, and what they are interested in. Passages
 * of the public sites of their products and companies come last, each opening
 * with whose site it is, so a match never reads as the owner's own work. Contact
 * details are deliberately absent: they are served by an action, never
 * retrieved by similarity.
 */

export const CHUNK_CATEGORIES = [
  'profile',
  'experience',
  'skills',
  'education',
  'languages',
  'certifications',
  'projects',
  'principles',
  'notes',
  'product-sites',
] as const;
export type ChunkCategory = (typeof CHUNK_CATEGORIES)[number];

export interface KnowledgeChunk {
  /** Stable across rebuilds, so the index can be checked against the corpus. */
  readonly id: string;
  readonly category: ChunkCategory;
  readonly text: string;
  readonly source: string;
}

function list(items: readonly string[]): string {
  return items.join(', ');
}

function liveProductText(project: Project, owner: string): string {
  const links = project.links.map((link) => link.url).join(', ');
  return `${project.name}, one of ${owner}'s own products with a public site (${project.category}), status: ${project.status}. ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Platforms: ${list(project.platforms)}.${listed('Technologies', project.technologies)}${listed('Outcomes', project.outcomes)} Links: ${links}. Only what those links show is documented — no users, revenue or release dates.`;
}

/** A labelled list, or nothing when the record documents none. */
function listed(label: string, items: readonly string[]): string {
  return items.length > 0 ? ` ${label}: ${list(items)}.` : '';
}

function conceptText(project: Project, owner: string): string {
  return `${project.name}, one of ${owner}'s product concepts (${project.category}): ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Only planned scope is documented — no implementation, users, revenue or release dates.`;
}

/**
 * One passage for a whole section of the record, credited to the section: its
 * entries share one source. A section with no entries has nothing to say.
 */
function sectionPassage(
  category: 'certifications' | 'languages',
  entries: readonly { readonly source: string }[],
  text: string,
): KnowledgeChunk[] {
  const [first] = entries;
  return first ? [{ id: category, category, text, source: first.source }] : [];
}

const SUBJECT_NOUN = { project: 'product', company: 'company' } as const;

function subjectName({ projects, experience }: Knowledge, { subject }: SitePassage): string {
  const name =
    subject.kind === 'project'
      ? projects.find((project) => project.id === subject.id)?.name
      : experience.find((role) => role.id === subject.id)?.company;
  if (name === undefined) throw new Error(`Unknown site subject "${subject.id}".`);
  return name;
}

function sitePassage(knowledge: Knowledge, passage: SitePassage): KnowledgeChunk {
  const name = subjectName(knowledge, passage);
  return {
    id: passage.id,
    category: 'product-sites',
    text: `From the public website of ${name} (${siteLabel(passage.url)}), describing the ${SUBJECT_NOUN[passage.subject.kind]} itself:\n${passage.text}`,
    source: siteSourceId(passage.url),
  };
}

export function buildCorpus(knowledge: Knowledge): KnowledgeChunk[] {
  return [
    ...recordPassages(knowledge),
    ...knowledge.productSites.map((passage) => sitePassage(knowledge, passage)),
  ];
}

function recordPassages({
  profile,
  experience,
  skills,
  certifications,
  education,
  languages,
  projects,
  principles,
  notes,
}: Knowledge): KnowledgeChunk[] {
  return [
    {
      id: 'profile',
      category: 'profile',
      text: `Professional profile of ${profile.name}, ${profile.title}, with ${profile.yearsLabel} of experience since ${String(profile.careerStartYear)}. ${profile.summary} ${profile.context} ${profile.focus} Specializations: ${list(profile.specializations)}. Based in ${profile.location.country}. Availability: ${profile.availability}.`,
      source: profile.source,
    },
    ...experience.flatMap((role): KnowledgeChunk[] => [
      {
        id: `role:${role.id}`,
        category: 'experience',
        text: `${role.company} — ${role.role}, ${role.period}${role.current ? ' (current role)' : ''}${role.engagement === 'contract' ? ' (contract)' : ''}. ${role.summary}`,
        source: role.source,
      },
      ...role.highlights.map((statement, index): KnowledgeChunk => ({
        id: `role:${role.id}:${String(index)}`,
        category: 'experience',
        text: `${role.company} (${role.role}, ${role.period}): ${statement}`,
        source: role.source,
      })),
    ]),
    ...skills.map((group): KnowledgeChunk => ({
      id: `skills:${group.id}`,
      category: 'skills',
      text: `Skills — ${group.title}: ${list(group.items)}.`,
      source: group.source,
    })),
    ...sectionPassage(
      'certifications',
      certifications,
      `Certifications, which are courses and not professional experience: ${list(certifications.map((item) => `${item.name} (${item.issuer})`))}.`,
    ),
    {
      id: 'education',
      category: 'education',
      text: `Education: ${education.degree} from ${education.school} (${education.schoolShort}), ${education.location}, completed in ${String(education.year)}.`,
      source: education.source,
    },
    ...sectionPassage(
      'languages',
      languages,
      `Languages: ${list(languages.map((language) => `${language.name} (${language.level})`))}.`,
    ),
    ...projects.map((project): KnowledgeChunk => ({
      id: `project:${project.id}`,
      category: 'projects',
      text: project.live
        ? liveProductText(project, profile.firstName)
        : conceptText(project, profile.firstName),
      source: project.source,
    })),
    ...principles.map((principle, index): KnowledgeChunk => ({
      id: `principle:${String(index)}`,
      category: 'principles',
      text: `Engineering principle — ${principle.title}: ${principle.text}`,
      source: principle.source,
    })),
    ...notes.passages.map((note): KnowledgeChunk => ({
      id: `notes:${note.id}`,
      category: 'notes',
      text: note.text,
      source: notes.source,
    })),
  ];
}
