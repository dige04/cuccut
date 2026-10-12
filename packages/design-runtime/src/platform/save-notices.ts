/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformSaveNotices(
  runtime: RuntimeBindings,
): () => void {
  var STUCK_SAVE_REASON_MESSAGES: Dynamic;
  var HOT_EDIT_RESTART_CATEGORIES: Dynamic;
  async function applyCrashStashEdits(
    stash?: Dynamic,
    readCurrentText?: Dynamic,
  ): Promise<Dynamic> {
    let entry: Dynamic = await stash.read();
    if (entry === undefined) return;
    let edits: Dynamic = entry.edits.filter((input?: Dynamic): Dynamic => {
      let value: Dynamic = readCurrentText(input.path);
      return value === undefined || value !== input.text;
    });
    if (edits.length === 0) {
      await stash.clearOffered();
      return;
    }
    return {
      ...entry,
      edits: edits,
    };
  }
  function describeStuckSave(
    saveState?: Dynamic,
    now: Dynamic = Date.now(),
  ): Dynamic {
    let stashExplanation: Dynamic = saveState.stashed
        ? "Your edit is kept in this browser for up to " +
          runtime.CRASH_STASH_RETENTION_LABEL +
          ". If this tab closes, open this page again in this browser to get it back."
        : "Your edit is kept only while this tab stays open.",
      value: Dynamic =
        "the file that lists what is on this page (" +
        (saveState.file ?? "its index") +
        ")";
    if (saveState.code === "index_newer_build")
      return (
        "Not saved: a newer version of this editor has saved " +
        value +
        ", and this tab cannot read it. " +
        (saveState.stashed
          ? "Your edit is kept in this browser for up to " +
            runtime.CRASH_STASH_RETENTION_LABEL +
            ": reload the page to get the newer editor, and it is offered back to you."
          : "Your edit is kept only while this tab stays open: copy what you need, then reload the page to get the newer editor.")
      );
    if (saveState.code === "index_damaged")
      return (
        "Not saved: " +
        value +
        // CucCut: user-facing copy calls the agent "the agent", not Claude.
        " cannot be read because it is not in the form this editor writes, so nothing can be saved from here. It is looked at again whenever you make a change. If it still cannot be read, ask whoever manages this project, or the agent in the chat, to restore that file. " +
        stashExplanation
      );
    if (saveState.code === "conflict")
      return (
        "Not saved yet: a newer version of this page was saved first. " +
        stashExplanation +
        (saveState.nextRetryAt !== undefined
          ? " Still trying; you can retry now."
          : " You can retry now.")
      );
    if (saveState.code === "upstream_error")
      return (
        "Not saved yet: the server could not be reached. " +
        stashExplanation +
        " Still trying; you can retry now."
      );
    if (saveState.code === "rate_limited") {
      let value2: Dynamic =
        saveState.nextRetryAt === undefined
          ? 0
          : Math.ceil((saveState.nextRetryAt - now) / 1e3);
      return (
        "Not saved yet: too many saves in a short time. " +
        stashExplanation +
        (value2 > 0
          ? " Trying again in about " +
            String(value2) +
            (value2 === 1 ? " second." : " seconds.")
          : " Still trying.")
      );
    }
    return (
      "Not saved: " +
      (STUCK_SAVE_REASON_MESSAGES[saveState.code] ??
        "this change could not be saved as it is. Undo your last change, then try again") +
      ". " +
      stashExplanation
    );
  }
  function describeUnsendableEdits(
    paths?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let basename2: Dynamic = (input?: Dynamic): Dynamic =>
        input.slice(input.lastIndexOf("/") + 1),
      first: Dynamic = paths[0],
      single: Dynamic = paths.length === 1,
      stashExplanation: Dynamic =
        options.stashed === true
          ? "kept in this browser for up to " +
            runtime.CRASH_STASH_RETENTION_LABEL
          : "kept only while this tab stays open",
      value: Dynamic =
        " Until then " +
        (single ? "it is" : "they are") +
        " not saved, and " +
        stashExplanation +
        ".";
    return options.restSaved === false
      ? (single
          ? 'Also, "' + basename2(first.path) + '" cannot be saved as it is: '
          : "Also, " +
            String(paths.length) +
            ' files cannot be saved as they are. The first, "' +
            basename2(first.path) +
            '": ') +
          first.why +
          "." +
          value
      : (single
          ? 'Everything else is saved, but "' +
            basename2(first.path) +
            '" is not: '
          : "Everything else is saved, but " +
            String(paths.length) +
            ' files are not. The first, "' +
            basename2(first.path) +
            '": ') +
          first.why +
          "." +
          value;
  }
  bindRuntimeValue(runtime, "applyCrashStashEdits", () => applyCrashStashEdits);
  bindRuntimeValue(runtime, "describeStuckSave", () => describeStuckSave);
  bindRuntimeValue(
    runtime,
    "describeUnsendableEdits",
    () => describeUnsendableEdits,
  );
  bindRuntimeValue(
    runtime,
    "STUCK_SAVE_REASON_MESSAGES",
    () => STUCK_SAVE_REASON_MESSAGES,
    (value) => {
      STUCK_SAVE_REASON_MESSAGES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_EDIT_RESTART_CATEGORIES",
    () => HOT_EDIT_RESTART_CATEGORIES,
    (value) => {
      HOT_EDIT_RESTART_CATEGORIES = value;
    },
  );
  return () => {
    STUCK_SAVE_REASON_MESSAGES = {
      not_writer:
        "you no longer have edit access here. Ask an owner for access, then reload; your edit can be saved once you have it",
      not_declared: "saving is not available on this page",
      capability_disabled:
        "saving is not available on this page right now. Reload to try again",
      too_large:
        "this change is too large to save. Make it smaller and try again",
      read_only_path:
        "this file belongs to the editor itself and cannot be changed",
    };
    HOT_EDIT_RESTART_CATEGORIES = {
      "fetch-exhausted": "network",
      "apply-failed": "internal",
      required: null,
      code: null,
      "code-after-adopt": null,
      "deferred-update": null,
    };
  };
}
