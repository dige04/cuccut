import type {
  AffineTuple,
  AffineTransform,
  ContainerPoint,
  PreviewHandle,
} from "../contracts/geometry";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installGeometryInsertionTransform(
  runtime: RuntimeBindings,
): () => void {
  function measureInsertionContainerTransform(
    componentName: string,
    templateId: number,
    clientX: number,
    clientY: number,
  ): AffineTuple | null {
    function value(element: Element): string | null {
      let value5 = element.hasAttribute("data-sc-name")
          ? element.parentElement
          : element,
        value6 = value5 ? value5.closest("[data-sc-name]") : null;
      return value6 ? value6.getAttribute("data-sc-name") : null;
    }
    let value2 = document.querySelectorAll(
        '[data-dc-tpl="' + String(templateId) + '"]',
      ),
      value3: Element | null = null;
    for (let index = 0; index < value2.length && !value3; index++)
      value(value2[index]!) === componentName &&
        !value2[index]!.closest("[data-dc-editor-overlay]") &&
        (value3 = value2[index]!);
    if (!value3) return null;
    let value4 = getComputedStyle(value3),
      bounds = value3.getBoundingClientRect();
    if (
      /hidden|clip|scroll|auto/.test(
        value4.overflowX + " " + value4.overflowY,
      ) &&
      (clientX < bounds.left ||
        clientX > bounds.right ||
        clientY < bounds.top ||
        clientY > bounds.bottom)
    )
      return null;
    let items = [
        [0, 0],
        [100, 0],
        [0, 100],
        [100, 100],
      ],
      items2: HTMLDivElement[] = [];
    try {
      for (let index = 0; index < items.length; index++) {
        let value10 = document.createElement("div");
        value10.style.cssText =
          "all:initial!important;display:block!important;position:absolute!important;left:" +
          String(items[index]![0]) +
          "px!important;top:" +
          String(items[index]![1]) +
          "px!important;width:0!important;height:0!important;visibility:hidden!important;pointer-events:none!important";
        items2.push(value10);
        value3.appendChild(value10);
      }
      let value5 = items2.map(function (input) {
          let bounds2 = input.getBoundingClientRect();
          return [bounds2.left, bounds2.top];
        }),
        value6 = value5[0]!,
        value7 = value5[1]!,
        value8 = value5[2]!,
        value9 = value5[3]!;
      return Math.abs(value9[0]! - (value7[0]! + value8[0]! - value6[0]!)) > 1 ||
        Math.abs(value9[1]! - (value7[1]! + value8[1]! - value6[1]!)) > 1
        ? null
        : [
            value6[0]!,
            value6[1]!,
            (value7[0]! - value6[0]!) / 100,
            (value7[1]! - value6[1]!) / 100,
            (value8[0]! - value6[0]!) / 100,
            (value8[1]! - value6[1]!) / 100,
          ];
    } finally {
      for (let index = 0; index < items2.length; index++)
        items2[index]!.parentNode &&
          items2[index]!.parentNode!.removeChild(items2[index]!);
    }
  }
  function parseInsertionContainerTransform(
    value: unknown,
  ): AffineTransform | null {
    if (
      !Array.isArray(value) ||
      value.length !== 6 ||
      !value.every(
        (input) =>
          typeof input == "number" &&
          Number.isFinite(input) &&
          Math.abs(input) < 1e6,
      )
    )
      return null;
    let [originX, originY, basisXX, basisXY, basisYX, basisYY] = value;
    return {
      ox: originX,
      oy: originY,
      ux: basisXX,
      uy: basisXY,
      vx: basisYX,
      vy: basisYY,
    };
  }
  function insertionPointInContainer(
    transform: AffineTransform,
    clientX: number,
    clientY: number,
  ): ContainerPoint | null {
    let determinant = transform.ux * transform.vy - transform.uy * transform.vx;
    if (Math.abs(determinant) < 0.001) return null;
    let isIdentity = [
        transform.ux - 1,
        transform.uy,
        transform.vx,
        transform.vy - 1,
      ].every((input) => Math.abs(input) < 0.002),
      roundCoordinate: (coordinate: number) => number = (input) =>
        isIdentity ? Math.round(input) : Math.round(input * 100) / 100,
      [offsetX, offsetY] = [clientX - transform.ox, clientY - transform.oy],
      [left, top] = [
        roundCoordinate(
          (offsetX * transform.vy - offsetY * transform.vx) / determinant,
        ),
        roundCoordinate(
          (offsetY * transform.ux - offsetX * transform.uy) / determinant,
        ),
      ];
    if (Math.abs(left) > 1e5 || Math.abs(top) > 1e5) return null;
    let [projectedX, projectedY] = [
      transform.ox + left * transform.ux + top * transform.vx,
      transform.oy + left * transform.uy + top * transform.vy,
    ];
    return Math.abs(projectedX - clientX) <= 1 &&
      Math.abs(projectedY - clientY) <= 1
      ? {
          left: left,
          top: top,
        }
      : null;
  }
  async function requestInsertionContainerTransform(
    webview: PreviewHandle,
    componentName: string,
    templateId: number,
    clientX: number,
    clientY: number,
    timeoutMs: number = 400,
  ): Promise<AffineTransform | null> {
    try {
      return parseInsertionContainerTransform(
        await webview.executeJavaScript(
          "(" +
            measureInsertionContainerTransform.toString() +
            ")(" +
            [componentName, templateId, clientX, clientY]
              .map((input) => JSON.stringify(input))
              .join(",") +
            ")",
          timeoutMs,
        ),
      );
    } catch {
      return null;
    }
  }
  async function placeElementAtMeasuredPoint(
    session?: Dynamic,
    point?: Dynamic,
    makePlacement?: Dynamic,
  ): Promise<Dynamic> {
    let [clientX, clientY]: Dynamic = [
        Math.round(point.x),
        Math.round(point.y),
      ],
      initialPlacement: Dynamic = makePlacement(clientX, clientY),
      currentState: Dynamic = session.state(),
      initialTarget: Dynamic = currentState
        ? (0, runtime.defaultInsertionPoint)(
            currentState.model,
            initialPlacement,
          )
        : null,
      containerTemplateId: Dynamic =
        initialTarget?.position === "into" ? initialTarget.targetTid : null,
      containerElement: Dynamic =
        currentState && containerTemplateId != null
          ? currentState.model.element(containerTemplateId)
          : null,
      containerTransform: Dynamic =
        containerElement &&
        containerTemplateId != null &&
        !currentState?.liveStampsStale
          ? await session.measure(containerTemplateId, clientX, clientY)
          : null;
    if (!session.live()) return null;
    let replacementResult: Dynamic = session.replaced?.(initialPlacement);
    if (replacementResult) return replacementResult;
    let containerPoint: Dynamic = containerTransform
      ? insertionPointInContainer(containerTransform, clientX, clientY)
      : null;
    return session.mutate((input?: Dynamic): Dynamic => {
      let value: Dynamic = (0, runtime.defaultInsertionPoint)(
          input.model,
          initialPlacement,
        ),
        value2: Dynamic =
          containerPoint != null &&
          containerElement != null &&
          value.position === "into" &&
          value.targetTid != null &&
          input.model.element(value.targetTid) === containerElement;
      return (0, runtime.insertHtmlIntoModel)(
        input,
        value2
          ? makePlacement(containerPoint.left, containerPoint.top)
          : initialPlacement,
        value,
      );
    });
  }
  bindRuntimeValue(
    runtime,
    "measureInsertionContainerTransform",
    () => measureInsertionContainerTransform,
  );
  bindRuntimeValue(
    runtime,
    "parseInsertionContainerTransform",
    () => parseInsertionContainerTransform,
  );
  bindRuntimeValue(
    runtime,
    "insertionPointInContainer",
    () => insertionPointInContainer,
  );
  bindRuntimeValue(
    runtime,
    "requestInsertionContainerTransform",
    () => requestInsertionContainerTransform,
  );
  bindRuntimeValue(
    runtime,
    "placeElementAtMeasuredPoint",
    () => placeElementAtMeasuredPoint,
  );
  return () => {};
}
