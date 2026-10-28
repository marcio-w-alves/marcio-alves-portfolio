import type { Locale } from '../i18n/locale';
import type {
  Education,
  Knowledge,
  Language,
  Principle,
  Project,
  Role,
  SkillGroup,
} from './schema';

/**
 * How each language frames a passage of the record, so a passage reads whole
 * in one language and a question in that language finds it. Only the generic
 * words are written here; every fact comes from the record.
 */
export interface PassagePhrases {
  readonly profile: (profile: Knowledge['profile']) => string;
  readonly role: (role: Role) => string;
  readonly skills: (group: SkillGroup) => string;
  readonly certifications: (courses: string) => string;
  readonly education: (education: Education) => string;
  readonly languages: (languages: readonly Language[]) => string;
  readonly liveProduct: (project: Project, owner: string) => string;
  readonly concept: (project: Project, owner: string) => string;
  readonly principle: (principle: Principle) => string;
}

export function list(items: readonly string[]): string {
  return items.join(', ');
}

/** A labelled list, or nothing when the record documents none. */
function listed(label: string, items: readonly string[]): string {
  return items.length > 0 ? ` ${label}: ${list(items)}.` : '';
}

function links(project: Project): string {
  return project.links.map((link) => link.url).join(', ');
}

const LEVELS: Readonly<Record<Locale, Readonly<Record<Language['level'], string>>>> = {
  en: { Native: 'Native', Fluent: 'Fluent', Intermediate: 'Intermediate' },
  'pt-BR': { Native: 'nativo', Fluent: 'fluente', Intermediate: 'intermediário' },
};

function spoken(languages: readonly Language[], locale: Locale): string {
  return list(languages.map(({ name, level }) => `${name} (${LEVELS[locale][level]})`));
}

const english: PassagePhrases = {
  profile: (profile) =>
    `Professional profile of ${profile.name}, ${profile.title}, with ${profile.yearsLabel} of experience since ${String(profile.careerStartYear)}. ${profile.summary} ${profile.context} ${profile.focus} Specializations: ${list(profile.specializations)}. Based in ${profile.location.country}. Availability: ${profile.availability}.`,
  role: (role) =>
    `${role.company} — ${role.role}, ${role.period}${role.current ? ' (current role)' : ''}${role.engagement === 'contract' ? ' (contract)' : ''}. ${role.summary}`,
  skills: (group) => `Skills — ${group.title}: ${list(group.items)}.`,
  certifications: (courses) =>
    `Certifications, which are courses and not professional experience: ${courses}.`,
  education: (education) =>
    `Education: ${education.degree} from ${education.school} (${education.schoolShort}), ${education.location}, completed in ${String(education.year)}.`,
  languages: (languages) => `Languages: ${spoken(languages, 'en')}.`,
  liveProduct: (project, owner) =>
    `${project.name}, one of ${owner}'s own products with a public site (${project.category}), status: ${project.status}. ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Platforms: ${list(project.platforms)}.${listed('Technologies', project.technologies)}${listed('Outcomes', project.outcomes)} Links: ${links(project)}. Only what those links show is documented — no users, revenue or release dates.`,
  concept: (project, owner) =>
    `${project.name}, one of ${owner}'s product concepts (${project.category}): ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Only planned scope is documented — no implementation, users, revenue or release dates.`,
  principle: (principle) => `Engineering principle — ${principle.title}: ${principle.text}`,
};

const portuguese: PassagePhrases = {
  profile: (profile) =>
    `Perfil profissional de ${profile.name}, ${profile.title}, com ${profile.yearsLabel} de experiência desde ${String(profile.careerStartYear)}. ${profile.summary} ${profile.context} ${profile.focus} Especializações: ${list(profile.specializations)}. Localização: ${profile.location.country}. Disponibilidade: ${profile.availability}.`,
  role: (role) =>
    `${role.company} — ${role.role}, ${role.period}${role.current ? ' (cargo atual)' : ''}${role.engagement === 'contract' ? ' (contrato)' : ''}. ${role.summary}`,
  skills: (group) => `Competências — ${group.title}: ${list(group.items)}.`,
  certifications: (courses) =>
    `Certificações, que são cursos e não experiência profissional: ${courses}.`,
  education: (education) =>
    `Formação: ${education.degree} — ${education.school} (${education.schoolShort}), ${education.location}, concluída em ${String(education.year)}.`,
  languages: (languages) => `Idiomas: ${spoken(languages, 'pt-BR')}.`,
  liveProduct: (project, owner) =>
    `${project.name}, um dos produtos próprios de ${owner} com site público (${project.category}), status: ${project.status}. ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Plataformas: ${list(project.platforms)}.${listed('Tecnologias', project.technologies)}${listed('Resultados', project.outcomes)} Links: ${links(project)}. Só o que esses links mostram está documentado — não há usuários, receita nem datas de lançamento.`,
  concept: (project, owner) =>
    `${project.name}, um dos conceitos de produto de ${owner} (${project.category}): ${project.description} ${project.scopeLabel}: ${list(project.scope)}. Só o escopo planejado está documentado — não há implementação, usuários, receita nem datas de lançamento.`,
  principle: (principle) => `Princípio de engenharia — ${principle.title}: ${principle.text}`,
};

export const PASSAGE_PHRASES: Readonly<Record<Locale, PassagePhrases>> = {
  en: english,
  'pt-BR': portuguese,
};
