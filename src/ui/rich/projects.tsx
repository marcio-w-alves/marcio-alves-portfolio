import type { ProjectView } from '@/core/assistant/components';
import { ButtonLink, Tag, VisuallyHidden } from '../primitives';
import { BulletList } from './bullet-list';
import { SectionTitle } from './section-title';
import { TagList } from './tag-list';

export function Projects({ projects }: { readonly projects: readonly ProjectView[] }) {
  return (
    <div className="grid grid-cols-projects gap-3">
      {projects.map((project) => (
        <ProjectPreview key={project.id} project={project} />
      ))}
    </div>
  );
}

// Each section renders only when documented, so planned scope never reads as shipped work.
function ProjectPreview({ project }: { readonly project: ProjectView }) {
  const links = project.links.filter(isWebUrl);
  return (
    <article
      aria-label={`Project: ${project.name}`}
      className="@container/project flex h-full animate-block-enter flex-col gap-3.5 rounded-card bg-surface px-5 py-4.5 shadow-raised"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          <h4 className="text-17 leading-heading font-semibold tracking-title">{project.name}</h4>
          <p className="mt-0.75 font-mono text-12 leading-label text-ink-muted">
            {project.category}
          </p>
        </div>
        <Tag>{project.status}</Tag>
      </div>
      <p className="text-14.5 leading-reading">{project.description}</p>
      {project.scope.length > 0 ? (
        <div>
          <SectionTitle>Planned scope</SectionTitle>
          <PlannedScope items={project.scope} />
        </div>
      ) : null}
      {project.technologies.length > 0 ? (
        <div>
          <SectionTitle>Main technologies</SectionTitle>
          <TagList tags={project.technologies} />
        </div>
      ) : null}
      {project.considerations.length > 0 ? (
        <div>
          <SectionTitle>Engineering considerations</SectionTitle>
          <BulletList items={project.considerations} marker="disc" />
        </div>
      ) : null}
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {links.map((href) => (
            <ButtonLink key={href} href={href} size="sm" target="_blank" rel="noopener noreferrer">
              {linkLabel(href)}
              <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
            </ButtonLink>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PlannedScope({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="grid grid-cols-scope gap-x-4 gap-y-1.5 text-14 leading-caption">
      {items.map((item) => (
        <li key={item} className="flex items-baseline gap-2.5">
          <span
            aria-hidden="true"
            className="size-1.75 shrink-0 -translate-y-px rounded-full inset-shadow-dot"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Links are opened in a new tab, so only well-formed web addresses qualify.
function isWebUrl(href: string): boolean {
  return /^https?:\/\//i.test(href) && URL.canParse(href);
}

// A link arrives as a bare URL; its host is the most honest label for it.
function linkLabel(href: string): string {
  return new URL(href).host;
}
