import { Button, Icon, type IconName } from '../primitives';

interface ConversationTopBarProps {
  readonly topic: { readonly label: string; readonly icon: IconName };
  readonly onNewConversation: () => void;
}

/** Above the conversation on wide layouts; the compact layout has its own top bar. */
export function ConversationTopBar({ topic, onNewConversation }: ConversationTopBarProps) {
  return (
    <div className="flex h-13 shrink-0 items-center justify-between gap-3 pr-4 pl-6 @max-compact/ma:hidden">
      <p className="flex min-w-0 items-center gap-2 text-13 text-ink-muted">
        <Icon name={topic.icon} size="sm" />
        <span>
          Conversation · <strong className="font-medium text-ink">{topic.label}</strong>
        </span>
      </p>
      <Button variant="ghost" size="sm" onClick={onNewConversation}>
        <Icon name="compose" size="sm" />
        New conversation
      </Button>
    </div>
  );
}
