import type { ModelRequest, ModelUsage } from '../ports/language-model.port';

/**
 * Deliberately high: English runs near four characters a token, Portuguese
 * and JSON nearer three. The budget guards spending, so erring high is the
 * safe side.
 */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 3);
}

/**
 * The most a call can have cost: its input estimated high from the characters
 * sent, and its output at the call's ceiling — a call cut short may already
 * have generated tokens it never delivered, and those are billed too.
 */
function ceilingOf({ messages, tools, maxOutputTokens }: ModelRequest): ModelUsage {
  const sentChars = JSON.stringify(messages).length + JSON.stringify(tools).length;
  return { inputTokens: estimateTokens(sentChars), outputTokens: maxOutputTokens, estimated: true };
}

/**
 * What one model call cost. The provider reports usage only in the stream's
 * final chunk, so a call cut short once the provider had started answering —
 * the visitor leaving, a stall, a provider error — would otherwise cost
 * nothing at all; it is charged its ceiling instead. A call refused before
 * the provider answered is not charged.
 */
export function createUsageMeter(request: ModelRequest, record: (usage: ModelUsage) => void) {
  let answering = false;
  let reported = false;

  return {
    answering(): void {
      answering = true;
    },
    report(usage: ModelUsage): void {
      reported = true;
      record(usage);
    },
    /** Called once the call is over, however it ended. */
    settle(): void {
      if (answering && !reported) record(ceilingOf(request));
    },
  };
}
