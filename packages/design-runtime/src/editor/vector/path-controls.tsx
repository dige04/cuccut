/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorVectorPathControls(
  runtime: RuntimeBindings,
): () => void {
  var VectorPathControlsLabel: Dynamic;
  var VectorPathControlsLabel_2: Dynamic;
  function VectorPathControls({
    path: path,
    selected: selected,
    draft: draft,
    hover: hover,
    view: view,
    hitRadiusPx: hitRadiusPx,
    controls: controls,
  }: Dynamic): Dynamic {
    let value: Dynamic = Math.max(3.5, hitRadiusPx * 0.45),
      items: Dynamic = [];
    path.contours.forEach((input?: Dynamic, options?: Dynamic): Dynamic => {
      input.anchors.forEach((input2?: Dynamic, options2?: Dynamic): Dynamic => {
        let value2: Dynamic = view.toScreen(input2),
          value3: Dynamic =
            selected &&
            selected.contour === options &&
            selected.anchor === options2,
          callback: Dynamic = (
            input3?: Dynamic,
            options3?: Dynamic,
            context?: Dynamic,
          ): Dynamic => {
            let value6: Dynamic = view.toScreen(input3),
              value7: Dynamic = view.toScreen(options3);
            items.push(
              <line
                key={context}
                x1={value7.x}
                y1={value7.y}
                x2={value6.x}
                y2={value6.y}
                stroke={VectorPathControlsLabel}
                strokeDasharray={"3 3"}
                opacity={0.7}
              />,
            );
          },
          callback2: Dynamic = (
            input3?: Dynamic,
            options3?: Dynamic,
            context?: Dynamic,
          ): Dynamic => {
            let value6: Dynamic = view.toScreen(input3),
              value7: Dynamic = value3 && selected.part === options3;
            items.push(
              <circle
                key={context}
                cx={value6.x}
                cy={value6.y}
                r={value7 ? value + 1 : value - 0.5}
                fill={
                  value7 ? VectorPathControlsLabel_2 : "var(--t-panel, #fff)"
                }
                stroke={
                  value7 ? VectorPathControlsLabel_2 : VectorPathControlsLabel
                }
                strokeWidth={1.25}
              />,
            );
          },
          value4: Dynamic = (0, runtime.previousContourAnchor)(input, options2),
          callback3: Dynamic = (input3?: Dynamic): Dynamic =>
            (0, runtime.showVectorControls)(
              controls,
              input,
              options,
              options2,
              input3,
              selected,
            );
        input2.seg.kind === "quad" && value4 && callback3("c")
          ? (callback(input2.seg.c, value4, `t${options}:${options2}a`),
            callback(input2.seg.c, input2, `t${options}:${options2}b`),
            callback2(input2.seg.c, "c", `q${options}:${options2}`))
          : input2.seg.kind === "cubic" &&
            value4 &&
            (callback3("c") &&
              (callback(input2.seg.c1, value4, `t${options}:${options2}a`),
              callback2(input2.seg.c1, "c", `c1${options}:${options2}`)),
            callback3("c2") &&
              (callback(input2.seg.c2, input2, `t${options}:${options2}b`),
              callback2(input2.seg.c2, "c2", `c2${options}:${options2}`)));
        let value5: Dynamic = value3 && selected.part === "anchor";
        items.push(
          <rect
            key={`a${options}:${options2}`}
            x={value2.x - (value5 ? value + 1 : value)}
            y={value2.y - (value5 ? value + 1 : value)}
            width={2 * (value5 ? value + 1 : value)}
            height={2 * (value5 ? value + 1 : value)}
            fill={value5 ? VectorPathControlsLabel_2 : "var(--t-panel, #fff)"}
            stroke={value5 ? VectorPathControlsLabel_2 : "var(--t-fg, #141413)"}
            strokeWidth={1.25}
          />,
        );
      });
    });
    if (draft.length > 0) {
      let value2: Dynamic = draft.map(
          (input?: Dynamic): Dynamic => view.toScreen(input),
        ),
        value3: Dynamic = value2[0],
        value4: Dynamic =
          "M" +
          value2
            .map((input?: Dynamic): Dynamic => `${input.x} ${input.y}`)
            .join(" L") +
          (hover
            ? ` L${view.toScreen(hover).x} ${view.toScreen(hover).y}`
            : "");
      items.push(
        <path
          key={"draft"}
          d={value4}
          fill={"none"}
          stroke={VectorPathControlsLabel_2}
          strokeWidth={1.5}
          strokeDasharray={"4 3"}
        />,
      );
      value3 &&
        draft.length >= 3 &&
        items.push(
          <circle
            key={"draft-close"}
            cx={value3.x}
            cy={value3.y}
            r={runtime.VectorPathEditingConstant}
            fill={"none"}
            stroke={VectorPathControlsLabel_2}
            strokeWidth={1.5}
          />,
        );
      for (let [value5, value6] of value2.entries() as Dynamic)
        items.push(
          <rect
            key={`d${value5}`}
            x={value6.x - value + 1}
            y={value6.y - value + 1}
            width={2 * value - 2}
            height={2 * value - 2}
            fill={VectorPathControlsLabel_2}
          />,
        );
    }
    return <g>{items}</g>;
  }
  bindRuntimeValue(
    runtime,
    "VectorPathControlsLabel",
    () => VectorPathControlsLabel,
    (value) => {
      VectorPathControlsLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VectorPathControlsLabel_2",
    () => VectorPathControlsLabel_2,
    (value) => {
      VectorPathControlsLabel_2 = value;
    },
  );
  bindRuntimeValue(runtime, "VectorPathControls", () => VectorPathControls);
  return () => {
    VectorPathControlsLabel = "var(--t-fg-muted, #73726c)";
    VectorPathControlsLabel_2 = "var(--t-app-accent, #2a78d6)";
  };
}
