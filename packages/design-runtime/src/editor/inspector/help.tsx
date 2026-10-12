/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorInspectorHelp(
  runtime: RuntimeBindings,
): () => void {
  function InspectorCodePreview(input?: Dynamic): Dynamic {
    return (
      <pre
        {...input}
        className={(0, runtime.cn)(
          "m-0 px-3.5 pb-1 [font-family:ui-monospace,'SF_Mono',monospace] text-[10px] leading-normal text-secondary whitespace-pre-wrap break-all select-text",
          input.className,
        )}
      />
    );
  }
  function InspectorHelpText(input?: Dynamic): Dynamic {
    return (
      <div
        {...input}
        className={(0, runtime.cn)(
          "px-3.5 pb-2.5 text-[11px] text-secondary leading-normal",
          input.className,
        )}
      />
    );
  }
  bindRuntimeValue(runtime, "InspectorCodePreview", () => InspectorCodePreview);
  bindRuntimeValue(runtime, "InspectorHelpText", () => InspectorHelpText);
  return () => {};
}
