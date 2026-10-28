import type { Knowledge } from '@/core/knowledge/schema';

/**
 * Technologies visitors ask about. Whether Marcio has used one is decided by
 * searching the record, not by a list of what is "undocumented" — such a list
 * had already contradicted the resume once, about Kotlin and testing.
 *
 * React, TypeScript, Next.js, Node.js and design systems are absent on
 * purpose: each has its own, richer answer.
 */

export interface Technology {
  readonly name: string;
  /** Matched against the normalized question. */
  readonly detect: RegExp;
  /** Matched against the knowledge base's own wording. */
  readonly evidence: RegExp;
}

function technology(name: string, detect: RegExp, evidence = detect): Technology {
  return { name, detect, evidence: new RegExp(evidence.source, 'i') };
}

/** The ones the fast path answers by searching the record. */
export const ROUTED_TECHNOLOGIES: readonly Technology[] = [
  technology('Vue', /\bvue(\.?js)?\b/),
  technology('Angular', /\bangular(js)?\b/),
  technology('Svelte', /\bsvelte\b/),
  technology('GraphQL', /\bgraphql\b/),
  technology('Kubernetes', /\b(kubernetes|k8s)\b/),
  technology('Docker', /\bdocker\b/),
  technology('Python', /\bpython\b/),
  technology('Java', /\bjava\b(?!script)/),
  technology('Ruby', /\bruby\b/),
  technology('PHP', /\bphp\b/),
  technology('Flutter', /\bflutter\b/),
  technology('React Native', /\breact native\b/),
  technology('Kotlin', /\bkotlin\b/),
  technology('Android', /\bandroid\b/),
  technology('MongoDB', /\bmongo(db)?\b/),
  technology('Firebase', /\bfirebase\b/),
  technology('Terraform', /\bterraform\b/),
  technology('Storybook', /\bstorybook\b/),
  technology('Jest', /\bjest\b/),
  technology('Cypress', /\bcypress\b/),
  technology('Playwright', /\bplaywright\b/),
  technology('Redux', /\bredux\b/),
  technology('Webpack', /\bwebpack\b/),
  technology('Vite', /\bvite\b/),
  technology('Tailwind CSS', /\btailwind\b/),
  technology('React Hooks', /\b(react )?hooks?\b/, /\breact hooks\b/),
  technology('progressive web apps', /\b(pwas?|progressive web apps?)\b/, /\bprogressive web app/),
];

// The fast path gives these practices answers of their own; the model still
// weighs them against the record like any other technology.
const PRACTICES: readonly Technology[] = [
  technology('accessibility', /\b(accessib\w*|a11y|wcag)\b/, /\baccessib\w*/),
  technology('automated testing', /\b(testing|tests?|tdd|test[- ]driven)\b/, /\btesting\b/),
];

export const TECHNOLOGIES: readonly Technology[] = [...ROUTED_TECHNOLOGIES, ...PRACTICES];

export interface WorkEvidence {
  readonly role: string;
  readonly company: string;
  readonly statement: string;
}

export interface TechnologyEvidence {
  readonly technology: Technology;
  readonly work: readonly WorkEvidence[];
  readonly skills: readonly string[];
  /** Coursework, which is not professional experience. */
  readonly coursework: readonly string[];
  /**
   * Paragraphs of his knowledge-base notes that mention it: his own account or
   * his studies, each carrying its evidence tag, never résumé evidence.
   */
  readonly notes: readonly string[];
}

function paragraphsOf(text: string): string[] {
  const body = text.slice(text.indexOf(':\n') + 2);
  return body.split('\n\n');
}

export type EvidenceFinder = (technology: Technology) => TechnologyEvidence;

export function createEvidenceFinder({
  experience,
  skills,
  certifications,
  notes,
}: Knowledge): EvidenceFinder {
  const noteParagraphs = [...new Set(notes.flatMap((note) => paragraphsOf(note.text)))];
  return (technology) => {
    const matches = (value: string) => technology.evidence.test(value);
    return {
      technology,
      work: experience.flatMap((role) =>
        role.highlights
          .filter(matches)
          .map((statement) => ({ role: role.id, company: role.company, statement })),
      ),
      skills: skills.flatMap((group) => group.items.filter(matches)),
      coursework: certifications
        .filter((certification) => matches(certification.name))
        .map((certification) => `${certification.name} (${certification.issuer})`),
      notes: noteParagraphs.filter(matches),
    };
  };
}
