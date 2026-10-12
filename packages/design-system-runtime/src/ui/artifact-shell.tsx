/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type * as React from "react";
import type {
  JsxNamespace,
  ArtifactShellProps,
  ArtifactShellDocument,
  ArtifactShellUndo,
} from "../contracts/composition";
export function installUiArtifactShell(runtime: RuntimeBindings): () => void {
  var jsxForUiArtifactShell: JsxNamespace;
  var ArtifactErrorBoundary: React.ComponentClass<
    React.PropsWithChildren,
    {
      error?: string;
    }
  >;
  function LocalStashRecoveryOffer<Seed>({
    doc: doc,
    undo: undo,
  }: {
    doc: ArtifactShellDocument<Seed>;
    undo?: ArtifactShellUndo<Seed> | null;
  }) {
    let value = doc.stashOffer(),
      ref = (runtime.reactForUiDisclosure as typeof import("react")).useRef<{
        at: number;
        mins: number;
      } | null>(null);
    if (value && ref.current?.at !== value.at) {
      ref.current = {
        at: value.at,
        mins: Math.max(1, Math.round((Date.now() - value.at) / 60000)),
      };
    }
    let value2 = value ? (ref.current?.mins ?? 1) : 0;
    return (
      <div data-mc-chrome={""} role={"status"} className={"shrink-0"}>
        {value ? (
          <div className={"px-md pt-md"}>
            <runtime.Callout
              variant={"warning"}
              role={"none"}
              action={
                <jsxForUiArtifactShell.Fragment>
                  {[
                    <runtime.Button
                      variant={"secondary"}
                      onClick={() => {
                        let value3 = doc.restoreStash();
                        if (value3 && undo) {
                          undo.seed(value3);
                        }
                      }}
                    >
                      {"Restore"}
                    </runtime.Button>,
                    <runtime.Button
                      variant={"ghost"}
                      onClick={() => {
                        let value3 = !undo || undo.redoDepth() <= 1;
                        doc.discardStash();
                        if (undo && value3) {
                          undo.clear();
                        }
                      }}
                    >
                      {"Discard"}
                    </runtime.Button>,
                  ]}
                </jsxForUiArtifactShell.Fragment>
              }
            >
              {[
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
              ]}
            </runtime.Callout>
          </div>
        ) : null}
      </div>
    );
  }
  function ArtifactShell<Seed>({
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
  }: ArtifactShellProps<Seed>) {
    let [, value] = runtime.reactForUiDisclosure.useState(0),
      [value2, value3] = runtime.reactForUiDisclosure.useState(doc.saveState());
    runtime.reactForUiDisclosure.useEffect(() => {
      let value11 = doc.subscribe(() => value((input: number) => input + 1)),
        value12 = doc.subscribeSave(value3);
      value3(doc.saveState());
      return () => {
        value11();
        value12();
      };
    }, [doc]);
    runtime.reactForUiDisclosure.useEffect(() => {
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
    runtime.reactForUiDisclosure.useEffect(() => {
      if (value5 !== "") {
        document.title = value5;
      }
    }, [value5]);
    let value8 = value2.status === "loading" && !value4,
      callback = (input: React.ReactNode) =>
        value8 && input != null ? (
          <fieldset
            disabled={true}
            aria-busy={"true"}
            title={"Loading the latest content…"}
            className={"contents"}
          >
            {input}
          </fieldset>
        ) : (
          input
        ),
      value9 =
        tabs !== undefined &&
        tabs.length > 0 &&
        tab !== undefined &&
        onTabChange ? (
          <runtime.ToolbarTabs
            tabs={tabs}
            value={tab}
            onChange={onTabChange}
            label={"Editor mode"}
          />
        ) : null,
      value10 = toolbarVariant === "floating" && value9 === null;
    return (
      <runtime.AppDesignProvider>
        <ArtifactErrorBoundary>
          {[
            <runtime.PanedLayout
              leading={leading}
              toolbarVariant={value10 ? "floating" : "docked"}
              toolbar={
                <jsxForUiArtifactShell.Fragment>
                  {[
                    hideToolbar ? null : (
                      <runtime.ArtifactToolbar
                        title={doc.title()}
                        saveState={value2}
                        saveMode={doc.saveMode()}
                        syncDot={value6}
                        onSave={() => void doc.save()}
                        undo={undo}
                        extrasEnd={
                          !value4 || alwaysShowExtras
                            ? callback(toolbarExtrasEnd)
                            : null
                        }
                        pinned={
                          !value4 || alwaysShowExtras
                            ? callback(toolbarPinned)
                            : null
                        }
                        afterUndo={toolbarAfterUndo}
                        {...(toolbarQuietReadOnlyReason !== undefined
                          ? {
                              quietReadOnlyReason: toolbarQuietReadOnlyReason,
                            }
                          : {})}
                        leading={toolbarLeading}
                        trailing={toolbarTrailing}
                        undoButtons={toolbarUndoButtons}
                        density={toolbarDensity}
                        touchTargets={toolbarTouchTargets}
                        readOnly={value4}
                        variant={value10 ? "floating" : "docked"}
                      >
                        {!value4 || alwaysShowExtras
                          ? callback(toolbarExtras)
                          : null}
                      </runtime.ArtifactToolbar>
                    ),
                    value9,
                  ]}
                </jsxForUiArtifactShell.Fragment>
              }
            >
              {[
                value10 ? (
                  <div
                    data-tb-overlay-clear={""}
                    className={"flex shrink-0 flex-col"}
                  >
                    {[
                      <LocalStashRecoveryOffer doc={doc} undo={undo} />,
                      <div
                        data-tb-clear-above={""}
                        className={"flex shrink-0 flex-col"}
                      >
                        {aboveContent}
                      </div>,
                    ]}
                  </div>
                ) : (
                  <jsxForUiArtifactShell.Fragment>
                    {[
                      <LocalStashRecoveryOffer doc={doc} undo={undo} />,
                      aboveContent,
                    ]}
                  </jsxForUiArtifactShell.Fragment>
                ),
                <div
                  data-appifact-content={""}
                  className={"isolate min-h-0 min-w-0 flex-1 overflow-auto"}
                  style={{
                    contain: "paint",
                  }}
                >
                  <runtime.ArtifactLoadBoundary
                    doc={doc}
                    skeleton={skeleton}
                    skeletonFlush={skeletonFlush}
                  >
                    {children}
                  </runtime.ArtifactLoadBoundary>
                </div>,
              ]}
            </runtime.PanedLayout>,
            <runtime.useToastBridge />,
          ]}
        </ArtifactErrorBoundary>
      </runtime.AppDesignProvider>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxForUiArtifactShell",
    () => jsxForUiArtifactShell,
    (value) => {
      jsxForUiArtifactShell = value;
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
    jsxForUiArtifactShell = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    ArtifactErrorBoundary = class ArtifactErrorBoundary extends (
      (runtime.reactForUiDisclosure.Component as typeof React.Component)
    )<
      React.PropsWithChildren,
      {
        error?: string;
      }
    > {
      declare props: React.PropsWithChildren;
      state: {
        error?: string;
      } = {};
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
          return (
            <div
              className={
                "m-6 rounded-lg border border-border-line bg-panel p-4 text-sm"
              }
            >
              {[
                <p className={"font-semibold"}>
                  {"This appifact hit a rendering error."}
                </p>,
                <p className={"mt-1 text-fg-muted"}>{this.state.error}</p>,
                <p className={"mt-2 text-fg-muted"}>
                  {
                    "Reload to try again. If it persists, a stored value may be malformed."
                  }
                </p>,
              ]}
            </div>
          );
        }
        return this.props.children;
      }
    };
  };
}
