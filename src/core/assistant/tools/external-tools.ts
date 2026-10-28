import { z } from 'zod';
import { ROLE_IDS } from '@/core/knowledge/ids';
import { knowledgeBase, roleById } from '@/core/knowledge/knowledge-base';
import type { AnswerSource } from '../assistant-event';
import { citation } from '../citations';
import type { GithubPort } from '../ports/github.port';
import type { ReferencePort, ReferenceSummary } from '../ports/reference.port';
import { evidenceReport } from './evidence-report';
import {
  COMPANY_REFERENCES,
  REFERENCED_TECHNOLOGIES,
  TECHNOLOGY_REFERENCES,
} from './reference-catalog';
import { defineTool, type Tool } from './tool';

/**
 * Third-party text — encyclopedia extracts, repository descriptions — reaches
 * the model through these actions, so it is bounded in length: it is data to
 * summarize, and a long passage is also a longer surface for an injected
 * instruction.
 */
const MAX_EXTRACT = 1200;
const MAX_DESCRIPTION = 200;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function referenceSource(summary: ReferenceSummary): AnswerSource {
  return {
    id: `wikipedia:${summary.title}`,
    label: `Wikipedia · ${summary.title}`,
    url: summary.url,
  };
}

const UNAVAILABLE = 'no public reference is available right now';

interface Dependencies {
  readonly references: ReferencePort;
  readonly github: GithubPort;
}

export function createExternalTools({ references, github }: Dependencies): Tool[] {
  async function lookUp(title: string | null | undefined) {
    return title ? references.summary(title) : null;
  }

  const getTechnologyBrief = defineTool({
    name: 'getTechnologyBrief',
    description:
      "What a technology from Marcio's record is, from a public encyclopedia, together with where he used it. Only technologies his record mentions can be looked up.",
    input: { technology: z.enum(REFERENCED_TECHNOLOGIES) },
    execute: async ({ technology }) => {
      const summary = await lookUp(TECHNOLOGY_REFERENCES[technology]);
      const evidence = evidenceReport(technology);
      return {
        data: {
          technology,
          reference: summary
            ? { title: summary.title, summary: clip(summary.extract, MAX_EXTRACT) }
            : UNAVAILABLE,
          marcio: evidence.data,
        },
        sources: [...(summary ? [referenceSource(summary)] : []), ...evidence.sources],
      };
    },
  });

  const getCompanyBrief = defineTool({
    name: 'getCompanyBrief',
    description:
      'What one of the companies Marcio worked for is, from a public encyclopedia, together with his role there.',
    input: { company: z.enum(ROLE_IDS) },
    execute: async ({ company }) => {
      const role = roleById(company);
      const summary = await lookUp(COMPANY_REFERENCES[company]);
      return {
        data: {
          company: role.company,
          reference: summary
            ? { title: summary.title, summary: clip(summary.extract, MAX_EXTRACT) }
            : UNAVAILABLE,
          marcioRole: {
            role: role.role,
            period: role.period,
            current: role.current,
            summary: role.summary,
          },
        },
        sources: [...(summary ? [referenceSource(summary)] : []), citation(role.source)],
      };
    },
  });

  const getCityBrief = defineTool({
    name: 'getCityBrief',
    description:
      'The city Marcio is based in, from a public encyclopedia — or a statement that it is not documented.',
    input: {},
    execute: async () => {
      const { city, country } = knowledgeBase.profile.location;
      if (!city) {
        return {
          data: { country, city: 'not documented', note: 'Do not guess or infer the city.' },
          sources: [citation('profile')],
        };
      }
      const summary = await lookUp(city);
      return {
        data: {
          city,
          country,
          reference: summary ? clip(summary.extract, MAX_EXTRACT) : UNAVAILABLE,
        },
        sources: [citation('profile'), ...(summary ? [referenceSource(summary)] : [])],
      };
    },
  });

  const githubSource: AnswerSource = {
    id: 'github',
    label: 'GitHub profile',
    url: knowledgeBase.contact.github,
  };

  const getGithubProfile = defineTool({
    name: 'getGithubProfile',
    description: "Marcio's public GitHub profile, read live from GitHub.",
    input: {},
    execute: async () => {
      const profile = await github.profile();
      return {
        data: profile
          ? { ...profile, bio: profile.bio && clip(profile.bio, MAX_DESCRIPTION) }
          : { available: false, url: knowledgeBase.contact.github },
        sources: [githubSource],
      };
    },
  });

  const getRepositories = defineTool({
    name: 'getRepositories',
    description:
      "Marcio's public GitHub repositories, most recently updated first. Private and employer code is never visible here.",
    input: { limit: z.number().int().min(1).max(10).optional() },
    execute: async ({ limit }) => {
      const repositories = await github.repositories(limit ?? 6);
      return {
        data: repositories
          ? repositories.map((repository) => ({
              ...repository,
              description: repository.description && clip(repository.description, MAX_DESCRIPTION),
            }))
          : { available: false, url: knowledgeBase.contact.github },
        sources: [githubSource],
      };
    },
  });

  const getLinkedinProfile = defineTool({
    name: 'getLinkedinProfile',
    description:
      "Marcio's LinkedIn profile link and headline. LinkedIn has no public API, so the profile itself is not read.",
    input: {},
    execute: () => ({
      data: {
        url: knowledgeBase.contact.linkedin,
        headline: knowledgeBase.profile.title,
        note: 'LinkedIn offers no public API, so the page is not read. His documented experience mirrors his resume.',
      },
      sources: [{ id: 'linkedin', label: 'LinkedIn profile', url: knowledgeBase.contact.linkedin }],
    }),
  });

  return [
    getTechnologyBrief,
    getCompanyBrief,
    getCityBrief,
    getGithubProfile,
    getRepositories,
    getLinkedinProfile,
  ];
}
