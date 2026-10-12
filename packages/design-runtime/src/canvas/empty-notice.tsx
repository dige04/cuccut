/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasEmptyNotice(runtime: RuntimeBindings): () => void {
  var react_HAt: Dynamic;
  var jsx_H_: Dynamic;
  function EmptyCanvasReadOnlyNotice({
    editable: editable,
    reason: reason,
    wholeCanvas: wholeCanvas,
  }: Dynamic): Dynamic {
    let value: Dynamic = (0, react_HAt.useSyncExternalStore)(
      runtime.subscribeCanvasLoadFailure,
      runtime.getCanvasLoadFailure,
      (): Dynamic => {},
    );
    return !editable && wholeCanvas && value !== undefined ? (
      <p
        data-testid={"dc-empty-page-note"}
        className={"max-w-sm text-[12.5px] text-secondary"}
      >
        {value}
      </p>
    ) : (
      <jsx_H_.Fragment>
        <p
          data-testid={"dc-empty-page-note"}
          className={"text-[12.5px] text-secondary"}
        >
          {editable
            ? "No artboards yet."
            : "No artboards to show in this view."}
        </p>
        {!editable && reason !== undefined && (
          <p className={"max-w-sm text-[11.5px] text-secondary"}>{reason}</p>
        )}
      </jsx_H_.Fragment>
    );
  }
  bindRuntimeValue(
    runtime,
    "react_HAt",
    () => react_HAt,
    (value) => {
      react_HAt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_H_",
    () => jsx_H_,
    (value) => {
      jsx_H_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EmptyCanvasReadOnlyNotice",
    () => EmptyCanvasReadOnlyNotice,
  );
  return () => {
    react_HAt = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    jsx_H_ = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
  };
}
