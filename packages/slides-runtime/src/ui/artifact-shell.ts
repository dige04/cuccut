/** Restored application module; prepare first, initialize in original order. */
import type { ComponentClass, ReactElement, ReactNode } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type { ArtifactDocument } from "../documents/artifact-document";
import type { CommandHistory } from "../editor/command-history";
import type { ToolbarTabItem } from "./toolbar-tabs";

/** Last stash offer shown, with the minutes-ago label frozen at first sight. */
export interface StashOfferNote {
  at: number;
  mins: number;
}

export interface LocalStashRecoveryOfferProps {
  doc: ArtifactDocument<unknown>;
  undo?: CommandHistory | null;
}

export interface ArtifactShellProps {
  children?: ReactNode;
  doc: ArtifactDocument<unknown>;
  undo?: CommandHistory | null;
  toolbarExtras?: ReactNode;
  toolbarExtrasEnd?: ReactNode;
  toolbarPinned?: ReactNode;
  toolbarAfterUndo?: ReactNode;
  /** A read-only reason that should not be announced as a toolbar warning. */
  toolbarQuietReadOnlyReason?: string;
  toolbarLeading?: ReactNode;
  toolbarTrailing?: ReactNode;
  toolbarUndoButtons?: boolean;
  toolbarDensity?: "compact" | "comfortable";
  toolbarTouchTargets?: string;
  alwaysShowExtras?: boolean;
  /** Bind the undo/redo keyboard shortcuts (default true). */
  undoShortcuts?: boolean;
  tabs?: readonly ToolbarTabItem[];
  tab?: string;
  onTabChange?: (value: string) => void;
  aboveContent?: ReactNode;
  skeleton?: ReactNode;
  skeletonFlush?: boolean;
  leading?: ReactNode;
  hideToolbar?: boolean;
  toolbarVariant?: "docked" | "floating";
}

export interface ArtifactErrorBoundaryProps {
  children?: ReactNode;
}

export interface ArtifactErrorBoundaryState {
  error?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxS6: JsxNamespace;
    ArtifactErrorBoundary: ComponentClass<
      ArtifactErrorBoundaryProps,
      ArtifactErrorBoundaryState
    >;
    LocalStashRecoveryOffer: (
      props: LocalStashRecoveryOfferProps,
    ) => ReactElement;
    ArtifactShell: (props: ArtifactShellProps) => ReactElement;
  }
}

