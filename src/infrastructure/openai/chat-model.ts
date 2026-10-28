/**
 * The only chat model the project calls, for the assistant and for the judge
 * in `pnpm eval:assistant` alike. Fixed in code, not read from the
 * environment: a judge left on a larger model drained the API credits in a
 * day of evaluation runs (POR-74), and no setting should be able to repeat it.
 */
export const CHAT_MODEL = 'gpt-4o-mini';
