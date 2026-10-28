import { z } from 'zod';
import type { AnswerSource } from '../assistant-event';
import type { GithubPort } from '../ports/github.port';
import type { ReferencePort, ReferenceSummary } from '../ports/reference.port';
import type { ResponseKit } from '../response-kit';
import { createEvidenceReporter } from './evidence-report';
import { defineTool, oneOf, type Tool } from './tool';

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
  readonly kit: ResponseKit;
  readonly references: ReferencePort;
  readonly github: GithubPort;
}

export function createExternalTools({ kit, references, github }: Dependencies): Tool[] {
  const { knowledge, citation, roleById } = kit;
  const { firstName } = knowledge.profile;
  const technologyReferences = knowledge.references.technologies;
  const evidenceReport = createEvidenceReporter(kit);

  async function lookUp(title: string | null | undefined) {
    return title ? references.summary(title) : null;
  }

  const getTechnologyBrief = defineTool({
    name: 'getTechnologyBrief',
    description: `What a technology from ${firstName}'s record is, from a public encyclopedia, together with where he used it. Only technologies his record mentions can be looked up.`,
    input: { technology: oneOf(Object.keys(technologyReferences)) },
    execute: async ({ technology }) => {
      const summary = await lookUp(technologyReferences[technology]);
      const evidence = evidenceReport(technology);
      return {
        data: {
          technology,
          reference: summary
            ? { title: summary.title, summary: clip(summary.extract, MAX_EXTRACT) }
            : UNAVAILABLE,
          inHisRecord: evidence.data,
        },
        sources: [...(summary ? [referenceSource(summary)] : []), ...evidence.sources],
      };
    },
  });

  const getCompanyBrief = defineTool({
    name: 'getCompanyBrief',
    description: `What one of the companies ${firstName} worked for is, from a public encyclopedia, together with his role there.`,
    input: { company: oneOf(knowledge.experience.map((role) => role.id)) },
    execute: async ({ company }) => {
      const role = roleById(company);
      const summary = await lookUp(role.reference?.encyclopediaTitle);
      return {
        data: {
          company: role.company,
          reference: summary
            ? { title: summary.title, summary: clip(summary.extract, MAX_EXTRACT) }
            : UNAVAILABLE,
          hisRole: {
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
    description: `The city ${firstName} is based in, from a public encyclopedia — or a statement that it is not documented.`,
    input: {},
    execute: async () => {
      const { city, country } = knowledge.profile.location;
      if (!city) {
        return {
          data: { country, city: 'not documented', note: 'Do not guess or infer the city.' },
          sources: [citation(knowledge.profile.source)],
        };
      }
      const summary = await lookUp(city);
      return {
        data: {
          city,
          country,
          reference: summary ? clip(summary.extract, MAX_EXTRACT) : UNAVAILABLE,
        },
        sources: [
          citation(knowledge.profile.source),
          ...(summary ? [referenceSource(summary)] : []),
        ],
      };
    },
  });

  const githubSource: AnswerSource = {
    id: 'github',
    label: 'GitHub profile',
    url: knowledge.contact.github,
  };

  const getGithubProfile = defineTool({
    name: 'getGithubProfile',
    description: `${firstName}'s public GitHub profile, read live from GitHub.`,
    input: {},
    execute: async () => {
      const profile = await github.profile();
      return {
        data: profile
          ? { ...profile, bio: profile.bio && clip(profile.bio, MAX_DESCRIPTION) }
          : { available: false, url: knowledge.contact.github },
        sources: [githubSource],
      };
    },
  });

  const getRepositories = defineTool({
    name: 'getRepositories',
    description: `${firstName}'s public GitHub repositories, most recently updated first. Private and employer code is never visible here.`,
    input: { limit: z.number().int().min(1).max(10).optional() },
    execute: async ({ limit }) => {
      const repositories = await github.repositories(limit ?? 6);
      return {
        data: repositories
          ? repositories.map((repository) => ({
              ...repository,
              description: repository.description && clip(repository.description, MAX_DESCRIPTION),
            }))
          : { available: false, url: knowledge.contact.github },
        sources: [githubSource],
      };
    },
  });

  const getLinkedinProfile = defineTool({
    name: 'getLinkedinProfile',
    description: `${firstName}'s LinkedIn profile link and headline. LinkedIn has no public API, so the profile itself is not read.`,
    input: {},
    execute: () => ({
      data: {
        url: knowledge.contact.linkedin,
        headline: knowledge.profile.title,
        note: 'LinkedIn offers no public API, so the page is not read. His documented experience mirrors his resume.',
      },
      sources: [{ id: 'linkedin', label: 'LinkedIn profile', url: knowledge.contact.linkedin }],
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
