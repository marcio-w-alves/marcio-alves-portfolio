import type { KnowledgeSource } from '@/core/knowledge/schema';
import { education, languages } from './education';
import { experience } from './experience';
import { metrics } from './metrics';
import notes from './notes.json';
import { practice } from './practice';
import { assistant, contact, principles, profile, welcome } from './profile';
import { projects } from './projects';
import { certifications, skills } from './skills';
import { sourceLabels } from './sources';

/** The single source of truth for every fact the assistant and the pages present. */
export const knowledge: KnowledgeSource = {
  profile,
  welcome,
  assistant,
  contact,
  principles,
  metrics,
  experience,
  skills,
  certifications,
  projects,
  education,
  languages,
  practice,
  sourceLabels,
  notes: { source: 'notes', passages: notes },
};
