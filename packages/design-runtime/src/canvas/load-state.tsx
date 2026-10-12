/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasLoadState(runtime: RuntimeBindings): () => void {
  var canvasNotLoadedMessage: Dynamic;
  var unavailableCanvasHistory: Dynamic;
  function useCanvasLoadState(document2?: Dynamic): Dynamic {
    let callback: Dynamic = (): Dynamic => {
        let value3: Dynamic =
          "loadState" in document2 ? document2.loadState() : "live";
        return value3 === "cached" ? "live" : value3;
      },
      [value, value2]: Dynamic = (0, runtime.reactChromeTheme.useState)(
        callback,
      );
    (0, runtime.reactChromeTheme.useEffect)(
      (): Dynamic => (
        value2(callback()),
        "subscribeLoad" in document2
          ? document2.subscribeLoad((): Dynamic => value2(callback()))
          : undefined
      ),
      [document2],
    );
    return value;
  }
  function CanvasLoadingPlaceholder(): Dynamic {
    return (
      <div
        className={
          "flex h-full w-full items-start justify-center overflow-hidden px-8 pt-10"
        }
      >
        <div className={"flex w-full max-w-[45rem] flex-col gap-1.5"}>
          <span className={"text-sm leading-none"}>
            <runtime.ChromeTextSkeleton chars={9} />
          </span>
          <div className={"aspect-[11/7] w-full"}>
            <runtime.ChromeSkeleton className={"h-full w-full rounded-md"} />
          </div>
        </div>
      </div>
    );
  }
  function CanvasLoadFailure({
    doc: doc,
    filePath: filePath,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, runtime.reactChromeTheme.useState)(
      doc.saveState(),
    );
    (0, runtime.reactChromeTheme.useEffect)(
      (): Dynamic => doc.subscribeSave(value2),
      [doc],
    );
    let callback: Dynamic = (): Dynamic => {
      doc.save();
    };
    (0, runtime.useFrameSaveState)(value.status, callback);
    return (
      <div
        className={
          "relative flex h-screen w-screen flex-col bg-page text-primary"
        }
      >
        <runtime.EditorToolbar
          title={(document as Dynamic).title || filePath}
          saveState={value}
          saveMode={doc.saveMode()}
          syncDot={true}
          onSave={callback}
          undo={unavailableCanvasHistory}
          publishControls={false}
          undoButtons={false}
          touchTargets={"square"}
          variant={"floating"}
          extrasEnd={
            <runtime.SessionStripPopover
              icon={"Play"}
              label={"Play"}
              iconOnly={true}
              disabled={true}
              disabledTip={canvasNotLoadedMessage}
            >
              {null}
            </runtime.SessionStripPopover>
          }
          trailing={
            <span className={"flex shrink-0 items-center gap-1"}>
              <fieldset disabled={true} className={"contents"}>
                <runtime.ToolbarPrimitivesComponent
                  glyph={
                    <runtime.Icon
                      name={"SidebarRight"}
                      size={"auto"}
                      className={"max-[599px]:rotate-90"}
                    />
                  }
                  label={"Properties"}
                  iconOnly={true}
                  tip={canvasNotLoadedMessage}
                  onClick={(): Dynamic => {}}
                />
              </fieldset>
              <runtime.ToolbarDivider />
              <span data-view-control={""} className={"contents"}>
                <runtime.CanvasZoomControl
                  readout={true}
                  getScale={(): Dynamic => 1}
                  onPickScale={(): Dynamic => {}}
                  onFit={(): Dynamic => {}}
                  fitLabel={runtime.fitArtboardsLabel}
                  disabled={true}
                  disabledTip={canvasNotLoadedMessage}
                />
              </span>
              <runtime.ToolbarPublishControls
                saveState={value}
                saveMode={doc.saveMode()}
                syncDot={true}
                onSave={callback}
              />
            </span>
          }
        />
        <div className={"relative min-h-0 flex-1 pt-[var(--tb-overlay-h,0px)]"}>
          <runtime.DocumentLoadGate
            doc={doc}
            skeleton={<CanvasLoadingPlaceholder />}
          >
            {null}
          </runtime.DocumentLoadGate>
        </div>
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "canvasNotLoadedMessage",
    () => canvasNotLoadedMessage,
    (value) => {
      canvasNotLoadedMessage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unavailableCanvasHistory",
    () => unavailableCanvasHistory,
    (value) => {
      unavailableCanvasHistory = value;
    },
  );
  bindRuntimeValue(runtime, "useCanvasLoadState", () => useCanvasLoadState);
  bindRuntimeValue(
    runtime,
    "CanvasLoadingPlaceholder",
    () => CanvasLoadingPlaceholder,
  );
  bindRuntimeValue(runtime, "CanvasLoadFailure", () => CanvasLoadFailure);
  return () => {
    canvasNotLoadedMessage = "Available once the canvas has loaded";
    unavailableCanvasHistory = {
      exec(): Dynamic {},
      seed(): Dynamic {},
      undo(): Dynamic {},
      redo(): Dynamic {},
      canUndo: (): Dynamic => false,
      canRedo: (): Dynamic => false,
      redoDepth: (): Dynamic => 0,
      clear(): Dynamic {},
      subscribe: (): Dynamic => (): Dynamic => {},
    };
  };
}
