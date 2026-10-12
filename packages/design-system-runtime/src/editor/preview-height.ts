import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorPreviewHeight(
  runtime: RuntimeBindings,
): () => void {
  var clampPreviewHeight: (height: number) => number;
  var DEFAULT_PREVIEW_HEIGHT: number;
  var MAX_AUTO_PREVIEW_HEIGHT: number;
  var PREVIEW_RESIZE_SETTLE_MS: number;
  var PREVIEW_RESIZE_ANIMATION_WINDOW_MS: number;
  var PREVIEW_RESIZE_MIN_DELAY_MS: number;
  var PREVIEW_RESIZE_MARGIN_PX: number;
  var PREVIEW_RESIZE_MAX_HEIGHT: number;
  var NON_LAYOUT_TRANSITION_PROPERTIES: RegExp;
  var PREVIEW_FONT_WAIT_TIMEOUT_MS: number;
  var PREVIEW_RESIZE_ACTIVITY_EVENTS: (keyof DocumentEventMap)[];
  var isNormalFlowStyle: (style: CSSStyleDeclaration) => boolean;
  function elementDocumentBottom(
    element: Element,
    frameWindow: Window,
  ): number {
    let offsetElement = element as HTMLElement,
      body = element.ownerDocument.body;
    if (typeof offsetElement.offsetTop !== "number" || element === body) {
      return (
        element.getBoundingClientRect().bottom + (frameWindow.scrollY || 0)
      );
    }
    let bottom = offsetElement.offsetTop + offsetElement.offsetHeight;
    for (
      let offsetParent = offsetElement.offsetParent as HTMLElement | null;
      offsetParent !== null && offsetParent !== undefined;
      offsetParent = offsetParent.offsetParent as HTMLElement | null
    ) {
      if (offsetParent === body) {
        if (frameWindow.getComputedStyle(offsetParent).position !== "static") {
          bottom +=
            offsetParent.getBoundingClientRect().top +
            (frameWindow.scrollY || 0) +
            offsetParent.clientTop;
        }
        break;
      }
      bottom += offsetParent.offsetTop + offsetParent.clientTop;
    }
    return bottom;
  }
  function* normalFlowChildren(
    element: Element,
    frameWindow: Window,
    depth: number = 0,
  ): Generator<Element, void, unknown> {
    for (
      let firstElementChild = element.firstElementChild;
      firstElementChild !== null;
      firstElementChild = firstElementChild.nextElementSibling
    ) {
      let style = frameWindow.getComputedStyle(firstElementChild);
      if (style.display === "contents" && depth < 4) {
        yield* normalFlowChildren(firstElementChild, frameWindow, depth + 1);
      } else if (isNormalFlowStyle(style)) {
        yield firstElementChild;
      }
    }
  }
  function collapsedBottomMargin(
    element: Element,
    frameWindow: Window,
  ): number {
    let margin: number = 0,
      current: Element | null = element;
    for (let index: number = 0; current !== null && index < 8; index++) {
      let style = frameWindow.getComputedStyle(current);
      if (style.display !== "inline") {
        margin = Math.max(margin, parseFloat(style.marginBottom) || 0);
      }
      if (
        style.display !== "block" ||
        style.overflow !== "visible" ||
        (parseFloat(style.paddingBottom) || 0) > 0 ||
        (parseFloat(style.borderBottomWidth) || 0) > 0
      ) {
        break;
      }
      let lastElementChild: Element | null = current.lastElementChild;
      while (
        lastElementChild !== null &&
        !isNormalFlowStyle(frameWindow.getComputedStyle(lastElementChild))
      ) {
        lastElementChild = lastElementChild.previousElementSibling;
      }
      if (
        lastElementChild !== null &&
        elementDocumentBottom(current, frameWindow) -
          elementDocumentBottom(lastElementChild, frameWindow) >
          1
      ) {
        break;
      }
      current = lastElementChild;
    }
    return margin;
  }
  function measurePreviewDocumentHeight(
    document2: Document,
    frameWindow: Window,
  ): number {
    let body = document2.body;
    if (body === null) {
      return Math.ceil(
        elementDocumentBottom(document2.documentElement, frameWindow),
      );
    }
    let bodyStyle = frameWindow.getComputedStyle(body),
      bottomBox =
        (parseFloat(bodyStyle.paddingBottom) || 0) +
        (parseFloat(bodyStyle.borderBottomWidth) || 0),
      bottomMargin = parseFloat(bodyStyle.marginBottom) || 0,
      childBottom = -1 / 0,
      childMargin = 0;
    for (let value of normalFlowChildren(body, frameWindow)) {
      let value2 = elementDocumentBottom(value, frameWindow),
        value3 = collapsedBottomMargin(value, frameWindow);
      if (value2 + value3 > childBottom + childMargin) {
        childBottom = value2;
        childMargin = value3;
      }
    }
    let bodyBottom = elementDocumentBottom(body, frameWindow) + bottomMargin,
      shortBodyBottom =
        bodyBottom + 1 < (frameWindow.scrollY || 0) + frameWindow.innerHeight
          ? bodyBottom
          : -1 / 0;
    if (childBottom === -1 / 0) {
      return Math.ceil(Math.max(bodyBottom, 0));
    }
    return Math.ceil(
      Math.max(
        childBottom +
          bottomBox +
          (bottomBox > 0
            ? childMargin + bottomMargin
            : Math.max(childMargin, bottomMargin)),
        shortBodyBottom,
      ),
    );
  }
  function accessiblePreviewDocument(iframe: HTMLIFrameElement): {
    d: Editor.PreviewAnimationDocument;
    fw: Editor.PreviewFrameWindow;
  } | null {
    try {
      let { contentDocument: value, contentWindow: value2 } = iframe;
      if (value !== null && value2 !== null && value.body !== null) {
        return {
          d: value as Editor.PreviewAnimationDocument,
          fw: value2 as Editor.PreviewFrameWindow,
        };
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function observePreviewHeight(
    iframe: HTMLIFrameElement,
    onHeight: (height: number) => void,
    options?: number,
  ): () => void {
    let value = accessiblePreviewDocument(iframe),
      value2 = value?.fw.ResizeObserver;
    if (value === null || typeof value2 !== "function") {
      return (): void => {
        return;
      };
    }
    let { d: value3, fw: value4 } = value,
      documentElement = value3.documentElement,
      body = value3.body,
      callback = () => measurePreviewDocumentHeight(value3, value4),
      flag: boolean = false,
      innerHeight = value4.innerHeight,
      value5 = callback(),
      index = 0,
      value6 =
        options !== undefined && innerHeight > options
          ? innerHeight - options
          : 0,
      value7 = clampPreviewHeight(value5),
      index2 = 0,
      value8 = value5,
      index3 = 0,
      items: Editor.AnimatedPreviewHeight[] = [],
      flag2: boolean = false,
      index4: number = 0,
      index5: number = 0,
      flag3: boolean = false,
      index6: number = 0,
      index7 = 0,
      index8 = 0,
      value9: ReturnType<typeof setTimeout> | undefined,
      flag4: boolean = false,
      flag5: boolean = false,
      value10 = PREVIEW_FONT_WAIT_TIMEOUT_MS,
      value11: ReturnType<typeof setTimeout> | undefined,
      index9 = 0,
      value12: number | undefined = Math.max(
        documentElement.scrollHeight,
        body.scrollHeight,
      ),
      value13: ReturnType<typeof setTimeout> | undefined = setTimeout(
        () => value17(callback3),
        MAX_AUTO_PREVIEW_HEIGHT,
      ),
      flag6 = false,
      index10: number = 0,
      flag7: boolean = true,
      callback2 = (): void => {
        let value19: boolean =
          Math.max(value4.innerHeight, value12 ?? 0) + 1 <
          Math.max(documentElement.scrollHeight, body.scrollHeight);
        if (value19 === flag6) {
          return;
        }
        flag6 = value19;
        if (value19) {
          if (Date.now() - index10 < PREVIEW_FONT_WAIT_TIMEOUT_MS) {
            documentElement.style.setProperty("scrollbar-gutter", "stable");
          }
          documentElement.style.setProperty("overflow", "auto", "important");
        } else {
          index10 = Date.now();
          value4.scrollTo(0, 0);
          documentElement.style.removeProperty("overflow");
        }
      },
      callback3 = (): void => {
        if (value13 !== undefined) {
          clearTimeout(value13);
        }
        value13 = undefined;
        value12 = undefined;
        if (value11 === undefined) {
          callback2();
        }
      },
      callback4 = () =>
        documentElement.getClientRects().length > 0 && value4.innerHeight > 0,
      value14 = callback4(),
      callback5 = (): void => {
        let innerHeight2 = value4.innerHeight;
        if (!callback4()) {
          return;
        }
        let value19 = callback();
        if (!value14) {
          value14 = true;
          innerHeight = innerHeight2;
          value5 = value19;
          value7 = clampPreviewHeight(value19);
          return;
        }
        if (innerHeight2 === innerHeight) {
          value5 = value19;
          return;
        }
        index3 = value19 - value5;
        index = Math.max(0, index + index3);
        index2 = innerHeight2 - innerHeight;
        value8 = value5;
        index5 = Date.now();
        flag3 = true;
        flag2 = false;
        items = index5 - index4 <= PREVIEW_RESIZE_MARGIN_PX ? [] : callback13();
        innerHeight = innerHeight2;
        value5 = value19;
        callback3();
        if (index3 < -1) {
          callback14();
        }
      },
      callback6 = (): string => {
        if (index2 === 0) {
          return "judged";
        }
        if (
          items.some(
            ({ a: a, el: el2 }) =>
              el2.isConnected && (a.playState === "running" || a.pending),
          ) &&
          Date.now() - index5 < PREVIEW_RESIZE_MAX_HEIGHT
        ) {
          return "deferred";
        }
        let value19 = value5 - value8,
          flag9: boolean = false;
        if (!flag2 && Math.abs(value19) <= 1 && Math.abs(index2) >= 2) {
          flag9 = index !== 0;
          callback7();
          index = 0;
        } else if (items.length > 0) {
          index = Math.max(
            0,
            index +
              items.reduce(
                (input, { el: el2, h0: h02 }) =>
                  input + (el2.offsetHeight - h02),
                0,
              ),
          );
        }
        items = [];
        if (value6 > 0 && Math.abs(index2) >= 2) {
          index += Math.round(
            Math.max(0, Math.min(1, value19 / index2)) * value6,
          );
          value6 = 0;
        }
        index2 = 0;
        index3 = 0;
        if (flag9) {
          return "healed";
        } else {
          return "judged";
        }
      },
      callback7 = (): void => {
        index -= index8;
        index8 = 0;
        if (value9 !== undefined) {
          clearTimeout(value9);
        }
        value9 = undefined;
      },
      callback8 = () =>
        index6 !== 0 &&
        Date.now() - index6 < PREVIEW_RESIZE_ANIMATION_WINDOW_MS,
      flag8: boolean = false,
      callback9 = (input: Event & { repeat?: boolean }): void => {
        if (!input.isTrusted) {
          return;
        }
        if (input.type === "pointerdown" || input.type === "pointercancel") {
          flag8 = input.type === "pointercancel";
          return;
        }
        if (input.type === "pointerup" && flag8) {
          return;
        }
        if (input.type === "keydown" && input.repeat) {
          return;
        }
        index6 = Date.now();
      },
      callback10 = (): void => {
        value11 = undefined;
        if (!callback4()) {
          return;
        }
        callback5();
        value5 = callback();
        let value19 = callback6();
        if (value19 === "deferred") {
          callback2();
          return;
        }
        let value20: boolean = value19 === "healed",
          value21 = clampPreviewHeight(value5 - index);
        if (value21 > value7 + 1 && !value20) {
          let value23: boolean = flag3;
          flag3 = false;
          if (value23 && callback8()) {
            flag5 = false;
            if (index8 > 0) {
              callback7();
            }
            value21 = clampPreviewHeight(value5 - index);
          } else if (value23) {
            index7 += 1;
            if (index7 > 2) {
              index8 += value21 - value7;
              index += value21 - value7;
              value21 = value7;
              if (flag5) {
                value10 *= 3;
              }
              if (value9 === undefined) {
                value9 = setTimeout(
                  () =>
                    value17((): void => {
                      value9 = undefined;
                      flag4 = true;
                      callback7();
                      callback14();
                    }),
                  value10,
                );
              }
            }
            flag5 = false;
          } else if (flag4) {
            flag4 = false;
            flag5 = true;
          } else {
            flag5 = false;
            value10 = PREVIEW_FONT_WAIT_TIMEOUT_MS;
            if (index8 > 0) {
              callback7();
            } else {
              index7 = 0;
            }
            value21 = clampPreviewHeight(value5 - index);
          }
        } else if (value21 < value7 - 1) {
          index7 = 0;
        }
        let value22 = options !== undefined && innerHeight <= options + 1;
        if (
          Math.abs(value21 - value7) >= 2 ||
          (flag7 &&
            (value21 < innerHeight - 1 ||
              (value22 && value21 > innerHeight + 1)))
        ) {
          value7 = value21;
          value12 = value21;
          index6 = 0;
          if (value13 !== undefined) {
            clearTimeout(value13);
          }
          value13 = setTimeout(
            () => value17(callback3),
            MAX_AUTO_PREVIEW_HEIGHT,
          );
          onHeight(value21);
        }
        flag7 = false;
        callback2();
      },
      callback11 = (): Editor.PreviewAnimation[] => {
        try {
          if (typeof value3.getAnimations === "function") {
            return value3
              .getAnimations()
              .filter(
                (input) =>
                  input.playState === "running" &&
                  input.effect?.getTiming().iterations !== 1 / 0,
              );
          } else {
            return [];
          }
        } catch {
          return [];
        }
      },
      callback12 = (): boolean => callback11().length > 0,
      callback13 = () => {
        let value19 = callback11()
          .filter(
            (input) =>
              Number(input.currentTime ?? 0) <= PREVIEW_RESIZE_MIN_DELAY_MS &&
              !NON_LAYOUT_TRANSITION_PROPERTIES.test(
                input.transitionProperty ?? "",
              ),
          )
          .map((input) => ({
            a: input,
            el: input.effect?.target,
          }))
          .filter(
            (input: {
              a: Editor.PreviewAnimation;
              el: Element | null | undefined;
            }): input is { a: Editor.PreviewAnimation; el: HTMLElement } =>
              input.el !== null &&
              input.el !== undefined &&
              typeof (input.el as HTMLElement).offsetHeight === "number",
          );
        return value19
          .filter(
            ({ el: el2 }, options2) =>
              value19.findIndex((input): boolean => input.el === el2) ===
                options2 &&
              !value19.some(
                (input) => input.el !== el2 && input.el.contains(el2),
              ),
          )
          .map(({ a: a, el: el2 }) => ({
            a: a,
            el: el2,
            h0: el2.offsetHeight,
          }));
      },
      callback14 = (): void => {
        value17(callback5);
        if (flag) {
          return;
        }
        let value19: number = Date.now();
        if (value11 === undefined) {
          index9 = value19;
        } else if (
          value19 - index9 >
          (callback12() ? PREVIEW_RESIZE_SETTLE_MS : MAX_AUTO_PREVIEW_HEIGHT) -
            DEFAULT_PREVIEW_HEIGHT
        ) {
          return;
        } else {
          clearTimeout(value11);
        }
        value11 = setTimeout(() => value17(callback10), DEFAULT_PREVIEW_HEIGHT);
      },
      value15 = new value2(callback14);
    value15.observe(body);
    for (
      let firstElementChild = body.firstElementChild;
      firstElementChild !== null;
      firstElementChild = firstElementChild.nextElementSibling
    ) {
      value15.observe(firstElementChild);
    }
    let value16 =
      typeof value4.MutationObserver === "function"
        ? new value4.MutationObserver((input: MutationRecord[]): void => {
            flag2 = true;
            index4 = Date.now();
            for (let value19 of input) {
              if (value19.target !== body || value19.type !== "childList") {
                continue;
              }
              value19.addedNodes.forEach((input2): void => {
                if (input2.nodeType === 1) {
                  value15.observe(input2 as Element);
                }
              });
              value19.removedNodes.forEach((input2): void => {
                if (input2.nodeType === 1) {
                  value15.unobserve(input2 as Element);
                }
              });
            }
            callback14();
          })
        : null;
    value16?.observe(body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    value4.addEventListener("resize", callback14);
    value3.addEventListener("transitionend", callback14, true);
    value3.addEventListener("animationend", callback14, true);
    for (let value19 of PREVIEW_RESIZE_ACTIVITY_EVENTS) {
      value3.addEventListener(value19, callback9, true);
    }
    function value17(input: () => void): void {
      if (flag) {
        return;
      }
      try {
        input();
      } catch {
        value18();
      }
    }
    function value18(): void {
      if (flag) {
        return;
      }
      flag = true;
      if (value11 !== undefined) {
        clearTimeout(value11);
      }
      if (value13 !== undefined) {
        clearTimeout(value13);
      }
      if (value9 !== undefined) {
        clearTimeout(value9);
      }
      value15.disconnect();
      value16?.disconnect();
      try {
        value4.removeEventListener("resize", callback14);
        value3.removeEventListener("transitionend", callback14, true);
        value3.removeEventListener("animationend", callback14, true);
        for (let value19 of PREVIEW_RESIZE_ACTIVITY_EVENTS) {
          value3.removeEventListener(value19, callback9, true);
        }
      } catch {}
    }
    return value18;
  }
  bindRuntimeValue(
    runtime,
    "clampPreviewHeight",
    () => clampPreviewHeight,
    (value) => {
      clampPreviewHeight = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_PREVIEW_HEIGHT",
    () => DEFAULT_PREVIEW_HEIGHT,
    (value) => {
      DEFAULT_PREVIEW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_AUTO_PREVIEW_HEIGHT",
    () => MAX_AUTO_PREVIEW_HEIGHT,
    (value) => {
      MAX_AUTO_PREVIEW_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RESIZE_SETTLE_MS",
    () => PREVIEW_RESIZE_SETTLE_MS,
    (value) => {
      PREVIEW_RESIZE_SETTLE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RESIZE_ANIMATION_WINDOW_MS",
    () => PREVIEW_RESIZE_ANIMATION_WINDOW_MS,
    (value) => {
      PREVIEW_RESIZE_ANIMATION_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RESIZE_MIN_DELAY_MS",
    () => PREVIEW_RESIZE_MIN_DELAY_MS,
    (value) => {
      PREVIEW_RESIZE_MIN_DELAY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RESIZE_MARGIN_PX",
    () => PREVIEW_RESIZE_MARGIN_PX,
    (value) => {
      PREVIEW_RESIZE_MARGIN_PX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RESIZE_MAX_HEIGHT",
    () => PREVIEW_RESIZE_MAX_HEIGHT,
    (value) => {
      PREVIEW_RESIZE_MAX_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "NON_LAYOUT_TRANSITION_PROPERTIES",
    () => NON_LAYOUT_TRANSITION_PROPERTIES,
    (value) => {
      NON_LAYOUT_TRANSITION_PROPERTIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_FONT_WAIT_TIMEOUT_MS",
    () => PREVIEW_FONT_WAIT_TIMEOUT_MS,
    (value) => {
      PREVIEW_FONT_WAIT_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_RESIZE_ACTIVITY_EVENTS",
    () => PREVIEW_RESIZE_ACTIVITY_EVENTS,
    (value) => {
      PREVIEW_RESIZE_ACTIVITY_EVENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isNormalFlowStyle",
    () => isNormalFlowStyle,
    (value) => {
      isNormalFlowStyle = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "elementDocumentBottom",
    () => elementDocumentBottom,
  );
  bindRuntimeValue(runtime, "normalFlowChildren", () => normalFlowChildren);
  bindRuntimeValue(
    runtime,
    "collapsedBottomMargin",
    () => collapsedBottomMargin,
  );
  bindRuntimeValue(
    runtime,
    "measurePreviewDocumentHeight",
    () => measurePreviewDocumentHeight,
  );
  bindRuntimeValue(
    runtime,
    "accessiblePreviewDocument",
    () => accessiblePreviewDocument,
  );
  bindRuntimeValue(runtime, "observePreviewHeight", () => observePreviewHeight);
  return () => {
    clampPreviewHeight = (height: number): number =>
      Math.min(4000, Math.max(40, Math.round(height)));
    DEFAULT_PREVIEW_HEIGHT = 120;
    MAX_AUTO_PREVIEW_HEIGHT = 480;
    PREVIEW_RESIZE_SETTLE_MS = 1500;
    PREVIEW_RESIZE_ANIMATION_WINDOW_MS = 1500;
    PREVIEW_RESIZE_MIN_DELAY_MS = 120;
    PREVIEW_RESIZE_MARGIN_PX = 50;
    PREVIEW_RESIZE_MAX_HEIGHT = 4000;
    NON_LAYOUT_TRANSITION_PROPERTIES =
      /^(opacity|color|background|box-shadow|outline|transform|filter|backdrop-filter|fill|stroke|visibility|text-decoration|caret-color|accent-color|border-\w+-color)/;
    PREVIEW_FONT_WAIT_TIMEOUT_MS = 1000;
    PREVIEW_RESIZE_ACTIVITY_EVENTS = [
      "click",
      "pointerup",
      "pointercancel",
      "pointerdown",
      "keydown",
    ];
    isNormalFlowStyle = (style: CSSStyleDeclaration) =>
      style.display !== "none" &&
      style.position !== "absolute" &&
      style.position !== "fixed";
  };
}
