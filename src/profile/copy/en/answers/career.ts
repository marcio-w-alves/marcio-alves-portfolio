import type { AssistantResponse, ConversationContext } from '@/core/assistant/response';
import {
  bullets,
  details,
  note,
  table,
  text,
  type ResponseKit,
} from '@/core/assistant/response-kit';
import { article, createFacts } from './facts';

/**
 * Answers about career, impact and leadership. Every claim maps to a record
 * in the knowledge base; what the record does not document is left out
 * rather than inferred.
 */
export function createCareerAnswers(kit: ResponseKit) {
  const { roleById, allRoleSources, contactOnce, metrics, response, timeline, knowledge } = kit;
  const { practice } = knowledge;
  const {
    first,
    experience,
    employer,
    title,
    period,
    years,
    startMonth,
    product: productName,
    metric,
    amount,
    before,
    after,
    countsInWords,
  } = createFacts(kit);
  const team = countsInWords('roots-team');
  const peopleList = countsInWords('deel-people-list');

  function career(): AssistantResponse {
    return response(
      'career',
      [
        text(
          `${first} is a frontend engineer with **${experience}** of professional experience. He started in ${String(knowledge.profile.careerStartYear)} as a freelance web developer and grew into senior and lead frontend roles — helping lead the HRIS team at **${employer('deel')}** (${period('deel')}) and, since ${startMonth('way2b1')}, as ${article(title('way2b1'))} ${title('way2b1')} at **${employer('way2b1')}**, working full stack across a small startup's product suite.\n\n` +
            'Across those roles the thread is consistent: React and Next.js architecture, performance, developer experience and technical leadership, with engineering work tied to product needs and user impact.',
        ),
        text(`### How his scope grew\n${bullets(practice.careerArc)}`),
        timeline(),
        text('A few documented outcomes along the way:'),
        metrics(['deel-critical-load', 'deel-web-vitals', 'deel-people-list', 'roots-team']),
        text(`### What he is looking for next\n${practice.goals.roles} ${practice.goals.mode}`),
      ],
      {
        followUps: [
          `What has he built at ${employer('deel')}?`,
          'Has he led engineering teams?',
          'What projects is he working on?',
        ],
        sources: ['profile', ...allRoleSources(), 'notes'],
        related: 'deel',
      },
    );
  }

  function roleFit(context: ConversationContext): AssistantResponse {
    return response(
      'roleFit',
      [
        text(
          `${first} has several characteristics associated with Staff-level frontend engineering: deep technical expertise, ownership of architectural decisions, measurable product improvements and a track record of mentoring engineers.\n\n` +
            `At **${employer('deel')}**, he helped lead the HRIS team, standardized architecture across its interfaces and led the migration of ${employer('roots')} into the platform — while improving Web Vitals by at least ${amount('deel-web-vitals')} and cutting critical page loading time by ${metric('deel-critical-load')}. At **${employer('roots')}**, he directed frontend strategy and grew the frontend team from ${team.from} developer to ${team.to}.`,
        ),
        table(
          ['Signal', 'Evidence', 'Where'],
          [
            [
              'Architecture ownership',
              'Directed frontend technical strategy and architecture for a growing product',
              employer('roots'),
            ],
            [
              'Standards at scale',
              'Standardized HRIS frontend architecture: structure, state management, error handling',
              employer('deel'),
            ],
            [
              'Measurable impact',
              `Web Vitals +${amount('deel-web-vitals')}, critical page load −${metric('deel-critical-load')}, People List load from ${before('deel-people-list')} to ${after('deel-people-list')}`,
              employer('deel'),
            ],
            [
              'Team building',
              `Grew the frontend team from a solo setup to ${team.to} developers`,
              employer('roots'),
            ],
            [
              'Delivery leadership',
              'Technical trade-offs, delivery plans, OKRs and quarterly goals with Product',
              employer('deel'),
            ],
            [
              'Across products',
              `Bundle size cut by nearly ${amount('way2b1-bundle')} and legacy code migrated across a product suite`,
              employer('way2b1'),
            ],
          ],
          'Staff-level signals in his experience',
        ),
        text(
          `### How he leads\n${practice.leadershipPractice.style}\n\nHis formal titles were Senior and Lead Frontend Engineer; Staff-level describes the scope of his work, not a title he held.`,
        ),
        note(
          'inference',
          "This is an assessment drawn from his documented experience. Whether he fits a specific role depends on that team's needs.",
        ),
        contactOnce(context),
      ],
      {
        followUps: [
          'Tell me more about his leadership.',
          'Show me examples of architectural decisions.',
          'What are his strongest technical skills?',
        ],
        sources: ['resume.way2b1', 'resume.deel', 'resume.roots', 'notes'],
        related: 'deel',
      },
    );
  }

  const COMPANY_INTROS: Readonly<Record<string, string>> = {
    way2b1: `Since ${startMonth('way2b1')}, ${first} has been ${article(title('way2b1'))} ${title('way2b1')} at **${employer('way2b1')}**, a small San Francisco startup building a platform for families and family offices. He works full stack across its product suite: he cut bundle size by nearly ${amount('way2b1-bundle')}, brought loading times down to a few hundred milliseconds and migrated legacy code across multiple products.`,
    deel: `${first} worked at **${employer('deel')}** from ${years('deel').from} to ${years('deel').to} as ${article(title('deel'))} ${title('deel')}, helping lead the HRIS team behind the company's core HR tools and leading the migration of ${employer('roots')} into ${employer('deel')}.`,
    roots: `At **${employer('roots')}** (${period('roots')}), a startup building Slack bots for HR, ${first} was the ${title('roots')}. He built the product frontend end to end, grew the frontend team from ${team.from} to ${team.to}, and later led the platform's migration into ${employer('deel')}.`,
    shall: `At **${employer('shall')}** (${period('shall')}), ${first} worked as ${article(title('shall'))} ${title('shall')} on an HR platform for an American company, where he was promoted from mid-level to Principal Frontend Developer.`,
  };

  const COMPANY_FOLLOW_UPS: Readonly<Record<string, readonly string[]>> = {
    way2b1: [
      'How did he optimize performance?',
      'How does he approach frontend architecture?',
      'Would he fit a technical leadership position?',
    ],
    deel: [
      'What architecture improvements did he introduce?',
      'How did he optimize performance?',
      'What was his role in the HRIS team?',
    ],
    roots: [
      `How did he grow the team at ${employer('roots')}?`,
      `What has he built at ${employer('deel')}?`,
      'Has he ever built something from scratch?',
    ],
    shall: [
      'Has he worked with backend systems?',
      'Has he built mobile apps?',
      'Has he received any awards?',
    ],
    maison: [
      'Does he have Next.js and SSR experience?',
      `Tell me about ${first}'s career.`,
      'What are his biggest technical achievements?',
    ],
  };

  function section(heading: string, items: readonly string[]) {
    return items.length > 0 ? text(`### ${heading}\n${bullets(items)}`) : null;
  }

  function caseStudy(roleId: string) {
    const study = practice.caseStudies[roleId];
    if (!study) return [];
    return [text(`### The engineering problem\n${study.problem}\n\n${bullets(study.angles)}`)];
  }

  function company(roleId: string): AssistantResponse {
    const role = roleById(roleId);
    const intro =
      COMPANY_INTROS[roleId] ??
      `${first} worked at **${role.company}** as ${article(role.role)} ${role.role} (${role.period}).`;
    return response(
      `company:${roleId}`,
      [
        text(intro),
        role.metrics.length > 0 ? text('### Impact') : null,
        role.metrics.length > 0 ? metrics(role.metrics) : null,
        text(`### What the work involved\n${bullets(role.responsibilities)}`),
        section('Leadership', role.leadership),
        section('Recognition', role.achievements),
        ...caseStudy(roleId),
        roleId === 'deel'
          ? details(
              'How were the performance gains achieved?',
              `Through targeted refactoring and optimization of critical pages. The People List page went from ${peopleList.from} seconds to ${peopleList.to} on a cold run, critical-page loading time fell by ${metric('deel-critical-load')} overall, and Web Vitals improved by at least ${amount('deel-web-vitals')}. The specific tooling behind each change isn't documented.`,
            )
          : null,
      ],
      {
        followUps: COMPANY_FOLLOW_UPS[roleId] ?? [
          `Tell me about ${first}'s career.`,
          'What are his biggest technical achievements?',
          'How experienced is he with React and TypeScript?',
        ],
        sources: practice.caseStudies[roleId] ? [role.source, 'notes'] : [role.source],
        related: roleId,
      },
    );
  }

  function leadRole(): AssistantResponse {
    return response(
      'leadRole',
      [
        text(
          `At **${employer('deel')}**, ${first} helped lead and maintain the HRIS team responsible for the company's core HR tools product. His role covered four areas:\n\n` +
            '- **Architecture** — standardized the HRIS frontend: structure, state management, error handling and scalability.\n' +
            `- **Integration** — led the migration and scaling of ${employer('roots')} into ${employer('deel')}, mitigating rollout risks.\n` +
            '- **Planning** — defined technical trade-offs and delivery plans, and documented deliveries for OKRs and quarterly goals with Product Managers.\n' +
            '- **People** — guided junior and mid-level engineers through knowledge-sharing sessions and code walkthroughs, ran code reviews and pair programming, and helped hire and onboard engineers.',
        ),
        metrics(['deel-critical-load', 'deel-people-list']),
        text(
          `### The system design behind it\n${bullets(practice.caseStudies.deel?.angles ?? [])}`,
        ),
      ],
      {
        followUps: [
          'How did he optimize performance?',
          'How does he raise code quality?',
          'Tell me more about his leadership.',
        ],
        sources: ['resume.deel', 'notes'],
        related: 'deel',
      },
    );
  }

  function leadership(): AssistantResponse {
    return response(
      'leadership',
      [
        text(
          `Yes. ${first}'s leadership spans team building, technical direction, delivery and people development.\n\n` +
            '### Team building\n' +
            `- At **${employer('roots')}**, he grew the frontend team from a solo setup by recruiting and integrating ${team.added} developers, then led it for nearly two years.\n` +
            `- At **${employer('deel')}**, he helped lead the HRIS team and contributed to hiring and onboarding.\n\n` +
            '### Technical direction\n' +
            `- Directed frontend strategy and architecture at **${employer('roots')}**.\n` +
            `- Standardized HRIS frontend architecture and led the ${employer('roots')} migration at **${employer('deel')}**.\n` +
            `- Works across the teams of several products at **${employer('way2b1')}**, migrating legacy code.\n\n` +
            '### Delivery and people\n' +
            `- Defined technical trade-offs, delivery plans, OKRs and quarterly goals with Product at **${employer('deel')}**.\n` +
            `- Coordinated sprint planning with managers and stakeholders at **${employer('roots')}**.\n` +
            `- Guided junior and mid-level engineers, ran code reviews and pair programming at **${employer('deel')}**, and set coding standards at **${employer('maison')}**.\n` +
            `- Was promoted to Principal Frontend Developer at **${employer('shall')}**.`,
        ),
        text(
          `### How he leads\n${practice.leadershipPractice.style}\n\n${bullets(practice.leadershipPractice.habits)}\n\n${practice.leadershipPractice.balance}`,
        ),
        metrics(['roots-team']),
      ],
      {
        followUps: [
          'Show me examples of architectural decisions.',
          `How did he grow the team at ${employer('roots')}?`,
          'Would he fit a technical leadership position?',
        ],
        sources: [
          'resume.roots',
          'resume.deel',
          'resume.way2b1',
          'resume.maison',
          'resume.shall',
          'notes',
        ],
      },
    );
  }

  function teamGrowth(): AssistantResponse {
    return response(
      'teamGrowth',
      [
        text(
          `As ${title('roots')} at **${employer('roots')}** (${period('roots')}), ${first} grew the frontend team from a solo setup to ${team.to} developers by recruiting and integrating ${team.added}. He then led frontend development for nearly two years, organizing and delegating work and coordinating sprint planning and deliverables with managers and stakeholders.\n\n` +
            `At ${employer('deel')} he also contributed to hiring and onboarding engineers.`,
        ),
        text(
          `### What growing the team required\n${practice.caseStudies.roots?.problem ?? ''}\n\n${bullets(practice.caseStudies.roots?.angles ?? [])}`,
        ),
        metrics(['roots-team']),
      ],
      {
        followUps: [
          'Has he led engineering teams?',
          `What did he do at ${employer('roots')}?`,
          'Has he ever built something from scratch?',
        ],
        sources: ['resume.roots', 'resume.deel', 'notes'],
        related: 'roots',
      },
    );
  }

  function achievements(): AssistantResponse {
    return response(
      'achievements',
      [
        text(
          'The clearest documented results come from performance, quality and team-building work:',
        ),
        metrics(['deel-critical-load', 'deel-web-vitals', 'deel-people-list', 'roots-team']),
        text(
          '### Other recognition\n' +
            `- Contributed to a web and mobile application that received the **Golden Award in 2019** at ${employer('shall')}.\n` +
            `- Contributed to the newsletter project at ${employer('maison')}, which achieved a **${metric('maison-newsletter')} increase in income**.\n` +
            `- Helped smaller industry clients at ${employer('webfi')} grow sales by **over ${amount('webfi-sales')}**.`,
        ),
        details(
          `How the ${employer('deel')} performance gains were achieved`,
          `Targeted refactoring and optimization of critical pages. His approach to a performance problem:\n\n${bullets(practice.performanceApproach)}`,
        ),
        note(
          'inference',
          'These are results reported in his resume from team work; none is claimed as his alone. Productivity, ROI or revenue attributable only to him are not documented.',
        ),
      ],
      {
        followUps: [
          'How did he optimize performance?',
          'How does he raise code quality?',
          'Tell me about his leadership experience.',
        ],
        sources: [
          'resume.deel',
          'resume.roots',
          'resume.shall',
          'resume.maison',
          'resume.webfi',
          'notes',
        ],
        related: 'deel',
      },
    );
  }

  function qualityImprovement(): AssistantResponse {
    return response(
      'qualityImprovement',
      [
        text(
          `At **${employer('deel')}**, ${first} standardized the HRIS frontend architecture — including state management and error handling — and raised quality standards through code reviews, pair programming and onboarding. At **${employer('maison')}**, he led code reviews and established coding standards to reduce bugs and improve maintainability.`,
        ),
        text(`### What a healthy codebase means to him\n${bullets(practice.qualityPractices)}`),
      ],
      {
        followUps: [
          'What architecture improvements did he introduce?',
          'How does he think about code quality?',
          `What has he built at ${employer('deel')}?`,
        ],
        sources: ['resume.deel', 'resume.maison', 'notes'],
        related: 'deel',
      },
    );
  }

  function awards(): AssistantResponse {
    return response(
      'awards',
      [
        text(
          `At **${employer('shall')}**, ${first} contributed to a web and mobile application that received the **Golden Award in 2019**.\n\n` +
            `Other documented business results include the ${employer('maison')} newsletter project, which achieved a ${metric('maison-newsletter')} increase in income, and helping smaller ${employer('webfi')} clients grow sales by over ${amount('webfi-sales')}.`,
        ),
        note(
          'inference',
          'The Golden Award went to the product he worked on, not to him personally.',
        ),
      ],
      {
        followUps: [
          'What are his biggest technical achievements?',
          `What did he do at ${employer('shall')}?`,
          `Tell me about ${first}'s career.`,
        ],
        sources: ['resume.shall', 'resume.maison', 'resume.webfi'],
        related: 'shall',
      },
    );
  }

  function scaling(): AssistantResponse {
    return response(
      'scaling',
      [
        text(
          `Scaling shows up in ${first}'s work at three levels — product, codebase and team:\n\n` +
            `- **Product** — at ${employer('deel')} he led the migration and scaling of the ${employer('roots')} platform into ${employer('deel')}, mitigating rollout risks; at ${employer('roots')} he shaped frontend architecture to support user base growth.\n` +
            `- **Codebase** — he standardized HRIS frontend architecture at ${employer('deel')}, introduced advanced state management at ${employer('roots')} and migrates legacy code across several products at ${employer('way2b1')}.\n` +
            `- **Team** — at ${employer('roots')} he grew the frontend team from ${team.from} to ${team.to} and set up GitLab CI pipelines deploying to Amazon S3.`,
        ),
        metrics(['deel-critical-load', 'roots-team']),
        text(
          `### What scaling ${employer('deel')}'s HRIS involved\n${bullets(practice.caseStudies.deel?.angles ?? [])}`,
        ),
      ],
      {
        followUps: [
          `What has he built at ${employer('deel')}?`,
          'How does he approach frontend architecture?',
          'How did he optimize performance?',
        ],
        sources: ['resume.deel', 'resume.roots', 'resume.way2b1', 'notes'],
        related: 'deel',
      },
    );
  }

  function scratch(): AssistantResponse {
    return response(
      'scratch',
      [
        text(
          'Yes, several times:\n\n' +
            `- At **${employer('roots')}**, he built an end-to-end React frontend for a startup creating Slack bots for HR, with its architecture, state management and CI pipelines.\n` +
            `- At **${employer('shall')}**, he led development of a progressive web app.\n` +
            `- On his own, he builds products such as **${productName('evcopilot')}**, **${productName('formdaily')}** and **${productName('targup')}**.`,
        ),
        metrics(['roots-team']),
        text(
          `### Starting from zero at ${employer('roots')}\n${practice.caseStudies.roots?.problem ?? ''}\n\nIn his own products he starts the same way: the product goal and its users first, then the domain, then the simplest architecture that fits.`,
        ),
      ],
      {
        followUps: [
          'What projects is he working on?',
          `What did he do at ${employer('roots')}?`,
          'How does he approach frontend architecture?',
        ],
        sources: ['resume.roots', 'resume.shall', 'projects', 'notes'],
        related: 'roots',
      },
    );
  }

  function enterprise(context: ConversationContext): AssistantResponse {
    return response(
      'enterprise',
      [
        text(
          `Yes. The most substantial enterprise example is **${employer('deel')}** (${period('deel')}), where he helped lead the HRIS team behind the company's core HR tools, standardized its frontend architecture and led the migration of ${employer('roots')} into the platform.\n\n` +
            `At **${employer('way2b1')}**, a smaller startup, he works full stack across several products, migrating legacy code and improving performance.`,
        ),
        text(
          `### The enterprise problem at ${employer('deel')}\n${practice.caseStudies.deel?.problem ?? ''}`,
        ),
        metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list']),
        contactOnce(context),
      ],
      {
        followUps: [
          `What has he built at ${employer('deel')}?`,
          'How did he optimize performance?',
          'Has he led engineering teams?',
        ],
        sources: ['profile', 'resume.deel', 'resume.way2b1', 'notes'],
        related: 'deel',
      },
    );
  }

  function product(): AssistantResponse {
    return response(
      'product',
      [
        text(
          'Close collaboration with product, design and leadership runs through his roles:\n\n' +
            `- At **${employer('deel')}**, he defined technical trade-offs and delivery plans with Product and Engineering, and planned OKRs and quarterly goals with Product Managers.\n` +
            `- At **${employer('roots')}**, he coordinated sprint planning with managers and stakeholders and built accessibility in with UX designers.\n` +
            `- At **${employer('maison')}**, he turned complex requirements into accessible interfaces with UX designers.\n\n` +
            knowledge.profile.focus.replace(/^He/, first),
        ),
        text(
          `### How he works with them\n${bullets(practice.leadershipPractice.habits)}\n\nHe starts from the product goal, the users and what success looks like before choosing a solution, and treats requirements such as latency, privacy, accessibility and operating cost as part of the design.`,
        ),
      ],
      {
        followUps: [
          "What's his engineering philosophy?",
          'Would he fit a technical leadership position?',
          `What has he built at ${employer('deel')}?`,
        ],
        sources: ['resume.deel', 'resume.roots', 'resume.maison', 'profile', 'notes'],
      },
    );
  }

  return {
    career,
    roleFit,
    company,
    leadRole,
    leadership,
    teamGrowth,
    achievements,
    qualityImprovement,
    awards,
    scaling,
    scratch,
    enterprise,
    product,
  };
}
