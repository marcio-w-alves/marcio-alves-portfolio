import type { EducationSource, LanguageSource } from '@/core/knowledge/schema';

export const education: EducationSource = {
  degree: {
    en: "Bachelor's Degree in Computer Engineering",
    'pt-BR': 'Bacharelado em Engenharia da Computação',
  },
  school: 'Universidade Federal da Paraíba',
  schoolShort: 'UFPB',
  location: { en: 'Paraíba, Brazil', 'pt-BR': 'Paraíba, Brasil' },
  year: 2019,
  source: 'resume.education',
};

export const languages: readonly LanguageSource[] = [
  { name: { en: 'Portuguese', 'pt-BR': 'Português' }, level: 'Native', source: 'resume.languages' },
  { name: { en: 'English', 'pt-BR': 'Inglês' }, level: 'Fluent', source: 'resume.languages' },
  { name: { en: 'French', 'pt-BR': 'Francês' }, level: 'Intermediate', source: 'resume.languages' },
  {
    name: { en: 'Spanish', 'pt-BR': 'Espanhol' },
    level: 'Intermediate',
    source: 'resume.languages',
  },
];
