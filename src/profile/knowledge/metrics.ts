import type { MetricSource } from '@/core/knowledge/schema';

export const metrics: Readonly<Record<string, MetricSource>> = {
  'way2b1-bundle': {
    value: '~50%',
    label: { en: 'Smaller bundle size', 'pt-BR': 'Bundle menor' },
    context: 'Way2b1',
    source: 'resume.way2b1',
  },
  'way2b1-load': {
    value: '~100s of ms',
    label: {
      en: 'Loading times, down to a few hundred milliseconds',
      'pt-BR': 'Tempos de carregamento, reduzidos a algumas centenas de milissegundos',
    },
    context: 'Way2b1',
    source: 'resume.way2b1',
  },
  'deel-critical-load': {
    value: '50%',
    label: {
      en: 'Reduction in loading time on critical pages',
      'pt-BR': 'Redução no tempo de carregamento das páginas críticas',
    },
    context: 'Deel',
    source: 'resume.deel',
  },
  'deel-web-vitals': {
    value: '30%+',
    label: { en: 'Improvement in Web Vitals', 'pt-BR': 'Melhoria nos Web Vitals' },
    context: 'Deel',
    source: 'resume.deel',
  },
  'deel-people-list': {
    value: '6s → 3s',
    label: {
      en: 'People List load time on a cold run',
      'pt-BR': 'Tempo de carregamento da People List sem cache',
    },
    context: 'Deel',
    source: 'resume.deel',
  },
  'roots-team': {
    value: '1 → 4',
    label: {
      en: 'Frontend team grown from a solo setup',
      'pt-BR': 'Time de frontend ampliado a partir de um único desenvolvedor',
    },
    context: 'Roots',
    source: 'resume.roots',
  },
  'maison-newsletter': {
    value: '20%',
    label: {
      en: 'Income increase from the newsletter project he contributed to',
      'pt-BR': 'Aumento de receita do projeto de newsletter em que ele trabalhou',
    },
    context: 'Maison Moderne',
    source: 'resume.maison',
  },
  'webfi-sales': {
    value: '30%+',
    label: {
      en: 'Sales growth for smaller industry clients',
      'pt-BR': 'Crescimento de vendas para clientes industriais menores',
    },
    context: 'WEBFI',
    source: 'resume.webfi',
  },
};
