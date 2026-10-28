import { z } from 'zod';
import type { ResponseKit } from '../response-kit';
import { createEvidenceReporter } from './evidence-report';
import { defineTool, oneOf, type Tool } from './tool';

// The model reads the facts; their sources reach it as the call's citations.
function withoutSources<Entry extends { readonly source: string }>(
  entries: readonly Entry[],
): Omit<Entry, 'source'>[] {
  return entries.map(({ source: _source, ...entry }) => entry);
}

/** Read-only access to the knowledge base, one fact family per action. */
export function createKnowledgeTools(kit: ResponseKit): Tool[] {
  const { knowledge, citation, roleById, projectById, metricById } = kit;
  const { profile, contact, experience, skills, certifications, education, languages } = knowledge;
  const evidenceReport = createEvidenceReporter(kit);
  const roleIds = oneOf(experience.map((role) => role.id));

  function citeAll(entries: readonly { readonly source: string }[]) {
    return [...new Set(entries.map((entry) => entry.source))].map(citation);
  }

  const getProfileSummary = defineTool({
    name: 'getProfileSummary',
    description: `${profile.firstName}'s professional summary: title, years of experience, specializations, focus, and where he is based.`,
    input: {},
    execute: () => ({
      data: {
        name: profile.name,
        title: profile.title,
        experience: profile.yearsLabel,
        careerStartYear: profile.careerStartYear,
        summary: profile.summary,
        focus: profile.focus,
        context: profile.context,
        specializations: profile.specializations,
        location: {
          country: profile.location.country,
          city: profile.location.city ?? 'not documented',
        },
      },
      sources: [citation(profile.source)],
    }),
  });

  const getExperience = defineTool({
    name: 'getExperience',
    description: `${profile.firstName}'s roles, newest first, with the resume's own statements for each. Pass a company to get only that role.`,
    input: {
      company: roleIds.optional().describe('Limit the result to one role.'),
    },
    execute: ({ company }) => {
      const roles = company ? [roleById(company)] : experience;
      return {
        data: roles.map((role) => ({
          id: role.id,
          company: role.company,
          role: role.role,
          period: role.period,
          current: role.current,
          summary: role.summary,
          statements: role.highlights,
        })),
        sources: roles.map((role) => citation(role.source)),
      };
    },
  });

  const getAchievementMetrics = defineTool({
    name: 'getAchievementMetrics',
    description:
      'Measurable outcomes from his resume, each with the company where it happened. Pass a company to filter.',
    input: { company: roleIds.optional() },
    execute: ({ company }) => {
      const roles = company ? [roleById(company)] : experience;
      return {
        data: roles.flatMap((role) =>
          role.metrics.map((id) => ({ id, company: role.company, ...metricById(id) })),
        ),
        sources: roles
          .filter((role) => role.metrics.length > 0)
          .map((role) => citation(role.source)),
      };
    },
  });

  const getSkills = defineTool({
    name: 'getSkills',
    description:
      'His skills grouped by area. There are no self-rated levels; evidence lives in the experience statements.',
    input: { area: oneOf(skills.map((group) => group.id)).optional() },
    execute: ({ area }) => {
      const groups = area ? skills.filter((group) => group.id === area) : skills;
      return {
        data: groups.map((group) => ({ area: group.id, title: group.title, items: group.items })),
        sources: citeAll(groups),
      };
    },
  });

  const getTechnologyEvidence = defineTool({
    name: 'getTechnologyEvidence',
    description: `Where a technology appears in ${profile.firstName}'s record: professional work, listed skills, or coursework only. Use it before saying whether he has used something.`,
    input: { technology: z.string().trim().min(1).max(60) },
    execute: ({ technology }) => evidenceReport(technology),
  });

  const getProjects = defineTool({
    name: 'getProjects',
    description:
      "His own products: those with a public site (live: true) and concepts (live: false). Only what each product's public site states is documented: no users, revenue or release dates.",
    input: { project: oneOf(knowledge.projects.map((project) => project.id)).optional() },
    execute: ({ project }) => {
      const products = project ? [projectById(project)] : knowledge.projects;
      return { data: withoutSources(products), sources: citeAll(products) };
    },
  });

  const getEducationAndLanguages = defineTool({
    name: 'getEducationAndLanguages',
    description:
      'His degree, the languages he speaks and the courses he lists as certifications (coursework, not experience).',
    input: {},
    execute: () => ({
      data: {
        education: {
          degree: education.degree,
          school: education.school,
          location: education.location,
          year: education.year,
        },
        languages: withoutSources(languages),
        certifications: withoutSources(certifications),
      },
      sources: citeAll([education, ...languages, ...certifications]),
    }),
  });

  const getContactChannels = defineTool({
    name: 'getContactChannels',
    description: `How to reach ${profile.firstName}. A phone number is never shared.`,
    input: {},
    execute: () => ({
      data: {
        email: contact.email,
        linkedin: contact.linkedin,
        github: contact.github,
        resume: contact.resumeUrl ?? 'not published; request it by email',
      },
      sources: [citation(profile.source)],
    }),
  });

  const getEngineeringPrinciples = defineTool({
    name: 'getEngineeringPrinciples',
    description: 'The principles he says he works by, and his professional focus.',
    input: {},
    execute: () => ({
      data: { focus: profile.focus, principles: withoutSources(knowledge.principles) },
      sources: citeAll([...knowledge.principles, profile]),
    }),
  });

  return [
    getProfileSummary,
    getExperience,
    getAchievementMetrics,
    getSkills,
    getTechnologyEvidence,
    getProjects,
    getEducationAndLanguages,
    getContactChannels,
    getEngineeringPrinciples,
  ];
}
