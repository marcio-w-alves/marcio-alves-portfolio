import type { MetricId, ProjectId, RoleId, SkillGroupId, SourceId } from '@/core/knowledge/ids';
import {
  isConcurrent,
  knowledgeBase,
  projectById,
  roleById,
  sourceOf,
} from '@/core/knowledge/knowledge-base';
import type { Project, Role } from '@/core/knowledge/types';
import type { MetricItem, NoteTone, ProjectView, RoleSection, RoleView } from './components';
import type {
  AssistantResponse,
  ComponentPart,
  ConversationContext,
  ResponsePart,
} from './response';

/**
 * Builders for answer parts. Components always receive resolved data, so the
 * client never has to know a knowledge-base id exists.
 */

export function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function numbered(items: readonly string[]): string {
  return items.map((item, index) => `${String(index + 1)}. ${item}`).join('\n');
}

export function text(markdown: string): ResponsePart {
  return { type: 'text', text: markdown };
}

export function metrics(ids: readonly MetricId[]): ComponentPart {
  const items = ids.map((id): MetricItem => {
    const metric = knowledgeBase.metrics[id];
    return { value: metric.value, label: metric.label, context: metric.context };
  });
  return { type: 'component', component: 'metrics', props: { items } };
}

function roleView(role: Role): RoleView {
  const sections: RoleSection[] = [];
  if (role.responsibilities.length > 0) {
    sections.push({ title: 'Responsibilities', kind: 'list', items: role.responsibilities });
  }
  if (role.metrics.length > 0) {
    sections.push({
      title: 'Engineering impact',
      kind: 'metrics',
      items: role.metrics.map((id) => {
        const metric = knowledgeBase.metrics[id];
        return { value: metric.value, label: metric.label };
      }),
    });
  }
  if (role.leadership.length > 0) {
    sections.push({ title: 'Leadership', kind: 'list', items: role.leadership });
  }
  if (role.achievements.length > 0) {
    sections.push({ title: 'Notable achievements', kind: 'list', items: role.achievements });
  }
  if (role.focus.length > 0) {
    sections.push({ title: 'Focus areas', kind: 'tags', items: role.focus });
  }
  return {
    id: role.id,
    company: role.company,
    role: role.role,
    period: role.period,
    summary: role.summary,
    current: role.current,
    concurrent: isConcurrent(role),
    sections,
  };
}

export function timeline(ids?: readonly RoleId[]): ComponentPart {
  const roles = ids ? ids.map(roleById) : knowledgeBase.experience;
  return {
    type: 'component',
    component: 'timeline',
    props: { roles: roles.map(roleView), expanded: [] },
  };
}

export function skills(ids?: readonly SkillGroupId[]): ComponentPart {
  const groups = ids
    ? knowledgeBase.skills.filter((group) => ids.includes(group.id))
    : knowledgeBase.skills;
  return {
    type: 'component',
    component: 'skills',
    props: { groups: groups.map((group) => ({ title: group.title, items: group.items })) },
  };
}

// A card shows what a product is, not whether it is live: the status says that in words.
function projectView({ source: _source, live: _live, ...view }: Project): ProjectView {
  return view;
}

export function projects(ids?: readonly ProjectId[]): ComponentPart {
  const list = ids ? ids.map(projectById) : knowledgeBase.projects;
  return {
    type: 'component',
    component: 'projects',
    props: { projects: list.map(projectView) },
  };
}

export function table(
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  caption = '',
): ComponentPart {
  return { type: 'component', component: 'table', props: { columns, rows, caption } };
}

export function note(tone: NoteTone, markdown: string): ComponentPart {
  return { type: 'component', component: 'note', props: { tone, text: markdown } };
}

export function details(summary: string, markdown: string): ComponentPart {
  return { type: 'component', component: 'details', props: { summary, text: markdown } };
}

export function contactCard(): ComponentPart {
  const { email, linkedin, github, resumeUrl } = knowledgeBase.contact;
  return {
    type: 'component',
    component: 'contact',
    props: {
      heading: 'Interested in working together?',
      text: 'Get in touch with Marcio to discuss engineering, architecture, and product opportunities.',
      email,
      linkedin,
      github,
      resumeUrl,
    },
  };
}

/**
 * Recruitment-flavoured answers may close with the contact call to action,
 * but only once per conversation, so it never turns into repeated promotion.
 */
export function contactOnce(context: ConversationContext): ComponentPart | null {
  return context.ctaShown ? null : contactCard();
}

export function metricValue(id: MetricId): string {
  return knowledgeBase.metrics[id].value;
}

export function allRoleSources(): SourceId[] {
  return knowledgeBase.experience.map((role) => role.source);
}

interface ResponseMeta {
  readonly followUps: readonly string[];
  readonly sources: readonly SourceId[];
  readonly related?: RoleId;
  readonly grounded?: boolean;
}

export function response(
  intent: string,
  parts: readonly (ResponsePart | null)[],
  meta: ResponseMeta,
): AssistantResponse {
  return {
    intent,
    parts: parts.filter((part): part is ResponsePart => part !== null),
    followUps: meta.followUps,
    sources: meta.sources.map(sourceOf),
    related: meta.related ?? null,
    grounded: meta.grounded ?? true,
  };
}
