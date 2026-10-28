import type { MetricId } from '../ids';
import type { Metric } from '../types';

export const metrics: Readonly<Record<MetricId, Metric>> = {
  'deel-critical-load': {
    value: '50%',
    label: 'Reduction in critical page loading time',
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
    label: 'People List loading time',
    context: 'Deel',
    source: 'resume.deel',
  },
  'deel-backlog': {
    value: '~67%',
    label: 'Reduction in bug and support ticket backlog',
    context: 'Deel',
    source: 'resume.deel',
  },
  'roots-team': {
    value: '4 engineers',
    label: 'Team size after growing it from a solo setup',
    context: 'Roots',
    source: 'resume.roots',
  },
  'roots-slack-bot': {
    value: '50%+',
    label: 'Increase in Slack bot usage',
    context: 'Roots',
    source: 'resume.roots',
  },
  'roots-initial-load': {
    value: '30%',
    label: 'Improvement in initial loading performance',
    context: 'Roots',
    source: 'resume.roots',
  },
  'maison-newsletter': {
    value: '20%',
    label: 'Income increase associated with a newsletter initiative he contributed to',
    context: 'Maison Modern',
    source: 'resume.maison',
  },
  'webfi-sales': {
    value: '30%+',
    label: 'Sales improvement for smaller clients',
    context: 'WEBFI',
    source: 'resume.webfi',
  },
};
