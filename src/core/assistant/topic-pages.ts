import type { ResponsePart } from './response';
import { bullets, details, numbered, table, text, type ResponseKit } from './response-kit';
import type { TopicCatalog, TopicId } from './topics';

const INTRO_FOLLOW_UPS = 3;

/** How a topic's page opens: its introduction, its part of the record, and what to ask next. */
export interface TopicIntro {
  readonly parts: readonly ResponsePart[];
  readonly followUps: readonly string[];
}

export function createTopicIntro(kit: ResponseKit, catalog: TopicCatalog) {
  const topicData = createTopicData(kit);
  return (topic: TopicId): TopicIntro => ({
    parts: [text(catalog.topicById(topic).intro), ...topicData(topic)],
    followUps: catalog.suggestions(topic, 0, INTRO_FOLLOW_UPS),
  });
}

/**
 * What each topic's page shows beneath its introduction: the record itself,
 * built locally from the knowledge base, never by the model. The overview has
 * none, because its page is the welcome screen.
 */
function createTopicData({ knowledge, projects, skills, timeline, productDepth }: ResponseKit) {
  const { practice } = knowledge;
  return (topic: TopicId): readonly ResponsePart[] => {
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
            `### The engineering behind them\n${bullets(knowledge.projects.map((project) => `**${project.name}** — ${productDepth(project.id)}`))}`,
          ),
        ];
      case 'philosophy':
        return [
          text(
            knowledge.principles
              .map((principle) => `- **${principle.title}** — ${principle.text}`)
              .join('\n'),
          ),
          text(`### How he takes a problem to delivery\n${numbered(practice.designProcess)}`),
        ];
      case 'education':
        return [
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
          text(
            `### Continuous learning\n${practice.learningStyle}\n\n${bullets(practice.studies)}`,
          ),
        ];
    }
  };
}
