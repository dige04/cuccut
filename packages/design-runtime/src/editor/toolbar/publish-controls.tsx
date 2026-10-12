/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorToolbarPublishControls(
  runtime: RuntimeBindings,
): () => void {
  function ToolbarPublishControls({
    saveState: saveState,
    saveMode = "manual",
    onSave: onSave,
    syncDot = false,
    editing: editing,
    onToggleEdit: onToggleEdit,
  }: Dynamic): Dynamic {
    let value: Dynamic = saveState.status === "readonly",
      value2: Dynamic =
        saveState.status === "dirty" || saveState.status === "error",
      value3: Dynamic = !value2 || saveState.status === "saving",
      value4: Dynamic = saveState.status === "saving",
      value5: Dynamic = value4 ? "Saving\u2026" : "Save",
      value6: Dynamic = value4
        ? value5
        : value2
          ? "Publish your changes \u2014 every open view updates"
          : "Everything is published",
      value7: Dynamic = (0, runtime.useDisabledToolbarItem)({
        disabled: value3,
        name: value5,
        reason: value6,
      }),
      value8: Dynamic = (0, runtime.reactCanvasMeasurements.useRef)(null);
    (0, runtime.useToolbarPress)(value8, value3);
    return (
      <runtime.jsxToolbarLayout.Fragment>
        {!value && onToggleEdit ? (
          <runtime.ToolbarPrimitivesComponent
            icon={"Edit"}
            label={"Edit"}
            tip={editing ? "Done editing \u2014 back to the live view" : "Edit"}
            pressed={editing === true}
            onClick={onToggleEdit}
            data-testid={"dc-mode-edit"}
          />
        ) : null}
        {!value && syncDot ? (
          <runtime.ToolbarSyncStatus state={saveState} onRetry={onSave} />
        ) : null}
        {!value && saveMode === "manual" && !syncDot ? (
          <runtime.Tooltip
            content={value6}
            shortcut={value2 ? "cmd+s" : undefined}
            side={"bottom"}
            align={"end"}
            hoverable={false}
          >
            <span
              ref={value8}
              tabIndex={value3 ? 0 : -1}
              {...value7.props}
              data-tb-save={""}
              className={
                "inline-flex shrink-0 rounded outline-none focus-visible:outline-hidden focus-visible:shadow-focus"
              }
            >
              <runtime.Button
                variant={value2 ? "primary" : "secondary"}
                disabled={value3}
                onClick={onSave}
                aria-label={value5}
                {...value7.inner}
              >
                {value5}
              </runtime.Button>
              {value7.mirror}
            </span>
          </runtime.Tooltip>
        ) : null}
      </runtime.jsxToolbarLayout.Fragment>
    );
  }
  function ToolbarSurface({ floating: floating, ...props }: Dynamic): Dynamic {
    return floating ? (
      <runtime.Surface elevation={runtime.PanelValue} {...props} />
    ) : (
      <div {...props} />
    );
  }
  bindRuntimeValue(
    runtime,
    "ToolbarPublishControls",
    () => ToolbarPublishControls,
  );
  bindRuntimeValue(runtime, "ToolbarSurface", () => ToolbarSurface);
  return () => {};
}
