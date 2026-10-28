import { Fragment, type ReactNode } from 'react';
import type { Template } from '@/core/i18n/format';

/**
 * A template whose placeholders are elements rather than text, such as keys
 * drawn as keys. The words around them stay in the catalog, in the order the
 * language puts them.
 */
export function formatNodes(template: Template, nodes: Readonly<Record<string, ReactNode>>) {
  return template.split(/(\{\w+\})/).map((piece, index) => {
    const key = /^\{(\w+)\}$/.exec(piece)?.[1];
    return (
      <Fragment key={index}>{key !== undefined && key in nodes ? nodes[key] : piece}</Fragment>
    );
  });
}
