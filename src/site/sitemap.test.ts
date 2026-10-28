import { expect, it } from 'vitest';
import { sitemap } from './sitemap';

it('lists every page at the canonical origin, the overview as the home page', () => {
  expect(sitemap(new URL('https://ada.example')).map(({ url }) => url)).toEqual([
    'https://ada.example/',
    'https://ada.example/experience',
    'https://ada.example/skills',
    'https://ada.example/projects',
    'https://ada.example/philosophy',
    'https://ada.example/education',
  ]);
});
