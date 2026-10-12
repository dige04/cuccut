/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCanvasMeasurements(
  runtime: RuntimeBindings,
): () => void {
  var reactCanvasMeasurements: Dynamic;
  var reactCanvasMeasurements_2: Dynamic;
  var SaveNowValue: Dynamic;
  var OpenFindValue: Dynamic;
  var CanvasMeasurementsPattern: Dynamic;
  var CanvasMeasurementsIsSafeInteger: Dynamic;
  var CanvasMeasurementsConstant: Dynamic;
  var CanvasMeasurementsPattern_2: Dynamic;
  var CanvasMeasurementsConstant_2: Dynamic;
  var CanvasMeasurementsAZaZPattern: Dynamic;
  var CanvasMeasurementsPattern_3: Dynamic;
  var CanvasMeasurementsConstant_3: Dynamic;
  var CanvasMeasurementsConstant_4: Dynamic;
  var CanvasMeasurementsPattern_4: Dynamic;
  function MeasurementOverlay({ m: m, scale: scale }: Dynamic): Dynamic {
    return (
      <runtime.jsxCanvasNote.Fragment>
        <svg
          data-testid={"measure-overlay"}
          aria-hidden={"true"}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            overflow: "visible",
            pointerEvents: "none",
          }}
          width={1}
          height={1}
        >
          {m.lines.map(
            (input?: Dynamic, options?: Dynamic): Dynamic =>
              (() => {
                const _Component = "line";
                const _props = {
                  x1: input.x1,
                  y1: input.y1,
                  x2: input.x2,
                  y2: input.y2,
                  style: {
                    stroke: "var(--t-measure)",
                    strokeWidth: 1 / scale,
                    strokeDasharray: input.ext
                      ? String(3 / scale) + " " + String(3 / scale)
                      : undefined,
                    opacity: input.ext ? 0.6 : 1,
                  },
                } as const;
                const _key = "ml" + String(options);
                return <_Component key={_key} {..._props} />;
              })(),
          )}
        </svg>
        {m.labels.map(
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            (() => {
              const _Component2 = "div";
              const _props2 = {
                "data-testid": "measure-label",
                "aria-hidden": "true",
                style: {
                  position: "absolute",
                  left: input.x,
                  top: input.y,
                  transform:
                    input.axis === "x"
                      ? "translate(-50%, " + String(5 / scale) + "px)"
                      : "translate(" + String(5 / scale) + "px, -50%)",
                  background: "var(--t-measure)",
                  color: "#FFFFFF",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 11 / scale,
                  lineHeight: 1.4,
                  fontVariantNumeric: "tabular-nums",
                  padding: String(1 / scale) + "px " + String(5 / scale) + "px",
                  borderRadius: 4 / scale,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                },
                children: input.text,
              } as const;
              const _key2 = "mt" + String(options);
              return <_Component2 key={_key2} {..._props2} />;
            })(),
        )}
      </runtime.jsxCanvasNote.Fragment>
    );
  }
  bindRuntimeValue(runtime, "MeasurementOverlay", () => MeasurementOverlay);
  bindRuntimeValue(
    runtime,
    "reactCanvasMeasurements",
    () => reactCanvasMeasurements,
    (value) => {
      reactCanvasMeasurements = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "reactCanvasMeasurements_2",
    () => reactCanvasMeasurements_2,
    (value) => {
      reactCanvasMeasurements_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SaveNowValue",
    () => SaveNowValue,
    (value) => {
      SaveNowValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OpenFindValue",
    () => OpenFindValue,
    (value) => {
      OpenFindValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsPattern",
    () => CanvasMeasurementsPattern,
    (value) => {
      CanvasMeasurementsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsIsSafeInteger",
    () => CanvasMeasurementsIsSafeInteger,
    (value) => {
      CanvasMeasurementsIsSafeInteger = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsConstant",
    () => CanvasMeasurementsConstant,
    (value) => {
      CanvasMeasurementsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsPattern_2",
    () => CanvasMeasurementsPattern_2,
    (value) => {
      CanvasMeasurementsPattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsConstant_2",
    () => CanvasMeasurementsConstant_2,
    (value) => {
      CanvasMeasurementsConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsAZaZPattern",
    () => CanvasMeasurementsAZaZPattern,
    (value) => {
      CanvasMeasurementsAZaZPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsPattern_3",
    () => CanvasMeasurementsPattern_3,
    (value) => {
      CanvasMeasurementsPattern_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsConstant_3",
    () => CanvasMeasurementsConstant_3,
    (value) => {
      CanvasMeasurementsConstant_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsConstant_4",
    () => CanvasMeasurementsConstant_4,
    (value) => {
      CanvasMeasurementsConstant_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasMeasurementsPattern_4",
    () => CanvasMeasurementsPattern_4,
    (value) => {
      CanvasMeasurementsPattern_4 = value;
    },
  );
  return () => {
    reactCanvasMeasurements = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeCdsIndex)();
    reactCanvasMeasurements_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    SaveNowValue = "save_now";
    OpenFindValue = "open_find";
    CanvasMeasurementsPattern = /^[a-z0-9]{1,8}$/;
    CanvasMeasurementsIsSafeInteger = (input?: Dynamic): Dynamic =>
      typeof input == "number" &&
      Number.isSafeInteger(input) &&
      input > 5e3 &&
      input <= 15 * 6e4
        ? input
        : undefined;
    CanvasMeasurementsConstant = 8;
    CanvasMeasurementsPattern_2 = /^[a-z][a-z0-9_-]{0,31}$/;
    CanvasMeasurementsConstant_2 = 8;
    CanvasMeasurementsAZaZPattern = /^[A-Za-z0-9_-]{16,64}$/;
    CanvasMeasurementsPattern_3 = /^[a-z][a-z0-9_-]{0,31}$/;
    CanvasMeasurementsConstant_3 = 8;
    CanvasMeasurementsConstant_4 = 9999;
    CanvasMeasurementsPattern_4 = /^#[0-9a-f]{6}$/;
  };
}
