/*
 * Some mechanisms are ported from paseo (Apache-2.0, Copyright (c) 2025-present Mohamed Boudra), modified:
 * - createAsyncMessageInput in packages/server/src/server/agent/providers/claude/agent.ts (streaming input queue)
 * - queryFactory injection in packages/server/src/server/agent/providers/claude/query.ts
 */
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';
import type { ModelInfo, Options, PermissionMode, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * The part of `Query` that the driver uses. The SDK's `query()` return value structurally satisfies it; the fake Query injected by tests
 * (`testing/fake-claude.ts`) implements only these, so it does not have to keep up with the SDK's full `Query` type.
 */
export interface ClaudeQuery extends AsyncIterable<SDKMessage> {
  interrupt(): Promise<unknown>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  supportedModels(): Promise<ModelInfo[]>;
  close(): void;
}

export interface ClaudeQueryParams {
  prompt: AsyncIterable<SDKUserMessage>;
  options: Options;
}

/** Starts a Query. Uses the SDK's `query()` by default; tests inject a fake one, which starts no process and does not log in. */
export type ClaudeQueryFactory = (params: ClaudeQueryParams) => ClaudeQuery;

export const sdkQueryFactory: ClaudeQueryFactory = (params) => sdkQuery(params);

/**
 * Streaming input of a long-lived Query: a queue to which items can be pushed at any time.
 *
 * The whole session has only this one input stream. Appended messages (steer) are also pushed here, rather than calling `Query.streamInput()` separately:
 * the SDK's streamInput closes the CLI's stdin once the passed iterable ends, and the session would never receive messages again.
 */
export interface MessageInput<T> {
  push(item: T): void;
  /** End input: the CLI exits once it reads the end of stdin. */
  end(): void;
  readonly iterable: AsyncIterable<T>;
}

export function createMessageInput<T>(): MessageInput<T> {
  const queue: T[] = [];
  const waiting: Array<(result: IteratorResult<T, undefined>) => void> = [];
  let closed = false;
  return {
    push(item) {
      if (closed) return;
      const resolve = waiting.shift();
      if (resolve) resolve({ value: item, done: false });
      else queue.push(item);
    },
    end() {
      closed = true;
      for (const resolve of waiting.splice(0)) resolve({ value: undefined, done: true });
    },
    iterable: {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (queue.length > 0) return Promise.resolve({ value: queue.shift()!, done: false });
          if (closed) return Promise.resolve({ value: undefined, done: true });
          return new Promise<IteratorResult<T, undefined>>((resolve) => waiting.push(resolve));
        },
      }),
    },
  };
}
