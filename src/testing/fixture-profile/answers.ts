import type { AnswerBuilder, AnswerSet } from '@/core/assistant/answer-set';
import { bullets, text, type ResponseKit } from '@/core/assistant/response-kit';
import {
  SCORED_INTENTS,
  type ScoredIntent,
  type Vocabulary,
} from '@/core/assistant/system1/intents';
import type { TopicQuestion } from '@/core/assistant/topics';

/**
 * The fictional person's answers. Each one states facts read from the kit's
 * record, so a test that changes the record sees the answer follow, and each
 * intent opens with a marker naming it, so a test can tell which answer ran.
 */

/** What the fixture's answers say around the record's facts, in one language. */
interface Phrases {
  /** Her own words for an intent, in this language. */
  readonly vocabulary: Vocabulary;
  readonly followUps: readonly [career: string, skills: string, contact: string];
  readonly at: string;
  readonly payroll: string;
  readonly cutting: string;
  readonly teamWent: (change: string) => string;
  readonly downloadCv: string;
  readonly headed: string;
  readonly hello: (name: string) => string;
  readonly private: (firstName: string) => string;
  readonly offPurpose: string;
  readonly unknown: (firstName: string) => string;
  readonly slowDown: string;
  readonly roles: string;
  readonly topics: {
    readonly ask: (name: string) => string;
    readonly overview: string;
    readonly experience: string;
    readonly rolesSince: (count: string, year: string) => string;
    readonly skills: string;
    readonly platformSkills: string;
    readonly projects: string;
    readonly and: string;
    readonly philosophy: string;
    readonly education: string;
    readonly tags: { readonly career: string; readonly skills: string; readonly payroll: string };
    readonly herCareer: string;
    readonly payrollQuestion: string;
    readonly globexQuestion: string;
    readonly reactQuestion: string;
  };
}

function scoredAnswers(kit: ResponseKit, phrases: Phrases): Record<ScoredIntent, AnswerBuilder> {
  const {
    knowledge,
    response,
    roleById,
    metricValue,
    timeline,
    metrics,
    contactOnce,
    contactCard,
  } = kit;
  const { profile, experience } = knowledge;
  const [current] = experience;
  const facts: Partial<Record<ScoredIntent, () => string>> = {
    career: () =>
      experience
        .map((role) => `${role.role} ${phrases.at} **${role.company}** (${role.period})`)
        .join('; '),
    leadRole: () => `${roleById('acme').leadership.join(' ')} — ${phrases.payroll}`,
    roleFit: () => `${profile.title}, ${phrases.cutting} ${metricValue('acme-build-time')}.`,
    teamGrowth: () => phrases.teamWent(metricValue('globex-team')),
    achievements: () =>
      Object.values(knowledge.metrics)
        .map((metric) => metric.value)
        .join(', '),
    location: () => `${profile.location.city ?? ''}, ${profile.location.country}`,
    contact: () => knowledge.contact.email,
    resume: () => `[${phrases.downloadCv}](${knowledge.contact.resumeUrl ?? ''})`,
    education: () => `${knowledge.education.degree}, ${knowledge.education.school}`,
    languages: () => knowledge.languages.map((language) => language.name).join(', '),
    skills: () => knowledge.skills.flatMap((group) => group.items).join(', '),
  };
  const fallback = () =>
    `${profile.name} — ${current?.role ?? ''} ${phrases.at} ${current?.company ?? ''}.`;
  return Object.fromEntries(
    SCORED_INTENTS.map((intent): [ScoredIntent, AnswerBuilder] => [
      intent,
      (context) =>
        response(
          intent,
          [
            text(`[${intent}] ${(facts[intent] ?? fallback)()}`),
            intent === 'career' ? timeline() : null,
            intent === 'career'
              ? text(`### ${phrases.headed}\n${knowledge.practice.goals.roles}`)
              : null,
            intent === 'achievements' ? metrics(Object.keys(knowledge.metrics)) : null,
            intent === 'roleFit' ? contactOnce(context) : null,
            intent === 'contact' ? contactCard() : null,
          ],
          { followUps: phrases.followUps, sources: [profile.source] },
        ),
    ]),
  ) as Record<ScoredIntent, AnswerBuilder>;
}

