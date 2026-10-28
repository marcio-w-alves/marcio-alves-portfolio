import type { ProjectId } from '@/core/knowledge/ids';
import { knowledgeBase, projectById } from '@/core/knowledge/knowledge-base';
import type { AssistantResponse, ConversationContext } from '../../response';
import {
  allRoleSources,
  contactCard,
  contactOnce,
  metrics,
  note,
  projects as projectCards,
  response,
  skills as skillGroups,
  table,
  text,
  timeline,
} from '../../response-kit';

/** Answers about expertise, projects, background and contact. */

export function react(): AssistantResponse {
  return response(
    'react',
    [
      text(
        "React sits at the center of Marcio's documented work from 2018 to today — from React and Node.js applications at Shall And Partners to React/TypeScript architecture at Toptal. Rather than a single claim of expertise, here is the evidence by area:\n\n" +
          '- **Component architecture** — architected a modular React and TypeScript component library at Toptal, used across multiple product teams.\n' +
          '- **Complex enterprise interfaces** — led the HRIS team at Deel and standardized its frontend architecture.\n' +
          '- **Performance** — improved Web Vitals by 30%+ and cut critical page loading time by 50% at Deel.\n' +
          '- **State management** — implemented advanced state management at Roots, where he built the frontend end to end.\n' +
          '- **Next.js and SSR** — implemented server-side rendering for SEO and initial load speed at Maison Modern.\n' +
          '- **Modernization** — refactored a codebase to React Hooks at Shall And Partners.',
      ),
      skillGroups(['frontend', 'architecture']),
      note(
        'gap',
        'His resume lists React work per role rather than exact years per technology, so I describe the span of documented roles instead of a precise number.',
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
        "Marcio's documented architecture work follows a consistent thread: standardize the foundations, keep components modular, and tie structural decisions to measurable product outcomes.\n\n" +
          '### Documented decisions\n' +
          '- **Toptal** — architected a modular React and TypeScript component library and planned the initial architecture for a new product.\n' +
          '- **Deel** — standardized frontend architecture for HRIS interfaces, covering structure, state management, error handling and scalability.\n' +
          '- **Roots** — directed frontend technical strategy and architecture, and implemented advanced state management.\n' +
          '- **Maison Modern** — implemented server-side rendering with Next.js for SEO and initial load speed.\n' +
          '- **Shall And Partners** — refactored a codebase to React Hooks and built applications within a microservices architecture.\n\n' +
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
        'Has he ever built something from scratch?',
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
      text(
        "Performance is one of the most consistently documented themes in Marcio's work, with results at two companies:",
      ),
      metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list', 'roots-initial-load']),
      text(
        '### How the results were achieved\n' +
          '- **Deel** — critical page loading time was cut by 50% through **targeted refactoring and optimization**; the People List page went from six seconds to three on a cold run.\n' +
          '- **Roots** — **bundle size optimization** produced a 30% faster initial load across key user flows.\n' +
          '- **Maison Modern** — **server-side rendering** improved SEO and initial load speed.',
      ),
      note(
        'gap',
        "The resume names these techniques but doesn't break them down further, so I won't guess at the specific changes.",
      ),
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
          '- **Shall And Partners (2018 — 2020)** — Full Stack Developer who engineered RESTful APIs and built web and mobile applications within a microservices architecture using Node.js and multiple databases.\n' +
          '- **Roots** — established CI pipelines on GitLab deploying to Amazon S3.\n' +
          '- **Toptal** — collaborates with backend engineers to design and optimize RESTful APIs.',
      ),
      skillGroups(['backend']),
      note(
        'inference',
        'Based on his role titles, backend work in his recent positions is collaborative (APIs, delivery pipelines) rather than his primary ownership.',
      ),
    ],
    {
      followUps: [
        'What did he do at Shall And Partners?',
        'What are his strongest technical skills?',
        'How does he approach frontend architecture?',
      ],
      sources: ['resume.shall', 'resume.roots', 'resume.toptal', 'resume.skills'],
      related: 'shall',
    },
  );
}

