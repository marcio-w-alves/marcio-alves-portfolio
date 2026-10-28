'use client';

import { Icon } from '../primitives';
import { ACTION } from './answer-actions';
import { copyText } from './copy-text';
import { useCopyConfirmation } from './use-copy-confirmation';

export function CodeBlock({
  language,
  code,
}: {
  readonly language: string;
  readonly code: string;
}) {
  const { copied, copy } = useCopyConfirmation(() => copyText(code));

  return (
    <figure className="m-0 animate-block-enter overflow-hidden rounded-md bg-ice shadow-ring">
      <figcaption className="flex items-center justify-between gap-3 py-1 pr-1 pl-4 text-12 text-ink-muted inset-shadow-rule-bottom">
        <span>{language}</span>
        <button type="button" className={ACTION} onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} size="xs" />
          {copied ? 'Copied' : 'Copy code'}
        </button>
        <span role="status" className="sr-only">
          {copied ? 'Copied' : ''}
        </span>
      </figcaption>
      <pre className="m-0 overflow-x-auto px-4.5 py-4 font-mono text-13 leading-airy tab-2 text-ink">
        <code className="font-code-block">{code}</code>
      </pre>
    </figure>
  );
}
