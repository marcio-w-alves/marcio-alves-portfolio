import { VisuallyHidden } from '../primitives';

interface SkillGroup {
  readonly title: string;
  readonly items: readonly string[];
}

export function Skills({ groups }: { readonly groups: readonly SkillGroup[] }) {
  return (
    <section aria-label="Technical skills" className="@container/skills animate-block-enter">
      <ul className="grid grid-cols-skills gap-x-7 gap-y-5">
        {groups.map((group) => (
          <li key={group.title}>
            <p className="mb-2.5 flex items-baseline gap-2 text-13.5 font-semibold">
              {group.title}
              <span className="font-mono text-11 leading-none font-medium text-ink-muted">
                {group.items.length}
                <VisuallyHidden> skills</VisuallyHidden>
              </span>
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {group.items.map((skill) => (
                <li
                  key={skill}
                  className="inset-shadow-ring inline-flex h-7 items-center rounded-pill bg-surface px-2.75 text-13 whitespace-nowrap text-ink"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
