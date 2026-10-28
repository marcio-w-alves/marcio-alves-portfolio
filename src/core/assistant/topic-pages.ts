import { METRIC_IDS } from '@/core/knowledge/ids';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import type { ResponsePart } from './response';
import { details, metrics, projects, skills, table, text, timeline } from './response-kit';
import type { TopicId } from './topics';

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
      return [timeline()];
    case 'skills':
      return [skills()];
    case 'projects':
      return [projects()];
    case 'achievements':
      return [metrics(METRIC_IDS)];
    case 'philosophy':
      return [
        text(
          knowledgeBase.principles
            .map((principle) => `- **${principle.title}** — ${principle.text}`)
            .join('\n'),
        ),
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
      ];
  }
}
