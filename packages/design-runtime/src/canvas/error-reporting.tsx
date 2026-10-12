/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasErrorReporting(
  runtime: RuntimeBindings,
): () => void {
  var react_MCt: Dynamic;
  var artboardErrorReportDelayMs: Dynamic;
  var scheduleArtboardErrorReport: Dynamic;
  var artboardErrorReporter: Dynamic;
  function createArtboardErrorReporter(options?: Dynamic): Dynamic {
    if (options.hosted)
      return {
        shown(): Dynamic {},
      };
    let flag: Dynamic = false,
      flag2: Dynamic = false,
      flag3: Dynamic = false,
      value: Dynamic,
      value2: Dynamic,
      value3: Dynamic,
      callback: Dynamic = (): Dynamic => {
        flag && !flag2 && !flag3
          ? (value2 ??= options.after(
              artboardErrorReportDelayMs,
              (): Dynamic => {
                flag3 = true;
                value3?.();
                options.report(...runtime.ExportOutcomesOpenAbortedValues);
              },
            ))
          : (value2?.(), (value2 = undefined));
      },
      callback2: Dynamic = (): Dynamic => {
        options.activity.get() === "working"
          ? (value?.(), (value = undefined), (flag2 = true))
          : flag2 &&
            (value ??= options.after(
              runtime.CanvasWorkingStateConstant,
              (): Dynamic => {
                value = undefined;
                flag2 = false;
                callback();
              },
            ));
        callback();
      };
    return {
      shown(input: Dynamic): Dynamic {
        flag3 ||
          ((flag = input),
          flag && (value3 ??= options.activity.subscribe(callback2)),
          callback2());
      },
    };
  }
  function useArtboardErrorReporting(shown?: Dynamic): Dynamic {
    (0, react_MCt.useEffect)((): Dynamic => {
      artboardErrorReporter ??= createArtboardErrorReporter({
        hosted: (0, runtime.embedMemoryPrefix)() !== "",
        activity: runtime.claudeActivityStore,
        after: scheduleArtboardErrorReport,
        report: (...input: Dynamic[]): Dynamic =>
          runtime.healthReporter.report(...input),
      });
      let value: Dynamic = artboardErrorReporter;
      value.shown(shown);
      return (): Dynamic => value.shown(false);
    }, [shown]);
  }
  bindRuntimeValue(
    runtime,
    "react_MCt",
    () => react_MCt,
    (value) => {
      react_MCt = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardErrorReportDelayMs",
    () => artboardErrorReportDelayMs,
    (value) => {
      artboardErrorReportDelayMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createArtboardErrorReporter",
    () => createArtboardErrorReporter,
  );
  bindRuntimeValue(
    runtime,
    "scheduleArtboardErrorReport",
    () => scheduleArtboardErrorReport,
    (value) => {
      scheduleArtboardErrorReport = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardErrorReporter",
    () => artboardErrorReporter,
    (value) => {
      artboardErrorReporter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useArtboardErrorReporting",
    () => useArtboardErrorReporting,
  );
  return () => {
    react_MCt = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
    artboardErrorReportDelayMs = 5e3;
    scheduleArtboardErrorReport = (
      input?: Dynamic,
      options?: Dynamic,
    ): Dynamic => {
      let value: Dynamic = setTimeout(options, input);
      return (): Dynamic => clearTimeout(value);
    };
  };
}
