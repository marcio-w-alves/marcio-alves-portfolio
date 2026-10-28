import type { MetricSource } from '@/core/knowledge/schema';

export const metrics: Readonly<Record<string, MetricSource>> = {
  'way2b1-bundle': {
    value: '~50%',
    label: { en: 'Smaller bundle size' },
    context: 'Way2b1',
    source: 'resume.way2b1',
  },
  'way2b1-load': {
    value: '~100s of ms',
    label: { en: 'Loading times, down to a few hundred milliseconds' },
    context: 'Way2b1',
    source: 'resume.way2b1',
  },
  'deel-critical-load': {
    value: '50%',
    label: { en: 'Reduction in loading time on critical pages' },
    context: 'Deel',
    source: 'resume.deel',
  },
  'deel-web-vitals': {
    value: '30%+',
    label: { en: 'Improvement in Web Vitals' },
    context: 'Deel',
    source: 'resume.deel',
  },
  'deel-people-list': {
    value: '6s → 3s',
    label: { en: 'People List load time on a cold run' },
    context: 'Deel',
    source: 'resume.deel',
  },
  'roots-team': {
    value: '1 → 4',
    label: { en: 'Frontend team grown from a solo setup' },
    context: 'Roots',
    source: 'resume.roots',
  },
  'maison-newsletter': {
    value: '20%',
    label: { en: 'Income increase from the newsletter project he contributed to' },
    context: 'Maison Moderne',
    source: 'resume.maison',
  },
  'webfi-sales': {
    value: '30%+',
    label: { en: 'Sales growth for smaller industry clients' },
    context: 'WEBFI',
    source: 'resume.webfi',
  },
};