export function skills(): AssistantResponse {
  return response(
    'skills',
    [
      text(
        "Here are Marcio's skills grouped by area. There are no self-rated percentages — the experience timeline holds the evidence for each area.",
      ),
      skillGroups(),
      text(
        'His strongest documented areas are **React and TypeScript architecture** and **performance**, which carry measurable results at Deel and Roots.',
      ),
    ],
    {
      followUps: [
        'How experienced is he with React and TypeScript?',
        'How did he optimize performance?',
        'Has he worked with backend systems?',
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
        'Yes. At **Maison Modern** (2020 — 2022), Marcio developed responsive digital magazines and newsletters with Next.js and React for distribution across multiple countries, and implemented server-side rendering to enhance SEO and improve initial load speed. Next.js and server-side rendering are also among his listed core skills.',
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
        "Design systems are part of Marcio's listed architecture skills. The closest documented work is at **Toptal**, where he architected and implemented a modular React and TypeScript component library to accelerate feature development and ensure UI consistency across multiple product teams. He also standardized frontend architecture at **Deel**, and led accessibility work at Toptal, Roots and Maison Modern.",
      ),
      note(
        'gap',
        "The component library isn't documented by name, and no public design system is listed.",
      ),
    ],
    {
      followUps: [
        'How does he approach frontend architecture?',
        "What's his engineering philosophy?",
        'What is he working on at Toptal?',
      ],
      sources: ['resume.skills', 'resume.toptal', 'resume.deel', 'resume.roots', 'resume.maison'],
      related: 'toptal',
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
          '- A modular component library shared across product teams at Toptal.\n' +
          '- Standardized HRIS frontend architecture at Deel, alongside a two-thirds smaller bug backlog.\n' +
          '- Measurable performance work tied to user-facing outcomes at Deel and Roots.',
      ),
    ],
    {
      followUps: [
        'How does he approach frontend architecture?',
        'How does he work with product teams?',
        'What are his biggest technical achievements?',
      ],
      sources: ['profile', 'principles', 'resume.toptal', 'resume.deel', 'resume.roots'],
    },
  );
}

export function codeQuality(): AssistantResponse {
  return response(
    'codeQuality',
    [
      text(
        "Marcio's engineering principles treat quality as a structural concern: readable, explicit code; small composable components; shared logic centralized instead of duplicated; and security enforced on the server.\n\n" +
          'In his documented work this shows up as pair programming, code reviews and structured knowledge-sharing at Deel, alongside a two-thirds smaller bug backlog from planned bug sprints; code reviews and coding standards he established at Maison Modern; and accessibility standards at Toptal and Roots. Frontend testing strategies are one of his listed core skills.',
      ),
    ],
    {
      followUps: [
        "What's his engineering philosophy?",
        'How did he reduce the bug backlog at Deel?',
        'How does he approach frontend architecture?',
      ],
      sources: ['principles', 'resume.deel', 'resume.maison', 'resume.toptal', 'resume.skills'],
    },
  );
}

export function projects(): AssistantResponse {
  return response(
    'projects',
    [
      text(
        'Alongside his professional work, Marcio is developing four independent product concepts. They are early-stage, so the previews below describe **planned scope**, not shipped products.',
      ),
      projectCards(),
    ],
    {
      followUps: [
        'Tell me more about EvCopilot.',
        'What is FictionDraft?',
        'Has he ever built something from scratch?',
      ],
      sources: ['projects'],
    },
  );
}

export function project(projectId: ProjectId): AssistantResponse {
  const subject = projectById(projectId);
  const next = knowledgeBase.projects.find((other) => other.id !== projectId);
  const description = subject.description.charAt(0).toLowerCase() + subject.description.slice(1);
  return response(
    `project:${projectId}`,
    [
      text(`**${subject.name}** is one of Marcio's independent product concepts: ${description}`),
      projectCards([projectId]),
      note(
        'gap',
        "Implementation status, users, revenue and release dates aren't documented, so I won't speculate about them.",
      ),
    ],
    {
      followUps: [
        next ? `Tell me more about ${next.name}.` : 'What projects is he working on?',
        'What projects is he working on?',
        'How does he approach frontend architecture?',
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
  return response(
    'education',
    [
      text(
        `Marcio holds a **${degree.replace("Bachelor's Degree", "Bachelor's degree")}** from ${school} (${schoolShort}), in ${location}, completed in ${String(year)}.`,
      ),
      languageTable(),
    ],
    {
      followUps: [
        "Tell me about Marcio's career.",
        'Can I see his resume?',
        'How can I contact Marcio?',
      ],
      sources: ['resume.education', 'resume.languages'],
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

export function certifications(): AssistantResponse {
  const list = knowledgeBase.certifications
    .map((certification) => `- ${certification.name} — ${certification.issuer}`)
    .join('\n');
  return response(
    'certifications',
    [
      text(`His resume lists these courses as certifications:\n\n${list}`),
      note(
        'info',
        'These are courses, not professional experience. Angular and Android, for example, appear here rather than in his work history.',
      ),
    ],
    {
      followUps: [
        'What are his strongest technical skills?',
        'Where did he study?',
        "Tell me about Marcio's career.",
      ],
      sources: ['resume.certifications'],
    },
  );
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
          ? `You can [download his resume as a PDF](${url}). Here is the career history it covers:`
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
