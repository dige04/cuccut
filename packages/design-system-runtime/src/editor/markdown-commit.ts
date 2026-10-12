import type * as React from "react";
import type * as Core from "../contracts";
import type * as M from "../contracts/documentation";
import type * as Files from "../contracts/file-browser";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorMarkdownCommit(
  runtime: RuntimeBindings,
): () => void {
  var markdownCommitClock: Core.MarkdownCommitClock;
  var markdownCommitQueues: Set<M.CommitQueueRegistration>;
  function flushMarkdownCommitQueues(): void {
    for (let value of markdownCommitQueues) {
      value.flush();
    }
  }
  function createMarkdownCommitQueue<Value>(
    delay: number,
    maxDelay: number,
    clock: Core.MarkdownCommitClock = markdownCommitClock,
  ): Core.MarkdownCommitQueue<Value> {
    let pendingValue: Value | null = null,
      pendingCommit: ((value: Value) => void) | null = null,
      timer: ReturnType<typeof setTimeout> | undefined,
      startedAt = 0,
      flush = (): void => {
        if (timer !== undefined) {
          clock.clearTimeout(timer);
        }
        timer = undefined;
        let value = pendingValue,
          value2 = pendingCommit;
        pendingValue = null;
        pendingCommit = null;
        startedAt = 0;
        if (value !== null && value2 !== null) {
          value2(value);
        }
      },
      queue = {
        push(input: Value, options: (value: Value) => void): void {
          let value = clock.now();
          if (pendingValue === null) {
            startedAt = value;
          }
          pendingValue = input;
          pendingCommit = options;
          if (timer !== undefined) {
            clock.clearTimeout(timer);
          }
          if (value - startedAt >= maxDelay) {
            flush();
          } else {
            timer = clock.setTimeout(
              flush,
              Math.min(delay, maxDelay - (value - startedAt)),
            );
          }
        },
        flush: flush,
        pending: (): boolean => pendingValue !== null,
        dispose(): void {
          flush();
          markdownCommitQueues.delete(queue);
        },
      };
    markdownCommitQueues.add(queue);
    return queue;
  }
  bindRuntimeValue(
    runtime,
    "markdownCommitClock",
    () => markdownCommitClock,
    (value) => {
      markdownCommitClock = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "markdownCommitQueues",
    () => markdownCommitQueues,
    (value) => {
      markdownCommitQueues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "flushMarkdownCommitQueues",
    () => flushMarkdownCommitQueues,
  );
  bindRuntimeValue(
    runtime,
    "createMarkdownCommitQueue",
    () => createMarkdownCommitQueue,
  );
  return () => {
    markdownCommitClock = {
      now: (): number => Date.now(),
      setTimeout: (input: () => void, options: number) =>
        setTimeout(input, options),
      clearTimeout: (input: ReturnType<typeof setTimeout>) =>
        clearTimeout(input),
    };
    markdownCommitQueues = new Set();
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      window.addEventListener(
        "keydown",
        (input: KeyboardEvent): void => {
          if (
            (input.metaKey || input.ctrlKey) &&
            input.key.toLowerCase() === "s"
          ) {
            flushMarkdownCommitQueues();
          }
        },
        true,
      );
      window.addEventListener(
        "pointerdown",
        (event: PointerEvent): void => {
          if (
            !(
              event.target instanceof Element &&
              event.target.closest('[contenteditable="true"]') !== null
            )
          ) {
            flushMarkdownCommitQueues();
          }
        },
        true,
      );
      document.addEventListener(
        "visibilitychange",
        (): void => {
          if (document.visibilityState === "hidden") {
            flushMarkdownCommitQueues();
          }
        },
        true,
      );
      window.addEventListener("pagehide", flushMarkdownCommitQueues, true);
    }
  };
}
