import { z } from 'zod';
import type { ComponentPart } from '../response';
import type { ResponseKit } from '../response-kit';
import { defineTool, oneOf, type Tool, type ToolResult } from './tool';

/**
 * Actions that put a rich block in the answer. The model chooses which block
 * and which records — by id, validated against the knowledge base — and the
 * server resolves the data, so nothing the model writes reaches the screen as
 * markup.
 */

/**
 * The model is handed exactly what the block shows. Told only "shown", it
 * once wrote filler around a timeline it had never seen — and because the
 * block cited its sources, the invented prose looked grounded.
 */
function display(part: ComponentPart, sources: ToolResult['sources']): ToolResult {
  const { type: _part, ...component } = part;
  return {
    data: { shown: component.component, content: component.props },
    sources,
    effect: { kind: 'display', component },
  };
}

export function createDisplayTools(kit: ResponseKit): Tool[] {
  const { knowledge, roleById, metricById } = kit;

  // A block shows facts, so it cites them like any other answer does.
  function cite(ids: readonly string[]): ToolResult['sources'] {
    return [...new Set(ids)].map(kit.citation);
  }

  const showMetrics = defineTool({
    name: 'showMetrics',
    description:
      'Show measurable outcomes as metric cards. Use the ids returned by getAchievementMetrics.',
    input: {
      ids: z
        .array(oneOf(Object.keys(knowledge.metrics)))
        .min(1)
        .max(8),
    },
    execute: ({ ids }) => display(kit.metrics(ids), cite(ids.map((id) => metricById(id).source))),
  });

  const showTimeline = defineTool({
    name: 'showTimeline',
    description:
      'Show his career as an interactive timeline, optionally limited to some companies.',
    input: {
      companies: z
        .array(oneOf(knowledge.experience.map((role) => role.id)))
        .min(1)
        .optional(),
    },
    execute: ({ companies }) =>
      display(
        kit.timeline(companies),
        cite(
          (companies ?? knowledge.experience.map((role) => role.id)).map(
            (id) => roleById(id).source,
          ),
        ),
      ),
  });

  const showSkills = defineTool({
    name: 'showSkills',
    description: 'Show his skills grouped by area, optionally limited to some areas.',
    input: {
      areas: z
        .array(oneOf(knowledge.skills.map((group) => group.id)))
        .min(1)
        .optional(),
    },
    execute: ({ areas }) => display(kit.skills(areas), cite(['resume.skills'])),
  });

  const showProjects = defineTool({
    name: 'showProjects',
    description: 'Show project cards, optionally limited to some projects.',
    input: {
      projects: z
        .array(oneOf(knowledge.projects.map((project) => project.id)))
        .min(1)
        .optional(),
    },
    execute: ({ projects: ids }) => display(kit.projects(ids), cite(['projects'])),
  });

  const showContactCard = defineTool({
    name: 'showContactCard',
    description:
      'Show the contact card. Use it when the visitor wants to reach Marcio or hire him.',
    input: {},
    execute: () => display(kit.contactCard(), cite(['profile'])),
  });

  return [showMetrics, showTimeline, showSkills, showProjects, showContactCard];
}
