import { z } from 'zod';
import type { AnswerSource } from '../assistant-event';
import type { RichComponent } from '../components';

/**
 * An action the model may take. The model is given these and nothing else:
 * never the knowledge base, never a database, never a URL to fetch. Every
 * fact it uses arrives as the result of one of these calls.
 */

export type DeclineReason = 'not_documented' | 'off_topic' | 'private';

/** What a call does to the answer, beyond handing data back to the model. */
export type ToolEffect =
  | { readonly kind: 'display'; readonly component: RichComponent }
  | { readonly kind: 'decline'; readonly reason: DeclineReason };

export interface ToolResult {
  /** JSON-serializable; this is all the model sees. */
  readonly data: unknown;
  readonly sources: readonly AnswerSource[];
  readonly effect?: ToolEffect;
}

export type ToolOutcome =
  | { readonly ok: true; readonly result: ToolResult }
  | { readonly ok: false; readonly error: string };

/** An action that threw, for whoever operates the site; never shown to the model. */
export interface ToolFailure {
  readonly tool: string;
  readonly error: unknown;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  /** JSON Schema of the arguments, generated from the same Zod schema that validates them. */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** `signal` is the visitor's request: an action that waits on the network stops with it. */
  run(rawArguments: unknown, signal?: AbortSignal): Promise<ToolOutcome>;
}

type Shape = z.core.$ZodLooseShape;
type StrictInput<S extends Shape> = z.output<ReturnType<typeof z.strictObject<S>>>;

interface ToolSpec<S extends Shape> {
  readonly name: string;
  readonly description: string;
  /** The argument shape. It is always wrapped in a strict object — see below. */
  readonly input: S;
  execute(input: StrictInput<S>, signal?: AbortSignal): ToolResult | Promise<ToolResult>;
}

/**
 * Binds a schema to an executor. The model's arguments are untrusted input,
 * so they are validated here, once, and the executor only ever sees values
 * the schema accepted. A rejection goes back to the model as an error it can
 * correct, instead of reaching the code.
 *
 * The object is strict by construction. Zod's default object silently drops
 * unknown keys, which would let the validator accept what the advertised
 * schema (`additionalProperties: false`) forbids.
 */
export function defineTool<S extends Shape>(spec: ToolSpec<S>): Tool {
  const schema = z.strictObject(spec.input);
  const { $schema: _dialect, ...parameters } = z.toJSONSchema(schema);
  return {
    name: spec.name,
    description: spec.description,
    parameters,
    async run(rawArguments, signal) {
      const parsed = schema.safeParse(rawArguments);
      if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
      return { ok: true, result: await spec.execute(parsed.data, signal) };
    },
  };
}
