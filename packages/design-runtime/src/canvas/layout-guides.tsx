/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasLayoutGuides(
  runtime: RuntimeBindings,
): () => void {
  var react__kt: Dynamic;
  var jsx_MN: Dynamic;
  var ArtboardLayoutGuides: Dynamic;
  function SquareGridGuide({ size: size, color: color }: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.useViewportStore)(),
      value2: Dynamic = (0, runtime.sanitizeCssColor)(color),
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        `linear-gradient(${input}, ${value2} calc(1px / var(--mega-scale, 1)), transparent calc(1px / var(--mega-scale, 1)))`;
    return (
      <div
        ref={value.stamp}
        className={"absolute inset-0"}
        style={{
          opacity: `clamp(0, (${size} * var(--mega-scale, 1) - 3) / 4, 1)`,
          backgroundImage: callback("to right") + ", " + callback("to bottom"),
          backgroundSize: `${size}px ${size}px`,
        }}
      />
    );
  }
  function RowColumnLayoutGuide({ r: r8 }: Dynamic): Dynamic {
    let value: Dynamic = r8.kind === "columns",
      value2: Dynamic = (0, runtime.sanitizeCssColor)(r8.color),
      value3: Dynamic = value ? "to right" : "to bottom";
    if (r8.align === "stretch") {
      let value7: Dynamic = `calc((100% + ${r8.gutter}px) / ${r8.count})`;
      return (
        <div
          className={"absolute inset-0"}
          style={{
            padding: value ? `0 ${r8.margin}px` : `${r8.margin}px 0`,
            backgroundOrigin: "content-box",
            backgroundClip: "content-box",
            backgroundRepeat: value ? "repeat-x" : "repeat-y",
            backgroundImage: `linear-gradient(${value3}, ${value2} calc(100% - ${r8.gutter}px), transparent calc(100% - ${r8.gutter}px))`,
            backgroundSize: value ? `${value7} 100%` : `100% ${value7}`,
          }}
        />
      );
    }
    let value4: Dynamic = r8.count * r8.size + (r8.count - 1) * r8.gutter,
      value5: Dynamic =
        r8.align === "center"
          ? `calc(50% - ${value4 / 2}px)`
          : `${r8.offset}px`,
      value6: Dynamic = value
        ? {
            top: 0,
            bottom: 0,
            width: value4,
            ...(r8.align === "end"
              ? {
                  right: value5,
                }
              : {
                  left: value5,
                }),
          }
        : {
            left: 0,
            right: 0,
            height: value4,
            ...(r8.align === "end"
              ? {
                  bottom: value5,
                }
              : {
                  top: value5,
                }),
          };
    return (
      <div
        className={"absolute"}
        style={{
          ...value6,
          backgroundRepeat: value ? "repeat-x" : "repeat-y",
          backgroundImage: `linear-gradient(${value3}, ${value2} ${r8.size}px, transparent ${r8.size}px)`,
          backgroundSize: value
            ? `${r8.size + r8.gutter}px 100%`
            : `100% ${r8.size + r8.gutter}px`,
        }}
      />
    );
  }
  bindRuntimeValue(
    runtime,
    "react__kt",
    () => react__kt,
    (value) => {
      react__kt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_MN",
    () => jsx_MN,
    (value) => {
      jsx_MN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ArtboardLayoutGuides",
    () => ArtboardLayoutGuides,
    (value) => {
      ArtboardLayoutGuides = value;
    },
  );
  bindRuntimeValue(runtime, "SquareGridGuide", () => SquareGridGuide);
  bindRuntimeValue(runtime, "RowColumnLayoutGuide", () => RowColumnLayoutGuide);
  return () => {
    react__kt = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    jsx_MN = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    ArtboardLayoutGuides = (0, react__kt.memo)(function ({
      guides: guides,
      w: w,
      h: h,
    }: Dynamic): Dynamic {
      return (
        <div
          aria-hidden={"true"}
          className={
            "pointer-events-none absolute inset-0 z-[12] overflow-hidden"
          }
        >
          {guides.map((input?: Dynamic, options?: Dynamic): Dynamic => {
            if (input.hidden === true) return null;
            let value: Dynamic = (0, runtime.resolveArtboardGuide)(input, {
              w: w,
              h: h,
            });
            return value.kind === "grid" ? (
              <SquareGridGuide
                key={options}
                size={value.size}
                color={value.color}
              />
            ) : (
              <RowColumnLayoutGuide key={options} r={value} />
            );
          })}
        </div>
      );
    });
  };
}
