import type { MetricId } from '../ids';
import type { Metric } from '../types';

export const metrics: Readonly<Record<MetricId, Metric>> = {
  'deel-critical-load': {
    value: '50%',
    label: 'Reduction in loading time on critical pages',
    context: 'Deel',
    source: 'resume.deel',
  },
  'deel-web-vitals': {
    value: '30%+',
    label: 'Improvement in Web Vitals',
    context: 'Deel',
    source: 'resume.deel',
  },
  'deel-people-list': {
    value: '6s → 3s',
    label: 'People List load time on a cold run',
    context: 'Deel',
    source: 'resume.deel',
  },
  'roots-team': {
    value: '1 → 4',
    label: 'Frontend team grown from a solo setup',
    context: 'Roots',
    source: 'resume.roots',
  },
  'maison-newsletter': {
    value: '20%',
    label: 'Income increase from the newsletter project he contributed to',
    context: 'Maison Modern',
    source: 'resume.maison',
  },
  'webfi-sales': {
    value: '30%+',
    label: 'Sales growth for smaller industry clients',
    context: 'WEBFI',
    source: 'resume.webfi',
  },
};
