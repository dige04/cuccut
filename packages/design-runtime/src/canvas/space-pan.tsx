/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasSpacePan(runtime: RuntimeBindings): () => void {
  var react_GT: Dynamic;
  function isPanKeyboardInput(target?: Dynamic): Dynamic {
    let value: Dynamic = target;
    return (
      value != null &&
      typeof value.tagName == "string" &&
      (/^(INPUT|TEXTAREA|SELECT)$/.test(value.tagName) ||
        value.isContentEditable === true ||
        (0, runtime.isPropertyEditorTarget)(value))
    );
  }
  function createSpacePanKeyboardController(
    onHeldChange?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = options.blocked ?? runtime.hasBlockingEditorOverlay,
      flag: Dynamic = false,
      flag2: Dynamic = false,
      flag3: Dynamic = false,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        input || (flag2 = false);
        flag !== input && ((flag = input), onHeldChange(input));
      },
      callback2: Dynamic = (event?: Dynamic): Dynamic => {
        event.code !== "Space" ||
          value() ||
          isPanKeyboardInput(event.target) ||
          (!event.defaultPrevented &&
            (event.repeat ||
              flag3 ||
              !(0, runtime.isControlTarget)(event.target)) &&
            event.preventDefault(),
          !event.repeat && (callback(true), flag3 && (flag2 = true)));
      },
      callback3: Dynamic = (event?: Dynamic): Dynamic => {
        event.code === "Space" &&
          (flag && flag2 && event.preventDefault(), callback(false));
      },
      callback4: Dynamic = (): Dynamic => {
        flag3 = false;
      },
      callback5: Dynamic = (): Dynamic => {
        flag3 = false;
        callback(false);
      };
    (window as Dynamic).addEventListener("keydown", callback2);
    (window as Dynamic).addEventListener("keyup", callback3, true);
    (window as Dynamic).addEventListener("pointerup", callback4, true);
    (window as Dynamic).addEventListener("pointercancel", callback4, true);
    (window as Dynamic).addEventListener("blur", callback5);
    return {
      claimPan(): Dynamic {
        flag && (flag2 = flag3 = true);
        return flag;
      },
      dispose(): Dynamic {
        (window as Dynamic).removeEventListener("keydown", callback2);
        (window as Dynamic).removeEventListener("keyup", callback3, true);
        (window as Dynamic).removeEventListener("pointerup", callback4, true);
        (window as Dynamic).removeEventListener(
          "pointercancel",
          callback4,
          true,
        );
        (window as Dynamic).removeEventListener("blur", callback5);
      },
    };
  }
  function useSpacePanKeyboard(): Dynamic {
    let [value, value2]: Dynamic = (0, react_GT.useState)(false),
      value3: Dynamic = (0, react_GT.useRef)(false),
      value4: Dynamic = (0, react_GT.useRef)(null);
    (0, react_GT.useEffect)((): Dynamic => {
      let value6: Dynamic = createSpacePanKeyboardController(
        (input?: Dynamic): Dynamic => {
          value3.current = input;
          value2(input);
        },
      );
      value4.current = value6;
      return (): Dynamic => {
        value4.current = null;
        value6.dispose();
      };
    }, []);
    let value5: Dynamic = (0, react_GT.useCallback)(
      (): Dynamic => value4.current?.claimPan() ?? false,
      [],
    );
    return {
      held: value,
      heldRef: value3,
      claimPan: value5,
    };
  }
  bindRuntimeValue(
    runtime,
    "react_GT",
    () => react_GT,
    (value) => {
      react_GT = value;
    },
  );
  bindRuntimeValue(runtime, "isPanKeyboardInput", () => isPanKeyboardInput);
  bindRuntimeValue(
    runtime,
    "createSpacePanKeyboardController",
    () => createSpacePanKeyboardController,
  );
  bindRuntimeValue(runtime, "useSpacePanKeyboard", () => useSpacePanKeyboard);
  return () => {
    react_GT = (0, runtime.toModuleNamespace)((0, runtime.load_react)(), 1);
  };
}
