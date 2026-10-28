import type { AnswerSource } from '../chat/events';
import { siteLabel, siteSourceId } from '../knowledge/product-sites';
import type { Knowledge } from '../knowledge/schema';

/**
 * How an answer credits what it was built from: a source of the record by its
 * label, and a page of a product's or company's site by its address, linked.
 */
export function createCitation({
  sourceLabels,
  productSites,
}: Pick<Knowledge, 'sourceLabels' | 'productSites'>) {
  const pages = new Map(
    productSites.map(({ url }): [string, AnswerSource] => [
      siteSourceId(url),
      { id: siteSourceId(url), label: siteLabel(url), url },
    ]),
  );
  return (id: string): AnswerSource => {
    const page = pages.get(id);
    if (page) return page;
    const label = sourceLabels[id];
    if (label === undefined) throw new Error(`Unknown source "${id}".`);
    return { id, label };
  };
}
