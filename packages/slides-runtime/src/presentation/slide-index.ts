/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    presentationOrdersEqual: (
      left: readonly string[],
      right: readonly string[],
    ) => boolean;
    preservePresentationSlideIndex: (
      previousOrder: readonly string[],
      order: readonly string[],
      slideId: string | undefined,
      fallbackIndex: number,
    ) => number;
  }
}

export function installPresentationSlideIndex(
  runtime: RuntimeBindings,
): () => void {
  var presentationOrdersEqual: RuntimeBindings["presentationOrdersEqual"];
  function preservePresentationSlideIndex(
    previousOrder: readonly string[],
    order: readonly string[],
    slideId: string | undefined,
    fallbackIndex: number,
  ): number {
    if (order.length === 0) {
      return 0;
    }
    let clampIndex = (input: number): number =>
      Math.max(0, Math.min(order.length - 1, input));
    if (slideId === undefined) {
      return clampIndex(fallbackIndex);
    }
    let index = order.indexOf(slideId);
    if (index >= 0) {
      return index;
    }
    let previousIndex = previousOrder.indexOf(slideId);
    if (previousIndex < 0) {
      return clampIndex(fallbackIndex);
    }
    for (let count = 1; count < previousOrder.length; count++)
      for (let value of [previousIndex + count, previousIndex - count]) {
        if (value < 0 || value >= previousOrder.length) {
          continue;
        }
        let value2 = order.indexOf(previousOrder[value]!);
        if (value2 >= 0) {
          return value2;
        }
      }
    return clampIndex(fallbackIndex);
  }
  bindRuntimeValue(
    runtime,
    "preservePresentationSlideIndex",
    () => preservePresentationSlideIndex,
  );
  bindRuntimeValue(
    runtime,
    "presentationOrdersEqual",
    () => presentationOrdersEqual,
    (value) => {
      presentationOrdersEqual = value;
    },
  );
  return () => {
    presentationOrdersEqual = (
      left: readonly string[],
      right: readonly string[],
    ): boolean =>
      left.length === right.length &&
      left.every(
        (input: string, options: number): boolean => input === right[options],
      );
  };
}