export function installUiArtifactShell(runtime: RuntimeBindings): () => void {
  var jsxS6: JsxNamespace;
  var ArtifactErrorBoundary: ComponentClass<
    ArtifactErrorBoundaryProps,
    ArtifactErrorBoundaryState
  >;
  function LocalStashRecoveryOffer({
    doc: doc,
    undo: undo,
  }: LocalStashRecoveryOfferProps): ReactElement {
    let value = doc.stashOffer(),
      ref = runtime.reactd3.useRef<StashOfferNote | null>(null);
    if (value && ref.current?.at !== value.at) {
      ref.current = {
        at: value.at,
        mins: Math.max(1, Math.round((Date.now() - value.at) / 60000)),
      };
    }
    let value2 = value ? (ref.current?.mins ?? 1) : 0;
    return jsxS6.jsx("div", {
      "data-mc-chrome": "",
      role: "status",
      className: "shrink-0",
      children: value
        ? jsxS6.jsx("div", {
            className: "px-md pt-md",
            children: jsxS6.jsxs(runtime.Callout, {
              variant: "warning",
              role: "none",
              action: jsxS6.jsxs(jsxS6.Fragment, {
                children: [
                  jsxS6.jsx(runtime.Button, {
                    variant: "secondary",
                    onClick: () => {
                      let value3 = doc.restoreStash();
                      if (value3 && undo) {
                        undo.seed(value3);
                      }
                    },
                    children: "Restore",
                  }),
                  jsxS6.jsx(runtime.Button, {
                    variant: "ghost",
                    onClick: () => {
                      let value3 = !undo || undo.redoDepth() <= 1;
                      doc.discardStash();
                      if (undo && value3) {
                        undo.clear();
                      }
                    },
                    children: "Discard",
                  }),
                ],
              }),
              children: [
                "Unsaved changes from about ",
                value2,
                " minute",
                value2 === 1 ? "" : "s",
                " ago were found on this page — from before the last reload (a save elsewhere, or this tab closing).",
                " ",
                doc.readOnly()
                  ? "Restore them here to keep working with them; this view can’t publish."
                  : doc.saveMode() === "auto"
                    ? "Restore puts them back over this version and saves automatically; Undo reverts."
                    : "Restore them here, then Save to publish.",
              ],
            }),
          })
        : null,
    });
  }
  function ArtifactShell({
    children: children,
    doc: doc,
    undo: undo,
    toolbarExtras: toolbarExtras,
    toolbarExtrasEnd: toolbarExtrasEnd,
    toolbarPinned: toolbarPinned,
    toolbarAfterUndo: toolbarAfterUndo,
    toolbarQuietReadOnlyReason: toolbarQuietReadOnlyReason,
    toolbarLeading: toolbarLeading,
    toolbarTrailing: toolbarTrailing,
    toolbarUndoButtons: toolbarUndoButtons,
    toolbarDensity: toolbarDensity,
    toolbarTouchTargets: toolbarTouchTargets,
    alwaysShowExtras: alwaysShowExtras,
    undoShortcuts = true,
    tabs: tabs,
    tab: tab,
    onTabChange: onTabChange,
    aboveContent: aboveContent,
    skeleton: skeleton,
    skeletonFlush: skeletonFlush,
    leading: leading,
    hideToolbar = false,
    toolbarVariant = "docked",
  }: ArtifactShellProps): ReactElement {
    let [, value] = runtime.reactd3.useState(0),
      [value2, value3] = runtime.reactd3.useState(doc.saveState());
    runtime.reactd3.useEffect(() => {
      let value11 = doc.subscribe(
          () => value((input) => input + 1),
        ),
        value12 = doc.subscribeSave(value3);
      value3(doc.saveState());
      return () => {
        value11();
        value12();
      };
    }, [doc]);
    runtime.reactd3.useEffect(() => {
      let callback2 = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
          return;
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          doc.save();
        }
      };
      window.addEventListener("keydown", callback2);
      return () => window.removeEventListener("keydown", callback2);
    }, [doc]);
    (0, runtime.useUndoKeys)(undo, undoShortcuts);
    let value4 = doc.readOnly(),
      value5 = doc.title(),
      value6 = "loadState" in doc || doc.saveMode() === "auto",
      status = doc.saveState().status,
      value7 =
        status === "readonly" &&
        toolbarQuietReadOnlyReason !== undefined &&
        doc.saveState().message === toolbarQuietReadOnlyReason;
    (0, runtime.useHostSaveState)(
      !value7 && (value6 || status === "readonly") ? status : null,
      () => void doc.save(),
    );
    runtime.reactd3.useEffect(() => {
      if (value5 !== "") {
        document.title = value5;
      }
    }, [value5]);
    let value8 = value2.status === "loading" && !value4,
      callback = (input: ReactNode) =>
        value8 && input != null
          ? jsxS6.jsx("fieldset", {
              disabled: true,
              "aria-busy": "true",
              title: "Loading the latest content…",
              className: "contents",
              children: input,
            })
          : input,
      value9 =
        tabs !== undefined &&
        tabs.length > 0 &&
        tab !== undefined &&
        onTabChange
          ? jsxS6.jsx(runtime.ToolbarTabs, {
              tabs: tabs,
              value: tab,
              onChange: onTabChange,
              label: "Editor mode",
            })
          : null,
      value10 = toolbarVariant === "floating" && value9 === null;
    return jsxS6.jsx(runtime.AppDesignProvider, {
      children: jsxS6.jsxs(ArtifactErrorBoundary, {
        children: [
          jsxS6.jsxs(runtime.PanedLayout, {
            leading: leading,
            toolbarVariant: value10 ? "floating" : "docked",
            toolbar: jsxS6.jsxs(jsxS6.Fragment, {
              children: [
                hideToolbar
                  ? null
                  : jsxS6.jsx(runtime.ArtifactToolbar, {
                      title: doc.title(),
                      saveState: value2,
                      saveMode: doc.saveMode(),
                      syncDot: value6,
                      onSave: () => void doc.save(),
                      undo: undo,
                      extrasEnd:
                        !value4 || alwaysShowExtras
                          ? callback(toolbarExtrasEnd)
                          : null,
                      pinned:
                        !value4 || alwaysShowExtras
                          ? callback(toolbarPinned)
                          : null,
                      afterUndo: toolbarAfterUndo,
                      ...(toolbarQuietReadOnlyReason !== undefined
                        ? {
                            quietReadOnlyReason: toolbarQuietReadOnlyReason,
                          }
                        : {}),
                      leading: toolbarLeading,
                      trailing: toolbarTrailing,
                      undoButtons: toolbarUndoButtons,
                      density: toolbarDensity,
                      touchTargets: toolbarTouchTargets,
                      readOnly: value4,
                      variant: value10 ? "floating" : "docked",
                      children:
                        !value4 || alwaysShowExtras
                          ? callback(toolbarExtras)
                          : null,
                    }),
                value9,
              ],
            }),
            children: [
              value10
                ? jsxS6.jsxs("div", {
                    "data-tb-overlay-clear": "",
                    className: "flex shrink-0 flex-col",
                    children: [
                      jsxS6.jsx(LocalStashRecoveryOffer, {
                        doc: doc,
                        undo: undo,
                      }),
                      jsxS6.jsx("div", {
                        "data-tb-clear-above": "",
                        className: "flex shrink-0 flex-col",
                        children: aboveContent,
                      }),
                    ],
                  })
                : jsxS6.jsxs(jsxS6.Fragment, {
                    children: [
                      jsxS6.jsx(LocalStashRecoveryOffer, {
                        doc: doc,
                        undo: undo,
                      }),
                      aboveContent,
                    ],
                  }),
              jsxS6.jsx("div", {
                "data-appifact-content": "",
                className: "isolate min-h-0 min-w-0 flex-1 overflow-auto",
                style: {
                  contain: "paint",
                },
                children: jsxS6.jsx(runtime.ArtifactLoadBoundary, {
                  doc: doc,
                  skeleton: skeleton,
                  skeletonFlush: skeletonFlush,
                  children: children,
                }),
              }),
            ],
          }),
          jsxS6.jsx(runtime.useToastBridge, {}),
        ],
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "jsxS6",
    () => jsxS6,
    (value) => {
      jsxS6 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ArtifactErrorBoundary",
    () => ArtifactErrorBoundary,
    (value) => {
      ArtifactErrorBoundary = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LocalStashRecoveryOffer",
    () => LocalStashRecoveryOffer,
  );
  bindRuntimeValue(runtime, "ArtifactShell", () => ArtifactShell);
  return () => {
    jsxS6 = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    ArtifactErrorBoundary = class ArtifactErrorBoundary extends runtime.reactd3
      .Component<ArtifactErrorBoundaryProps, ArtifactErrorBoundaryState> {
      state: ArtifactErrorBoundaryState = {};
      static getDerivedStateFromError(input: unknown) {
        return {
          error: input instanceof Error ? input.message : String(input),
        };
      }
      componentDidCatch(input: unknown) {
        try {
          if (typeof reportError === "function") {
            reportError(input);
          }
        } catch {}
      }
      render() {
        if (this.state.error !== undefined) {
          return jsxS6.jsxs("div", {
            className:
              "m-6 rounded-lg border border-border-line bg-panel p-4 text-sm",
            children: [
              jsxS6.jsx("p", {
                className: "font-semibold",
                children: "This appifact hit a rendering error.",
              }),
              jsxS6.jsx("p", {
                className: "mt-1 text-fg-muted",
                children: this.state.error,
              }),
              jsxS6.jsx("p", {
                className: "mt-2 text-fg-muted",
                children:
                  "Reload to try again. If it persists, a stored value may be malformed.",
              }),
            ],
          });
        }
        return this.props.children;
      }
    };
  };
}
