import type { ProjectId } from '@/core/knowledge/ids';
import { knowledgeBase, projectById } from '@/core/knowledge/knowledge-base';
import type { AssistantResponse, ConversationContext } from '../../response';
import {
  allRoleSources,
  contactCard,
  contactOnce,
  details,
  metrics,
  note,
  projects as projectCards,
  response,
  skills as skillGroups,
  table,
  text,
  timeline,
} from '../../response-kit';

/** Answers about expertise, products, background and contact. */

export function react(): AssistantResponse {
  return response(
    'react',
    [
      text(
        "React sits at the center of Marcio's documented work from 2018 to today. Rather than a single claim of expertise, here is the evidence by area:\n\n" +
          '- **Component architecture** — architected a modular React and TypeScript component library used across multiple product teams at Toptal.\n' +
          '- **Complex product interfaces** — helped lead the HRIS team at Deel and standardized its architecture, state management and error handling.\n' +
          '- **Performance** — improved Web Vitals by 30%+ and halved critical page loading time at Deel.\n' +
          '- **State management** — implemented advanced state management at Roots, where he built the frontend end to end.\n' +
          '- **Next.js and SSR** — built responsive digital magazines with Next.js and server-side rendering at Maison Modern.\n' +
          '- **Modernization** — refactored a codebase to React Hooks at Shall And Partners.',
      ),
      skillGroups(['frontend', 'architecture']),
      note(
        'gap',
        'His resume lists React work per role rather than years per technology, so I describe the span of documented roles instead of a precise number.',
      ),
    ],
    {
      followUps: [
        'How does he approach frontend architecture?',
        'What has he built at Deel?',
        'Has he worked with backend systems?',
      ],
      sources: [
        'resume.toptal',
        'resume.deel',
        'resume.roots',
        'resume.maison',
        'resume.shall',
        'resume.skills',
      ],
      related: 'toptal',
    },
  );
}

const EXAMPLE_CODE = [
  '// Illustrative: the feature component only orchestrates primitives.',
  '// Layout, data access and side effects live elsewhere.',
  'export function ProductCard({ product, onAddToCart }: ProductCardProps) {',
  '  return (',
  '    <Card>',
  '      <Card.Media>',
  '        <Image src={product.imageUrl} alt={product.name} />',
  '      </Card.Media>',
  '      <Card.Body>',
  '        <Text variant="title">{product.name}</Text>',
  '        <Price amount={product.price} />',
  '      </Card.Body>',
  '      <Card.Actions>',
  '        <Button onClick={() => onAddToCart(product.id)}>Add to cart</Button>',
  '      </Card.Actions>',
  '      <CommentList comments={product.comments} />',
  '    </Card>',
  '  );',
  '}',
].join('\n');

export function architecture(): AssistantResponse {
  return response(
    'architecture',
    [
      text(
        "Marcio's architecture work follows a consistent thread: standardize the foundations, keep components modular, and tie structural decisions to measurable product outcomes.\n\n" +
          '### Documented decisions\n' +
          '- **Toptal** — architected a modular React/TypeScript component library for consistent UI across product teams, and planned the initial architecture for a new product.\n' +
          '- **Deel** — standardized HRIS frontend architecture to improve structure, state management, error handling and scalability.\n' +
          '- **Roots** — directed frontend strategy, introduced advanced state management and set up GitLab CI pipelines deploying to Amazon S3.\n' +
          '- **Maison Modern** — implemented SSR with Next.js and integrated the frontend with external publishing platforms.\n' +
          '- **Shall And Partners** — moved the codebase to React Hooks and built apps within a microservices architecture.\n\n' +
          '### The principles behind them\n' +
          '1. Compose small primitives into higher-level components instead of building monoliths.\n' +
          '2. Keep presentation separate from state, domain logic and side effects.\n' +
          '3. Centralize shared logic rather than duplicating business rules.',
      ),
      note(
        'example',
        "The snippet below illustrates the composition principle. It is not taken from any employer's codebase.",
      ),
      text(`\`\`\`tsx\n${EXAMPLE_CODE}\n\`\`\``),
    ],
    {
      followUps: [
        'How did he optimize performance?',
        "What's his engineering philosophy?",
        'What does he know about design systems?',
      ],
      sources: [
        'resume.toptal',
        'resume.deel',
        'resume.roots',
        'resume.maison',
        'resume.shall',
        'principles',
      ],
      related: 'deel',
    },
  );
}

