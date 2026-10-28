import type { RoleId } from '@/core/knowledge/ids';
import { knowledgeBase, roleById } from '@/core/knowledge/knowledge-base';
import type { AssistantResponse, ConversationContext } from '../../response';
import {
  allRoleSources,
  contactOnce,
  details,
  metrics,
  metricValue,
  note,
  response,
  table,
  text,
  timeline,
} from '../../response-kit';

/**
 * Answers about career, impact and leadership. Every claim maps to a record
 * in the knowledge base; what the record does not document is stated as a
 * gap rather than inferred.
 */

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function career(): AssistantResponse {
  return response(
    'career',
    [
      text(
        `Marcio is a frontend engineer with **over 10 years** of professional experience. He started in ${String(knowledgeBase.profile.careerStartYear)} as a freelance web developer and grew into senior and lead frontend roles at product companies — most recently **Deel** (2022 — 2026) and **Toptal**, where he has worked since March 2026.\n\n` +
          'Across those roles the thread is consistent: React and TypeScript architecture, performance, and technical leadership, with engineering decisions tied to product impact.',
      ),
      timeline(),
      text('A few documented outcomes along the way:'),
      metrics(['deel-critical-load', 'deel-web-vitals', 'deel-backlog', 'roots-team']),
    ],
    {
      followUps: [
        'What has he built at Deel?',
        'Has he led engineering teams?',
        'What are his strongest technical skills?',
      ],
      sources: ['profile', ...allRoleSources()],
      related: 'deel',
    },
  );
}

export function staffFit(context: ConversationContext): AssistantResponse {
  return response(
    'staffFit',
    [
      text(
        'His documented experience shows several signals associated with Staff-level frontend engineering: architecture ownership, standards set across product areas, measurable product improvements, and mentoring and hiring.\n\n' +
          `At **Deel**, for example, he led the HRIS team responsible for the company's core HR tools product and standardized its frontend architecture, while improving Web Vitals by at least 30% and reducing critical page loading time by ${metricValue('deel-critical-load')}. At **Roots**, he led frontend technical development and grew the team from a solo setup to four developers.`,
      ),
      table(
        ['Signal', 'Evidence', 'Where'],
        [
          [
            'Architecture ownership',
            'Planned the initial architecture for a new product and architected a modular React/TypeScript component library',
            'Toptal',
          ],
          [
            'Standards at scale',
            'Standardized frontend architecture across HRIS interfaces',
            'Deel',
          ],
          [
            'Measurable impact',
            'Web Vitals improved by 30%+ and critical page loading time cut by 50%',
            'Deel',
          ],
          ['Team building', 'Grew the frontend team from one to four developers', 'Roots'],
          [
            'Organizational reach',
            'Mentoring, hiring, onboarding, technical trade-offs and OKRs',
            'Deel',
          ],
          [
            'Product partnership',
            'Coordinated product decisions with the Director and CEO',
            'Toptal',
          ],
        ],
        'Staff-level signals in his documented experience',
      ),
      text(
        'Together, these provide evidence of technical leadership and product impact beyond individual feature delivery.',
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
      sources: ['resume.toptal', 'resume.deel', 'resume.roots'],
      related: 'deel',
    },
  );
}

const COMPANY_INTROS: Partial<Record<RoleId, string>> = {
  toptal:
    'Marcio joined **Toptal** in March 2026 as a Senior Frontend Engineer. His work there combines hands-on architecture with product leadership.',
  deel: "Marcio worked at **Deel** from 2022 to 2026 as a Senior Frontend Engineer. He led and maintained the HRIS team responsible for the company's core HR tools product, and led the migration and scaling of the Roots platform into Deel.",
  roots:
    'At **Roots** (2020 — 2022), Marcio was the Lead Frontend Engineer and built the product frontend from the ground up for a startup specializing in Slack bots for HR. Roots was later migrated into Deel, where he led its scaling.',
};

const COMPANY_FOLLOW_UPS: Partial<Record<RoleId, readonly string[]>> = {
  toptal: [
    'How does he approach frontend architecture?',
    'What has he built at Deel?',
    'Would he fit a technical leadership position?',
  ],
  deel: [
    'What architecture improvements did he introduce?',
    'How did he optimize performance?',
    'What was his role in the HRIS team?',
  ],
  roots: [
    'Has he led engineering teams?',
    'What has he built at Deel?',
    'Has he ever built something from scratch?',
  ],
  shall: [
    'Has he worked with backend systems?',
    'Has he received any awards?',
    "Tell me about Marcio's career.",
  ],
  maison: [
    'Does he have Next.js and SSR experience?',
    "Tell me about Marcio's career.",
    'What are his biggest technical achievements?',
  ],
};

export function company(roleId: RoleId): AssistantResponse {
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
      text(`### What the work involved\n${bullets(role.highlights)}`),
      roleId === 'deel'
        ? details(
            'How were the performance gains achieved?',
            "His resume credits the 50% cut in critical page loading time to **targeted refactoring and optimization** — the People List page went from six seconds to three on a cold run — and the two-thirds smaller bug and support backlog to **planned bug sprints**. It does not break each result down further, so I won't speculate beyond that.",
          )
        : null,
      role.current
        ? note(
            'gap',
            'This is his current role, and no measurable outcomes are documented for it yet.',
          )
        : null,
    ],
    {
      followUps: COMPANY_FOLLOW_UPS[roleId] ?? [
        "Tell me about Marcio's career.",
        'What are his biggest technical achievements?',
        'How experienced is he with React and TypeScript?',
      ],
      sources: [role.source],
      related: roleId,
    },
  );
}

