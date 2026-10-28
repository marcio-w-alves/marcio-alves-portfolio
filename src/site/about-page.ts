/**
 * The one page without a chat: an article about how the site is built, in the
 * owner's words. A language whose profile copy has none has no such page and
 * no sidebar link.
 */
export interface AboutPageCopy {
  /** The sidebar's link to it. */
  readonly label: string;
  /** The page's heading. */
  readonly title: string;
  /** Its search-result snippet, at most 160 characters. */
  readonly description: string;
  /** The article, in the same Markdown the answers are written in. */
  readonly markdown: string;
}
