/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformMigrationState(
  runtime: RuntimeBindings,
): () => void {
  var PlatformMigrationStateAlias: Dynamic;
  var migrationStateLoaded: Dynamic;
  var PlatformMigrationStateSubscribers: Dynamic;
  var MovedToFilesValue: Dynamic;
  var PlatformMigrationStateHandler: Dynamic;
  var ThisCanvasNowSavesInAMessage: Dynamic;
  var ThisCanvasNowSavesInAMessage_2: Dynamic;
  var ThisCanvasIsOpenAgainYouMessage: Dynamic;
  var ThisCanvasIsOpenAgainMessage: Dynamic;
  var YourLastChangeIsNotSavedMessage: Dynamic;
  var ThatChangeIsSavedThisCanvasMessage: Dynamic;
  var PlatformMigrationStateConstant: Dynamic;
  var PlatformMigrationStateConstant_2: Dynamic;
  var PlatformMigrationStateAlias_2: Dynamic;
  var PlatformMigrationStateNow: Dynamic;
  var PlatformMigrationStateNow_2: Dynamic;
  var PlatformMigrationStateHandler_2: Dynamic;
  var PlatformMigrationStateSubscribers_2: Dynamic;
  var migrationRestartHandlerInstalled: Dynamic;
  function updateMovedToFilesState(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.getMovedToMarker)(input) !== null,
      value2: Dynamic =
        migrationStateLoaded && value && !PlatformMigrationStateAlias;
    PlatformMigrationStateAlias = value;
    if (!!value2)
      for (let value3 of [...PlatformMigrationStateSubscribers] as Dynamic)
        try {
          value3();
        } catch {}
  }
  function markMigrationLoaded(): Dynamic {
    migrationStateLoaded = true;
  }
  function subscribeMovedToFiles(input?: Dynamic): Dynamic {
    PlatformMigrationStateSubscribers.add(input);
    return (): Dynamic => {
      PlatformMigrationStateSubscribers.delete(input);
    };
  }
  function subscribeMigrationRestart(input?: Dynamic): Dynamic {
    PlatformMigrationStateSubscribers_2.add(input);
    return (): Dynamic => PlatformMigrationStateSubscribers_2.delete(input);
  }
  function installMigrationRestartHandler(input: Dynamic = {}): Dynamic {
    if (migrationRestartHandlerInstalled) return;
    migrationRestartHandlerInstalled = true;
    let value: Dynamic =
        input.hot !== undefined
          ? input.hot
          // CucCut: the host is globalThis.designHost (packages/design/src/editor/design-host.ts), not globalThis.claude.
          : (globalThis as Dynamic).designHost?.hot,
      value2: Dynamic = input.show ?? runtime.showEditorToast,
      value3: Dynamic =
        input.say ??
        ((input2?: Dynamic): Dynamic => (0, runtime.announce)(input2)),
      callback: Dynamic = (): Dynamic => {
        (
          input.show ??
          ((input2?: Dynamic): Dynamic => {
            (0, runtime.showEditorActionToast)(input2, null);
          })
        )(ThisCanvasNowSavesInAMessage);
        try {
          value3(ThisCanvasNowSavesInAMessage);
        } catch {}
        (0, runtime.clearMigrationInputBlocker)();
        try {
          input.onStranded?.();
        } catch {}
        for (let value8 of [...PlatformMigrationStateSubscribers_2] as Dynamic)
          try {
            value8();
          } catch {}
      };
    if (
      !(
        typeof value?.restart == "function" &&
        (input.hot !== undefined
          ? input.canReopen?.() !== false
          : (input.canReopen ?? PlatformMigrationStateHandler)())
      )
    )
      return callback();
    let value4: Dynamic = input.timers ?? {
        setTimeout: (input2?: Dynamic, options?: Dynamic): Dynamic =>
          setTimeout(input2, options),
        clearTimeout: (input2?: Dynamic): Dynamic => clearTimeout(input2),
        now: (): Dynamic => Date.now(),
      },
      callback2: Dynamic = (): Dynamic => {
        try {
          value.restart({
            note: "canvas keeps its content as files",
          });
        } catch {
          return callback();
        }
        value4.setTimeout(callback, PlatformMigrationStateConstant_2);
      };
    if (input.quiet === true) return callback2();
    let value5: Dynamic =
        input.say ??
        ((input2?: Dynamic): Dynamic => (0, runtime.announce)(input2)),
      value6: Dynamic = value4,
      value7: Dynamic = input.store ?? PlatformMigrationStateHandler_2(),
      flag: Dynamic = false,
      flag2: Dynamic = false,
      callback3: Dynamic = (): Dynamic => {
        if (!flag2) {
          flag2 = true;
          try {
            input.flush?.();
          } catch {}
        }
        let flag3: Dynamic = true;
        try {
          flag3 = input.drained === undefined || input.drained();
        } catch {}
        if (!flag3) {
          flag ||
            ((flag = true),
            value2(YourLastChangeIsNotSavedMessage),
            value5(YourLastChangeIsNotSavedMessage));
          value6.setTimeout(callback3, PlatformMigrationStateConstant);
          return;
        }
        if (!flag) return callback2();
        flag = false;
        value2(ThatChangeIsSavedThisCanvasMessage);
        (0, runtime.scheduleTypingAwareAnnouncement)({
          say: value5,
          message: ThatChangeIsSavedThisCanvasMessage,
          ...(input.isTyping !== undefined
            ? {
                isTyping: input.isTyping,
              }
            : {}),
          reopen: callback3,
          timers: value6,
          note: {
            store: value7,
            why: MovedToFilesValue,
            ...(input.focus !== undefined
              ? {
                  focus: input.focus,
                }
              : {}),
          },
        });
      };
    value2(ThisCanvasNowSavesInAMessage_2);
    (0, runtime.scheduleTypingAwareAnnouncement)({
      say: value5,
      message: ThisCanvasNowSavesInAMessage_2,
      ...(input.isTyping !== undefined
        ? {
            isTyping: input.isTyping,
          }
        : {}),
      reopen: callback3,
      timers: value6,
      note: {
        store: value7,
        why: MovedToFilesValue,
        ...(input.focus !== undefined
          ? {
              focus: input.focus,
            }
          : {}),
      },
    });
  }
  function announceMigrationReopen(input?: Dynamic): Dynamic {
    return (0, runtime.announceReopenedArtifact)({
      store: input.store ?? PlatformMigrationStateHandler_2(),
      now: input.now ?? Date.now(),
      say:
        input.say ??
        ((input2?: Dynamic): Dynamic => (0, runtime.announce)(input2)),
      message: (): Dynamic =>
        input.canWrite
          ? ThisCanvasIsOpenAgainYouMessage
          : ThisCanvasIsOpenAgainMessage,
      focus: (input2?: Dynamic): Dynamic => input.focus(input2),
    });
  }
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateAlias",
    () => PlatformMigrationStateAlias,
    (value) => {
      PlatformMigrationStateAlias = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "migrationStateLoaded",
    () => migrationStateLoaded,
    (value) => {
      migrationStateLoaded = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateSubscribers",
    () => PlatformMigrationStateSubscribers,
    (value) => {
      PlatformMigrationStateSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "updateMovedToFilesState",
    () => updateMovedToFilesState,
  );
  bindRuntimeValue(runtime, "markMigrationLoaded", () => markMigrationLoaded);
  bindRuntimeValue(
    runtime,
    "subscribeMovedToFiles",
    () => subscribeMovedToFiles,
  );
  bindRuntimeValue(
    runtime,
    "MovedToFilesValue",
    () => MovedToFilesValue,
    (value) => {
      MovedToFilesValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateHandler",
    () => PlatformMigrationStateHandler,
    (value) => {
      PlatformMigrationStateHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisCanvasNowSavesInAMessage",
    () => ThisCanvasNowSavesInAMessage,
    (value) => {
      ThisCanvasNowSavesInAMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisCanvasNowSavesInAMessage_2",
    () => ThisCanvasNowSavesInAMessage_2,
    (value) => {
      ThisCanvasNowSavesInAMessage_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisCanvasIsOpenAgainYouMessage",
    () => ThisCanvasIsOpenAgainYouMessage,
    (value) => {
      ThisCanvasIsOpenAgainYouMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThisCanvasIsOpenAgainMessage",
    () => ThisCanvasIsOpenAgainMessage,
    (value) => {
      ThisCanvasIsOpenAgainMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "YourLastChangeIsNotSavedMessage",
    () => YourLastChangeIsNotSavedMessage,
    (value) => {
      YourLastChangeIsNotSavedMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ThatChangeIsSavedThisCanvasMessage",
    () => ThatChangeIsSavedThisCanvasMessage,
    (value) => {
      ThatChangeIsSavedThisCanvasMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateConstant",
    () => PlatformMigrationStateConstant,
    (value) => {
      PlatformMigrationStateConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateConstant_2",
    () => PlatformMigrationStateConstant_2,
    (value) => {
      PlatformMigrationStateConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateAlias_2",
    () => PlatformMigrationStateAlias_2,
    (value) => {
      PlatformMigrationStateAlias_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateNow",
    () => PlatformMigrationStateNow,
    (value) => {
      PlatformMigrationStateNow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateNow_2",
    () => PlatformMigrationStateNow_2,
    (value) => {
      PlatformMigrationStateNow_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateHandler_2",
    () => PlatformMigrationStateHandler_2,
    (value) => {
      PlatformMigrationStateHandler_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PlatformMigrationStateSubscribers_2",
    () => PlatformMigrationStateSubscribers_2,
    (value) => {
      PlatformMigrationStateSubscribers_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeMigrationRestart",
    () => subscribeMigrationRestart,
  );
  bindRuntimeValue(
    runtime,
    "migrationRestartHandlerInstalled",
    () => migrationRestartHandlerInstalled,
    (value) => {
      migrationRestartHandlerInstalled = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "installMigrationRestartHandler",
    () => installMigrationRestartHandler,
  );
  bindRuntimeValue(
    runtime,
    "announceMigrationReopen",
    () => announceMigrationReopen,
  );
  return () => {
    PlatformMigrationStateAlias = false;
    migrationStateLoaded = false;
    PlatformMigrationStateSubscribers = new Set();
    MovedToFilesValue = "moved_to_files";
    PlatformMigrationStateHandler = (): Dynamic => (0, runtime.canHotRestart)();
    ThisCanvasNowSavesInAMessage =
      "This canvas now saves in a newer way. Reload the page to keep editing it.";
    ThisCanvasNowSavesInAMessage_2 =
      "This canvas now saves in a newer way. It reopens here in a moment.";
    ThisCanvasIsOpenAgainYouMessage =
      "This canvas is open again. You can keep editing.";
    ThisCanvasIsOpenAgainMessage = "This canvas is open again.";
    YourLastChangeIsNotSavedMessage =
      "Your last change is not saved yet, so this canvas stays open. It reopens by itself once that change is saved.";
    ThatChangeIsSavedThisCanvasMessage =
      "That change is saved. This canvas reopens in a moment.";
    PlatformMigrationStateConstant = 2e3;
    PlatformMigrationStateConstant_2 = 2e4;
    PlatformMigrationStateAlias_2 = -1 / 0;
    PlatformMigrationStateNow = (input: Dynamic = Date.now()): Dynamic => {
      PlatformMigrationStateAlias_2 = input;
    };
    PlatformMigrationStateNow_2 = (input: Dynamic = Date.now()): Dynamic =>
      input - PlatformMigrationStateAlias_2 < 1500;
    PlatformMigrationStateHandler_2 = (): Dynamic => {
      try {
        return typeof sessionStorage === "undefined"
          ? undefined
          : sessionStorage;
      } catch {
        return;
      }
    };
    PlatformMigrationStateSubscribers_2 = new Set();
    migrationRestartHandlerInstalled = false;
  };
}
