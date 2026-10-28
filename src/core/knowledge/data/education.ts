import type { Education, Language } from '../types';

export const education: Education = {
  degree: "Bachelor's Degree in Computer Engineering",
  school: 'Universidade Federal da Paraíba',
  schoolShort: 'UFPB',
  location: 'Paraíba, Brazil',
  year: 2019,
  source: 'resume.education',
};

export const languages: readonly Language[] = [
  { name: 'Portuguese', level: 'Native' },
  { name: 'English', level: 'Fluent' },
  { name: 'French', level: 'Intermediate' },
  { name: 'Spanish', level: 'Intermediate' },
];
