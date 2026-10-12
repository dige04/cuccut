/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorOutlineRename(
  runtime: RuntimeBindings,
): () => void {
  var OutlineRenameLimit: Dynamic;
  function OutlineRenameInput({
    label: label,
    onDone: onDone,
  }: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0,
      runtime.reactKeyboardEditActions.useState)(label),
      value3: Dynamic = (0, runtime.reactKeyboardEditActions.useRef)(false),
      callback: Dynamic = (
        input?: Dynamic,
        options: Dynamic = false,
      ): Dynamic => {
        value3.current || ((value3.current = true), onDone(input, options));
      };
    (0, runtime.reactKeyboardEditActions.useEffect)(
      (): Dynamic => (): Dynamic => callback(null),
      [],
    );
    return (
      <runtime.TextInput
        size={"sm"}
        fullWidth={false}
        className={"min-w-0 flex-1"}
        aria-label={"Artboard name"}
        autoFocus={true}
        value={value}
        onChange={(event?: Dynamic): Dynamic => value2(event.target.value)}
        onClick={(input?: Dynamic): Dynamic => input.stopPropagation()}
        onDoubleClick={(input?: Dynamic): Dynamic => input.stopPropagation()}
        onPointerDown={(input?: Dynamic): Dynamic => input.stopPropagation()}
        onContextMenu={(input?: Dynamic): Dynamic => input.stopPropagation()}
        onFocus={(input?: Dynamic): Dynamic => input.currentTarget.select()}
        onBlur={(): Dynamic => callback(value.trim() || null)}
        onKeyDown={(input?: Dynamic): Dynamic => {
          input.key === "Enter"
            ? callback(value.trim() || null, true)
            : input.key === "Escape" && callback(null, true);
          input.stopPropagation();
        }}
      />
    );
  }
  function consumeOutlineRefocus(input?: Dynamic): Dynamic {
    let value: Dynamic =
      input.refocusAt !== 0 &&
      Date.now() - input.refocusAt <= OutlineRenameLimit;
    input.refocusAt = 0;
    return value;
  }
  bindRuntimeValue(runtime, "OutlineRenameInput", () => OutlineRenameInput);
  bindRuntimeValue(
    runtime,
    "OutlineRenameLimit",
    () => OutlineRenameLimit,
    (value) => {
      OutlineRenameLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "consumeOutlineRefocus",
    () => consumeOutlineRefocus,
  );
  return () => {
    OutlineRenameLimit = 3e3;
  };
}
