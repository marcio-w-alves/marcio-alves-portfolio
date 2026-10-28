export interface GithubProfile {
  readonly login: string;
  readonly name: string | null;
  readonly bio: string | null;
  readonly publicRepositories: number;
  readonly followers: number;
  readonly url: string;
  readonly createdAt: string;
}

export interface GithubRepository {
  readonly name: string;
  readonly description: string | null;
  readonly language: string | null;
  readonly stars: number;
  readonly fork: boolean;
  readonly topics: readonly string[];
  readonly url: string;
  readonly pushedAt: string;
}

/** The owner's public GitHub account. Both calls return null when GitHub cannot be reached. */
export interface GithubPort {
  profile(): Promise<GithubProfile | null>;
  /** Most recently pushed first. */
  repositories(limit: number): Promise<GithubRepository[] | null>;
}
