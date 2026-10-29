import { interpolate } from '@/core/i18n/format';
import { siteSourceId } from '@/core/knowledge/product-sites';
import type { Knowledge, Metric, Project, Role, SiteSubject } from '@/core/knowledge/schema';
import type { AnswerSource, RelatedRole } from '../chat/events';
import type { AnswerLabels } from './answer-labels';
import { createCitation } from './citations';
import type {
  ComponentPart,
  MetricItem,
  NoteTone,
  ProjectView,
  ResponsePart,
  RoleBadge,
  RoleSection,
  RoleView,
} from '../chat/components';
import type { ConversationContext } from '../chat/request';
import type { AssistantResponse } from './response';

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

export function details(summary: string, markdown: string): ComponentPart {
  return { type: 'component', component: 'details', props: { summary, text: markdown } };
}

interface ResponseMeta {
  readonly followUps: readonly string[];
  readonly sources: readonly string[];
  /** The id of the role the answer is about. */
  readonly related?: string;
  readonly grounded?: boolean;
}

/**
 * The builders that read the record, bound to the knowledge they were created
 * with, and that word their cards with the labels of the same language.
 */
export interface ResponseKit {
  readonly knowledge: Knowledge;
  readonly table: (
    columns: readonly string[],
    rows: readonly (readonly string[])[],
    caption?: string,
  ) => ComponentPart;
  readonly note: (tone: NoteTone, markdown: string) => ComponentPart;
  readonly roleById: (id: string) => Role;
  readonly projectById: (id: string) => Project;
  readonly metricById: (id: string) => Metric;
  readonly citation: (id: string) => AnswerSource;
  readonly metrics: (ids: readonly string[]) => ComponentPart;
  readonly timeline: (ids?: readonly string[]) => ComponentPart;
  readonly skills: (ids?: readonly string[]) => ComponentPart;
  readonly projects: (ids?: readonly string[]) => ComponentPart;
  readonly contactCard: () => ComponentPart;
  /**
   * Recruitment-flavoured answers may close with the contact call to action,
   * but only once per conversation, so it never turns into repeated promotion.
   */
  readonly contactOnce: (context: ConversationContext) => ComponentPart | null;
  readonly metricValue: (id: string) => string;
  /** The engineering problem behind one of the owner's products. */
  readonly productDepth: (projectId: string) => string;
  readonly allRoleSources: () => string[];
  /** The sources of the public-site pages read for a project or a company, one per page. */
  readonly siteSources: (subject: SiteSubject) => string[];
  readonly response: (
    intent: string,
    parts: readonly (ResponsePart | null)[],
    meta: ResponseMeta,
  ) => AssistantResponse;
}

function lookup<Item extends { readonly id: string }>(items: readonly Item[], kind: string) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return (id: string): Item => {
    const item = byId.get(id);
    if (!item) throw new Error(`Unknown ${kind} "${id}".`);
    return item;
  };
}

// A card shows what a product is, not whether it is live: the status says that in words.
function projectView({
  source: _source,
  live: _live,
  technologiesSource: _technologiesSource,
  ...view
}: Project): ProjectView {
  return view;
}