export function performance(): AssistantResponse {
  return response(
    'performance',
    [
      text("Performance is one of the most consistently documented themes in Marcio's work:"),
      metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list']),
      text(
        '### How he got there\n' +
          '- **Deel** — targeted refactoring and optimization of critical pages; the People List page went from six seconds to three on a cold run.\n' +
          '- **Maison Modern** — server-side rendering to improve SEO and initial load speed for editorial products read by thousands daily.',
      ),
      note('gap', "The specific profiling tools behind each change aren't documented."),
    ],
    {
      followUps: [
        'What has he built at Deel?',
        'Does he have Next.js and SSR experience?',
        'How does he approach frontend architecture?',
      ],
      sources: ['resume.deel', 'resume.roots', 'resume.maison', 'resume.skills'],
      related: 'deel',
    },
  );
}

export function backend(): AssistantResponse {
  return response(
    'backend',
    [
      text(
        'Yes, with a clear distinction: Marcio is a frontend specialist who also has hands-on full-stack experience.\n\n' +
          '### Where it is documented\n' +
          '- **Shall And Partners (2018 — 2020)** — engineered RESTful APIs and built web and mobile apps in a microservices architecture with Node.js and multiple databases, plus internal tools that automated contractor timesheets.\n' +
          '- **Toptal** — works with backend engineers to design and optimize RESTful APIs for efficient data fetching.\n' +
          '- **Roots** — set up GitLab CI pipelines deploying to Amazon S3.',
      ),
      skillGroups(['backend']),
      note(
        'inference',
        'Based on his role titles, backend work in his recent positions is collaborative (API design, delivery pipelines) rather than his primary ownership.',
      ),
    ],
    {
      followUps: [
        'What did he do at Shall And Partners?',
        'What are his strongest technical skills?',
        'How does he approach frontend architecture?',
      ],
      sources: ['resume.shall', 'resume.toptal', 'resume.roots', 'resume.skills'],
      related: 'shall',
    },
  );
}

export function mobile(): AssistantResponse {
  return response(
    'mobile',
    [
      text(
        'Yes. At **Shall And Partners**, Marcio built web and mobile applications — including one that received the Golden Award in 2019 — and led development of a progressive web app before the product moved to a native Android app.\n\n' +
          'His own products are mobile-first too: **EvCopilot** is in an invite-only iPhone beta, and **FormDaily** lists web, iOS and Android.',
      ),
      projectCards(['evcopilot', 'formdaily']),
    ],
    {
      followUps: [
        'What projects is he working on?',
        'What did he do at Shall And Partners?',
        'How experienced is he with React and TypeScript?',
      ],
      sources: ['resume.shall', 'projects'],
      related: 'shall',
    },
  );
}

export function skills(): AssistantResponse {
  return response(
    'skills',
    [
      text(
        "Here are Marcio's skills grouped by area. There are no self-rated percentages — the experience timeline holds the evidence for each one.",
      ),
      skillGroups(),
      text(
        'His strongest documented areas are **React and Next.js architecture** and **performance**, both backed by measurable results at Deel and Roots.',
      ),
    ],
    {
      followUps: [
        'How experienced is he with React and TypeScript?',
        'How did he optimize performance?',
        'How does he approach accessibility?',
      ],
      sources: ['resume.skills', 'resume.deel', 'resume.roots'],
    },
  );
}

export function nextjs(): AssistantResponse {
  return response(
    'nextjs',
    [
      text(
        'Yes. At **Maison Modern** (2020 — 2022), Marcio built responsive digital magazines and newsletters with Next.js and React, distributed across multiple countries. He implemented server-side rendering to improve SEO and initial load speed, integrated the frontend with external publishing platforms, and kept editorial products fast for thousands of daily readers.',
      ),
      skillGroups(['frontend', 'architecture']),
    ],
    {
      followUps: [
        'How did he optimize performance?',
        'What did he do at Maison Modern?',
        'How experienced is he with React and TypeScript?',
      ],
      sources: ['resume.maison', 'resume.skills'],
      related: 'maison',
    },
  );
}

