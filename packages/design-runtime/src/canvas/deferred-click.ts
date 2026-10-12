/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasDeferredClick(
  runtime: RuntimeBindings,
): () => void {
  function createDeferredPointerClick(
    onClick?: Dynamic,
    threshold: Dynamic = 3,
  ): Dynamic {
    let value: Dynamic = null,
      callback: Dynamic = (): Dynamic => {
        let value2: Dynamic = value;
        value = null;
        value2 !== null &&
          !value2.travelled &&
          onClick(
            {
              x: value2.x,
              y: value2.y,
            },
            value2.what,
          );
      };
    return {
      down: (input?: Dynamic, options?: Dynamic): Dynamic => {
        value = {
          x: input.clientX,
          y: input.clientY,
          id: input.pointerId,
          what: options,
          travelled: false,
          asked: false,
          up: false,
        };
      },
      move: (input?: Dynamic): Dynamic => {
        value !== null &&
          !value.up &&
          input.pointerId === value.id &&
          Math.hypot(input.clientX - value.x, input.clientY - value.y) >
            threshold &&
          (value.travelled = true);
      },
      end: (input?: Dynamic): Dynamic => {
        value === null ||
          value.up ||
          ((value.up = true),
          input || (value.travelled = true),
          value.asked && callback());
      },
      contextmenu: (): Dynamic =>
        value === null
          ? false
          : ((value.asked = true), value.up && callback(), true),
      clear: (): Dynamic => {
        value = null;
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "createDeferredPointerClick",
    () => createDeferredPointerClick,
  );
  return () => {};
}
