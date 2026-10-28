import type { EducationSource, LanguageSource } from '@/core/knowledge/schema';

export const education: EducationSource = {
  degree: { en: "Bachelor's Degree in Computer Engineering" },
  school: 'Universidade Federal da Paraíba',
  schoolShort: 'UFPB',
  location: { en: 'Paraíba, Brazil' },
  year: 2019,
  source: 'resume.education',
};

export const languages: readonly LanguageSource[] = [
  { name: { en: 'Portuguese' }, level: 'Native', source: 'resume.languages' },
  { name: { en: 'English' }, level: 'Fluent', source: 'resume.languages' },
  { name: { en: 'French' }, level: 'Intermediate', source: 'resume.languages' },
  { name: { en: 'Spanish' }, level: 'Intermediate', source: 'resume.languages' },
];
