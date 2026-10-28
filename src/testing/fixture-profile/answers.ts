import type { AnswerBuilder, AnswerSet } from '@/core/assistant/answer-set';
import { bullets, text, type ResponseKit } from '@/core/assistant/response-kit';
import { SCORED_INTENTS, type ScoredIntent } from '@/core/assistant/system1/router';
import type { TopicQuestion } from '@/core/assistant/topics';

/**
 * The fictional person's answers. Each one states facts read from the kit's
 * record, so a test that changes the record sees the answer follow, and each
 * intent opens with a marker naming it, so a test can tell which answer ran.
 */

const FOLLOW_UPS = [
  "Tell me about Ada's career.",
  'Which skills does she have?',
  'How can I contact Ada?',
];

function scoredAnswers(kit: ResponseKit): Record<ScoredIntent, AnswerBuilder> {
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
      experience.map((role) => `${role.role} at **${role.company}** (${role.period})`).join('; '),
    leadRole: () => `${roleById('acme').leadership.join(' ')} — the payroll platform at Acme.`,
    roleFit: () => `${profile.title}, cutting build times by ${metricValue('acme-build-time')}.`,
    teamGrowth: () => `The Globex platform team went ${metricValue('globex-team')}.`,
    achievements: () =>
      Object.values(knowledge.metrics)
        .map((metric) => metric.value)
        .join(', '),
    location: () => `${profile.location.city ?? ''}, ${profile.location.country}`,
    contact: () => knowledge.contact.email,
    resume: () => `[Download her CV](${knowledge.contact.resumeUrl ?? ''})`,
    education: () => `${knowledge.education.degree}, ${knowledge.education.school}`,
    languages: () => knowledge.languages.map((language) => language.name).join(', '),
    skills: () => knowledge.skills.flatMap((group) => group.items).join(', '),
  };
  const fallback = () => `${profile.name} — ${current?.role ?? ''} at ${current?.company ?? ''}.`;
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
              ? text(`### Where she is headed\n${knowledge.practice.goals.roles}`)
              : null,
            intent === 'achievements' ? metrics(Object.keys(knowledge.metrics)) : null,
            intent === 'roleFit' ? contactOnce(context) : null,
            intent === 'contact' ? contactCard() : null,
          ],
          { followUps: FOLLOW_UPS, sources: [profile.source] },
        ),
    ]),
  ) as Record<ScoredIntent, AnswerBuilder>;
}

export const fixtureAnswers: AnswerSet = {
  vocabulary: { leadRole: [[/\bpayroll\b/, 3]] },
  topics: ({ knowledge, timeline, skills }) => {
    const question = (asked: string, tag: string): TopicQuestion => ({ question: asked, tag });
    const page = (
      label: string,
      intro: string,
      questions: readonly TopicQuestion[] = [question(FOLLOW_UPS[0] ?? '', 'Career')],
    ) => ({
      label,
      intro,
      description: intro,
      questions,
      page: [],
    });
    return {
      overview: page('Overview', `${knowledge.profile.name}, ${knowledge.profile.title}.`, [
        { ...question("Tell me about Ada's career.", 'Career'), short: 'Her career' },
        question('Did she lead the payroll team?', 'Payroll'),
        question('Which skills does she have?', 'Skills'),
      ]),
      experience: {
        ...page(
          'Experience',
          `${String(knowledge.experience.length)} roles since ${String(knowledge.profile.careerStartYear)}.`,
          [
            question("Tell me about Ada's career.", 'Career'),
            question('What did she do at Globex?', 'Globex'),
          ],
        ),
        page: [timeline(), text(bullets(knowledge.practice.careerArc))],
      },
      skills: {
        ...page('Skills', 'Platform skills.', [
          question('Which skills does she have?', 'Skills'),
          question('Does she know React?', 'React'),
        ]),
        page: [skills()],
      },
      projects: page(
        'Projects',
        `${knowledge.projects.map((project) => project.name).join(' and ')}.`,
      ),
      philosophy: page(
        'Philosophy',
        knowledge.principles.map((principle) => principle.title).join(', '),
      ),
      education: page('Education', knowledge.education.school),
    };
  },
  answers: (kit) => {
    const { response, roleById, projectById, knowledge } = kit;
    const plain = (intent: string, line: string, grounded = true) =>
      response(intent, [text(line)], { followUps: FOLLOW_UPS, sources: [], grounded });
    return {
      scored: scoredAnswers(kit),
      greeting: () => plain('greeting', `Hello — I answer about ${knowledge.profile.name}.`),
      privateInfo: () =>
        plain('privateInfo', `That is private to ${knowledge.profile.firstName}.`, false),
      offPurpose: () => plain('offPurpose', 'I only answer about her work.', false),
      unknown: () => plain('unknown', `Not in ${knowledge.profile.firstName}'s record.`, false),
      slowDown: (followUps) =>
        response('rateLimited', [text('Slow down, please.')], {
          followUps: followUps.length > 0 ? followUps : FOLLOW_UPS,
          sources: [],
          grounded: false,
        }),
      company: (roleId) => {
        const role = roleById(roleId);
        return response(
          `company:${roleId}`,
          [text(`${role.role} at **${role.company}** (${role.period}).`)],
          {
            followUps: FOLLOW_UPS,
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
            followUps: FOLLOW_UPS,
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
                .map((item) => `${item.technology.name}: ${String(item.work.length)} roles`)
                .join('\n'),
            ),
          ],
          { followUps: FOLLOW_UPS, sources: [], grounded: false },
        ),
    };
  },
};
