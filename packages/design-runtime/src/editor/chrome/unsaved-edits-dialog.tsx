/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorChromeUnsavedEditsDialog(
  runtime: RuntimeBindings,
): () => void {
  function UnsavedEditsDialog({
    open: open,
    editCount: editCount,
    onChoose: onChoose,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
    runtime.reactCodeDesignColorTokens.useState)("keep");
    (0, runtime.reactCodeDesignColorTokens.useEffect)((): Dynamic => {
      open || value2("keep");
    }, [open]);
    let value3: Dynamic =
      editCount === 1
        ? "your unsaved edit"
        : editCount > 1
          ? `your ${editCount} unsaved edits`
          : "your unsaved edits";
    return (
      <runtime.CdsIsland className={"contents"}>
        <runtime.DialogDialogRootTriggerPopupConfig.Root
          open={open}
          onOpenChange={(input?: Dynamic): Dynamic =>
            !input && onChoose("keep")
          }
        >
          <runtime.DialogDialogRootTriggerPopupConfig.Popup size={"sm"}>
            <runtime.DialogDialogRootTriggerPopupConfig.Header
              showClose={false}
              description={`It was updated outside this editor. What do you want to do with ${value3}?`}
            >
              {"This file changed"}
            </runtime.DialogDialogRootTriggerPopupConfig.Header>
            <runtime.ComponentsRadioGroupAssignValue
              value={value}
              onChange={value2}
              options={[
                {
                  value: "reload",
                  label: "Discard and reload",
                  description:
                    "Load the latest version. The edits from this session are removed.",
                },
                {
                  value: "keep",
                  label: "Keep them",
                  description:
                    // CucCut: user-facing copy calls the agent "the agent", not Claude.
                    "Your edits stay in this session, and the agent merges them with the latest version when you save.",
                },
              ]}
            />
            <runtime.DialogDialogRootTriggerPopupConfig.Footer>
              <runtime.Button
                variant={"primary"}
                onClick={(): Dynamic => onChoose(value)}
              >
                {"Okay"}
              </runtime.Button>
            </runtime.DialogDialogRootTriggerPopupConfig.Footer>
          </runtime.DialogDialogRootTriggerPopupConfig.Popup>
        </runtime.DialogDialogRootTriggerPopupConfig.Root>
      </runtime.CdsIsland>
    );
  }
  bindRuntimeValue(runtime, "UnsavedEditsDialog", () => UnsavedEditsDialog);
  return () => {};
}
