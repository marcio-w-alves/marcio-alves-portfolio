import { describe, expect, it } from 'vitest';
import type { LanguageModelPort, ModelRequest } from '@/core/assistant/ports/language-model.port';
import { CircuitOpenError, createCircuitBreaker, withCircuitBreaker } from './circuit-breaker';

const REQUEST: ModelRequest = { messages: [], tools: [], toolChoice: 'auto', maxOutputTokens: 1 };

function model(behaviour: () => 'ok' | Error) {
  let calls = 0;
  const port: LanguageModelPort = {
    async *stream() {
      calls += 1;
      const outcome = behaviour();
      if (outcome instanceof Error) throw outcome;
      yield { type: 'text-delta', delta: 'a' };
      yield { type: 'text-delta', delta: 'b' };
      yield { type: 'finish', usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
  return { port, calls: () => calls };
}

async function drain(port: LanguageModelPort): Promise<void> {
  await Array.fromAsync(port.stream(REQUEST));
}

function setup(behaviour: () => 'ok' | Error) {
  let clock = 0;
  const inner = model(behaviour);
  const transitions: string[] = [];
  const breaker = createCircuitBreaker({
    failureThreshold: 3,
    cooldownMs: 30_000,
    now: () => clock,
    onTransition: (to) => transitions.push(to),
  });
  return {
    guarded: withCircuitBreaker(inner.port, breaker),
    state: () => breaker.state(),
    transitions,
    calls: inner.calls,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('circuit breaker', () => {
  it('opens after consecutive failures and then fails fast without calling the provider', async () => {
    const { guarded, calls } = setup(() => new Error('down'));
    for (let i = 0; i < 3; i += 1) await expect(drain(guarded)).rejects.toThrow('down');
    await expect(drain(guarded)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(calls()).toBe(3);
  });

  it('lets one trial call through after the cooldown, and closes when it succeeds', async () => {
    let healthy = false;
    const { guarded, calls, advance } = setup(() => (healthy ? 'ok' : new Error('down')));
    for (let i = 0; i < 3; i += 1) await expect(drain(guarded)).rejects.toThrow('down');

    advance(30_000);
    healthy = true;
    await drain(guarded);
    await drain(guarded);
    expect(calls()).toBe(5);
  });

  it('reopens immediately when the trial call fails', async () => {
    const { guarded, calls, advance } = setup(() => new Error('down'));
    for (let i = 0; i < 3; i += 1) await expect(drain(guarded)).rejects.toThrow('down');
    advance(30_000);
    await expect(drain(guarded)).rejects.toThrow('down');
    await expect(drain(guarded)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(calls()).toBe(4);
  });

  it('does not count a visitor cancelling as the provider failing', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const { guarded, calls } = setup(() => abort);
    for (let i = 0; i < 5; i += 1) await expect(drain(guarded)).rejects.toThrow('aborted');
    expect(calls()).toBe(5);
  });

  it('is not left stuck when a consumer stops reading a trial call early', async () => {
    let healthy = false;
    const { guarded, calls, advance } = setup(() => (healthy ? 'ok' : new Error('down')));
    for (let i = 0; i < 3; i += 1) await expect(drain(guarded)).rejects.toThrow('down');
    advance(30_000);
    healthy = true;

    // The trial call must actually start before the consumer walks away:
    // return() before the first next() would never run the call at all.
    const trial = guarded.stream(REQUEST)[Symbol.asyncIterator]();
    await trial.next();
    await trial.return?.();
    await drain(guarded);
    expect(calls()).toBe(5);
  });

  it('reports open while cooling down, half-open once a trial may go through, closed after it succeeds', async () => {
    let healthy = false;
    const { guarded, state, transitions, advance } = setup(() =>
      healthy ? 'ok' : new Error('down'),
    );
    expect(state()).toBe('closed');
    for (let i = 0; i < 2; i += 1) await expect(drain(guarded)).rejects.toThrow('down');
    expect(state()).toBe('closed');
    await expect(drain(guarded)).rejects.toThrow('down');
    expect(state()).toBe('open');

    advance(30_000);
    expect(state()).toBe('half-open');
    healthy = true;
    await drain(guarded);
    expect(state()).toBe('closed');
    expect(transitions).toEqual(['open', 'closed']);
  });

  it('announces reopening when the trial fails, and stays quiet while healthy', async () => {
    let healthy = true;
    const { guarded, transitions, advance } = setup(() => (healthy ? 'ok' : new Error('down')));
    await drain(guarded);
    healthy = false;
    for (let i = 0; i < 3; i += 1) await expect(drain(guarded)).rejects.toThrow('down');
    advance(30_000);
    await expect(drain(guarded)).rejects.toThrow('down');
    expect(transitions).toEqual(['open', 'open']);
  });
});
