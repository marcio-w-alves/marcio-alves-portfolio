import { describe, expect, it } from 'vitest';
import { repositoryFiles, type SourceFile } from '@/testing/whitelabel';

/** Each contract the browser and the server share, and the one file that defines it. */
const WIRE_CONTRACTS = {
  ASSISTANT_EVENT_TYPES: 'src/core/chat/events.ts',
  AssistantEvent: 'src/core/chat/events.ts',
  AssistantError: 'src/core/chat/events.ts',
  AssistantErrorCode: 'src/core/chat/events.ts',
  AnswerSource: 'src/core/chat/events.ts',
  INTERRUPTED: 'src/core/chat/events.ts',
  RichComponent: 'src/core/chat/components.ts',
  RICH_COMPONENTS: 'src/core/chat/components.ts',
  TOPIC_IDS: 'src/core/chat/topic-id.ts',
  TopicId: 'src/core/chat/topic-id.ts',
  HistoryTurn: 'src/core/chat/request.ts',
  ConversationContext: 'src/core/chat/request.ts',
  ChatRequest: 'src/core/chat/request.ts',
  MAX_QUESTION_LENGTH: 'src/core/chat/request.ts',
  chatRequestSchema: 'src/core/chat/request-schema.ts',
} as const;

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

/** Every file that declares `name`, exported or not: a private copy drifts just the same. */
function declarersOf(name: string, files: readonly SourceFile[]): string[] {
  // A statement that starts with the keyword; `type X,` inside an import list only names it.
  const declaration = new RegExp(
    `^\\s*(export\\s+)?(const|let|var|type|interface|function|class)\\s+${name}\\b(?!\\s*[,}])`,
    'm',
  );
  return files.filter(({ text }) => declaration.test(text)).map(({ path }) => path);
}

const shipped = repositoryFiles(['src', 'scripts']).filter(
  ({ path }) =>
    /\.(ts|tsx|mts)$/.test(path) && !isTest(path) && !path.startsWith('src/architecture/fixtures/'),
);

describe('wire contracts', () => {
  it.each(Object.entries(WIRE_CONTRACTS))('defines %s once, in %s', (name, home) => {
    expect(declarersOf(name, shipped)).toEqual([home]);
  });

  it('lists the event types nowhere but in their union', () => {
    const eventTypeList = /['"]text-start['"]\s*,\s*['"]text-delta['"]/;

    expect(shipped.filter(({ text }) => eventTypeList.test(text)).map(({ path }) => path)).toEqual(
      [],
    );
  });

  it('finds a second, private definition of a contract', () => {
    const files = [
      { path: 'src/core/chat/events.ts', text: 'export const INTERRUPTED = {};' },
      { path: 'src/ui/chat/chat-client.ts', text: 'const INTERRUPTED: AssistantError = {};' },
      { path: 'src/ui/chat/other.ts', text: 'import {\n  type INTERRUPTED,\n} from "x";' },
    ];

    expect(declarersOf('INTERRUPTED', files)).toEqual([
      'src/core/chat/events.ts',
      'src/ui/chat/chat-client.ts',
    ]);
  });
});
