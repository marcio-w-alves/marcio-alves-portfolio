import { readFile } from 'node:fs/promises';
import type { KnowledgeIndex } from '../../src/infrastructure/retrieval/index-spec';
import type { Profile } from '../../src/profile/schema';
import type { ProbeVectors } from './retrieval';

/**
 * The profile of the checkout this file was copied into, with its retrieval
 * index and the stored vectors of its retrieval probes. `fixture` is the
 * fictional profile the tests use.
 */
const PROFILE_NAMES = ['owner', 'fixture'] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

interface CheckoutProfile {
  readonly profile: Profile;
  readonly index: KnowledgeIndex;
  readonly probes: ProbeVectors;
}

const NO_PROBES: ProbeVectors = { vectors: {} };

export function isProfileName(value: string): value is ProfileName {
  return (PROFILE_NAMES as readonly string[]).includes(value);
}

export async function loadCheckoutProfile(name: ProfileName): Promise<CheckoutProfile> {
  return name === 'owner' ? loadOwner() : loadFixture();
}

async function loadOwner(): Promise<CheckoutProfile> {
  const { profile } = await import('../../src/profile/index');
  return {
    profile,
    index: await readJsonBesideHere<KnowledgeIndex>(
      '../../src/profile/generated/knowledge-index.json',
    ),
    probes: await readJsonBesideHere<ProbeVectors>(
      '../../src/profile/generated/retrieval-probes.json',
    ),
  };
}

async function loadFixture(): Promise<CheckoutProfile> {
  const { profile } = await import('../../src/testing/fixture-profile/profile');
  return {
    profile,
    index: await readJsonBesideHere<KnowledgeIndex>(
      '../../src/testing/fixture-profile/generated/knowledge-index.json',
    ),
    probes: NO_PROBES,
  };
}

async function readJsonBesideHere<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8')) as T;
}
