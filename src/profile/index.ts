import { brand } from './brand';
import { answers } from './copy/en/answers';
import { evaluation } from './evaluation/cases';
import { identity } from './identity';
import { knowledge } from './knowledge';
import { locales } from './locales';
import { validateProfile } from './schema';

/** The owner of this site. Read only by the roots that wire it, the scripts and the tests. */
export const profile = validateProfile({
  identity,
  locales,
  knowledge,
  brand,
  copy: { en: { answers } },
  evaluation,
});
