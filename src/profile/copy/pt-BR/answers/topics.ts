import type { ResponseKit } from '@/core/assistant/response-kit';
import { bullets, details, numbered, text } from '@/core/assistant/response-kit';
import type { TopicCopy } from '@/core/assistant/topics';
import type { TopicId } from '@/core/chat/topic-id';
import type { Language } from '@/core/knowledge/schema';
import { createFacts, joinNames } from './facts';

/** How the Portuguese pages name a language's level. */
export const LEVEL: Readonly<Record<Language['level'], string>> = {
  Native: 'Nativo',
  Fluent: 'Fluente',
  Intermediate: 'Intermediário',
};

/** Language names as Portuguese writes them inside a sentence: in lower case. */
export function spokenLanguages(languages: readonly Language[]): string {
  return joinNames(languages.map((language) => language.name.toLowerCase()));
}

/**
 * The site's pages in Portuguese: each opens with a curated introduction and
 * its part of the record — never a model call — and suggests the questions
 * below.
 */
export function createTopics(kit: ResponseKit): Readonly<Record<TopicId, TopicCopy>> {
  const { knowledge, projects, skills, table, timeline, productDepth } = kit;
  const { profile, experience, languages, education, practice } = knowledge;
  const { first, employer, product } = createFacts(kit);
  const liveProducts = joinNames(
    knowledge.projects.filter((project) => project.live).map((project) => project.name),
  );
  return {
    overview: {
      label: 'Visão geral',
      intro: `Resumindo: ${profile.firstName} é ${profile.title} e tem ${profile.yearsLabel} de React, TypeScript e arquitetura frontend, com resultados mensuráveis em performance e no crescimento de times. O que você gostaria de saber?`,
      description: `${profile.name}, engenheiro frontend sênior: React, TypeScript, Next.js, arquitetura frontend e performance. Pergunte ao assistente de IA sobre o trabalho dele.`,
      questions: [
        {
          question: `Me fale sobre a carreira do ${first}.`,
          tag: 'Carreira',
          short: 'A carreira dele',
        },
        {
          question: 'Em que escopo ele já trabalhou?',
          tag: 'Escopo',
          short: 'Escopo do trabalho',
        },
        {
          question: `O que ele construiu na ${employer('deel')}?`,
          tag: employer('deel'),
          short: `Trabalho na ${employer('deel')}`,
        },
        {
          question: 'Qual é a experiência dele com React e TypeScript?',
          tag: 'React e TypeScript',
          short: 'React e TypeScript',
        },
        {
          question: 'Quais são as maiores conquistas técnicas dele?',
          tag: 'Impacto',
          short: 'Maiores conquistas',
        },
        {
          question: 'Ele já liderou times de engenharia?',
          tag: 'Liderança',
          short: 'Liderança',
        },
        {
          question: 'Em quais projetos ele está trabalhando?',
          tag: 'Projetos',
          short: 'Projetos próprios',
        },
        {
          question: 'Como ele aborda a arquitetura frontend?',
          tag: 'Arquitetura',
          short: 'Arquitetura',
        },
      ],
      page: [],
    },
    experience: {
      label: 'Experiência',
      intro: `A carreira de ${first} soma ${String(experience.length)} cargos desde ${String(profile.careerStartYear)} — do desenvolvimento web freelance a cargos de liderança e de frontend sênior na ${employer('roots')} e na ${employer('deel')} e, hoje, trabalho full stack na ${employer('way2b1')}. Escolha uma empresa, ou pergunte como o escopo dele cresceu com o tempo.`,
      description: `Experiência de ${profile.name}: ${employer('way2b1')}, ${employer('deel')}, ${employer('roots')} e mais — ${profile.yearsLabel} de frontend e full stack desde ${String(profile.careerStartYear)}.`,
      questions: [
        { question: `Me fale sobre a carreira do ${first}.`, tag: 'Carreira' },
        { question: `O que ele construiu na ${employer('deel')}?`, tag: employer('deel') },
        { question: `O que ele fez na ${employer('roots')}?`, tag: employer('roots') },
        {
          question: `No que ele está trabalhando na ${employer('way2b1')}?`,
          tag: employer('way2b1'),
        },
        {
          question: 'Me fale sobre a experiência dele escalando aplicações frontend.',
          tag: 'Escala',
        },
        { question: 'Ele já construiu algo do zero?', tag: 'Do zero' },
        { question: 'Ele tem experiência com aplicações corporativas?', tag: 'Corporativo' },
        { question: 'Ele já trabalhou com sistemas de backend?', tag: 'Full stack' },
      ],
      page: [timeline(), text(`### Como o escopo dele cresceu\n${bullets(practice.careerArc)}`)],
    },
    skills: {
      label: 'Competências técnicas',
      intro: `O stack principal de ${first} é React, TypeScript e Next.js, apoiado por competências de arquitetura, performance e liderança. Pergunte sobre qualquer área e você recebe a evidência por trás dela, não uma nota autoatribuída.`,
      description: `Competências técnicas de ${profile.name}: React, TypeScript, Next.js, arquitetura frontend, performance, acessibilidade, Node.js e liderança técnica.`,
      questions: [
        {
          question: 'Qual é a experiência dele com React e TypeScript?',
          tag: 'React e TypeScript',
        },
        { question: 'Como ele otimizou a performance?', tag: 'Performance' },
        { question: 'Ele já trabalhou com sistemas de backend?', tag: 'Full stack' },
        { question: 'Ele tem experiência com Next.js e SSR?', tag: 'Next.js' },
        { question: 'O que ele sabe sobre design systems?', tag: 'Design systems' },
        { question: 'Como ele aborda a acessibilidade?', tag: 'Acessibilidade' },
        { question: 'Como ele aborda os testes?', tag: 'Testes' },
        { question: 'Como ele usa IA na engenharia?', tag: 'Engenharia com IA' },
      ],
      page: [
        skills(),
        text(
          `### Até onde vai a evidência\n${bullets(practice.skillDepth.map(({ area, items }) => `**${area}** — ${items}`))}`,
        ),
        details(
          'Ferramentas por área',
          bullets(practice.toolset.map(({ area, items }) => `**${area}** — ${items}`)),
        ),
      ],
    },
    projects: {
      label: 'Projetos',
      intro: `Além do trabalho do dia a dia, ${first} constrói os próprios produtos. ${liveProducts} já têm sites públicos, e o ${product('fictiondraft')} ainda é um conceito. Pergunte sobre qualquer um deles — vou deixar claro o que está no ar e o que é plano.`,
      description: `Produtos que ${profile.name} constrói por conta própria — ${joinNames(knowledge.projects.map((project) => project.name))}: o que cada um faz e em que pé está.`,
      questions: [
        { question: `Me conte mais sobre o ${product('evcopilot')}.`, tag: product('evcopilot') },
        { question: `Me conte mais sobre o ${product('formdaily')}.`, tag: product('formdaily') },
        { question: `O que é o ${product('targup')}?`, tag: product('targup') },
        { question: `O que é o ${product('fictiondraft')}?`, tag: product('fictiondraft') },
        {
          question: `Me conte mais sobre o ${product('marciomariani-dev')}.`,
          tag: product('marciomariani-dev'),
        },
        { question: 'Ele já construiu apps mobile?', tag: 'Mobile' },
      ],
      page: [
        projects(),
        text(
          `### A engenharia por trás deles\n${bullets(knowledge.projects.map((project) => `**${project.name}** — ${productDepth(project.id)}`))}`,
        ),
      ],
    },
    philosophy: {
      label: 'Filosofia de engenharia',
      intro: `A engenharia de ${first} é pragmática: código legível que outras pessoas conseguem evoluir, arquitetura do tamanho do estágio real do produto e qualidade que ele consegue verificar. Aqui estão os princípios com que ele trabalha e como ele leva um problema da pergunta à entrega.`,
      description: `Como ${profile.name} desenvolve software: código sustentável, arquitetura do tamanho do produto, qualidade verificável e o processo dele do problema à entrega.`,
      questions: [
        { question: 'Qual é a filosofia de engenharia dele?', tag: 'Princípios' },
        { question: 'Como ele usa IA na engenharia?', tag: 'Engenharia com IA' },
        { question: 'Como ele aborda a arquitetura frontend?', tag: 'Arquitetura' },
        { question: 'Como ele aborda os testes?', tag: 'Testes' },
        { question: 'Como ele trabalha com times de produto?', tag: 'Produto' },
        { question: 'Como ele pensa a qualidade de código?', tag: 'Qualidade' },
      ],
      page: [
        text(
          knowledge.principles
            .map((principle) => `- **${principle.title}** — ${principle.text}`)
            .join('\n'),
        ),
        text(`### Como ele leva um problema até a entrega\n${numbered(practice.designProcess)}`),
      ],
    },
    education: {
      label: 'Formação e idiomas',
      intro: `${first} tem ${education.degree} pela ${education.school} (${String(education.year)}) e trabalha em ${spokenLanguages(languages)}.`,
      description: `Formação e idiomas de ${profile.name}: ${education.schoolShort} (${String(education.year)}), ${spokenLanguages(languages)}, cursos e aprendizado contínuo.`,
      questions: [
        { question: 'Como ele usa IA na engenharia?', tag: 'Engenharia com IA' },
        { question: 'Ele já trabalhou com sistemas de backend?', tag: 'Full stack' },
        { question: 'Posso ver o currículo dele?', tag: 'Currículo' },
      ],
      page: [
        table(
          ['Idioma', 'Nível'],
          knowledge.languages.map((language) => [language.name, LEVEL[language.level]]),
          'Idiomas',
        ),
        details(
          'Cursos e certificações',
          knowledge.certifications
            .map((certification) => `- ${certification.name} (${certification.issuer})`)
            .join('\n'),
        ),
        text(`### Aprendizado contínuo\n${practice.learningStyle}\n\n${bullets(practice.studies)}`),
      ],
    },
  };
}
