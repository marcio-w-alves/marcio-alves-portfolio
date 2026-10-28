import type { ProjectView } from '@/core/assistant/components';
import { ButtonLink, Icon, Tag, VisuallyHidden } from '../primitives';
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

// Each section renders only when documented, and the scope keeps its own label, so a concept's
// planned scope never reads as a live product's features.
function ProjectPreview({ project }: { readonly project: ProjectView }) {
  const links = project.links.filter((link) => isWebUrl(link.url));
  return (
    <article
      aria-label={`Project: ${project.name}`}
      className="@container/project flex h-full animate-block-enter flex-col gap-3.5 rounded-lg bg-surface px-5 py-4.5 shadow-ring"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-control bg-ice text-ink shadow-ring"
        >
          <Icon name="folder" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-16 leading-heading font-semibold tracking-subhead">
            {project.name}
          </h4>
          <p className="mt-0.5 text-12.5 leading-label text-ink-muted">{project.category}</p>
        </div>
        <Tag tone="accent">{project.status}</Tag>
      </div>
      <p className="text-14.5 leading-reading text-ink">{project.description}</p>
      {project.scope.length > 0 ? (
        <div>
          <SectionTitle>{project.scopeLabel}</SectionTitle>
          <Scope items={project.scope} />
        </div>
      ) : null}
      {project.platforms.length > 0 ? (
        <div>
          <SectionTitle>Platforms</SectionTitle>
          <TagList tags={project.platforms} />
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
          {links.map(({ label, url }) => (
            <ButtonLink key={url} href={url} size="sm" target="_blank" rel="noopener noreferrer">
              {label}
              <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
              <Icon name="arrowUpRight" size="xs" />
            </ButtonLink>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Scope({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="inline-flex h-7 items-center gap-1.75 rounded-pill bg-ice pr-2.75 pl-2.25 text-12.5 shadow-ring"
        >
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full inset-shadow-dot" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// Links are opened in a new tab, so only well-formed web addresses qualify.
function isWebUrl(href: string): boolean {
  return /^https?:\/\//i.test(href) && URL.canParse(href);
}
