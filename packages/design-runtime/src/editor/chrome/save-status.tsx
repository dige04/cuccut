/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromeSaveStatus(
  runtime: RuntimeBindings,
): () => void {
  var reactChromeSaveStatus: Dynamic;
  var jsxChromeSaveStatus: Dynamic;
  function DocumentSaveStatus({
    doc: doc,
    onSave: onSave,
    docked = false,
    belowPickerBar = false,
  }: Dynamic): Dynamic {
    let [, value]: Dynamic = (0, reactChromeSaveStatus.useState)(0);
    (0, reactChromeSaveStatus.useEffect)((): Dynamic => {
      let value3: Dynamic = doc.subscribe(
          (): Dynamic => value((input?: Dynamic): Dynamic => input + 1),
        ),
        value4: Dynamic = doc.subscribeSave(
          (): Dynamic => value((input?: Dynamic): Dynamic => input + 1),
        );
      return (): Dynamic => {
        value3();
        value4();
      };
    }, [doc]);
    (0, reactChromeSaveStatus.useEffect)((): Dynamic => {
      let callback: Dynamic = (event?: Dynamic): Dynamic => {
        event.defaultPrevented ||
          ((event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "s" &&
            (event.preventDefault(),
            doc.readOnly() || (onSave ? onSave() : doc.save())));
      };
      (window as Dynamic).addEventListener("keydown", callback);
      return (): Dynamic =>
        (window as Dynamic).removeEventListener("keydown", callback);
    }, [doc]);
    if (!doc.stashOffer()) return null;
    let value2: Dynamic = doc.readOnly();
    return (
      <runtime.CdsIsland className={"contents"}>
        <div
          className={
            (belowPickerBar
              ? "top-[52px] pointer-coarse:top-[68px]"
              : docked
                ? "top-11 pointer-coarse:top-[52px]"
                : "top-[calc(var(--tb-overlay-h,54px)+4px)]") +
            " absolute inset-x-3 z-40 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface-panel px-4 py-2 shadow-panel-sm"
          }
        >
          <span className={"min-w-0 text-footnote text-secondary"}>
            {"You have unsaved work from a previous session."}
            {value2
              ? " This view can\u2019t save it; restore it to look at or export it."
              : ""}
          </span>
          <span className={"ml-auto flex shrink-0 items-center gap-1"}>
            <runtime.Button
              type={"button"}
              variant={"primary"}
              onClick={(): Dynamic => doc.restoreStash()}
            >
              {"Restore"}
            </runtime.Button>
            <runtime.Button
              type={"button"}
              variant={"ghost"}
              onClick={(): Dynamic => doc.discardStash()}
            >
              {"Discard"}
            </runtime.Button>
          </span>
        </div>
      </runtime.CdsIsland>
    );
  }
  bindRuntimeValue(
    runtime,
    "reactChromeSaveStatus",
    () => reactChromeSaveStatus,
    (value) => {
      reactChromeSaveStatus = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxChromeSaveStatus",
    () => jsxChromeSaveStatus,
    (value) => {
      jsxChromeSaveStatus = value;
    },
  );
  bindRuntimeValue(runtime, "DocumentSaveStatus", () => DocumentSaveStatus);
  return () => {
    reactChromeSaveStatus = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    (0, runtime.initializePlatformCdsIsland)();
    jsxChromeSaveStatus = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
