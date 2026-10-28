import type { AssistantResponse, ConversationContext } from '../../response';
import { bullets, details, note, table, text, type ResponseKit } from '../../response-kit';

/**
 * Answers about career, impact and leadership. Every claim maps to a record
 * in the knowledge base; what the record does not document is left out
 * rather than inferred.
 */
export function createCareerAnswers(kit: ResponseKit) {
  const {
    roleById,
    allRoleSources,
    contactOnce,
    metrics,
    metricValue,
    response,
    timeline,
    knowledge,
  } = kit;
  const { practice } = knowledge;

  function article(word: string): string {
    return /^[aeiou]/i.test(word) ? 'an' : 'a';
  }

  function career(): AssistantResponse {
    return response(
      'career',
      [
        text(
          `Marcio is a frontend engineer with **over 10 years** of professional experience. He started in ${String(knowledge.profile.careerStartYear)} as a freelance web developer and grew into senior and lead frontend roles — helping lead the HRIS team at **Deel** (2022 — 2026) and, since June 2026, as a Senior Frontend Engineer at **Way2b1**, working full stack across a small startup's product suite.\n\n` +
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
          'What has he built at Deel?',
          'Has he led engineering teams?',
          'What projects is he working on?',
        ],
        sources: ['profile', ...allRoleSources(), 'notes'],
        related: 'deel',
      },
    );
  }

  function staffFit(context: ConversationContext): AssistantResponse {
    return response(
      'staffFit',
      [
        text(
          'Marcio has several characteristics associated with Staff-level frontend engineering: deep technical expertise, ownership of architectural decisions, measurable product improvements and a track record of mentoring engineers.\n\n' +
            `At **Deel**, he helped lead the HRIS team, standardized architecture across its interfaces and led the migration of Roots into the platform — while improving Web Vitals by at least 30% and cutting critical page loading time by ${metricValue('deel-critical-load')}. At **Roots**, he directed frontend strategy and grew the frontend team from one developer to four.`,
        ),
        table(
          ['Signal', 'Evidence', 'Where'],
          [
            [
              'Architecture ownership',
              'Directed frontend technical strategy and architecture for a growing product',
              'Roots',
            ],
            [
              'Standards at scale',
              'Standardized HRIS frontend architecture: structure, state management, error handling',
              'Deel',
            ],
            [
              'Measurable impact',
              'Web Vitals +30%, critical page load −50%, People List load from 6s to 3s',
              'Deel',
            ],
            [
              'Team building',
              'Grew the frontend team from a solo setup to four developers',
              'Roots',
            ],
            [
              'Delivery leadership',
              'Technical trade-offs, delivery plans, OKRs and quarterly goals with Product',
              'Deel',
            ],
            [
              'Across products',
              'Bundle size cut by nearly 50% and legacy code migrated across a product suite',
              'Way2b1',
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
    way2b1:
      'Since June 2026, Marcio has been a Senior Frontend Engineer at **Way2b1**, a small San Francisco startup building a platform for families and family offices. He works full stack across its product suite: he cut bundle size by nearly 50%, brought loading times down to a few hundred milliseconds and migrated legacy code across multiple products.',
    deel: "Marcio worked at **Deel** from 2022 to 2026 as a Senior Frontend Engineer, helping lead the HRIS team behind the company's core HR tools and leading the migration of Roots into Deel.",
    roots:
      "At **Roots** (2020 — 2022), a startup building Slack bots for HR, Marcio was the Lead Frontend Engineer. He built the product frontend end to end, grew the frontend team from one to four, and later led the platform's migration into Deel.",
    shall:
      'At **Shall And Partners** (2018 — 2020), Marcio worked as a Full Stack Developer on an HR platform for an American company, where he was promoted from mid-level to Principal Frontend Developer.',
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
      'How did he grow the team at Roots?',
      'What has he built at Deel?',
      'Has he ever built something from scratch?',
    ],
    shall: [
      'Has he worked with backend systems?',
      'Has he built mobile apps?',
      'Has he received any awards?',
    ],
    maison: [
      'Does he have Next.js and SSR experience?',
      "Tell me about Marcio's career.",
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
      `Marcio worked at **${role.company}** as ${article(role.role)} ${role.role} (${role.period}).`;
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
              "Through targeted refactoring and optimization of critical pages. The People List page went from six seconds to three on a cold run, critical-page loading time fell by 50% overall, and Web Vitals improved by at least 30%. The specific tooling behind each change isn't documented.",
            )
          : null,
      ],
      {
        followUps: COMPANY_FOLLOW_UPS[roleId] ?? [
          "Tell me about Marcio's career.",
          'What are his biggest technical achievements?',
          'How experienced is he with React and TypeScript?',
        ],
        sources: practice.caseStudies[roleId] ? [role.source, 'notes'] : [role.source],
        related: roleId,
      },
    );
  }

  function hrisRole(): AssistantResponse {
    return response(
      'hrisRole',
      [
        text(
          "At **Deel**, Marcio helped lead and maintain the HRIS team responsible for the company's core HR tools product. His role covered four areas:\n\n" +
            '- **Architecture** — standardized the HRIS frontend: structure, state management, error handling and scalability.\n' +
            '- **Integration** — led the migration and scaling of Roots into Deel, mitigating rollout risks.\n' +
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
          "Yes. Marcio's leadership spans team building, technical direction, delivery and people development.\n\n" +
            '### Team building\n' +
            '- At **Roots**, he grew the frontend team from a solo setup by recruiting and integrating three developers, then led it for nearly two years.\n' +
            '- At **Deel**, he helped lead the HRIS team and contributed to hiring and onboarding.\n\n' +
            '### Technical direction\n' +
            '- Directed frontend strategy and architecture at **Roots**.\n' +
            '- Standardized HRIS frontend architecture and led the Roots migration at **Deel**.\n' +
            '- Works across the teams of several products at **Way2b1**, migrating legacy code.\n\n' +
            '### Delivery and people\n' +
            '- Defined technical trade-offs, delivery plans, OKRs and quarterly goals with Product at **Deel**.\n' +
            '- Coordinated sprint planning with managers and stakeholders at **Roots**.\n' +
            '- Guided junior and mid-level engineers, ran code reviews and pair programming at **Deel**, and set coding standards at **Maison Moderne**.\n' +
            '- Was promoted to Principal Frontend Developer at **Shall And Partners**.',
        ),
        text(
          `### How he leads\n${practice.leadershipPractice.style}\n\n${bullets(practice.leadershipPractice.habits)}\n\n${practice.leadershipPractice.balance}`,
        ),
        metrics(['roots-team']),
      ],
      {
        followUps: [
          'Show me examples of architectural decisions.',
          'How did he grow the team at Roots?',
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
          'As Lead Frontend Engineer at **Roots** (2020 — 2022), Marcio grew the frontend team from a solo setup to four developers by recruiting and integrating three. He then led frontend development for nearly two years, organizing and delegating work and coordinating sprint planning and deliverables with managers and stakeholders.\n\n' +
            'At Deel he also contributed to hiring and onboarding engineers.',
        ),
        text(
          `### What growing the team required\n${practice.caseStudies.roots?.problem ?? ''}\n\n${bullets(practice.caseStudies.roots?.angles ?? [])}`,
        ),
        metrics(['roots-team']),
      ],
      {
        followUps: [
          'Has he led engineering teams?',
          'What did he do at Roots?',
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
            '- Contributed to a web and mobile application that received the **Golden Award in 2019** at Shall And Partners.\n' +
            '- Contributed to the newsletter project at Maison Moderne, which achieved a **20% increase in income**.\n' +
            '- Helped smaller industry clients at WEBFI grow sales by **over 30%**.',
        ),
        details(
          'How the Deel performance gains were achieved',
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

  function quality(): AssistantResponse {
    return response(
      'quality',
      [
        text(
          'At **Deel**, Marcio standardized the HRIS frontend architecture — including state management and error handling — and raised quality standards through code reviews, pair programming and onboarding. At **Maison Moderne**, he led code reviews and established coding standards to reduce bugs and improve maintainability.',
        ),
        text(`### What a healthy codebase means to him\n${bullets(practice.qualityPractices)}`),
      ],
      {
        followUps: [
          'What architecture improvements did he introduce?',
          'How does he think about code quality?',
          'What has he built at Deel?',
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
          'At **Shall And Partners**, Marcio contributed to a web and mobile application that received the **Golden Award in 2019**.\n\n' +
            'Other documented business results include the Maison Moderne newsletter project, which achieved a 20% increase in income, and helping smaller WEBFI clients grow sales by over 30%.',
        ),
        note(
          'inference',
          'The Golden Award went to the product he worked on, not to him personally.',
        ),
      ],
      {
        followUps: [
          'What are his biggest technical achievements?',
          'What did he do at Shall And Partners?',
          "Tell me about Marcio's career.",
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
          "Scaling shows up in Marcio's work at three levels — product, codebase and team:\n\n" +
            '- **Product** — at Deel he led the migration and scaling of the Roots platform into Deel, mitigating rollout risks; at Roots he shaped frontend architecture to support user base growth.\n' +
            '- **Codebase** — he standardized HRIS frontend architecture at Deel, introduced advanced state management at Roots and migrates legacy code across several products at Way2b1.\n' +
            '- **Team** — at Roots he grew the frontend team from one to four and set up GitLab CI pipelines deploying to Amazon S3.',
        ),
        metrics(['deel-critical-load', 'roots-team']),
        text(
          `### What scaling Deel's HRIS involved\n${bullets(practice.caseStudies.deel?.angles ?? [])}`,
        ),
      ],
      {
        followUps: [
          'What has he built at Deel?',
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
            '- At **Roots**, he built an end-to-end React frontend for a startup creating Slack bots for HR, with its architecture, state management and CI pipelines.\n' +
            '- At **Shall And Partners**, he led development of a progressive web app.\n' +
            '- On his own, he builds products such as **EvCopilot**, **FormDaily** and **TargUp**.',
        ),
        metrics(['roots-team']),
        text(
          `### Starting from zero at Roots\n${practice.caseStudies.roots?.problem ?? ''}\n\nIn his own products he starts the same way: the product goal and its users first, then the domain, then the simplest architecture that fits.`,
        ),
      ],
      {
        followUps: [
          'What projects is he working on?',
          'What did he do at Roots?',
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
          `Yes. The most substantial enterprise example is **Deel** (2022 — 2026), where he helped lead the HRIS team behind the company's core HR tools, standardized its frontend architecture and led the migration of Roots into the platform.\n\n` +
            'At **Way2b1**, a smaller startup, he works full stack across several products, migrating legacy code and improving performance.',
        ),
        text(`### The enterprise problem at Deel\n${practice.caseStudies.deel?.problem ?? ''}`),
        metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list']),
        contactOnce(context),
      ],
      {
        followUps: [
          'What has he built at Deel?',
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
            '- At **Deel**, he defined technical trade-offs and delivery plans with Product and Engineering, and planned OKRs and quarterly goals with Product Managers.\n' +
            '- At **Roots**, he coordinated sprint planning with managers and stakeholders and built accessibility in with UX designers.\n' +
            '- At **Maison Moderne**, he turned complex requirements into accessible interfaces with UX designers.\n\n' +
            knowledge.profile.focus.replace(/^He/, 'Marcio'),
        ),
        text(
          `### How he works with them\n${bullets(practice.leadershipPractice.habits)}\n\nHe starts from the product goal, the users and what success looks like before choosing a solution, and treats requirements such as latency, privacy, accessibility and operating cost as part of the design.`,
        ),
      ],
      {
        followUps: [
          "What's his engineering philosophy?",
          'Would he fit a technical leadership position?',
          'What has he built at Deel?',
        ],
        sources: ['resume.deel', 'resume.roots', 'resume.maison', 'profile', 'notes'],
      },
    );
  }

  return {
    career,
    staffFit,
    company,
    hrisRole,
    leadership,
    teamGrowth,
    achievements,
    quality,
    awards,
    scaling,
    scratch,
    enterprise,
    product,
  };
}
