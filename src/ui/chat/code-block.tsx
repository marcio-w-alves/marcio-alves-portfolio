'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../primitives';
import { ACTION } from './answer-actions';
import { copyText } from './copy-text';

const CONFIRM_MS = 1800;

export function CodeBlock({
  language,
  code,
}: {
  readonly language: string;
  readonly code: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, CONFIRM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  return (
    <figure className="bg-code-bg inset-shadow-ring m-0 animate-block-enter overflow-hidden rounded-md">
      <figcaption className="flex items-center justify-between gap-3 border-b border-border py-1 pr-1 pl-3.5 font-mono text-11.5 leading-none font-medium text-ink-muted">
        <span>{language}</span>
        <button
          type="button"
          className={ACTION}
          onClick={() => {
            void copyText(code).then(setCopied);
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size="xs" />
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </figcaption>
      <pre className="m-0 overflow-x-auto px-4 py-3.5 font-mono text-13 leading-prose tab-2 text-ink">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
