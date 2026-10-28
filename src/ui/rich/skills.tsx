import { VisuallyHidden } from '../primitives';

interface SkillGroup {
  readonly title: string;
  readonly items: readonly string[];
}

export function Skills({ groups }: { readonly groups: readonly SkillGroup[] }) {
  return (
    <section aria-label="Technical skills" className="@container/skills animate-block-enter">
      <ul className="grid grid-cols-skills gap-x-7 gap-y-5.5">
        {groups.map((group) => (
          <li key={group.title} className="pt-3.5 inset-shadow-rule-top">
            <p className="mb-3 flex items-baseline justify-between gap-2 font-display text-14 leading-label font-semibold tracking-name">
              {group.title}
              <span className="font-sans text-12 leading-none font-normal text-ink-muted">
                {group.items.length}
                <VisuallyHidden> skills</VisuallyHidden>
              </span>
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {group.items.map((skill) => (
                <li
                  key={skill}
                  className="inline-flex h-7 items-center rounded-pill bg-surface px-2.75 text-13 whitespace-nowrap shadow-ring-strong"
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
