import { JSDOM } from 'jsdom';
import { contrast, diffJson } from './json-diff';
import { normalizeDocument } from './normalize';

/**
 * Two documents compared node by node after normalization. A change is
 * located by its element path (`html>body>main[0]>p[2]@class`); structured
 * data is compared as the JSON it holds (`…>script[0]#name`). Where a parent's
 * children differ in number, the parent is reported once rather than every
 * sibling after the insertion.
 */

export interface DomChange {
  readonly path: string;
  readonly detail: string;
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export function compareDocuments(baselineHtml: string, targetHtml: string): DomChange[] {
  return compareElements(parse(baselineHtml), parse(targetHtml), 'html');
}

function parse(html: string): Element {
  const { document } = new JSDOM(html).window;
  normalizeDocument(document);
  return document.documentElement;
}

function compareElements(baseline: Element, target: Element, path: string): DomChange[] {
  if (baseline.tagName !== target.tagName) {
    return [{ path, detail: `<${baseline.localName}> → <${target.localName}>` }];
  }
  if (isStructuredData(baseline)) return compareStructuredData(baseline, target, path);
  return [...compareAttributes(baseline, target, path), ...compareChildren(baseline, target, path)];
}

function compareAttributes(baseline: Element, target: Element, path: string): DomChange[] {
  const names = [
    ...new Set([...baseline.getAttributeNames(), ...target.getAttributeNames()]),
  ].sort();
  return names
    .filter((name) => baseline.getAttribute(name) !== target.getAttribute(name))
    .map((name) => ({
      path: `${path}@${name}`,
      detail: contrast(
        baseline.getAttribute(name) ?? undefined,
        target.getAttribute(name) ?? undefined,
      ),
    }));
}

function compareChildren(baseline: Element, target: Element, path: string): DomChange[] {
  const before = childrenOf(baseline);
  const after = childrenOf(target);
  if (before.length !== after.length) {
    return [{ path, detail: `${describe(before)} → ${describe(after)}` }];
  }
  return before.flatMap((child, index) => {
    const other = after[index];
    if (!other) return [];
    const childPath = `${path}>${child.label}`;
    if (child.node.nodeType !== other.node.nodeType || child.label !== other.label) {
      return [{ path: childPath, detail: `${child.label} → ${other.label}` }];
    }
    if (child.node.nodeType === TEXT_NODE) {
      const [text, otherText] = [child.node.nodeValue, other.node.nodeValue];
      return text === otherText ? [] : [{ path: childPath, detail: contrast(text, otherText) }];
    }
    return compareElements(child.node as Element, other.node as Element, childPath);
  });
}

interface Child {
  readonly node: Node;
  /** `p[2]` for the third <p> among its siblings, `#text[0]` for the first text. */
  readonly label: string;
}

/** Elements and text, without the whitespace between tags that markup formatting leaves. */
function childrenOf(element: Element): Child[] {
  const seen = new Map<string, number>();
  return Array.from(element.childNodes)
    .filter(
      (node) =>
        node.nodeType === ELEMENT_NODE ||
        (node.nodeType === TEXT_NODE && (node.nodeValue ?? '').trim() !== ''),
    )
    .map((node) => {
      const name = node.nodeType === TEXT_NODE ? '#text' : (node as Element).localName;
      const index = seen.get(name) ?? 0;
      seen.set(name, index + 1);
      return { node, label: `${name}[${String(index)}]` };
    });
}

function describe(children: readonly Child[]): string {
  return `${String(children.length)} children (${children.map(({ label }) => label).join(', ')})`;
}

function isStructuredData(element: Element): boolean {
  return element.localName === 'script' && element.getAttribute('type') === 'application/ld+json';
}

function compareStructuredData(baseline: Element, target: Element, path: string): DomChange[] {
  return diffJson(jsonOf(baseline), jsonOf(target)).map((change) => ({
    path: `${path}#${change.path}`,
    detail: contrast(change.baseline, change.target),
  }));
}

function jsonOf(element: Element): unknown {
  return JSON.parse(element.textContent || 'null');
}
