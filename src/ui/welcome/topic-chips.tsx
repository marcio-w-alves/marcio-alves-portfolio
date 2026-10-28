import type { TopicId } from '@/core/assistant/topics';
import { Chip } from './chip';

export interface TopicChoice {
  readonly id: TopicId;
  readonly label: string;
}

interface TopicChipsProps {
  readonly topics: readonly TopicChoice[];
  readonly onPick: (id: TopicId) => void;
}

/** On a phone the sidebar is a drawer, so the topics surface here as a sideways row. */
export function TopicChips({ topics, onPick }: TopicChipsProps) {
  return (
    <ul
      aria-label="Topics"
      className="scrollbar-none hidden list-none @max-phone/ma:-mx-4 @max-phone/ma:flex @max-phone/ma:gap-2 @max-phone/ma:overflow-x-auto @max-phone/ma:px-4 @max-phone/ma:pt-0.5 @max-phone/ma:pb-1"
    >
      {topics.map((topic) => (
        <li key={topic.id}>
          <Chip
            className="shrink-0 whitespace-nowrap"
            onClick={() => {
              onPick(topic.id);
            }}
          >
            {topic.label}
          </Chip>
        </li>
      ))}
    </ul>
  );
}
