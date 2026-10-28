import type { AssistantResponse, ConversationContext } from '../../response';
import {
  bullets,
  details,
  note,
  numbered,
  table,
  text,
  type ResponseKit,
} from '../../response-kit';

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

  function react(): AssistantResponse {
    return response(
      'react',
      [
        text(
          "React sits at the center of Marcio's documented work from 2018 to today. Rather than a single claim of expertise, here is the evidence by area:\n\n" +
            '- **Complex product interfaces** — helped lead the HRIS team at Deel and standardized its architecture, state management and error handling.\n' +
            '- **Performance** — improved Web Vitals by 30%+ and halved critical page loading time at Deel.\n' +
            '- **State management** — implemented advanced state management at Roots, where he built the frontend end to end.\n' +
            '- **Next.js and SSR** — built responsive digital magazines with Next.js and server-side rendering at Maison Moderne.\n' +
            '- **Modernization** — refactored a codebase to React Hooks at Shall And Partners.',
        ),
        skillGroups(['frontend', 'architecture']),
        text(
          `### The React toolset he works with\n${practice.toolset.find((area) => area.area === 'Frontend and UI')?.items ?? ''}.`,
        ),
      ],
      {
        followUps: [
          'How does he approach frontend architecture?',
          'What has he built at Deel?',
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
          "Marcio's architecture work follows a consistent thread: standardize the foundations, keep components modular, and tie structural decisions to measurable product outcomes.\n\n" +
            '### Documented decisions\n' +
            '- **Way2b1** — migrates legacy code to a modern, maintainable base across several products.\n' +
            '- **Deel** — standardized HRIS frontend architecture to improve structure, state management, error handling and scalability.\n' +
            '- **Roots** — directed frontend strategy, introduced advanced state management and set up GitLab CI pipelines deploying to Amazon S3.\n' +
            '- **Maison Moderne** — implemented SSR with Next.js and integrated the frontend with external publishing platforms.\n' +
            '- **Shall And Partners** — moved the codebase to React Hooks and built apps within a microservices architecture.',
        ),
        text(
          `### What he treats as frontend architecture\n${bullets(practice.frontendArchitecture)}`,
        ),
        text(
          `### How he designs a system\n${numbered(practice.designProcess)}\n\nThe trade-offs he weighs most often: ${practice.decisionCriteria.map((criterion) => criterion.charAt(0).toLowerCase() + criterion.slice(1)).join('; ')}.`,
        ),
        details(
          'The engineering problem at Roots, Deel and Way2b1',
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
        text("Performance is one of the most consistently documented themes in Marcio's work:"),
        metrics(['deel-web-vitals', 'deel-critical-load', 'deel-people-list', 'way2b1-bundle']),
        text(
          '### How he got there\n' +
            '- **Way2b1** — refactored and optimized critical workflows platform-wide; bundle size down by nearly 50% and loading times down to a few hundred milliseconds.\n' +
            '- **Deel** — targeted refactoring and optimization of critical pages; the People List page went from six seconds to three on a cold run.\n' +
            '- **Maison Moderne** — server-side rendering to improve SEO and initial load speed for editorial products read by thousands daily.',
        ),
        text(
          `### How he approaches a performance problem\n${bullets(practice.performanceApproach)}`,
        ),
      ],
      {
        followUps: [
          'What has he built at Deel?',
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
          `Yes, with a clear distinction: Marcio is a frontend specialist who also has hands-on full-stack experience. ${practice.fullStack.summary}`,
        ),
        text(`### Company by company\n${bullets(practice.fullStack.byCompany)}`),
        text(`### In his own products\n${practice.fullStack.ownProducts}`),
        skillGroups(['backend']),
        note(
          'inference',
          'His deepest specialization is frontend; his current role at Way2b1 is full stack, and at Roots and Deel the backend belonged to other teams.',
        ),
      ],
      {
        followUps: [
          'What did he do at Shall And Partners?',
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
          'Yes. At **Shall And Partners**, Marcio built web and mobile applications — including one that received the Golden Award in 2019 — and led development of a progressive web app before the product moved to a native Android app.\n\n' +
            `His own products are mobile-first too: **EvCopilot** is in an invite-only iPhone beta, and **FormDaily** lists web, iOS and Android. ${practice.mobileExplorations}`,
        ),
        projectCards(['evcopilot', 'formdaily']),
      ],
      {
        followUps: [
          'What projects is he working on?',
          'What did he do at Shall And Partners?',
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
          "Here are Marcio's skills grouped by area. There are no self-rated percentages — the experience timeline holds the evidence for each one.",
        ),
        skillGroups(),
        text(
          'His strongest documented areas are **React and Next.js architecture** and **performance**, both backed by measurable results at Deel and Roots.',
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
          'Yes. At **Maison Moderne** (2020 — 2022), Marcio built responsive digital magazines and newsletters with Next.js and React, distributed across multiple countries. He implemented server-side rendering to improve SEO and initial load speed, integrated the frontend with external publishing platforms, and kept editorial products fast for thousands of daily readers.',
        ),
        text(
          `### How he decides what renders where\n${bullets(practice.frontendArchitecture.filter((decision) => /SSR|state/.test(decision)))}`,
        ),
        skillGroups(['frontend', 'architecture']),
      ],
      {
        followUps: [
          'How did he optimize performance?',
          'What did he do at Maison Moderne?',
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
          'His documented work on shared UI foundations is architectural: at **Deel** he standardized the HRIS frontend architecture — structure, state management and error handling — across product areas, and at **Maison Moderne** he established coding standards and led code reviews.\n\n' +
            'Building reusable components and modules without giving up readability is part of how he works, and design systems are among the themes he follows closely.',
        ),
      ],
      {
        followUps: [
          'How does he approach accessibility?',
          'How does he approach frontend architecture?',
          'What is he working on at Way2b1?',
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
          "Accessibility appears in two of Marcio's roles:\n\n" +
            '- **Roots** — integrated accessibility standards together with UX designers.\n' +
            '- **Maison Moderne** — built intuitive, accessible interfaces from complex requirements with UX designers.\n\n' +
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
          "Frontend testing strategies are listed among Marcio's core skills. In practice, his documented quality work includes standardized error handling at Deel, code reviews and pair programming, and coding standards he set at Maison Moderne to reduce bugs.",
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
    'Maintainability over cleverness':
      'Coding standards and code reviews at Maison Moderne; a move to React Hooks at Shall And Partners.',
    'Composition over monoliths':
      'Legacy code moved to a modern, modular codebase across several products at Way2b1.',
    'Reuse before rewriting':
      'One standardized HRIS frontend architecture across product areas at Deel.',
    'Architecture sized to the problem':
      'A React frontend built from an early stage at Roots, then organized for a team of four.',
    'Performance from the design':
      'Critical pages 50% faster and People List from 6s to 3s at Deel; SSR for editorial products at Maison Moderne.',
    'UX and visual fidelity':
      'Accessibility built in with UX designers at Roots and Maison Moderne.',
    'Verifiable quality':
      'Pair programming, code reviews and onboarding at Deel; GitLab CI pipelines at Roots.',
    'Explicit trade-offs':
      'Technical trade-offs and delivery plans defined with Product and Engineering at Deel.',
    'Security on the server':
      'In the designs of his own products: permissions checked on the backend, role-based access and tenant isolation.',
  };

  function philosophy(): AssistantResponse {
    return response(
      'philosophy',
      [
        text(
          "Marcio's philosophy is pragmatic: readable code other people can evolve, architecture sized to the product's real stage, and quality he can verify rather than assume. Each principle below is paired with where it shows up in his work.",
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
          "Marcio's engineering principles treat quality as a structural concern: readable, explicit code; small composable components; shared logic centralized instead of duplicated; and security enforced on the server.\n\n" +
            'In practice that has meant standardized error handling and state management, code reviews and pair programming, coding standards at Maison Moderne, and a move to React Hooks at Shall And Partners. Frontend testing strategies are part of his core skills.',
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
          'Alongside his professional work, Marcio builds his own products. Three already have public sites — **EvCopilot** (iPhone beta), **FormDaily** (invite-only) and **TargUp** (in development) — and **FictionDraft** is still a concept.',
        ),
        projectCards(),
        text(
          `### The engineering behind them\n${bullets(knowledge.projects.map((item) => `**${item.name}** — ${productDepth(item.id)}`))}`,
        ),
      ],
      {
        followUps: [
          'Tell me more about EvCopilot.',
          'Tell me more about FormDaily.',
          'What is TargUp?',
        ],
        sources: ['projects', 'notes'],
      },
    );
  }

  function project(projectId: string): AssistantResponse {
    const subject = projectById(projectId);
    const next = knowledge.projects.find((other) => other.id !== projectId && other.live);
    const lead = subject.live
      ? `**${subject.name}** is one of Marcio's own products. ${subject.description}`
      : `**${subject.name}** is one of Marcio's product concepts: ${subject.description.charAt(0).toLowerCase()}${subject.description.slice(1)}`;
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
          `Marcio holds a **${degree.replace("Bachelor's Degree", "Bachelor's degree")}** from ${school} (${schoolShort}), ${location}, completed in ${String(year)}.`,
        ),
        languageTable(),
        details('Courses and certifications', courses),
        text(`### Continuous learning\n${practice.learningStyle}\n\n${bullets(practice.studies)}`),
      ],
      {
        followUps: [
          "Tell me about Marcio's career.",
          'Can I see his resume?',
          'How can I contact Marcio?',
        ],
        sources: ['resume.education', 'resume.languages', 'resume.certifications', 'notes'],
      },
    );
  }

  function languages(question: string): AssistantResponse {
    const asked = knowledge.languages.find((language) =>
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

  function location(): AssistantResponse {
    const { city, country } = knowledge.profile.location;
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

  function contact(): AssistantResponse {
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