export function designSystems(): AssistantResponse {
  return response(
    'designSystems',
    [
      text(
        'At **Toptal**, Marcio architected and implemented a modular React and TypeScript component library that speeds up feature development and keeps the UI consistent across multiple product teams — paired with advanced accessibility standards he led.\n\n' +
          'Earlier, he standardized the HRIS frontend architecture at Deel and established coding standards at Maison Modern.',
      ),
    ],
    {
      followUps: [
        'How does he approach accessibility?',
        'How does he approach frontend architecture?',
        'What is he working on at Toptal?',
      ],
      sources: ['resume.toptal', 'resume.deel', 'resume.maison'],
      related: 'toptal',
    },
  );
}

export function accessibility(): AssistantResponse {
  return response(
    'accessibility',
    [
      text(
        "Accessibility appears in three of Marcio's roles:\n\n" +
          '- **Toptal** — led the integration of advanced accessibility standards, broadening the product to users with diverse accessibility needs.\n' +
          '- **Roots** — integrated accessibility standards together with UX designers.\n' +
          '- **Maison Modern** — built intuitive, accessible interfaces from complex requirements with UX designers.',
      ),
      note(
        'gap',
        "The specific standard levels (for example, WCAG 2.1 AA) aren't named in his resume.",
      ),
    ],
    {
      followUps: [
        'What does he know about design systems?',
        'What is he working on at Toptal?',
        'How does he work with product teams?',
      ],
      sources: ['resume.toptal', 'resume.roots', 'resume.maison'],
      related: 'toptal',
    },
  );
}

export function testing(): AssistantResponse {
  return response(
    'testing',
    [
      text(
        "Frontend testing strategies are listed among Marcio's core skills. In practice, his documented quality work includes standardized error handling at Deel, code reviews and pair programming, and coding standards he set at Maison Modern to reduce bugs.",
      ),
      note(
        'gap',
        "The specific testing frameworks and coverage practices he uses aren't documented.",
      ),
    ],
    {
      followUps: [
        'How does he think about code quality?',
        'How does he raise code quality?',
        'What are his strongest technical skills?',
      ],
      sources: ['resume.skills', 'resume.deel', 'resume.maison'],
    },
  );
}

export function philosophy(): AssistantResponse {
  const principles = knowledgeBase.principles
    .map((principle) => `- **${principle.title}** — ${principle.text}`)
    .join('\n');
  return response(
    'philosophy',
    [
      text(
        `${knowledgeBase.profile.focus.replace(/^He/, 'Marcio')}\n\n### Principles he works by\n${principles}\n\n` +
          '### Where they show up\n' +
          '- A shared component library for consistent UI across teams at Toptal.\n' +
          '- Standardized HRIS architecture at Deel.\n' +
          '- Code reviews, pair programming and coding standards at Deel and Maison Modern.',
      ),
    ],
    {
      followUps: [
        'How does he approach frontend architecture?',
        'How does he work with product teams?',
        'What are his biggest technical achievements?',
      ],
      sources: ['profile', 'principles', 'resume.toptal', 'resume.deel', 'resume.maison'],
    },
  );
}

export function codeQuality(): AssistantResponse {
  return response(
    'codeQuality',
    [
      text(
        "Marcio's engineering principles treat quality as a structural concern: readable, explicit code; small composable components; shared logic centralized instead of duplicated; and security enforced on the server.\n\n" +
          'In practice that has meant standardized error handling and state management, code reviews and pair programming, coding standards at Maison Modern, and a move to React Hooks at Shall And Partners. Frontend testing strategies are part of his core skills.',
      ),
    ],
    {
      followUps: [
        "What's his engineering philosophy?",
        'How did he optimize performance?',
        'How does he approach frontend architecture?',
      ],
      sources: ['principles', 'resume.deel', 'resume.maison', 'resume.shall', 'resume.skills'],
    },
  );
}

export function projects(): AssistantResponse {
  return response(
    'projects',
    [
      text(
        'Alongside his professional work, Marcio builds his own products. Three already have public sites — **EvCopilot** (iPhone beta), **FormDaily** (invite-only) and **TargUp** (in development) — and **FictionDraft** is still a concept.',
      ),
      projectCards(),
    ],
    {
      followUps: [
        'Tell me more about EvCopilot.',
        'Tell me more about FormDaily.',
        'What is TargUp?',
      ],
      sources: ['projects'],
    },
  );
}

