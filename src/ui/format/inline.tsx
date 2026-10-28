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
      return <strong className="font-semibold">{node.text}</strong>;
    case 'code':
      return (
        <code className="bg-code-bg inset-shadow-ring rounded-code px-1.25 py-px font-mono text-code font-normal">
          {node.text}
        </code>
      );
    case 'link':
      return <InlineLink node={node} />;
  }
}

function InlineLink({ node }: { readonly node: Extract<InlineNode, { kind: 'link' }> }) {
  const className =
    'text-accent underline decoration-accent/35 underline-offset-3 hover:text-accent-hover hover:decoration-current';
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
