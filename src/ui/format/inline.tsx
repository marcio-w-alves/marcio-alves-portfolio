import { VisuallyHidden } from '../primitives';
import { parseInline, type InlineNode } from './parse-inline';

/** Text with the inline Markdown subset rendered — as elements, never as an HTML string. */
export function InlineText({ text }: { readonly text: string }) {
  return <InlineNodes nodes={parseInline(text)} />;
}

/** Already-parsed inline nodes, as block-level Markdown hands them over. */
export function InlineNodes({ nodes }: { readonly nodes: readonly InlineNode[] }) {
  return nodes.map((node, index) => <InlineElement key={index} node={node} />);
}

function InlineElement({ node }: { readonly node: InlineNode }) {
  switch (node.kind) {
    case 'text':
      return node.text;
    case 'strong':
      return (
        <strong className="font-semibold">
          <InlineNodes nodes={node.children} />
        </strong>
      );
    case 'code':
      return (
        <code className="rounded-code bg-fill px-1.5 py-0.5 font-mono text-code font-medium">
          {node.text}
        </code>
      );
    case 'link':
      return <InlineLink node={node} />;
  }
}

function InlineLink({ node }: { readonly node: Extract<InlineNode, { kind: 'link' }> }) {
  const className =
    'font-medium text-ink underline decoration-border-strong underline-offset-3 hover:decoration-current';
  if (!node.external) {
    return (
      <a className={className} href={node.href}>
        {node.text}
      </a>
    );
  }
  return (
    <a className={className} href={node.href} target="_blank" rel="noopener noreferrer">
      {node.text}
      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
    </a>
  );
}
