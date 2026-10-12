/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorHooksElementAndDismissal(
  runtime: RuntimeBindings,
): () => void {
  var reactHooksElementAndDismissal: Dynamic;
  var reactHooksElementAndDismissal_2: Dynamic;
  var HooksElementAndDismissalSubscribers: Dynamic;
  function useElementById(input?: Dynamic): Dynamic {
    let [value, value2]: Dynamic = (0, reactHooksElementAndDismissal.useState)(
      (): Dynamic => (document as Dynamic).getElementById(input),
    );
    (0, reactHooksElementAndDismissal.useLayoutEffect)((): Dynamic => {
      let value3: Dynamic = (document as Dynamic).getElementById(input);
      value2(
        (input2?: Dynamic): Dynamic => (input2 === value3 ? input2 : value3),
      );
    });
    return value;
  }
  function useLiveDismissalGuard(input?: Dynamic): Dynamic {
    let value: Dynamic = (0, reactHooksElementAndDismissal_2.useRef)(input);
    value.current = input;
    (0, reactHooksElementAndDismissal_2.useEffect)((): Dynamic => {
      let callback: Dynamic = (): Dynamic =>
        typeof value.current == "function" ? value.current() : value.current;
      HooksElementAndDismissalSubscribers.add(callback);
      return (): Dynamic => {
        HooksElementAndDismissalSubscribers.delete(callback);
      };
    }, []);
    (0, runtime.npm_useEventListener_bc)(
      "beforeunload",
      (event?: Dynamic): Dynamic => {
        (typeof input == "function" ? input() : input) &&
          (event.preventDefault(), (event.returnValue = ""));
      },
    );
  }
  bindRuntimeValue(
    runtime,
    "reactHooksElementAndDismissal",
    () => reactHooksElementAndDismissal,
    (value) => {
      reactHooksElementAndDismissal = value;
    },
  );
  bindRuntimeValue(runtime, "useElementById", () => useElementById);
  bindRuntimeValue(
    runtime,
    "reactHooksElementAndDismissal_2",
    () => reactHooksElementAndDismissal_2,
    (value) => {
      reactHooksElementAndDismissal_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HooksElementAndDismissalSubscribers",
    () => HooksElementAndDismissalSubscribers,
    (value) => {
      HooksElementAndDismissalSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useLiveDismissalGuard",
    () => useLiveDismissalGuard,
  );
  return () => {
    reactHooksElementAndDismissal = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    reactHooksElementAndDismissal_2 = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react)(),
      1,
    );
    (0, runtime.initializeNpm_usehooks_ts_p0)();
    HooksElementAndDismissalSubscribers = new Set();
  };
}
