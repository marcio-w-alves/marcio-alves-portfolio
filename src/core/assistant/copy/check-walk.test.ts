import { describe, expect, it } from 'vitest';
import type { Locale } from '@/core/i18n/locale';
import { recordFigures } from '@/core/knowledge/figures';
import { localize } from '@/core/knowledge/localize';
import { answersFrom } from '@/testing/copy-answers';
import { exampleCopy } from '@/testing/copy-documents';
import { textAnswer, withAnswer, withDocument } from '@/testing/copy-variants';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { withRole } from '@/testing/fixture-profile/variants';
import type { KnowledgeSource } from '../../knowledge/schema';
import { checkCopyAlignment, checkLocaleCopy } from './check';
import type { CopyDocuments } from './copy-document';

/** The checker reads every place a copy can name a fact, and says where each problem is. */

function problems(documents: CopyDocuments, record: KnowledgeSource = fixtureKnowledge): string[] {
  const locale: Locale = 'en';
  return checkLocaleCopy(documents, {
    locale,
    limits: {},
    identity: {},
    knowledge: localize(record, locale),
    figures: recordFigures(record),
  });
}

const example = () => exampleCopy('en');
const planted = 'answers/planted.yaml';

describe('every place an answer names a fact', () => {
  const everywhere = {
    parts: [
      {
        table: {
          columns: ['{{profile.inColumn}}'],
          rows: [['{{profile.inCell}}']],
          caption: '{{profile.inCaption}}',
        },
      },
      { table: { columns: ['Role'], rows: { each: 'experience', cells: ['{{.inEachCell}}'] } } },
      { details: { summary: '{{profile.inSummary}}', text: '{{profile.inDetails}}' } },
      { note: { tone: 'info', text: '{{profile.inNote}}' } },
      { metrics: { from: 'profile.inFrom' } },
      { text: 'Shown when it can be.', when: 'profile.inWhen' },
    ],
    followUps: ['{{profile.inFollowUp}}'],
    related: '{{profile.inRelated}}',
    grounded: 'profile.inGrounded',
    sources: [{ id: '{{profile.inSource}}', when: 'profile.inSourceWhen' }],
  };

  it.each([
    'inColumn',
    'inCell',
    'inCaption',
    'inEachCell',
    'inSummary',
    'inDetails',
    'inNote',
    'inFrom',
    'inWhen',
    'inFollowUp',
    'inRelated',
    'inGrounded',
    'inSource',
    'inSourceWhen',
  ])('is checked: %s', (name) => {
    const found = problems(withAnswer(example(), 'achievements', everywhere)).join('\n');
    expect(found).toContain(`there is no "${name}"`);
  });
});

describe('ids', () => {
  it.each([
    ['timeline', { timeline: ['hooli'] }, 'the record has no role "hooli"'],
    ['skills', { skills: ['cooking'] }, 'the record has no skill group "cooking"'],
    ['projects', { projects: ['moonshot'] }, 'the record has no project "moonshot"'],
  ])('a %s part lists only ids the record has', (_kind, part, problem) => {
    const answer = { ...textAnswer('x'), parts: [part] };
    expect(problems(withAnswer(example(), 'career', answer))).toContain(
      `${planted}#career.parts[0]: ${problem}`,
    );
  });

  it('a topic page lists only ids the record has', () => {
    const documents = withDocument(example(), 'topics.yaml', (topics) => ({
      ...topics,
      skills: { ...(topics.skills as object), page: [{ skills: ['cooking'] }] },
    }));
    expect(problems(documents)).toContain(
      'topics.yaml#skills.page[0]: the record has no skill group "cooking"',
    );
  });

  it('byId belongs only to the answers about a role or a project', () => {
    const answer = { ...textAnswer('x'), followUps: { byId: { acme: ['?'] }, default: ['?'] } };
    expect(problems(withAnswer(example(), 'career', answer))).toContain(
      `${planted}#career.followUps.byId.acme: byId belongs to the company and project answers`,
    );
  });

  it('the stand-in skill groups are groups the record has', () => {
    const technology = { ...textAnswer('x'), fallbackSkillGroups: ['cooking'] };
    expect(problems(withAnswer(example(), 'technology', technology))).toContain(
      `${planted}#technology.fallbackSkillGroups: the record has no skill group "cooking"`,
    );
  });

  it('a role id may not also be the name of a field', () => {
    const record = withRole(fixtureKnowledge, 'initech', { id: 'company' });
    expect(problems(example(), record)).toContainEqual(
      expect.stringContaining('The id "company" is also the name of a field'),
    );
  });

  it('an answer is asked only about roles the record has', () => {
    expect(() => answersFrom(textAnswer('x'), 'company').company('hooli')).toThrow(
      'Unknown role "hooli".',
    );
  });
});

