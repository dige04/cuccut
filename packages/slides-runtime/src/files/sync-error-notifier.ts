/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Handle returned by the platform timer (a number in browsers, an object in Node). */
export type SyncTimerHandle = ReturnType<typeof setTimeout>;

/** The timer pair the notifier schedules with; tests inject fakes. */
export interface SyncNotifierTimers {
  setTimeout(callback: () => void, delay: number): SyncTimerHandle;
  clearTimeout(handle: SyncTimerHandle): void;
}

export interface SyncErrorNotifierOptions {
  /** Shows the "changes are not being saved" notice. */
  show(): void;
  /** Hides the notice again. */
  hide(): void;
  timers?: SyncNotifierTimers;
}

/** Save-queue health signals fed into the notifier. */
export type SyncErrorSignal =
  | "save-trouble"
  | "save-stuck"
  | "save-recovered"
  | (string & {});

declare module "../bindings" {
  interface RuntimeBindings {
    createDelayedSyncErrorNotifier: (
      options: SyncErrorNotifierOptions,
    ) => (signal: SyncErrorSignal) => void;
  }
}

export function installFilesSyncErrorNotifier(
  runtime: RuntimeBindings,
): () => void {
  function createDelayedSyncErrorNotifier(
    options: SyncErrorNotifierOptions,
  ): (signal: SyncErrorSignal) => void {
    let timers: SyncNotifierTimers = options.timers ?? {
        setTimeout: (input, options2) => setTimeout(input, options2),
        clearTimeout: (input) => clearTimeout(input),
      },
      timer: SyncTimerHandle | undefined,
      cancel = (): void => {
        if (timer !== undefined) {
          timers.clearTimeout(timer);
        }
        timer = undefined;
      },
      show = (input: number): void => {
        cancel();
        timer = timers.setTimeout(() => {
          timer = undefined;
          options.show();
        }, input);
      };
    return (input) => {
      if (input === "save-trouble") {
        if (timer === undefined) {
          show(3000);
        }
      } else if (input === "save-stuck") {
        show(0);
      } else if (input === "save-recovered") {
        cancel();
        options.hide();
      }
    };
  }
  bindRuntimeValue(
    runtime,
    "createDelayedSyncErrorNotifier",
    () => createDelayedSyncErrorNotifier,
  );
  return () => {};
}
