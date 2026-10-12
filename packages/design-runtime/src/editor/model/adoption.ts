/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorModelAdoption(
  runtime: RuntimeBindings,
): () => void {
  function adoptModelAndRelocateSelection(input?: Dynamic): Dynamic {
    let value: Dynamic = null,
      value2: Dynamic;
    try {
      input.adopt();
      value2 = input.own();
      if (value2 === undefined || value2 === input.prev) return;
      let prev: Dynamic = input.prev,
        value3: Dynamic = value2;
      prev &&
        (value = (input2?: Dynamic): Dynamic =>
          (0, runtime.relocateModelElementIds)(prev, value3, input2));
    } catch (value3: Dynamic) {
      input.log("the selection could not be followed and is dropped", value3);
    }
    try {
      input.pending.drop();
      let value3: Dynamic = value2;
      input.tellHost(
        value,
        !value3 || input.heldElsewhere()
          ? null
          : (input2?: Dynamic, options?: Dynamic): Dynamic =>
              input.pending.arm(
                options,
                (0, runtime.modelSelectionIdentityGuard)(value3, input2),
              ),
      );
    } catch (value3: Dynamic) {
      input.log("the host could not correct its selection", value3);
    }
  }
  bindRuntimeValue(
    runtime,
    "adoptModelAndRelocateSelection",
    () => adoptModelAndRelocateSelection,
  );
  return () => {};
}