export function project(projectId: ProjectId): AssistantResponse {
  const subject = projectById(projectId);
  const next = knowledgeBase.projects.find((other) => other.id !== projectId && other.live);
  const lead = subject.live
    ? `**${subject.name}** is one of Marcio's own products. ${subject.description}`
    : `**${subject.name}** is one of Marcio's product concepts: ${subject.description.charAt(0).toLowerCase()}${subject.description.slice(1)}`;
  return response(
    `project:${projectId}`,
    [
      text(lead),
      projectCards([projectId]),
      note(
        'gap',
        subject.live
          ? "Usage numbers and business metrics aren't published, so I won't speculate about them."
          : "It's at the concept stage, so there is no implementation to describe yet.",
      ),
    ],
    {
      followUps: [
        next ? `Tell me more about ${next.name}.` : 'What projects is he working on?',
        'What projects is he working on?',
        'Has he ever built something from scratch?',
      ],
      sources: ['projects'],
    },
  );
}

function languageTable() {
  return table(
    ['Language', 'Level'],
    knowledgeBase.languages.map((language) => [language.name, language.level]),
    'Languages',
  );
}

export function education(): AssistantResponse {
  const { degree, school, schoolShort, location, year } = knowledgeBase.education;
  const courses = knowledgeBase.certifications
    .map((certification) => `- ${certification.name} (${certification.issuer})`)
    .join('\n');
  return response(
    'education',
    [
      text(
        `Marcio holds a **${degree.replace("Bachelor's Degree", "Bachelor's degree")}** from ${school} (${schoolShort}), ${location}, completed in ${String(year)}.`,
      ),
      languageTable(),
      details('Courses and certifications', courses),
    ],
    {
      followUps: [
        "Tell me about Marcio's career.",
        'Can I see his resume?',
        'How can I contact Marcio?',
      ],
      sources: ['resume.education', 'resume.languages', 'resume.certifications'],
    },
  );
}

export function languages(question: string): AssistantResponse {
  const asked = knowledgeBase.languages.find((language) =>
    new RegExp(`\\b${language.name}\\b`, 'i').test(question),
  );
  let lead = 'Marcio works in four languages:';
  if (asked?.level === 'Native') lead = `${asked.name} is his native language.`;
  else if (asked)
    lead = `Yes — ${asked.name} at ${asked.level === 'Intermediate' ? 'an intermediate' : `a ${asked.level.toLowerCase()}`} level.`;
  return response('languages', [text(lead), languageTable()], {
    followUps: [
      'Where did he study?',
      "Tell me about Marcio's career.",
      'How can I contact Marcio?',
    ],
    sources: ['resume.languages'],
  });
}

export function location(): AssistantResponse {
  const { city, country } = knowledgeBase.profile.location;
  return response(
    'location',
    [
      text(
        city
          ? `Marcio is based in **${city}, ${country}**.`
          : `Marcio is based in **${country}**. His city isn't documented in his portfolio, so I won't guess it.`,
      ),
    ],
    {
      followUps: [
        'How can I contact Marcio?',
        'What languages does he speak?',
        "Tell me about Marcio's career.",
      ],
      sources: ['profile'],
    },
  );
}

export function contact(): AssistantResponse {
  return response(
    'contact',
    [
      text(
        'The best way to reach Marcio is by email or LinkedIn. He is open to conversations about engineering, architecture and product opportunities.',
      ),
      contactCard(),
    ],
    {
      followUps: [
        'Can I see his resume?',
        'Would he fit a technical leadership position?',
        "Tell me about Marcio's career.",
      ],
      sources: ['profile'],
    },
  );
}

export function resume(context: ConversationContext): AssistantResponse {
  const url = knowledgeBase.contact.resumeUrl;
  return response(
    'resume',
    [
      text(
        url
          ? `Sure — you can [open his resume as a PDF](${url}). Here is the career history it covers:`
          : "His resume PDF isn't published on this site yet, so you can request it by email. Here is the documented career history in the meantime:",
      ),
      timeline(),
      contactOnce(context),
    ],
    {
      followUps: [
        'What are his biggest technical achievements?',
        'What are his strongest technical skills?',
        'Where did he study?',
      ],
      sources: allRoleSources(),
    },
  );
}
