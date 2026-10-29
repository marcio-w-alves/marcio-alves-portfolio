import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/core/i18n/locale';
import { OWNER_COPY_REQUIRED, ownerCopyDirectory, ownerCopyStatus } from './copy-documents';

/**
 * Whether the owner's equivalence oracle may be skipped. It is the proof that
 * his copy data says what his TypeScript copy says, and it reads documents
 * that are not in the repository, so when it cannot run something has to say
 * so — loudly where the data was meant to be there.
 */

const LOCALES: readonly Locale[] = ['en', 'pt-BR'];

/** A profile home holding the owner's copy for the given languages, and no more. */
function homeWith(written: readonly Locale[]): Record<string, string> {
  const env = { PROFILE_HOME: mkdtempSync(join(tmpdir(), 'profile-home-')) };
  for (const locale of written) {
    mkdirSync(ownerCopyDirectory(locale, env), { recursive: true });
  }
  return env;
}

describe('with every language exported', () => {
  it('runs the proof', () => {
    expect(ownerCopyStatus(LOCALES, homeWith(LOCALES))).toEqual({ kind: 'ready' });
  });
});

describe('with nothing exported', () => {
  it('skips, saying why and how to make it a failure', () => {
    const status = ownerCopyStatus(LOCALES, homeWith([]));

    expect(status.kind).toBe('skipped');
    if (status.kind !== 'skipped') return;
    expect(status.reason).toContain('did not run');
    expect(status.reason).toContain(OWNER_COPY_REQUIRED);
  });

  it(`fails where ${OWNER_COPY_REQUIRED} asks for it, naming what is missing`, () => {
    const env = { ...homeWith([]), OWNER_COPY: 'required' };
    const status = ownerCopyStatus(LOCALES, env);

    expect(status.kind).toBe('failed');
    if (status.kind !== 'failed') return;
    expect(status.problem).toContain(OWNER_COPY_REQUIRED);
    expect(status.problem).toContain(ownerCopyDirectory('en', env));
    expect(status.problem).toContain(ownerCopyDirectory('pt-BR', env));
    expect(status.problem).toContain('export-owner-copy.mts');
  });
});

describe('with one language exported and another missing', () => {
  it('fails even unasked, naming the language it would have proven nothing about', () => {
    const env = homeWith(['en']);
    const status = ownerCopyStatus(LOCALES, env);

    expect(status.kind).toBe('failed');
    if (status.kind !== 'failed') return;
    expect(status.problem).toContain('1 of 2 languages');
    expect(status.problem).toContain(ownerCopyDirectory('pt-BR', env));
    expect(status.problem).not.toContain(ownerCopyDirectory('en', env));
    expect(status.problem).toContain('export-owner-copy.mts');
  });

  it('fails without being asked, so the marker is not what catches it', () => {
    expect(ownerCopyStatus(LOCALES, homeWith(['pt-BR'])).kind).toBe('failed');
  });
});
