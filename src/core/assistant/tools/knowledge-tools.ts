import { z } from 'zod';
import { PROJECT_IDS, ROLE_IDS, SKILL_GROUP_IDS } from '@/core/knowledge/ids';
import { knowledgeBase, projectById, roleById, sourceOf } from '@/core/knowledge/knowledge-base';
import { evidenceReport } from './evidence-report';
import { defineTool, type Tool } from './tool';

/** Read-only access to the knowledge base, one fact family per action. */

const { profile, contact, experience, metrics, skills, certifications, education, languages } =
  knowledgeBase;

const getProfileSummary = defineTool({
  name: 'getProfileSummary',
  description:
    "Marcio's professional summary: title, years of experience, specializations, focus, and where he is based.",
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
    sources: [sourceOf('profile')],
  }),
});

const getExperience = defineTool({
  name: 'getExperience',
  description:
    "Marcio's roles, newest first, with the resume's own statements for each. Pass a company to get only that role.",
  input: {
    company: z.enum(ROLE_IDS).optional().describe('Limit the result to one role.'),
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
      sources: roles.map((role) => sourceOf(role.source)),
    };
  },
});

const getAchievementMetrics = defineTool({
  name: 'getAchievementMetrics',
  description:
    'Measurable outcomes from his resume, each with the company where it happened. Pass a company to filter.',
  input: { company: z.enum(ROLE_IDS).optional() },
  execute: ({ company }) => {
    const roles = company ? [roleById(company)] : experience;
    return {
      data: roles.flatMap((role) =>
        role.metrics.map((id) => ({ id, company: role.company, ...metrics[id] })),
      ),
      sources: roles.filter((role) => role.metrics.length > 0).map((role) => sourceOf(role.source)),
    };
  },
});

const getSkills = defineTool({
  name: 'getSkills',
  description:
    'His skills grouped by area. There are no self-rated levels; evidence lives in the experience statements.',
  input: { area: z.enum(SKILL_GROUP_IDS).optional() },
  execute: ({ area }) => ({
    data: (area ? skills.filter((group) => group.id === area) : skills).map((group) => ({
      area: group.id,
      title: group.title,
      items: group.items,
    })),
    sources: [sourceOf('resume.skills')],
  }),
});

const getTechnologyEvidence = defineTool({
  name: 'getTechnologyEvidence',
  description:
    "Where a technology appears in Marcio's record: professional work, listed skills, or coursework only. Use it before saying whether he has used something.",
  input: { technology: z.string().trim().min(1).max(60) },
  execute: ({ technology }) => evidenceReport(technology),
});

const getProjects = defineTool({
  name: 'getProjects',
  description:
    'His independent product concepts. Only planned scope is documented: no users, revenue, status or dates.',
  input: { project: z.enum(PROJECT_IDS).optional() },
  execute: ({ project }) => ({
    data: (project ? [projectById(project)] : knowledgeBase.projects).map(
      ({ source: _source, ...concept }) => concept,
    ),
    sources: [sourceOf('projects')],
  }),
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
      languages,
      certifications,
    },
    sources: [
      sourceOf('resume.education'),
      sourceOf('resume.languages'),
      sourceOf('resume.certifications'),
    ],
  }),
});

const getContactChannels = defineTool({
  name: 'getContactChannels',
  description: 'How to reach Marcio. A phone number is never shared.',
  input: {},
  execute: () => ({
    data: {
      email: contact.email,
      linkedin: contact.linkedin,
      github: contact.github,
      resume: contact.resumeUrl ?? 'not published; request it by email',
    },
    sources: [sourceOf('profile')],
  }),
});

const getEngineeringPrinciples = defineTool({
  name: 'getEngineeringPrinciples',
  description: 'The principles he says he works by, and his professional focus.',
  input: {},
  execute: () => ({
    data: { focus: profile.focus, principles: knowledgeBase.principles },
    sources: [sourceOf('principles'), sourceOf('profile')],
  }),
});

export function createKnowledgeTools(): Tool[] {
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
