import type { ResponseKit } from '@/core/assistant/response-kit';
import { bullets, details, numbered, table, text } from '@/core/assistant/response-kit';
import type { TopicCopy, TopicId } from '@/core/assistant/topics';
import { createFacts, joinNames } from './facts';

/**
 * The site's pages: each opens with a curated introduction and its part of
 * the record — never a model call — and suggests the questions below.
 */
export function createTopics(kit: ResponseKit): Readonly<Record<TopicId, TopicCopy>> {
  const { knowledge, projects, skills, timeline, productDepth } = kit;
  const { profile, experience, languages, education, practice } = knowledge;
  const { first, employer, product } = createFacts(kit);
  const liveProducts = joinNames(
    knowledge.projects.filter((project) => project.live).map((project) => project.name),
  );
  return {
    overview: {
      label: 'Overview',
      intro: `Here's the short version: ${profile.firstName} is a Staff-level frontend engineer with ${profile.yearsLabel} in React, TypeScript and frontend architecture, with measurable wins in performance and team growth. What would you like to know?`,
      questions: [
        { question: `Tell me about ${first}'s career.`, tag: 'Career', short: 'His career' },
        {
          question: `What makes ${first} a strong Staff Engineer?`,
          tag: 'Staff-level',
          short: 'Why Staff-level',
        },
        {
          question: `What has he built at ${employer('deel')}?`,
          tag: employer('deel'),
          short: `Work at ${employer('deel')}`,
        },
        {
          question: 'How experienced is he with React and TypeScript?',
          tag: 'React & TypeScript',
          short: 'React & TypeScript',
        },
        {
          question: 'What are his biggest technical achievements?',
          tag: 'Impact',
          short: 'Biggest wins',
        },
        { question: 'Has he led engineering teams?', tag: 'Leadership', short: 'Leadership' },
        { question: 'What projects is he working on?', tag: 'Projects', short: 'Side projects' },
        {
          question: 'How does he approach frontend architecture?',
          tag: 'Architecture',
          short: 'Architecture',
        },
      ],
      page: [],
    },
    experience: {
      label: 'Experience',
      intro: `${first}'s career spans ${String(experience.length)} roles since ${String(profile.careerStartYear)} — from freelance web development to lead and senior frontend roles at ${employer('roots')} and ${employer('deel')} and, today, full-stack work at ${employer('way2b1')}. Pick a company, or ask how his scope grew over time.`,
      questions: [
        { question: `Tell me about ${first}'s career.`, tag: 'Career' },
        { question: `What has he built at ${employer('deel')}?`, tag: employer('deel') },
        { question: `What did he do at ${employer('roots')}?`, tag: employer('roots') },
        {
          question: `What is he working on at ${employer('way2b1')}?`,
          tag: employer('way2b1'),
        },
        { question: 'Tell me about his experience scaling frontend applications.', tag: 'Scale' },
        { question: 'Has he ever built something from scratch?', tag: 'Zero to one' },
        { question: 'Is he experienced with enterprise applications?', tag: 'Enterprise' },
        { question: 'Has he worked with backend systems?', tag: 'Full stack' },
      ],
      page: [timeline(), text(`### How his scope grew\n${bullets(practice.careerArc)}`)],
    },
    skills: {
      label: 'Technical Skills',
      intro: `${first}'s core stack is React, TypeScript and Next.js, backed by architecture, performance and leadership skills. Ask about any area and you'll get the evidence behind it, not a self-rated score.`,
      questions: [
        { question: 'How experienced is he with React and TypeScript?', tag: 'React & TypeScript' },
        { question: 'How did he optimize performance?', tag: 'Performance' },
        { question: 'Has he worked with backend systems?', tag: 'Full stack' },
        { question: 'Does he have Next.js and SSR experience?', tag: 'Next.js' },
        { question: 'What does he know about design systems?', tag: 'Design systems' },
        { question: 'How does he approach accessibility?', tag: 'Accessibility' },
        { question: 'How does he approach testing?', tag: 'Testing' },
        { question: 'How does he use AI in engineering?', tag: 'AI engineering' },
      ],
      page: [
        skills(),
        text(
          `### How deep the evidence goes\n${bullets(practice.skillDepth.map(({ area, items }) => `**${area}** — ${items}`))}`,
        ),
        details(
          'Toolset by area',
          bullets(practice.toolset.map(({ area, items }) => `**${area}** — ${items}`)),
        ),
      ],
    },
    projects: {
      label: 'Projects',
      intro: `Beyond his day job, ${first} builds his own products. ${liveProducts} already have public sites, and ${product('fictiondraft')} is still a concept. Ask about any of them — I'll be clear about what's live versus planned.`,
      questions: [
        { question: `Tell me more about ${product('evcopilot')}.`, tag: product('evcopilot') },
        { question: `Tell me more about ${product('formdaily')}.`, tag: product('formdaily') },
        { question: `What is ${product('targup')}?`, tag: product('targup') },
        { question: `What is ${product('fictiondraft')}?`, tag: product('fictiondraft') },
        { question: 'Has he built mobile apps?', tag: 'Mobile' },
      ],
      page: [
        projects(),
        text(
          `### The engineering behind them\n${bullets(knowledge.projects.map((project) => `**${project.name}** — ${productDepth(project.id)}`))}`,
        ),
      ],
    },
    philosophy: {
      label: 'Engineering Philosophy',
      intro: `${first}'s engineering is pragmatic: readable code other people can evolve, architecture sized to the product's real stage, and quality he can verify. Here are the principles he works by and how he takes a problem from question to delivery.`,
      questions: [
        { question: "What's his engineering philosophy?", tag: 'Principles' },
        { question: 'How does he use AI in engineering?', tag: 'AI engineering' },
        { question: 'How does he approach frontend architecture?', tag: 'Architecture' },
        { question: 'How does he approach testing?', tag: 'Testing' },
        { question: 'How does he work with product teams?', tag: 'Product' },
        { question: 'How does he think about code quality?', tag: 'Quality' },
      ],
      page: [
        text(
          knowledge.principles
            .map((principle) => `- **${principle.title}** — ${principle.text}`)
            .join('\n'),
        ),
        text(`### How he takes a problem to delivery\n${numbered(practice.designProcess)}`),
      ],
    },
    education: {
      label: 'Education & Languages',
      intro: `${first} holds a ${education.degree.replace("Bachelor's Degree", "Bachelor's degree")} from ${education.school} (${String(education.year)}) and works in ${joinNames(languages.map((language) => language.name))}.`,
      questions: [
        { question: 'How does he use AI in engineering?', tag: 'AI engineering' },
        { question: 'Has he worked with backend systems?', tag: 'Full stack' },
        { question: 'Can I see his resume?', tag: 'Resume' },
      ],
      page: [
        table(
          ['Language', 'Level'],
          knowledge.languages.map((language) => [language.name, language.level]),
          'Languages',
        ),
        details(
          'Courses and certifications',
          knowledge.certifications
            .map((certification) => `- ${certification.name} (${certification.issuer})`)
            .join('\n'),
        ),
        text(`### Continuous learning\n${practice.learningStyle}\n\n${bullets(practice.studies)}`),
      ],
    },
  };
}
