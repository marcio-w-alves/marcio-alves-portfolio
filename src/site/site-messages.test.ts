import { describe, expect, it } from 'vitest';
import type { Locale } from '@/core/i18n/locale';
import { localize } from '@/core/knowledge/localize';
import { profile } from '@/profile';
import { fixtureSiteProfile } from '@/testing/fixture-profile';
import { englishUiMessages } from '@/ui/i18n/en';
import { englishSiteCopy } from './site-copy';
import { siteMessages, type CopyOverrides, type SiteMessages } from './site-messages';
import { copyIn } from './site-profile';

const SUBJECT = new Set(['name', 'firstName', 'title']);
const DEFAULTS: SiteMessages = { ui: englishUiMessages, site: englishSiteCopy };

/**
 * Every message of a catalog by its path, e.g. `ui.errors.retryIn.one`. A list
 * is one entry, as long as the profile likes but with no blank item.
 */
function flatten(catalog: unknown, path = ''): Map<string, string> {
  if (typeof catalog === 'string') return new Map([[path, catalog]]);
  if (Array.isArray(catalog)) {
    const items = catalog as string[];
    return new Map([[path, items.every((item) => item.trim()) ? items.join('\n') : '']]);
  }
  return new Map(
    Object.entries(catalog as Record<string, unknown>).flatMap(([key, value]) => [
      ...flatten(value, path ? `${path}.${key}` : key),
    ]),
  );
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map(([, name = '']) => name).sort();
}

/**
 * What is wrong with a profile's catalogs, by path: a message missing or
 * blank, or one that lost a placeholder the interface fills in.
 */
function catalogProblems(resolved: SiteMessages): string[] {
  const shown = flatten(resolved);
  return [...flatten(DEFAULTS)].flatMap(([path, fallback]) => {
    const message = shown.get(path);
    if (!message?.trim()) return [`${path}: missing`];
    const expected = placeholders(fallback).filter((name) => !SUBJECT.has(name));
    return placeholders(message).join() === expected.join()
      ? []
      : [`${path}: placeholders ${placeholders(message).join() || 'none'}, not ${expected.join()}`];
  });
}

function resolvedFor(
  source: typeof fixtureSiteProfile,
  overrides: CopyOverrides,
  locale: Locale = 'en',
) {
  return siteMessages(localize(source.knowledge, locale), overrides, locale);
}

describe('the catalogs a profile renders with', () => {
  it("has every message, with the placeholders the interface fills, for the owner's profile", () => {
    expect(catalogProblems(resolvedFor(profile, profile.copy.en))).toEqual([]);
  });

  it('has every message, with the placeholders the interface fills, for the fixture', () => {
    expect(catalogProblems(resolvedFor(fixtureSiteProfile, fixtureSiteProfile.copy.en))).toEqual(
      [],
    );
  });

  it.each([
    ["the owner's profile", profile],
    ['the fixture', fixtureSiteProfile],
  ])('has every message in Portuguese, with the same placeholders, for %s', (_name, source) => {
    expect(catalogProblems(resolvedFor(source, copyIn(source, 'pt-BR'), 'pt-BR'))).toEqual([]);
  });

  it('has every message in the Portuguese defaults alone, for a profile that rewords none', () => {
    const none = { ui: {}, site: {} };
    expect(catalogProblems(resolvedFor(fixtureSiteProfile, none, 'pt-BR'))).toEqual([]);
  });

  it('accepts a list of its own length, but not a blank item in it', () => {
    const shorter = { ui: { conversation: { thinking: ['Reading'] } }, site: {} };
    const blank = { ui: { conversation: { thinking: ['Reading', ' '] } }, site: {} };
    expect(catalogProblems(resolvedFor(fixtureSiteProfile, shorter))).toEqual([]);
    expect(catalogProblems(resolvedFor(fixtureSiteProfile, blank))).toEqual([
      'ui.conversation.thinking: missing',
    ]);
  });

  it('names the message an override broke, by its path', () => {
    const broken = { ui: { actions: { viewRole: 'View the experience' } }, site: {} };
    expect(catalogProblems(resolvedFor(fixtureSiteProfile, broken))).toEqual([
      'ui.actions.viewRole: placeholders none, not company',
    ]);
  });

  it('writes the person in, and leaves what the browser fills', () => {
    const { ui, site } = resolvedFor(fixtureSiteProfile, fixtureSiteProfile.copy.en);
    expect(site.title).toBe('Ada Rivera — Principal Platform Engineer');
    expect(ui.conversation.thinking[0]).toBe("Reading Ada's documented experience");
    expect(ui.actions.roleQuestion).toBe('What did she do at {company}?');
  });

  it("takes the profile's wording where it has one, the default elsewhere", () => {
    const { ui } = resolvedFor(fixtureSiteProfile, fixtureSiteProfile.copy.en);
    expect(ui.emailSubject).toBe('Platform role');
    expect(ui.composer.send).toBe(englishUiMessages.composer.send);
  });
});
