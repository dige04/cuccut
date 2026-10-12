/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorSvgArrowProperties(
  runtime: RuntimeBindings,
): () => void {
  var SvgArrowPropertiesHeadStartHeadEndConfig: Dynamic;
  var SvgArrowPropertiesNoneOpenFilledConfig: Dynamic;
  var SvgArrowPropertiesLabel: Dynamic;
  var SvgArrowPropertiesLabel_2: Dynamic;
  function findSvgShaft(input?: Dynamic, options?: Dynamic): Dynamic {
    let state: Dynamic = {
        defs: 1,
        marker: 1,
        metadata: 1,
        title: 1,
        desc: 1,
        style: 1,
      },
      callback: Dynamic = (input2?: Dynamic): Dynamic => {
        for (let index: Dynamic = 0; index < input2.children.length; index++) {
          let value: Dynamic = input2.children[index],
            value2: Dynamic = (value.tagName || "").toLowerCase();
          if (
            !(state[value2] === 1 || options(value)) &&
            !(value2 === "g" && callback(value))
          )
            return false;
        }
        return true;
      };
    return callback(input);
  }
  function arrowHeadPropertyRows(input?: Dynamic): Dynamic {
    let heads: Dynamic = input.heads;
    return heads
      ? ["__headStart", "__headEnd"].map((input2?: Dynamic): Dynamic => {
          let value: Dynamic =
              heads[input2 === "__headStart" ? "start" : "end"],
            value2: Dynamic = SvgArrowPropertiesHeadStartHeadEndConfig[input2];
          return {
            prop: input2,
            label: value2,
            spec: {
              prop: input2,
              label: value2,
              editor: "flexSeg",
              section: "stroke",
              options: Object.keys(SvgArrowPropertiesNoneOpenFilledConfig),
              optionLabels: SvgArrowPropertiesNoneOpenFilledConfig,
            },
            value: value === "unknown" ? null : value,
            disabled: input.disabled || heads.width == null,
            ...(heads.width == null && !input.disabled
              ? {
                  whyDisabled: SvgArrowPropertiesLabel,
                }
              : {}),
          };
        })
      : [];
  }
  bindRuntimeValue(runtime, "findSvgShaft", () => findSvgShaft);
  bindRuntimeValue(
    runtime,
    "SvgArrowPropertiesHeadStartHeadEndConfig",
    () => SvgArrowPropertiesHeadStartHeadEndConfig,
    (value) => {
      SvgArrowPropertiesHeadStartHeadEndConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowPropertiesNoneOpenFilledConfig",
    () => SvgArrowPropertiesNoneOpenFilledConfig,
    (value) => {
      SvgArrowPropertiesNoneOpenFilledConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowPropertiesLabel",
    () => SvgArrowPropertiesLabel,
    (value) => {
      SvgArrowPropertiesLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SvgArrowPropertiesLabel_2",
    () => SvgArrowPropertiesLabel_2,
    (value) => {
      SvgArrowPropertiesLabel_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "arrowHeadPropertyRows",
    () => arrowHeadPropertyRows,
  );
  return () => {
    SvgArrowPropertiesHeadStartHeadEndConfig = {
      __headStart: "Start",
      __headEnd: "End",
    };
    SvgArrowPropertiesNoneOpenFilledConfig = {
      none: "None",
      open: "Open",
      filled: "Filled",
    };
    SvgArrowPropertiesLabel =
      "To choose an arrowhead, first type a Thickness in px";
    SvgArrowPropertiesLabel_2 =
      "To choose an arrowhead, first give every selected line a Thickness in px";
  };
}
