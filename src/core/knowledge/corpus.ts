import { DEFAULT_LOCALE } from '../i18n/locale';
import { localize } from './localize';
import { list, PASSAGE_PHRASES, type PassagePhrases } from './passage-phrases';
import { siteLabel, siteSourceId } from './product-sites';
import type { Knowledge, KnowledgeSource, SitePassage } from './schema';
import { writtenLocales } from './translations';

/**
 * The knowledge base flattened into categorized passages for retrieval.
 *
 * Each resume statement is its own passage, carrying its company, role and
 * period in the text, so a match is precise and still says where the fact
 * comes from. The record's passages are written in every language the record
 * is, so a question finds its facts in the language it is asked in. The
 * owner's knowledge-base document follows as its own passages (see notes.ts),
 * in the one language it is written in: the résumé records what they did, the
 * notes add how they work, what they study and build, and what they are
 * interested in. Passages of the public sites of their products and companies
 * come last, in the site's own language, each opening with whose site it is,
 * so a match never reads as the owner's own work. Contact details are
 * deliberately absent: they are served by an action, never
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
  /** Unique in the corpus and stable across rebuilds, so the index can be checked against it. */
  readonly id: string;
  /**
   * What the passage says, the same in every language it is written in
   * (`role:<id>` for `en/role:<id>` and `pt-BR/role:<id>`), so a search cites
   * one fact once.
   */
  readonly baseId: string;
  readonly category: ChunkCategory;
  readonly text: string;
  readonly source: string;
}

/**
 * Every passage of the record once per language it is written in, each id
 * prefixed with its language (`en/role:<id>`), followed by the passages
 * written in one language only: the owner's notes and the public sites, in
 * their own words.
 */
export function buildCorpus(source: KnowledgeSource): KnowledgeChunk[] {
  const english = localize(source, DEFAULT_LOCALE);
  return [
    ...writtenLocales(source).flatMap((locale) =>
      recordPassages(localize(source, locale), PASSAGE_PHRASES[locale]).map(
        (passage): KnowledgeChunk => ({ ...passage, id: `${locale}/${passage.baseId}` }),
      ),
    ),
    ...notePassages(english),
    ...english.productSites.map((passage) => sitePassage(english, passage)),
  ];
}

type RecordPassage = Omit<KnowledgeChunk, 'id'>;

/**
 * One passage for a whole section of the record, credited to the section: its
 * entries share one source. A section with no entries has nothing to say.
 */
function sectionPassage(
  category: 'certifications' | 'languages',
  entries: readonly { readonly source: string }[],
  text: string,
): RecordPassage[] {
  const [first] = entries;
  return first ? [{ baseId: category, category, text, source: first.source }] : [];
}

function recordPassages(
  {
    profile,
    experience,
    skills,
    certifications,
    education,
    languages,
    projects,
    principles,
  }: Knowledge,
  phrases: PassagePhrases,
): RecordPassage[] {
  return [
    {
      baseId: 'profile',
      category: 'profile',
      text: phrases.profile(profile),
      source: profile.source,
    },
    ...experience.flatMap((role): RecordPassage[] => [
      {
        baseId: `role:${role.id}`,
        category: 'experience',
        text: phrases.role(role),
        source: role.source,
      },
      ...role.highlights.map((statement, index): RecordPassage => ({
        baseId: `role:${role.id}:${String(index)}`,
        category: 'experience',
        text: `${role.company} (${role.role}, ${role.period}): ${statement}`,
        source: role.source,
      })),
    ]),
    ...skills.map((group): RecordPassage => ({
      baseId: `skills:${group.id}`,
      category: 'skills',
      text: phrases.skills(group),
      source: group.source,
    })),
    ...sectionPassage(
      'certifications',
      certifications,
      phrases.certifications(list(certifications.map((item) => `${item.name} (${item.issuer})`))),
    ),
    {
      baseId: 'education',
      category: 'education',
      text: phrases.education(education),
      source: education.source,
    },
    ...sectionPassage('languages', languages, phrases.languages(languages)),
    ...projects.map((project): RecordPassage => ({
      baseId: `project:${project.id}`,
      category: 'projects',
      text: project.live
        ? phrases.liveProduct(project, profile.firstName)
        : phrases.concept(project, profile.firstName),
      source: project.source,
    })),
    ...principles.map((principle, index): RecordPassage => ({
      baseId: `principle:${String(index)}`,
      category: 'principles',
      text: phrases.principle(principle),
      source: principle.source,
    })),
  ];
}

function notePassages({ notes }: Knowledge): KnowledgeChunk[] {
  return notes.passages.map((note): KnowledgeChunk => {
    const id = `notes:${note.id}`;
    return { id, baseId: id, category: 'notes', text: note.text, source: notes.source };
  });
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
    baseId: passage.id,
    category: 'product-sites',
    text: `From the public website of ${name} (${siteLabel(passage.url)}), describing the ${SUBJECT_NOUN[passage.subject.kind]} itself:\n${passage.text}`,
    source: siteSourceId(passage.url),
  };
}
