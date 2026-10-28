import type { ReactNode } from 'react';
import type { MessagePart } from '@/core/conversation/messages';
import { cn } from '../cn';
import { InlineNodes } from '../format/inline';
import { parseBlocks, type Block } from '../format/parse-blocks';
import { RichBlock } from '../rich';
import { CodeBlock } from './code-block';
import { ThinkingDots } from './thinking-dots';

function StreamingCaret() {
  return (
    <span
      aria-hidden="true"
      className="ml-1.5 inline-block size-1.75 animate-blink rounded-full bg-ink align-caret"
    />
  );
}

function TextBlock({ block, caret }: { readonly block: Block; readonly caret: boolean }) {
  const tail: ReactNode = caret ? <StreamingCaret /> : null;
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="m-0 text-pretty wrap-anywhere">
          <InlineNodes nodes={block.content} />
          {tail}
        </p>
      );
    case 'heading':
      return (
        // An answer sits under the page's h1: its sections, like its cards' titles, are h2.
        <h2 className="mt-3 -mb-1 font-display text-15.5 leading-label font-semibold tracking-title">
          <InlineNodes nodes={block.content} />
          {tail}
        </h2>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List
          start={block.ordered ? block.start : undefined}
          className={cn(
            'm-0 flex flex-col gap-2 pl-4.5 marker:text-ink-faint',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              <InlineNodes nodes={item} />
              {index === block.items.length - 1 && tail}
            </li>
          ))}
        </List>
      );
    }
    case 'code':
      return <CodeBlock language={block.language} code={block.code} />;
  }
}

interface AnswerBodyProps {
  readonly parts: readonly MessagePart[];
  readonly streaming: boolean;
}

/**
 * An answer's parts in order: Markdown text as blocks, and allow-listed rich
 * blocks. While it streams, a caret follows the last text, or dots follow a
 * rich block still waiting for what comes next.
 */
export function AnswerBody({ parts, streaming }: AnswerBodyProps) {
  const last = parts.at(-1);
  return (
    <div className="flex flex-col gap-3.5 text-15.5 leading-answer text-ink @max-phone/ma:text-15">
      {parts.map((part) => {
        if (part.type === 'component') {
          const { type: _part, id: _id, ...block } = part;
          return <RichBlock key={part.id} block={block} />;
        }
        const blocks = parseBlocks(part.text);
        const isTail = streaming && part === last;
        return blocks.map((block, index) => (
          <TextBlock
            key={`${part.id}:${String(index)}`}
            block={block}
            caret={isTail && index === blocks.length - 1}
          />
        ));
      })}
      {streaming && last?.type === 'component' && <ThinkingDots />}
    </div>
  );
}