describe('rendering', () => {
  it.each([
    [
      'a set of sources outside the answers that have one',
      { ...textAnswer('x'), sources: ['$sites'] },
      'career',
      `career: ${planted}#career.sources[0]:1:1: $sites has no meaning in this answer`,
    ],
    [
      'rows read from something that is not a list',
      {
        ...textAnswer('x'),
        parts: [{ table: { columns: ['x'], rows: { each: 'first', cells: ['x'] } } }],
      },
      'career',
      `career: ${planted}#career.parts[0].table.rows.each:1:1: The rows must be a list`,
    ],
    [
      'ids read from something that is not one',
      { ...textAnswer('x'), parts: [{ metrics: { from: 'role.acme.current' } }] },
      'career',
      `career: ${planted}#career.parts[0].from:1:1: Must name an id or a list of ids`,
    ],
    [
      'a contact card offered once outside a conversation',
      { ...textAnswer('x'), parts: [{ contactOnce: true }] },
      'greeting',
      `greeting: ${planted}#greeting.parts[0]:1:1: contactOnce needs a conversation`,
    ],
  ])('fails on %s', (_case, answer, answerId, problem) => {
    expect(problems(withAnswer(example(), answerId, answer))).toContain(problem);
  });

  it('renders every topic page', () => {
    const documents = withDocument(example(), 'topics.yaml', (topics) => ({
      ...topics,
      skills: { ...(topics.skills as object), intro: '{{role.globex.leadership | first}}' },
    }));
    expect(problems(documents)).toContain(
      'topics: topics.yaml#skills.intro:1:1: Nothing to write here',
    );
  });

  it('renders the about page', () => {
    const documents = {
      ...example(),
      'about.yaml': {
        label: 'About',
        title: 'T',
        description: 'D',
        markdown: '{{limits.missing}}',
      },
    };
    expect(problems(documents)).toContain(
      'about: about.yaml#markdown:1:1: Unknown path "limits.missing": there is no "missing"',
    );
  });
});

describe('documents that do not compile', () => {
  it('report their problems instead of the checks', () => {
    expect(problems(withAnswer(example(), 'greeting', textAnswer('{{first')))).toEqual([
      `${planted}#greeting.parts[0].text:1:1: Unclosed tag: missing "}}"`,
    ]);
  });

  it('refuse a string an answer and the shared facts both name', () => {
    const documents = withDocument(example(), 'facts.yaml', () => ({ strings: { intro: 'Hi.' } }));
    const answer = { ...textAnswer('{{strings.intro}}'), strings: { intro: 'Hello.' } };
    expect(problems(withAnswer(documents, 'greeting', answer))).toEqual([
      `${planted}#greeting.strings.intro: facts.yaml already names a string "intro"`,
    ]);
  });

  it('refuse an extraction whose pattern is not a regular expression', () => {
    const documents = withDocument(example(), 'facts.yaml', () => ({
      extract: { award: { from: 'experience | map role', pattern: '(', groups: ['name'] } },
    }));
    expect(problems(documents)).toEqual([
      'facts.yaml#extract.award.pattern: "(" is not a valid regular expression',
    ]);
  });

  it('keep a translation from being compared until both copies compile', () => {
    const broken = withAnswer(exampleCopy('pt-BR'), 'greeting', textAnswer('{{first'));
    expect(checkCopyAlignment(example(), broken, 'pt-BR')).toEqual([
      `${planted}#greeting.parts[0].text:1:1: Unclosed tag: missing "}}"`,
    ]);
  });
});

describe('a translated topic', () => {
  const portugueseWith = (edit: (topic: object) => object) =>
    withDocument(exampleCopy('pt-BR'), 'topics.yaml', (topics) => ({
      ...topics,
      education: edit(topics.education as object),
    }));

  it('names the facts its English twin names', () => {
    const changed = portugueseWith((topic) => ({ ...topic, intro: '{{education.degree}}' }));
    expect(checkCopyAlignment(example(), changed, 'pt-BR')).toEqual([
      'topics.yaml#education: the pt-BR copy names education.degree, which English does not — say the same facts, or why not in factsDiffer',
    ]);
  });

  it('leaves out no fact its English twin names', () => {
    const changed = portugueseWith((topic) => ({
      ...topic,
      intro: 'Formação.',
      description: 'Formação. Pergunte sobre {{profile.name}}.',
    }));
    expect(checkCopyAlignment(example(), changed, 'pt-BR')).toEqual([
      'topics.yaml#education: the pt-BR copy leaves out education.school, which English names — say the same facts, or why not in factsDiffer',
    ]);
  });

  it('may differ when it says why', () => {
    const changed = portugueseWith((topic) => ({
      ...topic,
      intro: '{{education.degree}}',
      description: 'Formação: {{education.degree}}',
      factsDiffer: 'Portuguese readers know the degree better than the school.',
    }));
    expect(checkCopyAlignment(example(), changed, 'pt-BR')).toEqual([]);
  });
});
