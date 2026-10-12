import type * as FilesCore from "../contracts/files-core";
import type * as Docs from "../contracts/design-system-document";
import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesReopen(runtime: RuntimeBindings): () => void {
  var MIGRATION_DONE_REOPEN_MESSAGE: string;
  var MIGRATION_ENDED_REOPEN_MESSAGE: string;
  var MIGRATION_STARTING_REOPEN_MESSAGE: string;
  var EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE: string;
  var DESIGN_SYSTEM_REOPENED_MESSAGE: string;
  var BOOT_LIVE_ANNOUNCEMENT_MESSAGES: Map<string, string>;
  var activeDesignSystemDocument: Boot.ActiveDocument | undefined;
  var legacyDesignSystemDocument: Boot.ActiveDocument | undefined;
  var legacyDesignSystemIsBusy: () => boolean;
  var activeDesignSystemHasUnsentEdits: () => boolean;
  var lastDesignSystemTypingAt: number;
  var designSystemTypingListenerInstalled: boolean;
  var safeReopenSessionStorage: () => globalThis.Storage | undefined;
  var designSystemRestartFunction: () =>
    | ((options: { note: string }) => void)
    | undefined;
  var DEFAULT_RELOAD_MESSAGE: string;
  var announceReloadRequired: (input?: string) => void;
  var DESIGN_SYSTEM_REOPEN_WATCHDOG_MS: number;
  var designSystemReopenPending: boolean;
  var singleFileMigrationRunning: boolean;
  function installDesignSystemTypingListener(): void {
    if (designSystemTypingListenerInstalled || typeof window === "undefined") {
      return;
    }
    designSystemTypingListenerInstalled = true;
    (window as Host.ProtocolGlobal).addEventListener(
      "keydown",
      (event): void => {
        let target = event.target as
          | (Element & { isContentEditable?: boolean })
          | null;
        if (
          target !== null &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          lastDesignSystemTypingAt = Date.now();
        }
      },
      true,
    );
  }
  function restartDesignSystemWithFallback(message?: string): void {
    (0, runtime.restartWithReloadFallback)({
      restart: designSystemRestartFunction(),
      note: "design system keeps its content as files",
      ask: () => announceReloadRequired(message),
      watchdogMs: DESIGN_SYSTEM_REOPEN_WATCHDOG_MS,
      setTimeout: (input: () => void, options: number) =>
        setTimeout(input, options),
    });
  }
  function reopenForEditingTransition(transition: "on" | "off"): void {
    if (designSystemReopenPending) {
      return;
    }
    let restart = designSystemRestartFunction();
    if (restart === undefined) {
      if (transition === "on") {
        designSystemReopenPending = true;
        announceReloadRequired(runtime.REOPEN_FAILED_MESSAGE);
      }
      return;
    }
    designSystemReopenPending = true;
    installDesignSystemTypingListener();
    let fallback = (): void => {
      designSystemReopenPending = false;
      if (transition === "on") {
        announceReloadRequired(runtime.REOPEN_FAILED_MESSAGE);
      }
    };
    (0, runtime.announceAndWaitToReopen)({
      say: (input: string) => (0, runtime.announceLiveMessage)(input),
      message: runtime.DESIGN_SYSTEM_CHANGED_MESSAGE,
      isTyping: (): boolean => Date.now() - lastDesignSystemTypingAt < 2000,
      hasUnsentEdits: activeDesignSystemHasUnsentEdits,
      reopen: () =>
        (0, runtime.restartWithReloadFallback)({
          restart: restart,
          note:
            "design system: the editing-off entry was " +
            (transition === "on" ? "removed" : "added"),
          ask: fallback,
          watchdogMs: DESIGN_SYSTEM_REOPEN_WATCHDOG_MS,
          setTimeout: (input: () => void, options: number) =>
            setTimeout(input, options),
        }),
      timers: {
        setTimeout: (input: () => void, options: number) =>
          setTimeout(input, options),
        clearTimeout: (input: ReturnType<typeof setTimeout> | undefined) =>
          clearTimeout(input),
        now: (): number => Date.now(),
      },
      note: {
        store: safeReopenSessionStorage(),
        why: "editing_" + transition,
        focus: location.hash.replace(/^#/, ""),
      },
    });
  }
  function reopenAfterFilesMigration(
    why: string,
    restart: boolean = true,
    message?: string,
    fallbackMessage?: string,
  ): void {
    if (designSystemReopenPending) {
      return;
    }
    designSystemReopenPending = true;
    let plainReload = !restart || why === "found_on_files";
    if (!plainReload && designSystemRestartFunction() === undefined) {
      let index = 0;
      try {
        let value = (
          JSON.parse(
            sessionStorage.getItem("ds-moved-reloads") ?? "[]",
          ) as unknown[]
        ).filter((input): boolean => Date.now() - (input as number) < 60000);
        index = value.length;
        sessionStorage.setItem(
          "ds-moved-reloads",
          JSON.stringify([...value, Date.now()]),
        );
      } catch {
        index = 2;
      }
      if (index >= 2) {
        return announceReloadRequired();
      }
      location.reload();
      return;
    }
    installDesignSystemTypingListener();
    try {
      activeDesignSystemDocument?.flushNow?.();
      activeDesignSystemDocument?.save?.();
    } catch {}
    let saveDeadline = Date.now() + 30000,
      reopen = (): void => {
        if (activeDesignSystemHasUnsentEdits() && Date.now() < saveDeadline) {
          setTimeout(reopen, 500);
          return;
        }
        if (plainReload) {
          location.reload();
        } else {
          restartDesignSystemWithFallback(fallbackMessage);
        }
      };
    (0, runtime.announceAndWaitToReopen)({
      say: (input: string) => (0, runtime.announceLiveMessage)(input),
      message:
        message ??
        (restart
          ? MIGRATION_DONE_REOPEN_MESSAGE
          : MIGRATION_ENDED_REOPEN_MESSAGE),
      isTyping: (): boolean => Date.now() - lastDesignSystemTypingAt < 2000,
      hasUnsentEdits: activeDesignSystemHasUnsentEdits,
      reopen: reopen,
      timers: {
        setTimeout: (input: () => void, options: number) =>
          setTimeout(input, options),
        clearTimeout: (input: ReturnType<typeof setTimeout> | undefined) =>
          clearTimeout(input),
        now: (): number => Date.now(),
      },
      note: {
        store: safeReopenSessionStorage(),
        why: why,
        focus: location.hash.replace(/^#/, ""),
      },
    });
  }
  function announceDesignSystemReopened(): void {
    (0, runtime.announceReopenedArtifact)({
      store: safeReopenSessionStorage(),
      now: Date.now(),
      say: (input: string) => (0, runtime.announceLiveMessage)(input),
      message: (): string =>
        activeDesignSystemDocument !== undefined &&
        !activeDesignSystemDocument.readOnly()
          ? EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE
          : DESIGN_SYSTEM_REOPENED_MESSAGE,
      focus: (input: string | undefined) =>
        (0, runtime.restoreReopenedFocus)(window, input),
    });
  }
  function waitForBootLiveAnnouncer(message?: string): void {
    let passes = 0,
      timer = setInterval((): void => {
        passes += 1;
        if (
          document.querySelector('[data-kit="live-announcer"]') === null &&
          passes < 80
        ) {
          return;
        }
        clearInterval(timer);
        announceDesignSystemReopened();
        if (
          message !== undefined &&
          runtime.BOOT_LIVE_NOTICE_MESSAGES.has(message)
        ) {
          (0, runtime.announceLiveMessage)(
            BOOT_LIVE_ANNOUNCEMENT_MESSAGES.get(message) ?? message,
          );
        }
      }, 250);
  }
  bindRuntimeValue(
    runtime,
    "MIGRATION_DONE_REOPEN_MESSAGE",
    () => MIGRATION_DONE_REOPEN_MESSAGE,
    (value) => {
      MIGRATION_DONE_REOPEN_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_ENDED_REOPEN_MESSAGE",
    () => MIGRATION_ENDED_REOPEN_MESSAGE,
    (value) => {
      MIGRATION_ENDED_REOPEN_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MIGRATION_STARTING_REOPEN_MESSAGE",
    () => MIGRATION_STARTING_REOPEN_MESSAGE,
    (value) => {
      MIGRATION_STARTING_REOPEN_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE",
    () => EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE,
    (value) => {
      EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_REOPENED_MESSAGE",
    () => DESIGN_SYSTEM_REOPENED_MESSAGE,
    (value) => {
      DESIGN_SYSTEM_REOPENED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "BOOT_LIVE_ANNOUNCEMENT_MESSAGES",
    () => BOOT_LIVE_ANNOUNCEMENT_MESSAGES,
    (value) => {
      BOOT_LIVE_ANNOUNCEMENT_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeDesignSystemDocument",
    () => activeDesignSystemDocument,
    (value) => {
      activeDesignSystemDocument = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "legacyDesignSystemDocument",
    () => legacyDesignSystemDocument,
    (value) => {
      legacyDesignSystemDocument = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "legacyDesignSystemIsBusy",
    () => legacyDesignSystemIsBusy,
    (value) => {
      legacyDesignSystemIsBusy = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "activeDesignSystemHasUnsentEdits",
    () => activeDesignSystemHasUnsentEdits,
    (value) => {
      activeDesignSystemHasUnsentEdits = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "lastDesignSystemTypingAt",
    () => lastDesignSystemTypingAt,
    (value) => {
      lastDesignSystemTypingAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemTypingListenerInstalled",
    () => designSystemTypingListenerInstalled,
    (value) => {
      designSystemTypingListenerInstalled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installDesignSystemTypingListener",
    () => installDesignSystemTypingListener,
  );
  bindRuntimeValue(
    runtime,
    "safeReopenSessionStorage",
    () => safeReopenSessionStorage,
    (value) => {
      safeReopenSessionStorage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "designSystemRestartFunction",
    () => designSystemRestartFunction,
    (value) => {
      designSystemRestartFunction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_RELOAD_MESSAGE",
    () => DEFAULT_RELOAD_MESSAGE,
    (value) => {
      DEFAULT_RELOAD_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "announceReloadRequired",
    () => announceReloadRequired,
    (value) => {
      announceReloadRequired = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DESIGN_SYSTEM_REOPEN_WATCHDOG_MS",
    () => DESIGN_SYSTEM_REOPEN_WATCHDOG_MS,
    (value) => {
      DESIGN_SYSTEM_REOPEN_WATCHDOG_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "restartDesignSystemWithFallback",
    () => restartDesignSystemWithFallback,
  );
  bindRuntimeValue(
    runtime,
    "designSystemReopenPending",
    () => designSystemReopenPending,
    (value) => {
      designSystemReopenPending = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reopenForEditingTransition",
    () => reopenForEditingTransition,
  );
  bindRuntimeValue(
    runtime,
    "reopenAfterFilesMigration",
    () => reopenAfterFilesMigration,
  );
  bindRuntimeValue(
    runtime,
    "announceDesignSystemReopened",
    () => announceDesignSystemReopened,
  );
  bindRuntimeValue(
    runtime,
    "waitForBootLiveAnnouncer",
    () => waitForBootLiveAnnouncer,
  );
  bindRuntimeValue(
    runtime,
    "singleFileMigrationRunning",
    () => singleFileMigrationRunning,
    (value) => {
      singleFileMigrationRunning = value;
    },
  );
  return () => {
    MIGRATION_DONE_REOPEN_MESSAGE =
      "This design system has moved to a newer way of saving. The page reopens in a moment.";
    MIGRATION_ENDED_REOPEN_MESSAGE =
      "The move of this design system has ended. The page reopens in a moment.";
    MIGRATION_STARTING_REOPEN_MESSAGE =
      "This design system is about to be moved to a newer way of saving. Your changes are saved. The page reopens in a moment.";
    EDITABLE_DESIGN_SYSTEM_REOPENED_MESSAGE =
      "The design system has reopened. Editing is back.";
    DESIGN_SYSTEM_REOPENED_MESSAGE = "The design system has reopened.";
    BOOT_LIVE_ANNOUNCEMENT_MESSAGES = new Map([
      [runtime.MOVED_RELOAD_MESSAGE, runtime.MOVED_RELOAD_MESSAGE],
      [
        runtime.MIGRATION_RUNNING_MESSAGE,
        "This design system is being moved. Editing is off until the page reopens.",
      ],
      [
        runtime.PARTIAL_DESIGN_SYSTEM_MESSAGE,
        "Part of this design system could not be found. Editing is off, and what is shown may be incomplete.",
      ],
      [
        runtime.OLDER_COPY_READONLY_MESSAGE,
        "An older copy of this design system was saved over the current one. Editing is off here.",
      ],
    ]);
    legacyDesignSystemIsBusy = (): boolean => false;
    (0, runtime.setAutosaveInstaller)(
      (input: Boot.ActiveDocument, options: () => boolean): void => {
        legacyDesignSystemDocument = input;
        legacyDesignSystemIsBusy = options;
        activeDesignSystemDocument ??= input;
      },
    );
    activeDesignSystemHasUnsentEdits = () => {
      let value = activeDesignSystemDocument?.saveState().status;
      return value === "dirty" || value === "saving";
    };
    lastDesignSystemTypingAt = 0;
    designSystemTypingListenerInstalled = false;
    safeReopenSessionStorage = () => {
      try {
        return sessionStorage;
      } catch {
        return;
      }
    };
    designSystemRestartFunction = () => {
      if (!(0, runtime.canRestartArtifact)()) {
        return;
      }
      // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
      let value = (
        globalThis as typeof globalThis &
          Pick<Host.ProtocolGlobal, "designSystemHost">
      ).designSystemHost?.hot;
      return value?.restart?.bind(value);
    };
    DEFAULT_RELOAD_MESSAGE = runtime.MOVED_RELOAD_MESSAGE;
    announceReloadRequired = (input = DEFAULT_RELOAD_MESSAGE): void => {
      (0, runtime.showEditorPromiseNotification)(input, null);
      (0, runtime.announceLiveMessage)(input);
    };
    DESIGN_SYSTEM_REOPEN_WATCHDOG_MS = 6000;
    designSystemReopenPending = false;
    singleFileMigrationRunning = false;
  };
}
