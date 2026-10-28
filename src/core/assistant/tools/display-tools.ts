import { z } from 'zod';
import { METRIC_IDS, PROJECT_IDS, ROLE_IDS, SKILL_GROUP_IDS } from '@/core/knowledge/ids';
import { sourceOf } from '@/core/knowledge/knowledge-base';
import type { ComponentPart } from '../response';
import { contactCard, metrics, projects, skills, timeline } from '../response-kit';
import { defineTool, type Tool, type ToolResult } from './tool';

/**
 * Actions that put a rich block in the answer. The model chooses which block
 * and which records — by id, validated against the knowledge base — and the
 * server resolves the data, so nothing the model writes reaches the screen as
 * markup.
 */

function display(part: ComponentPart, sources: ToolResult['sources']): ToolResult {
  const { type: _part, ...component } = part;
  return { data: { shown: component.component }, sources, effect: { kind: 'display', component } };
}

const showMetrics = defineTool({
  name: 'showMetrics',
  description:
    'Show measurable outcomes as metric cards. Use the ids returned by getAchievementMetrics.',
  input: { ids: z.array(z.enum(METRIC_IDS)).min(1).max(8) },
  execute: ({ ids }) => display(metrics(ids), []),
});

const showTimeline = defineTool({
  name: 'showTimeline',
  description: 'Show his career as an interactive timeline, optionally limited to some companies.',
  input: { companies: z.array(z.enum(ROLE_IDS)).min(1).optional() },
  execute: ({ companies }) => display(timeline(companies), []),
});

const showSkills = defineTool({
  name: 'showSkills',
  description: 'Show his skills grouped by area, optionally limited to some areas.',
  input: { areas: z.array(z.enum(SKILL_GROUP_IDS)).min(1).optional() },
  execute: ({ areas }) => display(skills(areas), [sourceOf('resume.skills')]),
});

const showProjects = defineTool({
  name: 'showProjects',
  description: 'Show project concept cards, optionally limited to some projects.',
  input: { projects: z.array(z.enum(PROJECT_IDS)).min(1).optional() },
  execute: ({ projects: ids }) => display(projects(ids), [sourceOf('projects')]),
});

const showContactCard = defineTool({
  name: 'showContactCard',
  description: 'Show the contact card. Use it when the visitor wants to reach Marcio or hire him.',
  input: {},
  execute: () => display(contactCard(), [sourceOf('profile')]),
});

export function createDisplayTools(): Tool[] {
  return [showMetrics, showTimeline, showSkills, showProjects, showContactCard];
}
