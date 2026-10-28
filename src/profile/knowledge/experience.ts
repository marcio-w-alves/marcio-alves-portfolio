import type { RoleSource } from '@/core/knowledge/schema';

/** Newest first. */
export const experience: readonly RoleSource[] = [
  {
    id: 'way2b1',
    company: 'Way2b1',
    role: 'Senior Frontend Engineer',
    period: 'Jun 2026 — Present',
    start: 2026.42,
    end: null,
    current: true,
    summary: {
      en: 'Full-stack work across the product suite of a small startup: performance, legacy migration and end-to-end features.',
    },
    responsibilities: [
      {
        en: "Works as a full-stack engineer across Way2b1's product suite, at a small San Francisco startup building a platform for families and family offices.",
      },
      {
        en: 'Cut bundle size by nearly 50% and brought loading times down to a few hundred milliseconds.',
      },
      {
        en: 'Migrated legacy code to a modern, maintainable architecture across multiple products, keeping features stable in production.',
      },
      { en: 'Delivers features end to end: frontend interfaces, backend services and APIs.' },
    ],
    leadership: [
      {
        en: 'Collaborates across product teams to align technical decisions, share patterns and keep the codebases consistent.',
      },
    ],
    achievements: [],
    focus: [
      { en: 'Performance' },
      { en: 'Legacy code migration' },
      { en: 'Full stack' },
      { en: 'Cross-team work' },
    ],
    metrics: ['way2b1-bundle', 'way2b1-load'],
    highlights: [
      {
        en: 'Reduced bundle size by nearly 50% and decreased loading times to a few hundred milliseconds.',
      },
      {
        en: 'Enhanced application performance platform-wide by refactoring and optimizing critical workflows.',
      },
      {
        en: 'Delivered end-to-end features encompassing frontend interfaces, backend services, and APIs.',
      },
      {
        en: "Contributed as a full-stack engineer across Way2b1's product suite at a small San Francisco startup developing a platform for families and family offices.",
      },
      {
        en: 'Migrated legacy code to a modern, maintainable architecture across multiple products, reducing technical debt and maintaining feature stability in production.',
      },
      {
        en: 'Collaborated across product teams to align technical decisions, share patterns, and maintain codebase consistency between products.',
      },
    ],
    source: 'resume.way2b1',
  },
  {
    id: 'deel',
    company: 'Deel',
    role: 'Senior Frontend Engineer',
    period: '2022 — 2026',
    start: 2022,
    end: 2026.17,
    current: false,
    summary: {
      en: 'Helped lead the HRIS team, led the Roots migration, architecture standards and performance work.',
    },
    responsibilities: [
      {
        en: "Helped lead and maintain the HRIS team responsible for the company's core HR tools product.",
      },
      {
        en: 'Led the migration and scaling of the Roots platform into Deel, mitigating rollout risks and improving maintainability.',
      },
      {
        en: 'Standardized frontend architecture for HRIS interfaces, improving structure, state management, error handling and scalability.',
      },
      {
        en: 'Cut loading time on critical pages by 50% through targeted refactoring and optimization.',
      },
    ],
    leadership: [
      { en: 'Defined technical trade-offs and delivery plans with Product and Engineering.' },
      {
        en: 'Planned and documented deliveries for OKRs and quarterly goals with Product Managers.',
      },
      {
        en: 'Guided junior and mid-level engineers through structured knowledge-sharing sessions and code walkthroughs.',
      },
      {
        en: 'Raised quality standards through code reviews and pair programming, and contributed to hiring and onboarding.',
      },
    ],
    achievements: [],
    focus: [
      { en: 'HRIS' },
      { en: 'Frontend architecture' },
      { en: 'State management' },
      { en: 'Web Vitals' },
      { en: 'Mentoring' },
    ],
    metrics: ['deel-web-vitals', 'deel-critical-load', 'deel-people-list'],
    highlights: [
      { en: 'Enhanced user experience metrics by improving web vitals by at least 30%.' },
      {
        en: "Helped lead and maintain the HRIS team responsible for the company's core HR tools product.",
      },
      {
        en: 'Led the migration and scaling of the Roots platform into Deel, mitigating rollout risks and enhancing maintainability.',
      },
      {
        en: 'Defined technical trade-offs and delivery plans in collaboration with Product and Engineering teams to deliver scalable solutions.',
      },
      {
        en: 'Collaborated with Product Managers to plan and document deliveries for OKRs and quarterly goals.',
      },
      {
        en: 'Standardized frontend architecture for HRIS interfaces to improve structure, state management, error handling, and scalability across product areas.',
      },
      {
        en: 'Reduced loading time on critical pages by 50% through targeted refactoring and optimization, decreasing People List page load time from six seconds to three seconds on cold run.',
      },
      {
        en: 'Guided juniors and mid-level engineers via structured knowledge-sharing sessions and code walkthroughs, enhancing team productivity and code quality.',
      },
      { en: 'Contributed to the hiring process and onboarding of engineers.' },
      {
        en: 'Elevated quality standards and ensured technical consistency by facilitating pair programming sessions, performing code reviews, and supporting onboarding.',
      },
    ],
    source: 'resume.deel',
  },
  {
    id: 'roots',
    company: 'Roots',
    role: 'Lead Frontend Engineer',
    period: '2020 — 2022',
    start: 2020,
    end: 2022,
    current: false,
    summary: {
      en: 'Built the product frontend from the ground up and grew the frontend team from one to four.',
    },
    responsibilities: [
      { en: 'Built an end-to-end React frontend for a startup creating Slack bots for HR.' },
      { en: 'Directed frontend technical strategy and architecture to support user base growth.' },
      {
        en: 'Implemented advanced state management to keep the application scalable and maintainable.',
      },
      { en: 'Integrated accessibility standards together with UX designers.' },
      { en: 'Set up GitLab CI pipelines deploying to Amazon S3.' },
    ],
    leadership: [
      {
        en: 'Grew the frontend team from a solo setup by recruiting and integrating three developers.',
      },
      {
        en: 'Led frontend development for nearly two years, coordinating sprint planning and deliverables with managers and stakeholders.',
      },
      { en: 'Organized and delegated work across the engineering team.' },
    ],
    achievements: [
      { en: "Drove product structure and traction to secure the product's long-term viability." },
    ],
    focus: [{ en: 'React' }, { en: 'State management' }, { en: 'Accessibility' }, { en: 'CI/CD' }],
    metrics: ['roots-team'],
    highlights: [
      { en: 'Directed frontend technical strategy and architecture to support user base growth.' },
      {
        en: 'Expanded the frontend team from a solo developer setup by recruiting and integrating three additional developers.',
      },
      {
        en: 'Led frontend development for nearly two years, coordinating sprint planning and deliverables with managers and stakeholders.',
      },
      { en: 'Delegated and organized tasks and responsibilities among engineering team members.' },
      {
        en: 'Integrated accessibility standards in collaboration with UX designers, enhancing compliance and user experience.',
      },
      {
        en: 'Implemented advanced state management solutions to enhance application scalability and maintainability.',
      },
      { en: 'Established CI pipelines on GitLab to deploy applications to Amazon S3.' },
      {
        en: 'Developed an end-to-end frontend application with React.js for a startup specializing in Slack bots for HR.',
      },
      { en: 'Drove product structure and traction to secure long-term viability.' },
    ],
    source: 'resume.roots',
  },
  {
    id: 'maison',
    company: 'Maison Moderne',
    role: 'Senior Frontend Developer',
    period: '2020 — 2022',
    start: 2020,
    end: 2022,
    current: false,
    summary: {
      en: 'Responsive digital magazines and newsletters with Next.js, SSR and publishing integrations.',
    },
    responsibilities: [
      {
        en: 'Developed responsive digital magazines and newsletters with Next.js and React, distributed across multiple countries.',
      },
      { en: 'Implemented server-side rendering to improve SEO and initial load speed.' },
      {
        en: 'Delivered scalable frontend solutions integrated with external publishing platforms.',
      },
      {
        en: 'Improved usability and performance of editorial products across devices, serving thousands of daily readers.',
      },
      { en: 'Built intuitive, accessible interfaces from complex requirements with UX designers.' },
    ],
    leadership: [
      {
        en: 'Led code reviews and established coding standards that reduced bugs and improved maintainability.',
      },
    ],
    achievements: [
      { en: 'Contributed to the newsletter project, which achieved a 20% increase in income.' },
    ],
    focus: [
      { en: 'Next.js' },
      { en: 'React' },
      { en: 'SSR' },
      { en: 'SEO' },
      { en: 'Accessibility' },
    ],
    metrics: ['maison-newsletter'],
    highlights: [
      { en: 'Contributed to the newsletter project, achieving a 20% increase in income.' },
      {
        en: 'Delivered scalable frontend solutions integrated with external publishing platforms.',
      },
      {
        en: 'Implemented server-side rendering solutions to enhance SEO and improve initial load speed.',
      },
      {
        en: 'Developed responsive digital magazines and newsletters using Next.js and React for distribution across multiple countries.',
      },
      { en: 'Improved usability and performance of editorial products across devices.' },
      {
        en: 'Collaborated with UX designers to develop intuitive, accessible interfaces from complex requirements.',
      },
      {
        en: 'Led code reviews and established coding standards to reduce bugs and enhance maintainability.',
      },
      { en: 'Maintained support for daily viewership reaching thousands.' },
    ],
    source: 'resume.maison',
  },
  {
    id: 'shall',
    company: 'Shall And Partners',
    role: 'Full Stack Developer',
    period: '2018 — 2020',
    start: 2018,
    end: 2020,
    current: false,
    summary: {
      en: 'Promoted from mid-level to Principal Frontend Developer on an HR platform; full-stack work with React and Node.js.',
    },
    responsibilities: [
      {
        en: 'Led development of a progressive web app before the product moved to a native Android app.',
      },
      { en: 'Refactored the codebase to React Hooks to improve maintainability.' },
      {
        en: 'Engineered RESTful APIs to improve data exchange between frontend and backend services.',
      },
      {
        en: 'Built web and mobile applications in a microservices architecture with Node.js and multiple databases.',
      },
      {
        en: 'Created internal tools that removed manual contractor timesheet entry by autofilling from prior submissions.',
      },
    ],
    leadership: [
      {
        en: 'Promoted from mid-level to Principal Frontend Developer on an HR platform for an American company.',
      },
    ],
    achievements: [
      { en: 'Contributed to a web and mobile application that received the Golden Award in 2019.' },
    ],
    focus: [
      { en: 'React' },
      { en: 'Node.js' },
      { en: 'REST APIs' },
      { en: 'Microservices' },
      { en: 'PWA' },
    ],
    metrics: [],
    highlights: [
      {
        en: 'Contributed to the development of a web and mobile application that received the Golden Award in 2019.',
      },
      {
        en: 'Promoted from Mid-level to Principal Frontend Developer on an HR platform for an American company.',
      },
      {
        en: 'Led development of a progressive web app prior to transitioning to a native Kotlin Android application.',
      },
      { en: 'Refactored codebase by transitioning to React Hooks to enhance maintainability.' },
      {
        en: 'Created internal tools that eliminated manual contractor timesheet entry by autofilling data based on prior submissions.',
      },
      {
        en: 'Engineered RESTful APIs to enhance data exchange between frontend and backend services.',
      },
      {
        en: 'Built web and mobile applications within a microservices architecture using Node.js and multiple databases.',
      },
    ],
    source: 'resume.shall',
  },
  {
    id: 'webfi',
    company: 'WEBFI',
    role: 'Frontend Developer',
    period: '2016 — 2018',
    start: 2016,
    end: 2018,
    current: false,
    summary: {
      en: 'End-to-end frontend delivery for mid-sized applications, from architecture to production.',
    },
    responsibilities: [
      {
        en: 'Led end-to-end frontend development for mid-sized applications, from architecture through production delivery.',
      },
    ],
    leadership: [],
    achievements: [{ en: 'Helped smaller industry clients grow sales by over 30%.' }],
    focus: [{ en: 'Frontend architecture' }, { en: 'Production delivery' }],
    metrics: ['webfi-sales'],
    highlights: [
      { en: 'Helped smaller industry clients grow sales by over 30%.' },
      {
        en: 'Led end-to-end frontend development for mid-sized applications from architecture through production delivery.',
      },
    ],
    source: 'resume.webfi',
  },
  {
    id: 'freelance',
    company: 'Freelance',
    role: 'Web Developer',
    period: '2015 — 2018',
    start: 2015,
    end: 2018,
    current: false,
    summary: { en: 'Independent web work, from small frontend tasks to complete applications.' },
    responsibilities: [
      {
        en: 'Progressed from small frontend tasks to independently developing complete web applications.',
      },
    ],
    leadership: [],
    achievements: [],
    focus: [{ en: 'Websites' }, { en: 'Web applications' }],
    metrics: [],
    highlights: [
      {
        en: 'Progressed from small frontend tasks to independently developing complete web applications.',
      },
    ],
    source: 'resume.freelance',
  },
];
