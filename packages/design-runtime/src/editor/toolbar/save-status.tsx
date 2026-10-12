/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorToolbarSaveStatus(
  runtime: RuntimeBindings,
): () => void {
  function ToolbarSaveStatus({ state: state }: Dynamic): Dynamic {
    if (state.status === "error" || state.status === "readonly")
      return <ToolbarSaveFailure state={state} />;
    let value: Dynamic = state.status === "saving",
      value2: Dynamic = state.status === "dirty";
    return (
      <span
        role={"status"}
        title={
          value
            ? "Saving\u2026"
            : value2
              ? "Edits are held in the editor \u2014 they save when applied"
              : "Every change saves automatically"
        }
        className={
          "inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-fg-muted"
        }
      >
        <span
          className={
            "h-1.5 w-1.5 shrink-0 rounded-full " +
            (value || value2 ? "bg-fill-warning" : "bg-fill-success")
          }
        />
        <span className={"tb-status-text truncate"}>
          {value
            ? "Saving\u2026"
            : value2
              ? "Unsaved edits"
              : "Saved automatically"}
        </span>
      </span>
    );
  }
  function ToolbarSyncStatus({
    state: state,
    onRetry: onRetry,
    tipSide = "bottom",
  }: Dynamic): Dynamic {
    let value: Dynamic = (0,
      runtime.reactCanvasMeasurements.useSyncExternalStore)(
        runtime.subscribeHostChrome,
        runtime.hostDrawsSave,
        (): Dynamic => false,
      ),
      value2: Dynamic = (0,
      runtime.reactCanvasMeasurements.useSyncExternalStore)(
        runtime.subscribeHostChrome,
        runtime.hostHandlesRetry,
        (): Dynamic => false,
      ),
      [value3, value4]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        false,
      ),
      [value5, value6]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        false,
      ),
      [value7, value8]: Dynamic = (0, runtime.reactCanvasMeasurements.useState)(
        false,
      ),
      status: Dynamic = state.status,
      value9: Dynamic =
        status === "saving" || status === "dirty" || status === "loading";
    value7 && !value9 && status !== "error" && value8(false);
    let value10: Dynamic = value3 || value5 || (value7 && value9);
    if (value && (status !== "error" || value2) && !value10) return null;
    let value11: Dynamic =
        status === "loading" || status === "cached"
          ? "loading"
          : status === "error"
            ? "error"
            : status === "dirty" || status === "saving"
              ? "pending"
              : "synced",
      value12: Dynamic = value11 === "synced" && !value10,
      value13: Dynamic =
        state.message ??
        (value11 === "pending"
          ? "Syncing\u2026"
          : value11 === "error"
            ? "Couldn\u2019t sync \u2014 click to retry"
            : "All changes synced"),
      value14: Dynamic = status === "error" || status === "dirty";
    return (
      <runtime.Tooltip
        content={value13}
        side={tipSide}
        align={"end"}
        multiline={true}
        hoverable={false}
        closeOnClick={false}
      >
        <button
          type={"button"}
          aria-disabled={value14 ? undefined : true}
          onClick={(): Dynamic => {
            value14 && (status === "error" && value8(true), onRetry());
          }}
          onFocus={(): Dynamic => value4(true)}
          onBlur={(): Dynamic => value4(false)}
          onPointerEnter={(): Dynamic => value6(true)}
          onPointerLeave={(): Dynamic => value6(false)}
          aria-label={value13}
          data-sync={value11}
          data-quiet={value12 ? "" : undefined}
          data-testid={"sync-dot"}
          className={"tb-sync-dot"}
        >
          <span aria-hidden={"true"} className={"tb-sync-dot-mark"} />
        </button>
      </runtime.Tooltip>
    );
  }
  function ToolbarSaveFailure({ state: state }: Dynamic): Dynamic {
    let value: Dynamic = (0,
    runtime.reactCanvasMeasurements.useSyncExternalStore)(
      runtime.subscribeHostChrome,
      runtime.hostDrawsReadOnly,
      (): Dynamic => false,
    );
    if (state.status === "error") {
      let value2: Dynamic = state.message ?? "Couldn\u2019t save";
      return (
        <span
          role={"status"}
          title={value2}
          className={
            "inline-flex max-w-80 shrink-0 items-center gap-1.5 truncate rounded-full bg-bad/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-bad"
          }
        >
          <span
            className={"h-1.5 w-1.5 shrink-0 rounded-full bg-fill-danger"}
          />
          <span className={"tb-status-text truncate"}>{value2}</span>
        </span>
      );
    }
    return state.status === "readonly" ? (
      value ? null : (
        <span
          role={"status"}
          title={state.message ?? "Read-only"}
          className={
            "tb-lock inline-flex shrink-0 items-center gap-1.5 px-1 text-body whitespace-nowrap text-fg-muted"
          }
        >
          <runtime.Icon name={"Lock"} size={"auto"} className={"shrink-0"} />
          <span className={"tb-lock-words truncate"}>{"Read-only"}</span>
        </span>
      )
    ) : null;
  }
  bindRuntimeValue(runtime, "ToolbarSaveStatus", () => ToolbarSaveStatus);
  bindRuntimeValue(runtime, "ToolbarSyncStatus", () => ToolbarSyncStatus);
  bindRuntimeValue(runtime, "ToolbarSaveFailure", () => ToolbarSaveFailure);
  return () => {};
}
