/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installEditorVectorElementPenEditor(
  runtime: RuntimeBindings,
): () => void {
  var VectorElementPenEditorLimit: Dynamic;
  var VectorElementPenEditorXYConfig: Dynamic;
  function ElementPenEditor({
    pen: pen,
    scale: scale,
    onPreview: onPreview,
    onCommitStroke: onCommitStroke,
    onGesture: onGesture,
  }: Dynamic): Dynamic {
    let value: Dynamic =
        pen.d + "|" + [pen.x, pen.y, pen.w, pen.h, pen.vbW, pen.vbH].join(","),
      [value2, value3]: Dynamic = (0,
      runtime.reactHooksLatestCallback_3.useState)(
        (): Dynamic => ({
          source: value,
          path: elementVectorPath(pen),
        }),
      );
    value2.source !== value &&
      value3({
        source: value,
        path: elementVectorPath(pen),
      });
    let value4: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(0),
      tid: Dynamic = pen.tid,
      value5: Dynamic = (0, runtime.reactHooksLatestCallback_3.useRef)(
        onPreview,
      );
    value5.current = onPreview;
    (0, runtime.reactHooksLatestCallback_3.useEffect)(
      (): Dynamic => (): Dynamic => {
        cancelAnimationFrame(value4.current);
        value5.current(tid, null);
      },
      [tid],
    );
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
        cancelAnimationFrame(value4.current);
        value4.current = requestAnimationFrame((): Dynamic => {
          onPreview(
            pen.tid,
            (0, runtime.serializeVectorPath)(
              (0, runtime.mapVectorPath)(
                input,
                (input2?: Dynamic): Dynamic => ({
                  x: ((input2.x - pen.x) * pen.vbW) / pen.w,
                  y: ((input2.y - pen.y) * pen.vbH) / pen.h,
                }),
              ),
              1,
            ),
          );
        });
      },
      callback2: Dynamic = (): Dynamic => {
        cancelAnimationFrame(value4.current);
        value3({
          source: value,
          path: elementVectorPath(pen),
        });
        onPreview(pen.tid, null);
      },
      callback3: Dynamic = (
        input?: Dynamic,
        options: Dynamic = false,
      ): Dynamic => {
        let value6: Dynamic = (0, runtime.serializeVectorPathBounds)(
          (0, runtime.mapVectorPath)(
            input,
            (input2?: Dynamic): Dynamic => ({
              x: input2.x * pen.kx,
              y: input2.y * pen.ky,
            }),
          ),
          1,
          !options,
        );
        return value6 &&
          /[LC]/.test(value6.d) &&
          value6.d.length <= VectorElementPenEditorLimit &&
          value6.w <= runtime.PlatformFileContentLimit_6 &&
          value6.h <= runtime.PlatformFileContentLimit_6
          ? value6
          : null;
      };
    return (
      <runtime.VectorPathEditor
        testId={"mega-pen-anchors-artboard"}
        path={value2.path}
        scale={scale}
        origin={VectorElementPenEditorXYConfig}
        onGesture={onGesture}
        onLive={(input?: Dynamic): Dynamic => {
          callback3(input) &&
            (value3(
              (input2?: Dynamic): Dynamic => ({
                ...input2,
                path: input,
              }),
            ),
            callback(input));
        }}
        onCommit={(
          input?: Dynamic,
          options?: Dynamic,
          context?: Dynamic,
        ): Dynamic => {
          cancelAnimationFrame(value4.current);
          let value6: Dynamic = callback3(options, context);
          if (!value6) return callback2();
          value3(
            (input2?: Dynamic): Dynamic => ({
              ...input2,
              path: options,
            }),
          );
          onCommitStroke(
            pen.tid,
            {
              x: value6.x / pen.kx,
              y: value6.y / pen.ky,
              w: Math.max(2, value6.w),
              h: Math.max(2, value6.h),
            },
            value6.d,
          );
        }}
        onCancel={callback2}
      />
    );
  }
  function elementVectorPath(input?: Dynamic): Dynamic {
    return (0, runtime.simplifyVectorPath)(
      input.d,
      {
        ox: input.x,
        oy: input.y,
        sx: input.w / input.vbW,
        sy: input.h / input.vbH,
      },
      VectorElementPenEditorLimit / Math.max(input.kx, input.ky, 1),
    );
  }
  bindRuntimeValue(
    runtime,
    "VectorElementPenEditorLimit",
    () => VectorElementPenEditorLimit,
    (value) => {
      VectorElementPenEditorLimit = value;
    },
  );
  bindRuntimeValue(runtime, "ElementPenEditor", () => ElementPenEditor);
  bindRuntimeValue(
    runtime,
    "VectorElementPenEditorXYConfig",
    () => VectorElementPenEditorXYConfig,
    (value) => {
      VectorElementPenEditorXYConfig = value;
    },
  );
  bindRuntimeValue(runtime, "elementVectorPath", () => elementVectorPath);
  return () => {
    VectorElementPenEditorLimit = 24e3;
    VectorElementPenEditorXYConfig = {
      x: 0,
      y: 0,
    };
  };
}
