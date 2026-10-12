/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installFindScrollReveal(runtime: RuntimeBindings): () => void {
  var isNontrivialCssTransformValue: Dynamic;
  var scrollRevealPixelTolerance: Dynamic;
  var rangeVisibleTolerance: Dynamic;
  var intervalsDoNotOverlap: Dynamic;
  var intervalOverlapLength: Dynamic;
  function scrollDeltaToRevealInterval(
    start?: Dynamic,
    end?: Dynamic,
    visibleStart?: Dynamic,
    visibleEnd?: Dynamic,
    padding: Dynamic = 0,
    edges: Dynamic = {
      lo: true,
      hi: true,
    },
  ): Dynamic {
    if (
      (start >= visibleStart + (edges.lo ? padding : 0) &&
        end <= visibleEnd - (edges.hi ? padding : 0)) ||
      (start < visibleStart && end > visibleEnd)
    )
      return 0;
    if (
      end <= visibleStart ||
      start >= visibleEnd ||
      (padding > 0 && end - start > visibleEnd - visibleStart - 2 * padding)
    )
      return (start + end) / 2 - (visibleStart + visibleEnd) / 2;
    let [items, items2]: Dynamic = [
        visibleStart + padding,
        visibleEnd - padding,
      ],
      value: Dynamic = end - start <= items2 - items;
    return start < items
      ? value
        ? start - items
        : end - items2
      : value
        ? end - items2
        : start - items;
  }
  function rangeCanvasRect(range?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.safeRangeClientRect)(range);
    if (value === null) return null;
    let state: Dynamic = {
      x: value.left,
      y: value.top,
      w: value.width,
      h: value.height,
    };
    return [state.x, state.y, state.w, state.h].every(Number.isFinite) &&
      state.w >= 0 &&
      state.h >= 0
      ? state
      : null;
  }
  function createsFixedContainingBlock(style?: Dynamic): Dynamic {
    return (
      isNontrivialCssTransformValue(style.transform) ||
      isNontrivialCssTransformValue(style.translate) ||
      isNontrivialCssTransformValue(style.rotate) ||
      isNontrivialCssTransformValue(style.scale) ||
      isNontrivialCssTransformValue(style.perspective) ||
      isNontrivialCssTransformValue(style.filter) ||
      /layout|paint|strict|content/.test(style.contain)
    );
  }
  function composedParentNode(node?: Dynamic): Dynamic {
    let assignedSlot: Dynamic = node.assignedSlot;
    if (assignedSlot) return assignedSlot;
    let parentNode: Dynamic = node.parentNode;
    return parentNode !== null && parentNode.nodeType === 11
      ? (parentNode.host ?? null)
      : parentNode;
  }
  function elementClientContentRect(element?: Dynamic): Dynamic {
    let bounds: Dynamic = element.getBoundingClientRect(),
      callback: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic =>
        options > 0 && input > 0 ? input / options : 1,
      value: Dynamic = callback(bounds.width, element.offsetWidth),
      value2: Dynamic = callback(bounds.height, element.offsetHeight);
    return {
      left: bounds.left + element.clientLeft * value,
      top: bounds.top + element.clientTop * value2,
      w: element.clientWidth * value,
      h: element.clientHeight * value2,
      sx: value,
      sy: value2,
    };
  }
  function describeScrollTransform(transform?: Dynamic): Dynamic {
    let value: Dynamic =
        /^matrix\(([^)]*)\)/.exec(transform)?.[1]?.split(",").map(Number) ?? [],
      [value2 = 1, value3 = 0, value4 = 0, value5 = 1]: Dynamic = value;
    return {
      spun: value.length >= 4 && (Math.abs(value3) > 1e-4 || value2 < 0),
      even:
        Math.abs(value2 - value5) < 1e-4 && Math.abs(value3 + value4) < 1e-4,
    };
  }
  function probeScrollableRangePosition(
    element?: Dynamic,
    range?: Dynamic,
    viewport?: Dynamic,
    tolerance?: Dynamic,
    onScroll?: Dynamic,
    environment?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic => ({
        x: input.x + input.w / 2,
        y: input.y + input.h / 2,
      }),
      value: Dynamic = element.scrollHeight - element.clientHeight,
      scrollTop: Dynamic = element.scrollTop,
      value2: Dynamic = rangeCanvasRect(range);
    if (value2 === null || value <= 0) return;
    environment?.(element);
    element.scrollTo({
      top:
        value - scrollTop >= scrollTop
          ? Math.min(value, scrollTop + 40)
          : Math.max(0, scrollTop - 40),
      behavior: "instant",
    });
    let bounds: Dynamic = element.getBoundingClientRect(),
      value3: Dynamic = rangeCanvasRect(range),
      value4: Dynamic = element.scrollTop - scrollTop,
      value5: Dynamic =
        value3 === null || value4 === 0
          ? null
          : {
              x: (callback(value3).x - callback(value2).x) / value4,
              y: (callback(value3).y - callback(value2).y) / value4,
            },
      value6: Dynamic =
        value5 === null ? 0 : value5.x * value5.x + value5.y * value5.y;
    if (value5 === null || value6 === 0)
      return void element.scrollTo({
        top: scrollTop,
        behavior: "instant",
      });
    let callback2: Dynamic = (input?: Dynamic, options?: Dynamic): Dynamic => {
        let value13: Dynamic =
            element.clientHeight / 2 +
            options +
            ((bounds.left + bounds.width / 2 - callback(input).x) * value5.x +
              (bounds.top + bounds.height / 2 - callback(input).y) * value5.y) /
              value6,
          value14: Dynamic =
            (input.w * Math.abs(value5.x) + input.h * Math.abs(value5.y)) /
            value6 /
            2;
        return [value13 - value14, value13 + value14];
      },
      [value7, value8]: Dynamic = callback2(value2, 0),
      startContainer: Dynamic = range.startContainer,
      value9: Dynamic =
        viewport &&
        startContainer === range.endContainer &&
        startContainer.nodeType === 3 &&
        range.endOffset - range.startOffset > 1
          ? [range.startOffset, range.endOffset - 1].map(
              (input?: Dynamic): Dynamic => {
                let value13: Dynamic =
                  startContainer.ownerDocument.createRange();
                value13.setStart(startContainer, input);
                value13.setEnd(startContainer, input + 1);
                return rangeCanvasRect(value13);
              },
            )
          : [],
      [value10, value11]: Dynamic = value9;
    if (value10 != null && value11 != null && value10.h > 0 && value11.h > 0) {
      let [items, items2]: Dynamic = [
        callback2(value10, value4),
        callback2(value11, value4),
      ];
      [value7, value8] = [
        Math.max(value7, Math.min(items[0], items2[0])),
        Math.min(value8, Math.max(items[1], items2[1])),
      ];
    }
    let value12: Dynamic =
      value8 - value7 > element.clientHeight
        ? (value7 + value8) / 2 - element.clientHeight / 2
        : scrollDeltaToRevealInterval(
            value7,
            value8,
            0,
            element.clientHeight,
            tolerance,
            onScroll,
          );
    element.scrollTo({
      top:
        Math.abs(value12) < scrollRevealPixelTolerance(element)
          ? scrollTop
          : Math.max(0, Math.min(value, scrollTop + value12)),
      behavior: "instant",
    });
  }
  function revealTextRange(range?: Dynamic, options?: Dynamic): Dynamic {
    let startContainer: Dynamic = range.startContainer,
      value: Dynamic =
        startContainer.nodeType === 1
          ? startContainer
          : startContainer.parentElement,
      value2: Dynamic = value?.ownerDocument,
      value3: Dynamic = value2?.defaultView;
    if (!value || !value2 || !value3) return;
    let value4: Dynamic = value2.scrollingElement ?? value2.documentElement,
      value5: Dynamic =
        options.within !== undefined
          ? describeScrollTransform(
              value3.getComputedStyle(options.within).transform,
            )
          : {
              spun: false,
              even: false,
            },
      flag: Dynamic = false,
      flag2: Dynamic = false;
    for (
      let value9: Dynamic = value;
      value9 !== null && value9 !== value4 && value9.nodeType === 1;
      value9 = value9 === options.within ? null : composedParentNode(value9)
    ) {
      let value10: Dynamic = value9,
        style: Dynamic = value3.getComputedStyle(value10);
      if (
        ((flag2 || (flag && style.position === "static")) &&
          !createsFixedContainingBlock(style)) ||
        ((flag = style.position === "absolute"),
        (flag2 = style.position === "fixed"),
        style.display === "inline" || style.display === "contents")
      )
        continue;
      let value11: Dynamic =
        (value10 === options.card ||
          /auto|scroll/.test(
            style.overflow + " " + style.overflowX + " " + style.overflowY,
          )) &&
        (value10.scrollHeight > value10.clientHeight ||
          value10.scrollWidth > value10.clientWidth)
          ? rangeCanvasRect(range)
          : null;
      if (value11 === null) continue;
      let value12: Dynamic =
          options.fade !== undefined && options.fade > 0 ? options.fade : 0,
        value13: Dynamic = (0, runtime.CanvasPanZoomScrollTop)(value10);
      if (value5.spun) {
        probeScrollableRangePosition(
          value10,
          range,
          value5.even,
          value12,
          {
            lo: value13.above,
            hi: value13.below,
          },
          options.onScroll,
        );
        continue;
      }
      let value14: Dynamic = elementClientContentRect(value10),
        value15: Dynamic =
          scrollDeltaToRevealInterval(
            value11.y,
            value11.y + value11.h,
            value14.top,
            value14.top + value14.h,
            value12 * value14.sy,
            {
              lo: value13.above,
              hi: value13.below,
            },
          ) / value14.sy,
        value16: Dynamic =
          scrollDeltaToRevealInterval(
            value11.x,
            value11.x + value11.w,
            value14.left,
            value14.left + value14.w,
          ) / value14.sx;
      (value12 > 0
        ? Math.max(Math.abs(value16), Math.abs(value15)) >=
          scrollRevealPixelTolerance(value10)
        : value16 !== 0 || value15 !== 0) &&
        (options.onScroll?.(value10),
        value10.scrollTo({
          left: value10.scrollLeft + value16,
          top: value10.scrollTop + value15,
          behavior: "instant",
        }));
    }
    if (!options.viewport || flag2) return;
    let value6: Dynamic = rangeCanvasRect(range);
    if (value6 === null) return;
    let value7: Dynamic = scrollDeltaToRevealInterval(
        value6.y,
        value6.y + value6.h,
        0,
        value4.clientHeight || value3.innerHeight,
      ),
      value8: Dynamic = scrollDeltaToRevealInterval(
        value6.x,
        value6.x + value6.w,
        0,
        value4.clientWidth || value3.innerWidth,
      );
    (value8 === 0 && value7 === 0) ||
      (options.onScroll?.(value3),
      value3.scrollBy({
        left: value8,
        top: value7,
        behavior: "instant",
      }));
  }
  function classifyTextRangeVisibility(
    range?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let value: Dynamic = rangeCanvasRect(range),
      startContainer: Dynamic = range.startContainer,
      value2: Dynamic =
        startContainer.nodeType === 1
          ? startContainer
          : startContainer.parentElement,
      value3: Dynamic = value2?.ownerDocument.defaultView;
    if (value === null || !value2 || !value3 || value.w <= 0 || value.h <= 0)
      return "never";
    let value4: Dynamic =
        value2.ownerDocument.scrollingElement ??
        value2.ownerDocument.documentElement,
      state: Dynamic = {
        x: value3.scrollX,
        y: value3.scrollY,
      };
    for (
      let value5: Dynamic = value2;
      value5 !== null && value5 !== value4 && value5.nodeType === 1;
      value5 = composedParentNode(value5)
    ) {
      state.x += value5.scrollLeft;
      state.y += value5.scrollTop;
    }
    if (
      options.within === undefined &&
      (value.x + value.w + state.x <= 0 || value.y + value.h + state.y <= 0)
    )
      return "never";
    let text: Dynamic = "shown",
      flag: Dynamic = false,
      flag2: Dynamic = false;
    for (
      let value5: Dynamic = value2;
      value5 !== null && value5 !== value4 && value5.nodeType === 1;
      value5 = value5 === options.within ? null : composedParentNode(value5)
    ) {
      let value6: Dynamic = value5,
        style: Dynamic = value3.getComputedStyle(value6);
      if (
        ((flag2 || (flag && style.position === "static")) &&
          !createsFixedContainingBlock(style)) ||
        ((flag = style.position === "absolute"),
        (flag2 = style.position === "fixed"),
        style.display === "inline" || style.display === "contents")
      )
        continue;
      let value7: Dynamic = elementClientContentRect(value6);
      for (let [value8, value9, value10, value11, value12] of [
        [
          style.overflowX || style.overflow,
          intervalOverlapLength(
            value.x,
            value.x + value.w,
            value7.left,
            value7.left + value7.w,
          ),
          value.w,
          value6.clientWidth,
          value6.scrollWidth > value6.clientWidth,
        ],
        [
          style.overflowY || style.overflow,
          intervalOverlapLength(
            value.y,
            value.y + value.h,
            value7.top,
            value7.top + value7.h,
          ),
          value.h,
          value6.clientHeight,
          value6.scrollHeight > value6.clientHeight,
        ],
      ] as Dynamic)
        if (
          !(
            value9 >= Math.min(rangeVisibleTolerance, value10) ||
            value8 === "visible" ||
            value8 === ""
          )
        )
          return !/auto|scroll/.test(value8) ||
            !value12 ||
            value11 < rangeVisibleTolerance
            ? "never"
            : "scroll";
    }
    options.within !== undefined ||
      flag2 ||
      ((intervalsDoNotOverlap(
        value.x,
        value.x + value.w,
        0,
        value4.clientWidth || value3.innerWidth,
      ) ||
        intervalsDoNotOverlap(
          value.y,
          value.y + value.h,
          0,
          value4.clientHeight || value3.innerHeight,
        )) &&
        (text = "scroll"));
    return text;
  }
  bindRuntimeValue(
    runtime,
    "scrollDeltaToRevealInterval",
    () => scrollDeltaToRevealInterval,
  );
  bindRuntimeValue(runtime, "rangeCanvasRect", () => rangeCanvasRect);
  bindRuntimeValue(
    runtime,
    "isNontrivialCssTransformValue",
    () => isNontrivialCssTransformValue,
    (value) => {
      isNontrivialCssTransformValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createsFixedContainingBlock",
    () => createsFixedContainingBlock,
  );
  bindRuntimeValue(runtime, "composedParentNode", () => composedParentNode);
  bindRuntimeValue(
    runtime,
    "elementClientContentRect",
    () => elementClientContentRect,
  );
  bindRuntimeValue(
    runtime,
    "describeScrollTransform",
    () => describeScrollTransform,
  );
  bindRuntimeValue(
    runtime,
    "scrollRevealPixelTolerance",
    () => scrollRevealPixelTolerance,
    (value) => {
      scrollRevealPixelTolerance = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "probeScrollableRangePosition",
    () => probeScrollableRangePosition,
  );
  bindRuntimeValue(runtime, "revealTextRange", () => revealTextRange);
  bindRuntimeValue(
    runtime,
    "rangeVisibleTolerance",
    () => rangeVisibleTolerance,
    (value) => {
      rangeVisibleTolerance = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "intervalsDoNotOverlap",
    () => intervalsDoNotOverlap,
    (value) => {
      intervalsDoNotOverlap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "intervalOverlapLength",
    () => intervalOverlapLength,
    (value) => {
      intervalOverlapLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "classifyTextRangeVisibility",
    () => classifyTextRangeVisibility,
  );
  return () => {
    isNontrivialCssTransformValue = (input?: Dynamic): Dynamic =>
      input !== undefined &&
      input !== "" &&
      input !== "none" &&
      input !== "auto";
    scrollRevealPixelTolerance = (element?: Dynamic): Dynamic =>
      0.625 *
      Math.max(
        1,
        1 / (element.ownerDocument.defaultView?.devicePixelRatio || 1),
      );
    rangeVisibleTolerance = 2;
    intervalsDoNotOverlap = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
    ): Dynamic => options <= context || input >= value;
    intervalOverlapLength = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
    ): Dynamic => Math.min(options, value) - Math.max(input, context);
  };
}
