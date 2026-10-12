import type {
  Point,
  Rectangle,
  ResizeHandle,
  Size,
} from "../../contracts/geometry";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../../runtime-types";
export function installEditorGeometryRotation(
  runtime: RuntimeBindings,
): () => void {
  function snapRotation(angle: number, snap15Degrees?: boolean): number {
    let snapped = snap15Degrees
        ? Math.round(angle / 15) * 15
        : Math.round(angle),
      rightAngle = Math.round(angle / 90) * 90;
    !snap15Degrees &&
      Math.abs(angle - rightAngle) <= 3 &&
      (snapped = rightAngle);
    snapped = ((snapped % 360) + 360) % 360;
    return snapped > 180 ? snapped - 360 : snapped;
  }
  function angleBetweenPoints(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  }
  function rotatePoint(point: Point, center: Point, degrees: number): Point {
    let value = (degrees * Math.PI) / 180,
      [items, items2, items3, items4] = [
        Math.cos(value),
        Math.sin(value),
        point.x - center.x,
        point.y - center.y,
      ];
    return {
      x: center.x + items3 * items - items4 * items2,
      y: center.y + items3 * items2 + items4 * items,
    };
  }
  function rotatedRectCorner(
    rect: Rectangle,
    degrees: number,
    area: Rectangle,
  ): boolean {
    let value = (degrees * Math.PI) / 180,
      [items, items2, items3, items4] = [
        Math.cos(value),
        Math.sin(value),
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
      ],
      value2 = [
        [-rect.w / 2, -rect.h / 2],
        [rect.w / 2, -rect.h / 2],
        [rect.w / 2, rect.h / 2],
        [-rect.w / 2, rect.h / 2],
      ].map(([input2, input3]) => ({
        x: items3 + input2! * items - input3! * items2,
        y: items4 + input2! * items2 + input3! * items,
      })),
      items5 = [
        {
          x: area.x,
          y: area.y,
        },
        {
          x: area.x + area.w,
          y: area.y,
        },
        {
          x: area.x + area.w,
          y: area.y + area.h,
        },
        {
          x: area.x,
          y: area.y + area.h,
        },
      ];
    for (let value3 of [
      {
        x: 1,
        y: 0,
      },
      {
        x: 0,
        y: 1,
      },
      {
        x: items,
        y: items2,
      },
      {
        x: -items2,
        y: items,
      },
    ]) {
      let callback: (points: readonly Point[]) => [number, number] = (
          input2,
        ) => {
          let [items6, items7] = [1 / 0, -1 / 0];
          for (let value8 of input2) {
            let value9 = value8.x * value3.x + value8.y * value3.y;
            [items6, items7] = [
              Math.min(items6, value9),
              Math.max(items7, value9),
            ];
          }
          return [items6, items7];
        },
        [value4, value5] = callback(value2),
        [value6, value7] = callback(items5);
      if (value5 < value6 || value7 < value4) return false;
    }
    return true;
  }
  function resizeRotatedRect(
    rect: Rectangle,
    degrees: number,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    min: Size,
    max: Size,
    keepAspect: boolean = false,
  ): Rectangle {
    let value2 = (degrees * Math.PI) / 180,
      [items, items2] = [Math.cos(value2), Math.sin(value2)],
      [items3, items4] = [dx * items + dy * items2, -dx * items2 + dy * items],
      value3 = keepAspect
        ? (0, runtime.resizeRectKeepingAspect)(
            rect,
            handle,
            items3,
            items4,
            min,
            max,
          )
        : (0, runtime.resizeRect)(rect, handle, items3, items4, min, max);
    if (!degrees) return value3;
    let [items5, items6] = [
        handle.x === "left" ? 1 : handle.x === "right" ? -1 : 0,
        handle.y === "top" ? 1 : handle.y === "bottom" ? -1 : 0,
      ],
      [items7, items8] = [(items5 * rect.w) / 2, (items6 * rect.h) / 2],
      [items9, items10] = [(items5 * value3.w) / 2, (items6 * value3.h) / 2],
      [items11, items12] = [rect.x + rect.w / 2, rect.y + rect.h / 2],
      [items13, items14] = [
        items11 + (items7 - items9) * items - (items8 - items10) * items2,
        items12 + (items7 - items9) * items2 + (items8 - items10) * items,
      ];
    return {
      x: items13 - value3.w / 2,
      y: items14 - value3.h / 2,
      w: value3.w,
      h: value3.h,
    };
  }
  bindRuntimeValue(runtime, "snapRotation", () => snapRotation);
  bindRuntimeValue(runtime, "angleBetweenPoints", () => angleBetweenPoints);
  bindRuntimeValue(runtime, "rotatePoint", () => rotatePoint);
  bindRuntimeValue(runtime, "rotatedRectCorner", () => rotatedRectCorner);
  bindRuntimeValue(runtime, "resizeRotatedRect", () => resizeRotatedRect);
  return () => {};
}
