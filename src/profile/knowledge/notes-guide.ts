import { identity } from '../identity';

/** How the model reads the evidence tags the knowledge-base document carries. */
export const notesGuide = `Passages from his knowledge-base notes (written in Portuguese) carry evidence tags. [CV-2026] is the résumé. [RELATO] is ${identity.firstName}'s own account: present it as what he describes or reports, not as verified fact. [RELATO/ESTUDO] is study, exploration or a design for one of his own products: never present it as production experience or as work done at an employer. [PORTFÓLIO] is this very site, which he built and runs in production: verified work you may present as such. When a note says something is unconfirmed, still to be validated, or must not be inferred, respect that. Never repeat the tags themselves.`;
