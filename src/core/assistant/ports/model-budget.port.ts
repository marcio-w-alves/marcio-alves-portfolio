import type { ModelUsage } from './language-model.port';

/** Whether a model answer may be spent on this request, and what each one cost. */
export interface ModelBudgetPort {
  /** False when this client has asked or spent too much, or the day's budget is spent. */
  admit(clientId: string): boolean;
  record(usage: ModelUsage, clientId: string): void;
}