export function createResponseKit(knowledge: Knowledge, labels: AnswerLabels): ResponseKit {
  const roleById = lookup(knowledge.experience, 'role');
  const projectById = lookup(knowledge.projects, 'project');
  const citation = createCitation(knowledge);
  const { roleSections, badges } = labels;
  const firstName = { firstName: knowledge.profile.firstName };

  function relatedRole(id: string): RelatedRole {
    return { id, company: roleById(id).company };
  }

  function metricById(id: string): Metric {
    const metric = knowledge.metrics[id];
    if (!metric) throw new Error(`Unknown metric "${id}".`);
    return metric;
  }

  function roleView(role: Role): RoleView {
    const sections: RoleSection[] = [];
    if (role.responsibilities.length > 0) {
      sections.push({
        title: roleSections.responsibilities,
        kind: 'list',
        items: role.responsibilities,
      });
    }
    if (role.metrics.length > 0) {
      sections.push({
        title: roleSections.impact,
        kind: 'metrics',
        items: role.metrics.map((id) => {
          const metric = metricById(id);
          return { value: metric.value, label: metric.label };
        }),
      });
    }
    if (role.leadership.length > 0) {
      sections.push({ title: roleSections.leadership, kind: 'list', items: role.leadership });
    }
    if (role.achievements.length > 0) {
      sections.push({ title: roleSections.achievements, kind: 'list', items: role.achievements });
    }
    if (role.focus.length > 0) {
      sections.push({ title: roleSections.focus, kind: 'tags', items: role.focus });
    }
    return {
      id: role.id,
      company: role.company,
      role: role.role,
      period: role.period,
      summary: role.summary,
      current: role.current,
      badges: badgesOf(role),
      sections,
    };
  }

  function badgesOf(role: Role): RoleBadge[] {
    const shown: RoleBadge[] = [];
    if (role.current) shown.push({ kind: 'current', label: badges.current });
    if (role.engagement === 'contract') shown.push({ kind: 'contract', label: badges.contract });
    return shown;
  }

  function contactCard(): ComponentPart {
    const { email, linkedin, github, resumeUrl } = knowledge.contact;
    return {
      type: 'component',
      component: 'contact',
      props: {
        initials: knowledge.profile.initials,
        heading: labels.contact.heading,
        text: interpolate(labels.contact.text, firstName),
        availability: knowledge.profile.availability,
        email,
        linkedin,
        github,
        resumeUrl,
        actions: {
          email: interpolate(labels.contact.email, firstName),
          linkedin: labels.contact.linkedin,
          resume: labels.contact.resume,
          github: labels.contact.github,
          ...labels.links,
        },
      },
    };
  }

  return {
    knowledge,
    table: (columns, rows, caption = '') => ({
      type: 'component',
      component: 'table',
      props: { columns, rows, caption, label: labels.cards.table },
    }),
    note: (tone, markdown) => ({
      type: 'component',
      component: 'note',
      props: { tone, text: markdown, label: labels.notes[tone] },
    }),
    roleById,
    projectById,
    metricById,
    citation,
    metrics(ids) {
      const items = ids.map((id): MetricItem => {
        const metric = metricById(id);
        return { value: metric.value, label: metric.label, context: metric.context };
      });
      return {
        type: 'component',
        component: 'metrics',
        props: { items, label: labels.cards.metrics },
      };
    },
    timeline(ids) {
      const roles = ids ? ids.map(roleById) : knowledge.experience;
      return {
        type: 'component',
        component: 'timeline',
        props: { roles: roles.map(roleView), expanded: [], label: labels.cards.timeline },
      };
    },
    skills(ids) {
      const groups = ids
        ? knowledge.skills.filter((group) => ids.includes(group.id))
        : knowledge.skills;
      return {
        type: 'component',
        component: 'skills',
        props: {
          groups: groups.map((group) => ({ title: group.title, items: group.items })),
          label: labels.cards.skills,
          unit: labels.cards.skillsUnit,
        },
      };
    },
    projects(ids) {
      const list = ids ? ids.map(projectById) : knowledge.projects;
      return {
        type: 'component',
        component: 'projects',
        props: {
          projects: list.map(projectView),
          labels: { ...labels.project, opensInNewTab: labels.links.opensInNewTab },
        },
      };
    },
    contactCard,
    contactOnce: (context) => (context.ctaShown ? null : contactCard()),
    metricValue: (id) => metricById(id).value,
    productDepth: (projectId) => {
      const depth = knowledge.practice.productDepth[projectId];
      if (depth === undefined) throw new Error(`Unknown project "${projectId}".`);
      return depth;
    },
    allRoleSources: () => knowledge.experience.map((role) => role.source),
    siteSources: ({ kind, id }) => [
      ...new Set(
        knowledge.productSites
          .filter(({ subject }) => subject.kind === kind && subject.id === id)
          .map(({ url }) => siteSourceId(url)),
      ),
    ],
    response(intent, parts, meta) {
      return {
        intent,
        parts: parts.filter((part): part is ResponsePart => part !== null),
        followUps: meta.followUps,
        sources: meta.sources.map(citation),
        related: meta.related ? relatedRole(meta.related) : null,
        grounded: meta.grounded ?? true,
      };
    },
  };
}
