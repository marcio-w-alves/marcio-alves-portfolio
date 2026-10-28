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
  { name: { en: 'Portuguese' }, level: 'Native' },
  { name: { en: 'English' }, level: 'Fluent' },
  { name: { en: 'French' }, level: 'Intermediate' },
  { name: { en: 'Spanish' }, level: 'Intermediate' },
];
