import type { AnswerSet } from '@/core/assistant/answer-set';
import { createBoundaryAnswers } from './boundaries';
import { createCareerAnswers } from './career';
import { createExpertiseAnswers } from './expertise';
import { labels } from './labels';
import { createTopics } from './topics';

/** The Portuguese fast-path answers and topic pages, written over the record in Portuguese. */
export const answers: AnswerSet = {
  // The owner's own words: the team he led at one employer, his university's
  // initials, the platform of his courses and the award one of his products won.
  vocabulary: {
    leadRole: [[/\bhris\b/, 3]],
    education: [[/\b(ufpb|udemy)\b/, 4]],
    awards: [[/\bgolden\b/, 3]],
  },
  labels,
  topics: createTopics,
  answers: (kit) => {
    const boundaries = createBoundaryAnswers(kit);
    const career = createCareerAnswers(kit);
    const expertise = createExpertiseAnswers(kit);
    return {
      scored: {
        identity: boundaries.identity,
        resume: expertise.resume,
        contact: expertise.contact,
        location: expertise.location,
        accessibility: expertise.accessibility,
        testing: expertise.testing,
        mobile: expertise.mobile,
        designSystems: expertise.designSystems,
        nextjs: expertise.nextjs,
        codeQuality: expertise.codeQuality,
        qualityImprovement: career.qualityImprovement,
        awards: career.awards,
        teamGrowth: career.teamGrowth,
        leadRole: career.leadRole,
        product: career.product,
        scratch: career.scratch,
        scaling: career.scaling,
        enterprise: career.enterprise,
        roleFit: career.roleFit,
        aiEngineering: expertise.aiEngineering,
        philosophy: expertise.philosophy,
        architecture: expertise.architecture,
        performance: expertise.performance,
        backend: expertise.backend,
        react: expertise.react,
        skills: expertise.skills,
        leadership: career.leadership,
        achievements: career.achievements,
        projects: expertise.projects,
        languages: (_context, question) => expertise.languages(question),
        education: expertise.education,
        career: career.career,
      },
      greeting: boundaries.greeting,
      privateInfo: boundaries.privateInfo,
      offPurpose: boundaries.offPurpose,
      unknown: boundaries.unknown,
      slowDown: boundaries.slowDown,
      company: career.company,
      project: expertise.project,
      technology: boundaries.technology,
    };
  },
};
