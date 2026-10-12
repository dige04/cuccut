/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPropertiesToolOptions(
  runtime: RuntimeBindings,
): () => void {
  var reactPropertiesToolOptions: Dynamic;
  var reactPropertiesToolOptions_2: Dynamic;
  function toolSegmentOption(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let state: Dynamic = {
      value: input,
      tooltip: options,
      ...(context !== undefined
        ? {
            disabled: context,
          }
        : {}),
    };
    if (input === "image")
      return {
        ...state,
        icon: "Image",
      };
    let value: Dynamic = runtime.PropertiesTooltipColorGradientConfig[input];
    return value === undefined
      ? {
          ...state,
          label: options,
        }
      : {
          ...state,
          label: (0, runtime.reactPropertiesTooltip_3.createElement)(
            runtime.reactPropertiesTooltip_3.Fragment,
            null,
            (0, runtime.reactPropertiesTooltip_3.createElement)(
              PropertyOptionIcon,
              {
                icon: value,
              },
            ),
            (0, runtime.reactPropertiesTooltip_3.createElement)(
              "span",
              {
                className: "sr-only",
              },
              options,
            ),
          ),
        };
  }
  function PropertyOptionIcon({
    icon: icon,
    className: className,
  }: Dynamic): Dynamic {
    let value: Dynamic = className ?? "shrink-0";
    return typeof icon == "string"
      ? (0, runtime.reactPropertiesTooltip_3.createElement)(runtime.Icon, {
          name: icon,
          size: "auto",
          className: value,
        })
      : (0, runtime.reactPropertiesTooltip_3.createElement)(runtime.Icon, {
          customIcon: icon,
          size: "auto",
          className: value,
        });
  }
  bindRuntimeValue(runtime, "toolSegmentOption", () => toolSegmentOption);
  bindRuntimeValue(runtime, "PropertyOptionIcon", () => PropertyOptionIcon);
  bindRuntimeValue(
    runtime,
    "reactPropertiesToolOptions",
    () => reactPropertiesToolOptions,
    (value) => {
      reactPropertiesToolOptions = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactPropertiesToolOptions_2",
    () => reactPropertiesToolOptions_2,
    (value) => {
      reactPropertiesToolOptions_2 = value;
    },
  );
  return () => {
    reactPropertiesToolOptions = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactPropertiesToolOptions_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
  };
}
