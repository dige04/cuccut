import type * as Boot from "../contracts/boot";
import type * as Model from "../contracts";
import type * as Storage from "../contracts/model-storage";
import type * as Dom from "../contracts/dom";
import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installFilesSaveMessages(runtime: RuntimeBindings): () => void {
  var STUCK_SAVE_REASON_MESSAGES: Record<string, string>;
  var isTextFileListingRow: (row: Model.FileListingRow) => boolean;
  function describeStuckSave(
    stuck: Boot.StuckSave,
    now: number = Date.now(),
  ): string {
    let retentionMessage: string = stuck.stashed
        ? "Your edit is kept in this browser for up to " +
          runtime.CRASH_STASH_RETENTION_LABEL +
          ". If this tab closes, open this page again in this browser to get it back."
        : "Your edit is kept only while this tab stays open.",
      indexDescription: string =
        "the file that lists what is on this page (" +
        (stuck.file ?? "its index") +
        ")";
    if (stuck.code === "index_newer_build") {
      return (
        "Not saved: a newer version of this editor has saved " +
        indexDescription +
        ", and this tab cannot read it. " +
        (stuck.stashed
          ? "Your edit is kept in this browser for up to " +
            runtime.CRASH_STASH_RETENTION_LABEL +
            ": reload the page to get the newer editor, and it is offered back to you."
          : "Your edit is kept only while this tab stays open: copy what you need, then reload the page to get the newer editor.")
      );
    }
    if (stuck.code === "index_damaged") {
      return (
        "Not saved: " +
        indexDescription +
        // CucCut: user-facing copy calls the agent "the agent", not Claude.
        " cannot be read because it is not in the form this editor writes, so nothing can be saved from here. It is looked at again whenever you make a change. If it still cannot be read, ask whoever manages this project, or the agent in the chat, to restore that file. " +
        retentionMessage
      );
    }
    if (stuck.code === "conflict") {
      return (
        "Not saved yet: a newer version of this page was saved first. " +
        retentionMessage +
        (stuck.nextRetryAt !== undefined
          ? " Still trying; you can retry now."
          : " You can retry now.")
      );
    }
    if (stuck.code === "upstream_error") {
      return (
        "Not saved yet: the server could not be reached. " +
        retentionMessage +
        " Still trying; you can retry now."
      );
    }
    if (stuck.code === "rate_limited") {
      let value: number =
        stuck.nextRetryAt === undefined
          ? 0
          : Math.ceil((stuck.nextRetryAt - now) / 1000);
      return (
        "Not saved yet: too many saves in a short time. " +
        retentionMessage +
        (value > 0
          ? " Trying again in about " +
            String(value) +
            (value === 1 ? " second." : " seconds.")
          : " Still trying.")
      );
    }
    return (
      "Not saved: " +
      (STUCK_SAVE_REASON_MESSAGES[stuck.code] ??
        "this change could not be saved as it is. Undo your last change, then try again") +
      ". " +
      retentionMessage
    );
  }
  function formatUnsendableFilesMessage(
    leftOut: readonly Boot.UnsavedFile[],
    options: { stashed?: boolean; restSaved?: boolean } = {},
  ): string {
    let basename = (input: string) => input.slice(input.lastIndexOf("/") + 1),
      first = leftOut[0],
      singular: boolean = leftOut.length === 1,
      retention: string =
        options.stashed === true
          ? "kept in this browser for up to " +
            runtime.CRASH_STASH_RETENTION_LABEL
          : "kept only while this tab stays open",
      suffix: string =
        " Until then " +
        (singular ? "it is" : "they are") +
        " not saved, and " +
        retention +
        ".";
    if (options.restSaved === false) {
      return (
        (singular
          ? 'Also, "' + basename(first.path) + '" cannot be saved as it is: '
          : "Also, " +
            String(leftOut.length) +
            ' files cannot be saved as they are. The first, "' +
            basename(first.path) +
            '": ') +
        first.why +
        "." +
        suffix
      );
    }
    return (
      (singular
        ? 'Everything else is saved, but "' +
          basename(first.path) +
          '" is not: '
        : "Everything else is saved, but " +
          String(leftOut.length) +
          ' files are not. The first, "' +
          basename(first.path) +
          '": ') +
      first.why +
      "." +
      suffix
    );
  }
  bindRuntimeValue(runtime, "describeStuckSave", () => describeStuckSave);
  bindRuntimeValue(
    runtime,
    "formatUnsendableFilesMessage",
    () => formatUnsendableFilesMessage,
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
    "isTextFileListingRow",
    () => isTextFileListingRow,
    (value) => {
      isTextFileListingRow = value;
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
    isTextFileListingRow = (input) =>
      input.contentType.startsWith("text/") ||
      input.contentType === "application/json" ||
      input.contentType === "image/svg+xml";
  };
}
