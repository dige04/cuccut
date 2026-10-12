/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFindNavigationOrigin(
  runtime: RuntimeBindings,
): () => void {
  function findReturnToScope(state?: Dynamic): Dynamic {
    return state.crossPage
      ? "page"
      : state.findShowed === null
        ? "canvas"
        : (0, runtime.isCompatibleFindCameraGlide)(state.now, {
              from: state.findShowed,
              to: state.findShowed,
            }) ||
            (state.glide !== null &&
              (0, runtime.isCompatibleFindCameraGlide)(state.now, state.glide))
          ? "fit"
          : "canvas";
  }
  function createFindNavigationOriginTracker(): Dynamic {
    let value: Dynamic = null;
    return {
      showedPage(input: Dynamic, options: Dynamic): Dynamic {
        value = {
          page: input,
          view: options,
        };
      },
      pageIs(input: Dynamic): Dynamic {
        value !== null && value.page !== input && (value = null);
      },
      pansFrom(input: Dynamic, options: Dynamic): Dynamic {
        value !== null &&
          findReturnToScope({
            crossPage: false,
            findShowed: value.view,
            glide: options,
            now: input,
          }) === "canvas" &&
          (value = null);
      },
      opensWindow(
        input: Dynamic,
        options: Dynamic,
        context: Dynamic,
        value2: Dynamic,
      ): Dynamic {
        return findReturnToScope({
          crossPage: options,
          findShowed:
            value !== null && value.page === input ? value.view : null,
          glide: value2,
          now: context,
        });
      },
    };
  }
  bindRuntimeValue(runtime, "findReturnToScope", () => findReturnToScope);
  bindRuntimeValue(
    runtime,
    "createFindNavigationOriginTracker",
    () => createFindNavigationOriginTracker,
  );
  return () => {};
}
