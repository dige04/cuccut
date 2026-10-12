/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorVectorAnnotationPenEditor(
  runtime: RuntimeBindings,
): () => void {
  var VectorAnnotationPenEditorOverflowTouchActionConfig: Dynamic;
  var VectorAnnotationPenEditorConstant: Dynamic;
  var annotationVectorKey: Dynamic;
  function simplifyVectorPath(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
        Math.max(Math.abs(options.sx), Math.abs(options.sy)) || 1,
      value2: Dynamic = (0, runtime.parseVectorPath)(
        input,
        options,
        VectorAnnotationPenEditorConstant * value,
      );
    for (
      let value3: Dynamic = 2 * VectorAnnotationPenEditorConstant;
      value3 <= 64 * VectorAnnotationPenEditorConstant &&
      /L/.test(input) &&
      ((0, runtime.serializeVectorPathBounds)(value2, 1)?.d.length ?? 0) >
        context;
      value3 *= 2
    )
      value2 = (0, runtime.parseVectorPath)(input, options, value3 * value);
    return value2;
  }
  function AnnotationPenEditor({
    spec: spec,
    ext: ext2,
    scale: scale,
    onChange: onChange,
    onGesture: onGesture,
    armWindowGestureEnd: armWindowGestureEnd,
  }: Dynamic): Dynamic {
    let value: Dynamic = annotationVectorKey(spec),
      [value2, value3]: Dynamic = (0,
      runtime.reactHooksLatestCallback_3.useState)(
        (): Dynamic => ({
          source: value,
          path: annotationVectorPath(spec, ext2),
        }),
      );
    value2.source !== value &&
      value3({
        source: value,
        path: annotationVectorPath(spec, ext2),
      });
    let value4: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(null),
      callback: Dynamic = (input?: Dynamic): Dynamic => ({
        x: input.x,
        y: input.y,
        w: Math.max(runtime.PlatformFileContentConstant_19, input.w),
        h: Math.max(runtime.PlatformFileContentConstant_19, input.h),
        d: input.d,
      }),
      callback2: Dynamic = (
        input?: Dynamic,
        options?: Dynamic,
        context?: Dynamic,
      ): Dynamic => {
        value3({
          source: annotationVectorKey(input),
          path: options,
        });
        onChange(input, context);
      },
      callback3: Dynamic = (): Dynamic => {
        let value5: Dynamic = value4.current ?? {
          x: spec.x,
          y: spec.y,
          w: spec.w,
          h: spec.h,
          d: spec.d,
        };
        value3({
          source: annotationVectorKey(value5),
          path: annotationVectorPath(value5, annotationPenViewBox(value5)),
        });
        onChange(value5, false);
      },
      callback4: Dynamic = (
        input?: Dynamic,
        options: Dynamic = false,
      ): Dynamic => {
        let value5: Dynamic = (0, runtime.serializeVectorPathBounds)(
          input,
          1,
          !options,
        );
        return !value5 ||
          value5.w > runtime.PlatformFileContentLimit_6 ||
          value5.h > runtime.PlatformFileContentLimit_6 ||
          (0, runtime.PlatformFileContentTrim_2)(value5.d) === null
          ? null
          : {
              ...value5,
              x: Math.round(value5.x * 10) / 10,
              y: Math.round(value5.y * 10) / 10,
            };
      };
    return (
      <runtime.VectorPathEditor
        testId={"mega-pen-anchors-" + spec.id}
        path={value2.path}
        scale={scale}
        origin={{
          x: spec.x,
          y: spec.y,
        }}
        onGesture={(input?: Dynamic): Dynamic => {
          value4.current = input
            ? {
                x: spec.x,
                y: spec.y,
                w: spec.w,
                h: spec.h,
                d: spec.d,
              }
            : null;
          onGesture("ann-anchor", input);
          input && armWindowGestureEnd("ann-anchor");
        }}
        onLive={(input?: Dynamic): Dynamic => {
          let value5: Dynamic = callback4(input);
          value5 && callback2(callback(value5), input, false);
        }}
        onCommit={(
          input?: Dynamic,
          options?: Dynamic,
          context?: Dynamic,
        ): Dynamic => {
          let value5: Dynamic = callback4(options, context);
          if (!value5) return callback3();
          let value6: Dynamic = callback(value5);
          callback2(
            value6,
            annotationVectorPath(value6, annotationPenViewBox(value6)),
            true,
          );
        }}
        onCancel={callback3}
      />
    );
  }
  function annotationPenViewBox(input?: Dynamic): Dynamic {
    let value: Dynamic = (input.d.match(/\d+(?:\.\d+)?/g) ?? []).map(Number),
      [items, items2]: Dynamic = [1, 1];
    for (let index: Dynamic = 0; index + 1 < value.length; index += 2)
      [items, items2] = [
        Math.max(items, value[index]),
        Math.max(items2, value[index + 1]),
      ];
    return {
      w: items,
      h: items2,
    };
  }
  function annotationVectorPath(input?: Dynamic, options?: Dynamic): Dynamic {
    return simplifyVectorPath(
      input.d,
      {
        ox: input.x,
        oy: input.y,
        sx: input.w / options.w,
        sy: input.h / options.h,
      },
      runtime.PlatformFileContentLimit_7,
    );
  }
  bindRuntimeValue(
    runtime,
    "VectorAnnotationPenEditorOverflowTouchActionConfig",
    () => VectorAnnotationPenEditorOverflowTouchActionConfig,
    (value) => {
      VectorAnnotationPenEditorOverflowTouchActionConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "VectorAnnotationPenEditorConstant",
    () => VectorAnnotationPenEditorConstant,
    (value) => {
      VectorAnnotationPenEditorConstant = value;
    },
  );
  bindRuntimeValue(runtime, "simplifyVectorPath", () => simplifyVectorPath);
  bindRuntimeValue(
    runtime,
    "annotationVectorKey",
    () => annotationVectorKey,
    (value) => {
      annotationVectorKey = value;
    },
  );
  bindRuntimeValue(runtime, "AnnotationPenEditor", () => AnnotationPenEditor);
  bindRuntimeValue(runtime, "annotationPenViewBox", () => annotationPenViewBox);
  bindRuntimeValue(runtime, "annotationVectorPath", () => annotationVectorPath);
  return () => {
    VectorAnnotationPenEditorOverflowTouchActionConfig = {
      overflow: "visible",
      touchAction: "none",
    };
    VectorAnnotationPenEditorConstant = 1.25;
    annotationVectorKey = (input?: Dynamic): Dynamic =>
      [input.x, input.y, input.w, input.h].join(",") + "|" + input.d;
  };
}