export function hrisRole(): AssistantResponse {
  return response(
    'hrisRole',
    [
      text(
        "At **Deel**, Marcio was a Senior Frontend Engineer who **led and maintained the HRIS team** responsible for the company's core HR tools product. His documented responsibilities:\n\n" +
          '- **Technical ownership** — standardized frontend architecture for HRIS interfaces, covering structure, state management, error handling and scalability.\n' +
          '- **Integration** — led the migration and scaling of the Roots platform into Deel, mitigating rollout risks.\n' +
          '- **People** — mentored junior engineers through knowledge-sharing sessions and code walkthroughs, and took part in hiring and onboarding.\n' +
          '- **Planning** — defined technical trade-offs and delivery plans with Product and Engineering, and planned OKRs and quarterly goals with Product Managers.',
      ),
      note('gap', "The HRIS team's size isn't documented."),
    ],
    {
      followUps: [
        'How did he optimize performance?',
        'What architecture improvements did he introduce?',
        'Tell me more about his leadership.',
      ],
      sources: ['resume.deel'],
      related: 'deel',
    },
  );
}

export function leadership(): AssistantResponse {
  return response(
    'leadership',
    [
      text(
        "Yes. Marcio's leadership is documented across team building, technical direction and people development.\n\n" +
          '### Team building\n' +
          '- At **Roots**, he grew the frontend team from a solo setup by recruiting and integrating three additional developers, then led it for nearly two years, coordinating sprint planning with managers and stakeholders.\n' +
          '- At **Deel**, he led and maintained the HRIS team and contributed to hiring and onboarding.\n\n' +
          '### Technical direction\n' +
          '- Directed frontend technical strategy and architecture at **Roots**.\n' +
          '- Standardized frontend architecture for HRIS interfaces at **Deel**.\n' +
          '- Planned the initial architecture for a new product at **Toptal**.\n\n' +
          '### People and product\n' +
          '- Mentored junior engineers and facilitated pair programming and code reviews at **Deel**.\n' +
          '- Led code reviews and established coding standards at **Maison Modern**.\n' +
          '- Coordinates product decisions with the Director and CEO at **Toptal**.\n' +
          '- Was promoted from Mid-level to Principal Frontend Developer at **Shall And Partners**.',
      ),
      metrics(['roots-team']),
    ],
    {
      followUps: [
        'Show me examples of architectural decisions.',
        'How did he grow the team at Roots?',
        'Would he fit a technical leadership position?',
      ],
      sources: ['resume.roots', 'resume.deel', 'resume.toptal', 'resume.maison', 'resume.shall'],
    },
  );
}

export function teamGrowth(): AssistantResponse {
  return response(
    'teamGrowth',
    [
      text(
        'As Lead Frontend Engineer at **Roots** (2020 — 2022), Marcio expanded the frontend team from a solo developer setup by recruiting and integrating three additional developers. He then led frontend development within that four-developer team for nearly two years, delegating and organizing tasks and coordinating sprint planning with managers and stakeholders.',
      ),
      metrics(['roots-team']),
      note(
        'gap',
        "How the candidates were sourced or interviewed isn't documented. At Deel he also contributed to hiring and onboarding.",
      ),
    ],
    {
      followUps: [
        'Has he led engineering teams?',
        'What did he do at Roots?',
        'Has he ever built something from scratch?',
      ],
      sources: ['resume.roots', 'resume.deel'],
      related: 'roots',
    },
  );
}

export function achievements(): AssistantResponse {
  return response(
    'achievements',
    [
      text(
        'The clearest documented results come from performance, quality and team-building work:',
      ),
      metrics([
        'deel-critical-load',
        'deel-web-vitals',
        'deel-people-list',
        'deel-backlog',
        'roots-team',
        'roots-slack-bot',
        'roots-initial-load',
      ]),
      text(
        '### Other recognition\n' +
          '- Contributed to a web and mobile application that received the **2019 Golden Award** at Shall And Partners.\n' +
          '- Contributed to a newsletter project at Maison Modern that achieved a **20% increase in income**.\n' +
          '- Helped smaller WEBFI clients grow sales by **over 30%**.',
      ),
    ],
    {
      followUps: [
        'How did he optimize performance?',
        'Has he ever built something from scratch?',
        'Tell me about his leadership experience.',
      ],
      sources: ['resume.deel', 'resume.roots', 'resume.shall', 'resume.maison', 'resume.webfi'],
      related: 'deel',
    },
  );
}

