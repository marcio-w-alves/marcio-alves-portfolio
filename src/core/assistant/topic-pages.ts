import { METRIC_IDS } from '@/core/knowledge/ids';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import type { ResponsePart } from './response';
import {
  bullets,
  details,
  metrics,
  numbered,
  projects,
  skills,
  table,
  text,
  timeline,
} from './response-kit';
import type { TopicId } from './topics';

const { practice } = knowledgeBase;

/**
 * What each topic's page shows beneath its introduction: the record itself,
 * built locally from the knowledge base, never by the model. The overview has
 * none, because its page is the welcome screen.
 */
export function topicData(topic: TopicId): readonly ResponsePart[] {
  switch (topic) {
    case 'overview':
      return [];
    case 'experience':
      return [timeline(), text(`### How his scope grew\n${bullets(practice.careerArc)}`)];
    case 'skills':
      return [
        skills(),
        text(
          `### How deep the evidence goes\n${bullets(practice.skillDepth.map(({ area, items }) => `**${area}** — ${items}`))}`,
        ),
        details(
          'Toolset by area',
          bullets(practice.toolset.map(({ area, items }) => `**${area}** — ${items}`)),
        ),
      ];
    case 'projects':
      return [
        projects(),
        text(
          `### The engineering behind them\n${bullets(knowledgeBase.projects.map((project) => `**${project.name}** — ${practice.productDepth[project.id]}`))}`,
        ),
      ];
    case 'achievements':
      return [
        metrics(METRIC_IDS),
        text(
          '### Other recognition\n' +
            '- Contributed to a web and mobile application that received the **Golden Award in 2019** at Shall And Partners.\n' +
            '- Built a frontend team from one developer to four at Roots.',
        ),
      ];
    case 'philosophy':
      return [
        text(
          knowledgeBase.principles
            .map((principle) => `- **${principle.title}** — ${principle.text}`)
            .join('\n'),
        ),
        text(`### How he takes a problem to delivery\n${numbered(practice.designProcess)}`),
      ];
    case 'education':
      return [
        table(
          ['Language', 'Level'],
          knowledgeBase.languages.map((language) => [language.name, language.level]),
          'Languages',
        ),
        details(
          'Courses and certifications',
          knowledgeBase.certifications
            .map((certification) => `- ${certification.name} (${certification.issuer})`)
            .join('\n'),
        ),
        text(`### Continuous learning\n${practice.learningStyle}\n\n${bullets(practice.studies)}`),
      ];
  }
}
