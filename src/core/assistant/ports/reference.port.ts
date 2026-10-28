export interface ReferenceSummary {
  readonly title: string;
  readonly extract: string;
  readonly url: string;
}

/** A public encyclopedia, for what a technology or a company is. */
export interface ReferencePort {
  /** Null when there is no article for the title, or the source cannot be reached right now. */
  summary(title: string): Promise<ReferenceSummary | null>;
}
