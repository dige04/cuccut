import type * as React from "react";
import type * as Host from "../../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installFilesUiHandoffRuntime(
  runtime: RuntimeBindings,
): () => void {
  var reactHandoff: typeof React;
  var reactDomHandoff: typeof import("react-dom");
  var jsxHandoff: typeof import("react/jsx-runtime");
  var reactHandoffTargets: typeof React;
  var jsxHandoffTargets: typeof import("react/jsx-runtime");
  var HANDOFF_TARGETS: Host.HandoffTarget[];
  var HANDOFF_TARGET_STORAGE_KEY: string;
  var preferredHandoffTarget: Host.HandoffTarget | null;
  var reactArtifactClipboard: typeof React;
  var ARTIFACT_CLIPBOARD_ATTRIBUTE: string;
  var ARTIFACT_CLIPBOARD_PATTERN: RegExp;
  function claudeSendResultMessage(
    kind: Host.ClaudeSendKind,
    suffix?: string,
  ): string;
  function claudeSendResultMessage(
    kind: string,
    suffix?: string,
  ): string | undefined;
  function claudeSendResultMessage(
    kind: string,
    suffix: string = "",
  ): string | undefined {
    // CucCut: user-facing copy calls the agent "the agent", not Claude.
    switch (kind) {
      case "staged":
      case "waiting":
        return (
          "Added to your message to the agent. Send it when you're ready." + suffix
        );
      case "unanswered":
        return "Couldn't reach the agent just now. Try again in a moment.";
      case "sent":
        return "Sent to the agent." + suffix;
      case "started":
        return "Sending to the agent…" + suffix;
      case "copied":
        return "Prompt copied. Paste it to the agent." + suffix;
      case "failed":
        return "Couldn't copy the prompt. Try again, or copy the text yourself.";
    }
  }
  function previewLibraryScripts(
    libraries: {
      load: readonly {
        file: string;
      }[];
    },
    files: Readonly<Record<string, string | undefined>>,
  ): string[] {
    return libraries.load.map((input) => files[input.file] ?? "");
  }
  bindRuntimeValue(
    runtime,
    "reactHandoff",
    () => reactHandoff,
    (value) => {
      reactHandoff = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactDomHandoff",
    () => reactDomHandoff,
    (value) => {
      reactDomHandoff = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxHandoff",
    () => jsxHandoff,
    (value) => {
      jsxHandoff = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "claudeSendResultMessage",
    () => claudeSendResultMessage,
  );
  bindRuntimeValue(
    runtime,
    "reactHandoffTargets",
    () => reactHandoffTargets,
    (value) => {
      reactHandoffTargets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxHandoffTargets",
    () => jsxHandoffTargets,
    (value) => {
      jsxHandoffTargets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HANDOFF_TARGETS",
    () => HANDOFF_TARGETS,
    (value) => {
      HANDOFF_TARGETS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HANDOFF_TARGET_STORAGE_KEY",
    () => HANDOFF_TARGET_STORAGE_KEY,
    (value) => {
      HANDOFF_TARGET_STORAGE_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "preferredHandoffTarget",
    () => preferredHandoffTarget,
    (value) => {
      preferredHandoffTarget = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactArtifactClipboard",
    () => reactArtifactClipboard,
    (value) => {
      reactArtifactClipboard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_CLIPBOARD_ATTRIBUTE",
    () => ARTIFACT_CLIPBOARD_ATTRIBUTE,
    (value) => {
      ARTIFACT_CLIPBOARD_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_CLIPBOARD_PATTERN",
    () => ARTIFACT_CLIPBOARD_PATTERN,
    (value) => {
      ARTIFACT_CLIPBOARD_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "previewLibraryScripts",
    () => previewLibraryScripts,
  );
  return () => {
    reactHandoff = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    reactDomHandoff = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactDomNamespace)(),
      1,
    );
    jsxHandoff = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    reactHandoffTargets = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxHandoffTargets = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    HANDOFF_TARGETS = ["cowork", "code", "coworker"];
    HANDOFF_TARGET_STORAGE_KEY = "appifact.handOff.target";
    preferredHandoffTarget = null;
    try {
      let value = localStorage.getItem(HANDOFF_TARGET_STORAGE_KEY);
      preferredHandoffTarget =
        HANDOFF_TARGETS.find((input) => input === value) ?? null;
    } catch {
      preferredHandoffTarget = null;
    }
    reactArtifactClipboard = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    ARTIFACT_CLIPBOARD_ATTRIBUTE = "data-appifact-object";
    ARTIFACT_CLIPBOARD_PATTERN = new RegExp(
      ARTIFACT_CLIPBOARD_ATTRIBUTE + '="([A-Za-z0-9+/=]+)"',
    );
  };
}
