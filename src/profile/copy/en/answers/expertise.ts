import type { AssistantResponse, ConversationContext } from '@/core/assistant/response';
import {
  bullets,
  details,
  note,
  numbered,
  table,
  text,
  type ResponseKit,
} from '@/core/assistant/response-kit';
import { createFacts, inWords } from './facts';

/** Answers about expertise, products, background and contact. */
export function createExpertiseAnswers(kit: ResponseKit) {
  const {
    productDepth,
    projectById,
    roleById,
    allRoleSources,
    contactCard,
    contactOnce,
    metrics,
    projects: projectCards,
    response,
    skills: skillGroups,
    timeline,
    knowledge,
  } = kit;
  const { practice } = knowledge;
  const {
    first,
    employer,
    period,
    years,
    product,
    metric,
    award,
    amount,
    before,
    after,
    countsInWords,
  } = createFacts(kit);
  const team = countsInWords('roots-team');
  const liveCount = inWords(knowledge.projects.filter((project) => project.live).length);
  const liveProducts = `${liveCount.charAt(0).toUpperCase()}${liveCount.slice(1)}`;
  const peopleList = countsInWords('deel-people-list');
  const criticalLoad =
    metric('deel-critical-load') === '50%'
      ? 'halved critical page loading time'
      : `cut critical page loading time by ${metric('deel-critical-load')}`;

  function react(): AssistantResponse {
    return response(
      'react',
      [
        text(
          `React sits at the center of ${first}'s documented work from ${years('shall').from} to today. Rather than a single claim of expertise, here is the evidence by area:\n\n` +
            `- **Complex product interfaces** — helped lead the HRIS team at ${employer('deel')} and standardized its architecture, state management and error handling.\n` +
            `- **Performance** — improved Web Vitals by ${metric('deel-web-vitals')} and ${criticalLoad} at ${employer('deel')}.\n` +
            `- **State management** — implemented advanced state management at ${employer('roots')}, where he built the frontend end to end.\n` +
            `- **Next.js and SSR** — built responsive digital magazines with Next.js and server-side rendering at ${employer('maison')}.\n` +
            `- **Modernization** — refactored a codebase to React Hooks at ${employer('shall')}.`,
        ),
        skillGroups(['frontend', 'architecture']),
        text(
          `### The React toolset he works with\n${practice.toolset.find((area) => area.area === 'Frontend and UI')?.items ?? ''}.`,
        ),
      ],
      {
        followUps: [
          'How does he approach frontend architecture?',
          `What has he built at ${employer('deel')}?`,
          'Has he worked with backend systems?',
        ],
        sources: [
          'resume.deel',
          'resume.roots',
          'resume.maison',
          'resume.shall',
          'resume.skills',
          'notes',
        ],
        related: 'deel',
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

  function architecture(): AssistantResponse {
    return response(
      'architecture',
      [
        text(
          `${first}'s architecture work follows a consistent thread: standardize the foundations, keep components modular, and tie structural decisions to measurable product outcomes.\n\n` +
            '### Documented decisions\n' +
            `- **${employer('way2b1')}** — migrates legacy code to a modern, maintainable base across several products.\n` +
            `- **${employer('deel')}** — standardized HRIS frontend architecture to improve structure, state management, error handling and scalability.\n` +
            `- **${employer('roots')}** — directed frontend strategy, introduced advanced state management and set up GitLab CI pipelines deploying to Amazon S3.\n` +
            `- **${employer('maison')}** — implemented SSR with Next.js and integrated the frontend with external publishing platforms.\n` +
            `- **${employer('shall')}** — moved the codebase to React Hooks and built apps within a microservices architecture.`,
        ),
        text(
          `### What he treats as frontend architecture\n${bullets(practice.frontendArchitecture)}`,
        ),
        text(
          `### How he designs a system\n${numbered(practice.designProcess)}\n\nThe trade-offs he weighs most often: ${practice.decisionCriteria.map((criterion) => criterion.charAt(0).toLowerCase() + criterion.slice(1)).join('; ')}.`,
        ),
        details(
          `The engineering problem at ${employer('roots')}, ${employer('deel')} and ${employer('way2b1')}`,
          (['roots', 'deel', 'way2b1'] as const)
            .map((id) => {
              const study = practice.caseStudies[id];
              return study
                ? `**${roleById(id).company}** — ${study.problem}\n\n${bullets(study.angles)}`
                : '';
            })
            .join('\n\n'),
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
          'resume.deel',
          'resume.roots',
          'resume.maison',
          'resume.shall',
          'principles',
          'notes',
        ],
        related: 'deel',
      },
    );
  }

  function performance(): AssistantResponse {
    return response(
      'performance',
      [
        text(`Performance is one of the most consistently documented themes in ${first}'s work:`),
        metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list', 'way2b1-bundle']),
        text(
          '### How he got there\n' +
            `- **${employer('way2b1')}** — refactored and optimized critical workflows platform-wide; bundle size down by nearly ${amount('way2b1-bundle')} and loading times down to a few hundred milliseconds.\n` +
            `- **${employer('deel')}** — targeted refactoring and optimization of critical pages; the People List page went from ${peopleList.from} seconds to ${peopleList.to} on a cold run.\n` +
            `- **${employer('maison')}** — server-side rendering to improve SEO and initial load speed for editorial products read by thousands daily.`,
        ),
        text(
          `### How he approaches a performance problem\n${bullets(practice.performanceApproach)}`,
        ),
      ],
      {
        followUps: [
          `What has he built at ${employer('deel')}?`,
          'Does he have Next.js and SSR experience?',
          'How does he approach frontend architecture?',
        ],
        sources: ['resume.way2b1', 'resume.deel', 'resume.maison', 'resume.skills', 'notes'],
        related: 'deel',
      },
    );
  }

  function backend(): AssistantResponse {
    return response(
      'backend',
      [
        text(
          `Yes, with a clear distinction: ${first} is a frontend specialist who also has hands-on full-stack experience. ${practice.fullStack.summary}`,
        ),
        text(`### Company by company\n${bullets(practice.fullStack.byCompany)}`),
        text(`### In his own products\n${practice.fullStack.ownProducts}`),
        skillGroups(['backend']),
        note(
          'inference',
          `His deepest specialization is frontend; his current role at ${employer('way2b1')} is full stack, and at ${employer('roots')} and ${employer('deel')} the backend belonged to other teams.`,
        ),
      ],
      {
        followUps: [
          `What did he do at ${employer('shall')}?`,
          'What are his strongest technical skills?',
          'How does he approach frontend architecture?',
        ],
        sources: [
          'resume.shall',
          'resume.way2b1',
          'resume.roots',
          'resume.deel',
          'resume.skills',
          'notes',
        ],
        related: 'shall',
      },
    );
  }

  function mobile(): AssistantResponse {
    return response(
      'mobile',
      [
        text(
          `Yes. At **${employer('shall')}**, ${first} built web and mobile applications — including one that received the ${award('shall').won} — and led development of a progressive web app before the product moved to a native Android app.\n\n` +
            `His own products are mobile-first too: **${product('evcopilot')}** is in an invite-only iPhone beta, and **${product('formdaily')}** lists web, iOS and Android. ${practice.mobileExplorations}`,
        ),
        projectCards(['evcopilot', 'formdaily']),
      ],
      {
        followUps: [
          'What projects is he working on?',
          `What did he do at ${employer('shall')}?`,
          'How experienced is he with React and TypeScript?',
        ],
        sources: ['resume.shall', 'projects', 'notes'],
        related: 'shall',
      },
    );
  }

  function skills(): AssistantResponse {
    return response(
      'skills',
      [
        text(
          `Here are ${first}'s skills grouped by area. There are no self-rated percentages — the experience timeline holds the evidence for each one.`,
        ),
        skillGroups(),
        text(
          `His strongest documented areas are **React and Next.js architecture** and **performance**, both backed by measurable results at ${employer('deel')} and ${employer('roots')}.`,
        ),
        text(
          `### How deep the evidence goes\n${bullets(practice.skillDepth.map(({ area, items }) => `**${area}** — ${items}`))}`,
        ),
        text(
          `### Toolset\n${bullets(practice.toolset.map(({ area, items }) => `**${area}** — ${items}`))}`,
        ),
      ],
      {
        followUps: [
          'How experienced is he with React and TypeScript?',
          'How did he optimize performance?',
          'How does he approach accessibility?',
        ],
        sources: ['resume.skills', 'resume.deel', 'resume.roots', 'notes'],
      },
    );
  }

  function nextjs(): AssistantResponse {
    return response(
      'nextjs',
      [
        text(
          `Yes. At **${employer('maison')}** (${period('maison')}), ${first} built responsive digital magazines and newsletters with Next.js and React, distributed across multiple countries. He implemented server-side rendering to improve SEO and initial load speed, integrated the frontend with external publishing platforms, and kept editorial products fast for thousands of daily readers.`,
        ),
        text(
          `### How he decides what renders where\n${bullets(practice.frontendArchitecture.filter((decision) => /SSR|state/.test(decision)))}`,
        ),
        skillGroups(['frontend', 'architecture']),
      ],
      {
        followUps: [
          'How did he optimize performance?',
          `What did he do at ${employer('maison')}?`,
          'How experienced is he with React and TypeScript?',
        ],
        sources: ['resume.maison', 'resume.skills', 'notes'],
        related: 'maison',
      },
    );
  }

  function designSystems(): AssistantResponse {
    return response(
      'designSystems',
      [
        text(
          `His documented work on shared UI foundations is architectural: at **${employer('deel')}** he standardized the HRIS frontend architecture — structure, state management and error handling — across product areas, and at **${employer('maison')}** he established coding standards and led code reviews.\n\n` +
            'Building reusable components and modules without giving up readability is part of how he works, and design systems are among the themes he follows closely.',
        ),
      ],
      {
        followUps: [
          'How does he approach accessibility?',
          'How does he approach frontend architecture?',
          `What is he working on at ${employer('way2b1')}?`,
        ],
        sources: ['resume.deel', 'resume.maison', 'notes'],
        related: 'deel',
      },
    );
  }

  function accessibility(): AssistantResponse {
    return response(
      'accessibility',
      [
        text(
          `Accessibility appears in two of ${first}'s roles:\n\n` +
            `- **${employer('roots')}** — integrated accessibility standards together with UX designers.\n` +
            `- **${employer('maison')}** — built intuitive, accessible interfaces from complex requirements with UX designers.\n\n` +
            'He treats accessibility as a requirement of the foundation rather than a late fix on individual screens, and checks it alongside design, tests and performance before calling a feature done.',
        ),
      ],
      {
        followUps: [
          'What does he know about design systems?',
          'How does he approach frontend architecture?',
          'How does he work with product teams?',
        ],
        sources: ['resume.roots', 'resume.maison', 'notes'],
        related: 'roots',
      },
    );
  }

  function testing(): AssistantResponse {
    return response(
      'testing',
      [
        text(
          `Frontend testing strategies are listed among ${first}'s core skills. In practice, his documented quality work includes standardized error handling at ${employer('deel')}, code reviews and pair programming, and coding standards he set at ${employer('maison')} to reduce bugs.`,
        ),
        text(
          '### How he approaches testing\n' +
            '- **Sized to risk** — unit, integration, contract and end-to-end tests chosen by how much each flow can break, not by a coverage target.\n' +
            '- **Tested at the boundaries** — modules with clear interfaces, so behaviour can be checked without wiring the whole app.\n' +
            '- **Checked before release** — typecheck, lint, reproducible builds and the critical flows verified before shipping.\n' +
            '- **Watched after release** — error monitoring and Web Vitals to catch regressions.\n\n' +
            `Tools in his practice: ${practice.toolset.find((area) => area.area === 'Testing and quality')?.items ?? ''}.`,
        ),
      ],
      {
        followUps: [
          'How does he think about code quality?',
          'How does he raise code quality?',
          'What are his strongest technical skills?',
        ],
        sources: ['resume.skills', 'resume.deel', 'resume.maison', 'notes'],
      },
    );
  }

  const PRINCIPLES_IN_PRACTICE: Readonly<Record<string, string>> = {
    'Maintainability over cleverness': `Coding standards and code reviews at ${employer('maison')}; a move to React Hooks at ${employer('shall')}.`,
    'Composition over monoliths': `Legacy code moved to a modern, modular codebase across several products at ${employer('way2b1')}.`,
    'Reuse before rewriting': `One standardized HRIS frontend architecture across product areas at ${employer('deel')}.`,
    'Architecture sized to the problem': `A React frontend built from an early stage at ${employer('roots')}, then organized for a team of ${team.to}.`,
    'Performance from the design': `Critical pages ${metric('deel-critical-load')} faster and People List from ${before('deel-people-list')} to ${after('deel-people-list')} at ${employer('deel')}; SSR for editorial products at ${employer('maison')}.`,
    'UX and visual fidelity': `Accessibility built in with UX designers at ${employer('roots')} and ${employer('maison')}.`,
    'Verifiable quality': `Pair programming, code reviews and onboarding at ${employer('deel')}; GitLab CI pipelines at ${employer('roots')}.`,
    'Explicit trade-offs': `Technical trade-offs and delivery plans defined with Product and Engineering at ${employer('deel')}.`,
    'Security on the server':
      'In the designs of his own products: permissions checked on the backend, role-based access and tenant isolation.',
  };

  function philosophy(): AssistantResponse {
    return response(
      'philosophy',
      [
        text(
          `${first}'s philosophy is pragmatic: readable code other people can evolve, architecture sized to the product's real stage, and quality he can verify rather than assume. Each principle below is paired with where it shows up in his work.`,
        ),
        text(
          `### Each principle in practice\n${bullets(
            knowledge.principles.map(
              (principle) =>
                `**${principle.title}** — ${principle.text} **In practice:** ${PRINCIPLES_IN_PRACTICE[principle.title] ?? ''}`,
            ),
          )}`,
        ),
        text(`### How he takes a problem to delivery\n${numbered(practice.designProcess)}`),
        text(`### Day to day\n${numbered(practice.workflow)}`),
        note(
          'inference',
          'The process and the day-to-day loop summarize how he describes his work; they are not a formal method any one employer adopted.',
        ),
      ],
      {
        followUps: [
          'Show me examples of architectural decisions.',
          'How does he use AI in engineering?',
          'How does he think about code quality?',
        ],
        sources: [
          'principles',
          'resume.way2b1',
          'resume.deel',
          'resume.roots',
          'resume.maison',
          'resume.shall',
          'notes',
        ],
      },
    );
  }

  function aiEngineering(): AssistantResponse {
    const ai = practice.aiEngineering;
    return response(
      'aiEngineering',
      [
        text(ai.summary),
        text(`### Tools\n${bullets(ai.tools)}`),
        text(`### How he works with agents\n${bullets(ai.practices)}`),
        text(`### AI inside products\n${ai.inProducts}`),
      ],
      {
        followUps: [
          "What's his engineering philosophy?",
          'How does he approach frontend architecture?',
          'What projects is he working on?',
        ],
        sources: ['notes'],
      },
    );
  }

  function codeQuality(): AssistantResponse {
    return response(
      'codeQuality',
      [
        text(
          `${first}'s engineering principles treat quality as a structural concern: readable, explicit code; small composable components; shared logic centralized instead of duplicated; and security enforced on the server.\n\n` +
            `In practice that has meant standardized error handling and state management, code reviews and pair programming, coding standards at ${employer('maison')}, and a move to React Hooks at ${employer('shall')}. Frontend testing strategies are part of his core skills.`,
        ),
        text(`### What a healthy codebase means to him\n${bullets(practice.qualityPractices)}`),
      ],
      {
        followUps: [
          "What's his engineering philosophy?",
          'How did he optimize performance?',
          'How does he approach frontend architecture?',
        ],
        sources: [
          'principles',
          'resume.deel',
          'resume.maison',
          'resume.shall',
          'resume.skills',
          'notes',
        ],
      },
    );
  }

  function projects(): AssistantResponse {
    return response(
      'projects',
      [
        text(
          `Alongside his professional work, ${first} builds his own products. ${liveProducts} already have public sites — **${product('evcopilot')}** (iPhone beta), **${product('formdaily')}** (invite-only) and **${product('targup')}** (in development) — and **${product('fictiondraft')}** is still a concept.`,
        ),
        projectCards(),
        text(
          `### The engineering behind them\n${bullets(knowledge.projects.map((item) => `**${item.name}** — ${productDepth(item.id)}`))}`,
        ),
      ],
      {
        followUps: [
          `Tell me more about ${product('evcopilot')}.`,
          `Tell me more about ${product('formdaily')}.`,
          `What is ${product('targup')}?`,
        ],
        sources: ['projects', 'notes'],
      },
    );
  }

  function project(projectId: string): AssistantResponse {
    const subject = projectById(projectId);
    const next = knowledge.projects.find((other) => other.id !== projectId && other.live);
    const lead = subject.live
      ? `**${subject.name}** is one of ${first}'s own products. ${subject.description}`
      : `**${subject.name}** is one of ${first}'s product concepts: ${subject.description.charAt(0).toLowerCase()}${subject.description.slice(1)}`;
    return response(
      `project:${projectId}`,
      [
        text(lead),
        projectCards([projectId]),
        text(`### The engineering behind it\n${productDepth(projectId)}`),
      ],
      {
        followUps: [
          next ? `Tell me more about ${next.name}.` : 'What projects is he working on?',
          'What projects is he working on?',
          'Has he ever built something from scratch?',
        ],
        sources: ['projects', 'notes'],
      },
    );
  }

  function languageTable() {
    return table(
      ['Language', 'Level'],
      knowledge.languages.map((language) => [language.name, language.level]),
      'Languages',
    );
  }

  function education(): AssistantResponse {
    const { degree, school, schoolShort, location, year } = knowledge.education;
    const courses = knowledge.certifications
      .map((certification) => `- ${certification.name} (${certification.issuer})`)
      .join('\n');
    return response(
      'education',
      [
        text(
          `${first} holds a **${degree.replace("Bachelor's Degree", "Bachelor's degree")}** from ${school} (${schoolShort}), ${location}, completed in ${String(year)}.`,
        ),
        languageTable(),
        details('Courses and certifications', courses),
        text(`### Continuous learning\n${practice.learningStyle}\n\n${bullets(practice.studies)}`),
      ],
      {
        followUps: [
          `Tell me about ${first}'s career.`,
          'Can I see his resume?',
          `How can I contact ${first}?`,
        ],
        sources: ['resume.education', 'resume.languages', 'resume.certifications', 'notes'],
      },
    );
  }

  function languages(question: string): AssistantResponse {
    const asked = knowledge.languages.find((language) =>
      new RegExp(`\\b${language.name}\\b`, 'i').test(question),
    );
    let lead = `${first} works in ${inWords(knowledge.languages.length)} languages:`;
    if (asked?.level === 'Native') lead = `${asked.name} is his native language.`;
    else if (asked)
      lead = `Yes — ${asked.name} at ${asked.level === 'Intermediate' ? 'an intermediate' : `a ${asked.level.toLowerCase()}`} level.`;
    return response('languages', [text(lead), languageTable()], {
      followUps: [
        'Where did he study?',
        `Tell me about ${first}'s career.`,
        `How can I contact ${first}?`,
      ],
      sources: ['resume.languages'],
    });
  }

  function location(): AssistantResponse {
    const { city, country } = knowledge.profile.location;
    return response(
      'location',
      [
        text(
          city
            ? `${first} is based in **${city}, ${country}**.`
            : `${first} is based in **${country}**. His city isn't documented in his portfolio, so I won't guess it.`,
        ),
      ],
      {
        followUps: [
          `How can I contact ${first}?`,
          'What languages does he speak?',
          `Tell me about ${first}'s career.`,
        ],
        sources: ['profile'],
      },
    );
  }

  function contact(): AssistantResponse {
    return response(
      'contact',
      [
        text(
          `The best way to reach ${first} is by email or LinkedIn. He is open to conversations about engineering, architecture and product opportunities.`,
        ),
        contactCard(),
      ],
      {
        followUps: [
          'Can I see his resume?',
          'Would he fit a technical leadership position?',
          `Tell me about ${first}'s career.`,
        ],
        sources: ['profile'],
      },
    );
  }

  function resume(context: ConversationContext): AssistantResponse {
    const url = knowledge.contact.resumeUrl;
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

  return {
    react,
    architecture,
    performance,
    backend,
    mobile,
    skills,
    nextjs,
    designSystems,
    accessibility,
    testing,
    philosophy,
    aiEngineering,
    codeQuality,
    projects,
    project,
    education,
    languages,
    location,
    contact,
    resume,
  };
}