export function quality(): AssistantResponse {
  return response(
    'quality',
    [
      text(
        'At **Deel**, Marcio reduced the bug and support ticket backlog by two-thirds by **implementing planned bug sprints**. Alongside that he raised quality standards through pair programming, code reviews and onboarding support, and standardized the frontend architecture for HRIS interfaces, including error handling.',
      ),
      metrics(['deel-backlog']),
    ],
    {
      followUps: [
        'What architecture improvements did he introduce?',
        'How does he think about code quality?',
        'What has he built at Deel?',
      ],
      sources: ['resume.deel'],
      related: 'deel',
    },
  );
}

export function awards(): AssistantResponse {
  return response(
    'awards',
    [
      text(
        'One formal award is documented: at **Shall And Partners**, Marcio contributed to a web and mobile application that received the **Golden Award in 2019**.\n\n' +
          'Other documented business results include a newsletter project at Maison Modern that achieved a 20% increase in income, and helping smaller WEBFI clients grow sales by over 30%.',
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

export function scaling(): AssistantResponse {
  return response(
    'scaling',
    [
      text(
        "Scaling shows up in Marcio's work in three ways — product, codebase and team:\n\n" +
          '- **Product scale** — at Deel he led the migration and scaling of the Roots platform into Deel, mitigating rollout risks.\n' +
          '- **Codebase scale** — he standardized frontend architecture for HRIS interfaces at Deel, and implemented advanced state management at Roots for scalability and maintainability.\n' +
          '- **Team scale** — at Roots he grew the frontend team from one to four developers and established CI pipelines on GitLab deploying to Amazon S3.',
      ),
      metrics(['deel-critical-load', 'deel-backlog', 'roots-team']),
    ],
    {
      followUps: [
        'What has he built at Deel?',
        'How does he approach frontend architecture?',
        'How did he optimize performance?',
      ],
      sources: ['resume.deel', 'resume.roots'],
      related: 'deel',
    },
  );
}

export function scratch(): AssistantResponse {
  return response(
    'scratch',
    [
      text(
        'Yes. At **Roots**, Marcio developed an end-to-end frontend application with React.js for a startup specializing in Slack bots for HR. As Lead Frontend Engineer he set the technical strategy and architecture, implemented advanced state management and established CI pipelines on GitLab deploying to Amazon S3, while growing the team from one to four developers.\n\n' +
          'More recently at **Toptal**, he planned the initial architecture for a new company product. Earlier, as a freelancer, he progressed from small frontend tasks to independently developing complete web applications.',
      ),
      metrics(['roots-team', 'roots-initial-load', 'roots-slack-bot']),
    ],
    {
      followUps: [
        'What did he do at Roots?',
        'How does he approach frontend architecture?',
        'What projects is he working on?',
      ],
      sources: ['resume.roots', 'resume.toptal', 'resume.freelance'],
      related: 'roots',
    },
  );
}

export function enterprise(context: ConversationContext): AssistantResponse {
  return response(
    'enterprise',
    [
      text(
        `Yes. ${knowledgeBase.profile.context} The most substantial enterprise example is **Deel** (2022 — 2026), where he led and maintained the HRIS team responsible for the company's core HR tools product, standardized its frontend architecture, and led the migration and scaling of the Roots platform into Deel.\n\n` +
          'At **Toptal** he architected a modular React and TypeScript component library used to keep the UI consistent across multiple product teams.',
      ),
      metrics(['deel-web-vitals', 'deel-people-list', 'deel-backlog']),
      contactOnce(context),
    ],
    {
      followUps: [
        'What has he built at Deel?',
        'How did he optimize performance?',
        'Has he led engineering teams?',
      ],
      sources: ['profile', 'resume.deel', 'resume.toptal'],
      related: 'deel',
    },
  );
}

export function product(): AssistantResponse {
  return response(
    'product',
    [
      text(
        'Product collaboration is a recurring part of his roles:\n\n' +
          '- At **Toptal**, he coordinates product decisions with the Director and CEO and planned the initial architecture for a new product.\n' +
          '- At **Deel**, he defined technical trade-offs and delivery plans with Product and Engineering teams, and planned OKRs and quarterly goals with Product Managers.\n' +
          '- At **Roots**, he coordinated sprint planning with managers and stakeholders, and boosted Slack bot usage and adoption by over 50%.\n' +
          '- At **Maison Modern**, he contributed to a newsletter project that achieved a 20% increase in income.\n\n' +
          knowledgeBase.profile.focus.replace(/^He/, 'Marcio'),
      ),
      note('gap', "His day-to-day product rituals and tools aren't documented."),
    ],
    {
      followUps: [
        "What's his engineering philosophy?",
        'Would he fit a technical leadership position?',
        'What has he built at Deel?',
      ],
      sources: ['resume.toptal', 'resume.deel', 'resume.roots', 'resume.maison', 'profile'],
    },
  );
}