function answersIn(phrases: Phrases): AnswerSet {
  const { topics: words, followUps, vocabulary } = phrases;
  return {
    vocabulary,
    topics: ({ knowledge, timeline, skills }) => {
      const question = (asked: string, tag: string): TopicQuestion => ({ question: asked, tag });
      const page = (
        label: string,
        intro: string,
        questions: readonly TopicQuestion[] = [question(followUps[0], words.tags.career)],
      ) => ({
        label,
        intro,
        description: `${label}: ${intro} ${words.ask(knowledge.profile.name)}`,
        questions,
        page: [],
      });
      return {
        overview: page(words.overview, `${knowledge.profile.name}, ${knowledge.profile.title}.`, [
          { ...question(followUps[0], words.tags.career), short: words.herCareer },
          question(words.payrollQuestion, words.tags.payroll),
          question(followUps[1], words.tags.skills),
        ]),
        experience: {
          ...page(
            words.experience,
            words.rolesSince(
              String(knowledge.experience.length),
              String(knowledge.profile.careerStartYear),
            ),
            [question(followUps[0], words.tags.career), question(words.globexQuestion, 'Globex')],
          ),
          page: [timeline(), text(bullets(knowledge.practice.careerArc))],
        },
        skills: {
          ...page(words.skills, words.platformSkills, [
            question(followUps[1], words.tags.skills),
            question(words.reactQuestion, 'React'),
          ]),
          page: [skills()],
        },
        projects: page(
          words.projects,
          `${knowledge.projects.map((project) => project.name).join(` ${words.and} `)}.`,
        ),
        philosophy: page(
          words.philosophy,
          knowledge.principles.map((principle) => principle.title).join(', '),
        ),
        education: page(words.education, knowledge.education.school),
      };
    },
    answers: (kit) => {
      const { response, roleById, projectById, knowledge } = kit;
      const plain = (intent: string, line: string, grounded = true) =>
        response(intent, [text(line)], { followUps, sources: [], grounded });
      return {
        scored: scoredAnswers(kit, phrases),
        greeting: () => plain('greeting', phrases.hello(knowledge.profile.name)),
        privateInfo: () =>
          plain('privateInfo', phrases.private(knowledge.profile.firstName), false),
        offPurpose: () => plain('offPurpose', phrases.offPurpose, false),
        unknown: () => plain('unknown', phrases.unknown(knowledge.profile.firstName), false),
        slowDown: (suggested) =>
          response('rateLimited', [text(phrases.slowDown)], {
            followUps: suggested.length > 0 ? suggested : followUps,
            sources: [],
            grounded: false,
          }),
        company: (roleId) => {
          const role = roleById(roleId);
          return response(
            `company:${roleId}`,
            [text(`${role.role} ${phrases.at} **${role.company}** (${role.period}).`)],
            {
              followUps,
              sources: [role.source],
              related: roleId,
            },
          );
        },
        project: (projectId) => {
          const project = projectById(projectId);
          return response(
            `project:${projectId}`,
            [
              text(`**${project.name}** — ${project.description}`),
              kit.projects([projectId]),
              text(kit.productDepth(projectId)),
            ],
            {
              followUps,
              sources: [project.source],
            },
          );
        },
        technology: (evidence) =>
          response(
            'technology',
            [
              text(
                evidence
                  .map(
                    (item) =>
                      `${item.technology.name}: ${String(item.work.length)} ${phrases.roles}`,
                  )
                  .join('\n'),
              ),
            ],
            { followUps, sources: [], grounded: false },
          ),
      };
    },
  };
}

export const fixtureAnswers = answersIn({
  vocabulary: { leadRole: [[/\bpayroll\b/, 3]] },
  followUps: [
    "Tell me about Ada's career.",
    'Which skills does she have?',
    'How can I contact Ada?',
  ],
  at: 'at',
  payroll: 'the payroll platform at Acme.',
  cutting: 'cutting build times by',
  teamWent: (change) => `The Globex platform team went ${change}.`,
  downloadCv: 'Download her CV',
  headed: 'Where she is headed',
  hello: (name) => `Hello — I answer about ${name}.`,
  private: (firstName) => `That is private to ${firstName}.`,
  offPurpose: 'I only answer about her work.',
  unknown: (firstName) => `Not in ${firstName}'s record.`,
  slowDown: 'Slow down, please.',
  roles: 'roles',
  topics: {
    ask: (name) => `Ask about ${name}'s documented work here.`,
    overview: 'Overview',
    experience: 'Experience',
    rolesSince: (count, year) => `${count} roles since ${year}.`,
    skills: 'Skills',
    platformSkills: 'Platform skills.',
    projects: 'Projects',
    and: 'and',
    philosophy: 'Philosophy',
    education: 'Education',
    tags: { career: 'Career', skills: 'Skills', payroll: 'Payroll' },
    herCareer: 'Her career',
    payrollQuestion: 'Did she lead the payroll team?',
    globexQuestion: 'What did she do at Globex?',
    reactQuestion: 'Does she know React?',
  },
});

/** The same answers in Portuguese, over the record read in Portuguese. */
export const fixturePortugueseAnswers = answersIn({
  // The Portuguese rules read a question without its accents.
  vocabulary: { leadRole: [[/\bfolha de pagamento\b/, 3]] },
  followUps: [
    'Me fale sobre a carreira da Ada.',
    'Quais competências ela tem?',
    'Como posso falar com a Ada?',
  ],
  at: 'na',
  payroll: 'a plataforma de folha de pagamento da Acme.',
  cutting: 'reduzindo o tempo de build em',
  teamWent: (change) => `O time de plataforma da Globex foi de ${change}.`,
  downloadCv: 'Baixe o currículo dela',
  headed: 'Para onde ela está indo',
  hello: (name) => `Olá — eu respondo sobre ${name}.`,
  private: (firstName) => `Isso é assunto particular de ${firstName}.`,
  offPurpose: 'Só respondo sobre o trabalho dela.',
  unknown: (firstName) => `Não está no histórico de ${firstName}.`,
  slowDown: 'Vá com calma, por favor.',
  roles: 'cargos',
  topics: {
    ask: (name) => `Pergunte aqui sobre o trabalho documentado de ${name}.`,
    overview: 'Visão geral',
    experience: 'Experiência',
    rolesSince: (count, year) => `${count} cargos desde ${year}.`,
    skills: 'Competências',
    platformSkills: 'Competências de plataforma.',
    projects: 'Projetos',
    and: 'e',
    philosophy: 'Filosofia',
    education: 'Formação',
    tags: { career: 'Carreira', skills: 'Competências', payroll: 'Folha de pagamento' },
    herCareer: 'A carreira dela',
    payrollQuestion: 'Ela liderou o time de folha de pagamento?',
    globexQuestion: 'O que ela fez na Globex?',
    reactQuestion: 'Ela conhece React?',
  },
});
