import type { AssistantResponse } from '@/core/assistant/response';
import { text, type ResponseKit } from '@/core/assistant/response-kit';
import type { TechnologyEvidence } from '@/core/assistant/system1/technologies';

/**
 * The answers that mark the edges of what this assistant does: greetings,
 * what it is, refusals, technologies weighed against the record, and the
 * honest fallback when nothing better is available.
 */
export function createBoundaryAnswers(kit: ResponseKit) {
  const { response, skills, note } = kit;
  const first = kit.knowledge.profile.firstName;

  const CORE_FOLLOW_UPS = [
    `Tell me about ${first}'s career.`,
    'What are his biggest technical achievements?',
    `How can I contact ${first}?`,
  ];

  function greeting(): AssistantResponse {
    return response(
      'greeting',
      [
        text(
          `Hi! I'm the assistant for ${first}'s portfolio. I answer questions using his documented professional experience — career, skills, products and how he works.`,
        ),
      ],
      { followUps: CORE_FOLLOW_UPS, sources: [] },
    );
  }

  function identity(): AssistantResponse {
    return response(
      'identity',
      [
        text(
          `I'm not ${first} — I'm an assistant that represents his professional portfolio. I answer from his documented experience, and when something isn't documented I'll say so rather than guess. To talk to ${first} directly, use the contact options.`,
        ),
      ],
      {
        followUps: [
          `How can I contact ${first}?`,
          `Tell me about ${first}'s career.`,
          'What projects is he working on?',
        ],
        sources: [],
      },
    );
  }

  function privateInfo(): AssistantResponse {
    return response(
      'privateInfo',
      [
        text(
          `That's outside what this portfolio covers. I only share professional information ${first} has chosen to document: his experience, skills, products, education and how to contact him.`,
        ),
      ],
      {
        followUps: [
          `Tell me about ${first}'s career.`,
          `How can I contact ${first}?`,
          'What are his strongest technical skills?',
        ],
        sources: [],
        grounded: false,
      },
    );
  }

  function offPurpose(): AssistantResponse {
    return response(
      'offPurpose',
      [
        text(
          `I can't change how I work or step outside this portfolio, but I'm happy to answer questions about ${first}'s professional experience.`,
        ),
      ],
      {
        followUps: [
          `Tell me about ${first}'s career.`,
          'What scope has he worked at?',
          'What projects is he working on?',
        ],
        sources: [],
        grounded: false,
      },
    );
  }

  function describe(evidence: TechnologyEvidence): string {
    const { technology, work, skills: listed, coursework } = evidence;
    if (work.length > 0 || listed.length > 0) {
      const lines = [
        ...work.map((item) => `- **${item.company}** — ${item.statement}`),
        ...(listed.length > 0 ? [`- **Listed skills** — ${listed.join(', ')}`] : []),
      ];
      return `**${technology.name}** appears in his documented experience:\n\n${lines.join('\n')}`;
    }
    const study =
      coursework.length > 0
        ? ` He has completed coursework on it — ${coursework.join(' and ')} — but no professional use is documented.`
        : '';
    return `I don't have documented information about ${first} working with **${technology.name}** in his roles, so I can't say how experienced he is with it.${study}`;
  }

  const DOCUMENTED_STACK_GROUPS = ['frontend', 'backend'];
  const stackSources = kit.knowledge.skills
    .filter((group) => DOCUMENTED_STACK_GROUPS.includes(group.id))
    .map((group) => group.source);
  const DOCUMENTED_STACK =
    'His documented stack is React, TypeScript and Next.js on the frontend, and Node.js and REST APIs on the backend.';

  /**
   * Reports exactly where each technology appears in the record — work, listed
   * skill, coursework or nowhere — without upgrading one into another.
   */
  function technology(evidence: readonly TechnologyEvidence[]): AssistantResponse {
    const documented = evidence.some((item) => item.work.length > 0 || item.skills.length > 0);
    const sources = new Set(
      evidence.flatMap((item) => [
        ...item.sources.work,
        ...item.sources.skills,
        ...(documented ? [] : stackSources),
        ...item.sources.coursework,
      ]),
    );
    const answer = evidence.map(describe).join('\n\n');
    return response(
      'technology',
      [
        text(documented ? answer : `${answer} ${DOCUMENTED_STACK}`),
        documented ? null : skills(DOCUMENTED_STACK_GROUPS),
      ],
      {
        followUps: [
          'How experienced is he with React and TypeScript?',
          'Has he worked with backend systems?',
          `How can I contact ${first}?`,
        ],
        sources: [...sources],
        grounded: documented,
      },
    );
  }

  /** The answer of last resort, used only when the model-backed path is unavailable. */
  function unknown(): AssistantResponse {
    return response(
      'unknown',
      [
        text(
          "I don't have enough documented information to answer that accurately, and I'd rather not guess. Here is what I can cover instead:\n\n" +
            '- His career and the companies he worked for\n' +
            '- Measurable results, architecture and performance work\n' +
            '- Technical skills, leadership and his own products\n' +
            '- Education, languages and how to contact him',
        ),
        note(
          'info',
          'The full assistant is temporarily unavailable, so only documented topics can be answered right now.',
        ),
      ],
      { followUps: CORE_FOLLOW_UPS, sources: [], grounded: false },
    );
  }

  /**
   * For a visitor who has used up their share of model answers. Not an error:
   * the suggested questions are answered by the fast path, so they keep working
   * at no cost while the limit resets.
   */
  function slowDown(followUps: readonly string[]): AssistantResponse {
    return response(
      'rateLimited',
      [
        text(
          "You've asked a lot in a short time, so the full assistant is pausing for a few minutes. The suggested questions below are answered instantly and still work.",
        ),
      ],
      {
        followUps: followUps.length > 0 ? followUps : CORE_FOLLOW_UPS,
        sources: [],
        grounded: false,
      },
    );
  }

  return { greeting, identity, privateInfo, offPurpose, technology, unknown, slowDown };
}
