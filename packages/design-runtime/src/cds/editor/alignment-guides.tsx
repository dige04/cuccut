/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsEditorAlignmentGuides(
  runtime: RuntimeBindings,
): () => void {
  var reactEditorAlignmentGuides: Dynamic;
  var jsxEditorAlignmentGuides: Dynamic;
  var AlignmentGuides: Dynamic;
  var initializeEditorAlignmentGuides: Dynamic;
  bindRuntimeValue(
    runtime,
    "reactEditorAlignmentGuides",
    () => reactEditorAlignmentGuides,
    (value) => {
      reactEditorAlignmentGuides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxEditorAlignmentGuides",
    () => jsxEditorAlignmentGuides,
    (value) => {
      jsxEditorAlignmentGuides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "AlignmentGuides",
    () => AlignmentGuides,
    (value) => {
      AlignmentGuides = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEditorAlignmentGuides",
    () => initializeEditorAlignmentGuides,
    (value) => {
      initializeEditorAlignmentGuides = value;
    },
  );
  return () => {
    initializeEditorAlignmentGuides = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeClassNames)();
        (0, runtime.initializeEditorSelectionGeometry)();
        reactEditorAlignmentGuides = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        jsxEditorAlignmentGuides = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        AlignmentGuides = (0, reactEditorAlignmentGuides.forwardRef)(function (
          {
            guides: guides,
            scale = 1,
            className: className,
            style: style,
            ...props
          }: Dynamic,
          options?: Dynamic,
        ): Dynamic {
          let value: Dynamic = (0, runtime.normalizeSelectionScale)(scale),
            guide: Dynamic = runtime.selectionMetrics.guide,
            value2: Dynamic = 1 / value;
          return (
            <div
              {...props}
              ref={options}
              data-cds={"AlignmentGuides"}
              aria-hidden={"true"}
              className={(0, runtime.cn)("absolute inset-0", className)}
              style={{
                ...style,
                pointerEvents: "none",
              }}
            >
              {guides.map(
                (input?: Dynamic, options2?: Dynamic): Dynamic =>
                  (() => {
                    const _Component = "span";
                    const _props = {
                      "data-axis": input.axis,
                      children: [
                        <span
                          data-guide-line={""}
                          className={"absolute block bg-fill-accent"}
                          style={
                            input.axis === "x"
                              ? {
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: guide,
                                  transformOrigin: "0 0",
                                  transform: `translateX(${input.pos}px) scaleX(${value2})`,
                                  pointerEvents: "none",
                                }
                              : {
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  height: guide,
                                  transformOrigin: "0 0",
                                  transform: `translateY(${input.pos}px) scaleY(${value2})`,
                                  pointerEvents: "none",
                                }
                          }
                        />,
                        input.label !== undefined ? (
                          <runtime.SelectionPoint
                            data-guide-label={""}
                            scale={value}
                            anchor={"start"}
                            at={
                              input.axis === "x"
                                ? {
                                    left: input.pos + 6 / value,
                                    top: 8 / value,
                                  }
                                : {
                                    left: 8 / value,
                                    top: input.pos + 6 / value,
                                  }
                            }
                          >
                            {input.label}
                          </runtime.SelectionPoint>
                        ) : null,
                      ],
                    } as const;
                    const _key = `${input.axis}-${input.pos}-${options2}`;
                    return <_Component key={_key} {..._props} />;
                  })(),
              )}
            </div>
          );
        });
        AlignmentGuides.displayName = "AlignmentGuides";
      },
    );
  };
}
