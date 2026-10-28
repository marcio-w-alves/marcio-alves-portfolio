import type { MetricItem, RoleSection, RoleView } from '@/core/assistant/components';
import { BulletList } from './bullet-list';
import { SectionTitle } from './section-title';
import { TagList } from './tag-list';
import { TimelineRole } from './timeline-role';

interface TimelineProps {
  readonly roles: readonly RoleView[];
  /** The roles open on first render; the visitor opens and closes the rest. */
  readonly expanded: readonly string[];
}

export function Timeline({ roles, expanded }: TimelineProps) {
  return (
    <section aria-label="Career timeline" className="@container/timeline animate-block-enter">
      <ol>
        {roles.map((role, index) => (
          <TimelineRole
            key={role.id}
            role={role}
            isFirst={index === 0}
            isLast={index === roles.length - 1}
            initiallyOpen={expanded.includes(role.id)}
          >
            {role.sections.map((section) => (
              <div key={section.title}>
                <SectionTitle>{section.title}</SectionTitle>
                <SectionContent section={section} />
              </div>
            ))}
          </TimelineRole>
        ))}
      </ol>
    </section>
  );
}

function SectionContent({ section }: { readonly section: RoleSection }) {
  switch (section.kind) {
    case 'list':
      return <BulletList items={section.items} marker="circle" />;
    case 'metrics':
      return <ImpactList items={section.items} />;
    case 'tags':
      return <TagList tags={section.items} tone="outline" />;
  }
}

function ImpactList({ items }: { readonly items: readonly MetricItem[] }) {
  return (
    <ul className="flex flex-col gap-2 text-14 leading-normal">
      {items.map((metric) => (
        <li
          key={`${metric.value} ${metric.label}`}
          className="grid grid-cols-impact items-baseline gap-3"
        >
          <span className="font-semibold tabular-nums">{metric.value}</span>
          <span>{metric.label}</span>
        </li>
      ))}
    </ul>
  );
}
