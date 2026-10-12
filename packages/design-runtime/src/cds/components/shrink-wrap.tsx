/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";
export function installCdsComponentsShrinkWrap(
  runtime: RuntimeBindings,
): () => void {
  var MaxWidthValue: Dynamic;
  var ComponentsShrinkWrapElementCache: Dynamic;
  var ComponentsShrinkWrapElementCache_2: Dynamic;
  var ComponentsShrinkWrapLimit: Dynamic;
  var ShrinkwrapAttribute: Dynamic;
  var ComponentsShrinkWrapLimit_2: Dynamic;
  var ComponentsShrinkWrapSubscribers: Dynamic;
  var ComponentsShrinkWrapElementCache_3: Dynamic;
  var ComponentsShrinkWrapElementCache_4: Dynamic;
  var initializeComponentsShrinkWrap: Dynamic;
  var reactComponentsShrinkWrap: Dynamic;
  var jsxComponentsShrinkWrap: Dynamic;
  var ShrinkWrap: Dynamic;
  var initializeComponentsShrinkWrap_2: Dynamic;
  function applyShrinkWrapWidth(input?: Dynamic, options?: Dynamic): Dynamic {
    input.style[MaxWidthValue] = options;
    ComponentsShrinkWrapElementCache_2.set(input, options);
  }
  function rememberOriginalWidth(input?: Dynamic): Dynamic {
    let value: Dynamic = input.style[MaxWidthValue];
    (!ComponentsShrinkWrapElementCache.has(input) ||
      value !== ComponentsShrinkWrapElementCache_2.get(input)) &&
      ComponentsShrinkWrapElementCache.set(input, value);
  }
  function measureInlineContent(element?: Dynamic): Dynamic {
    let ownerDocument: Dynamic = element.ownerDocument,
      defaultView: Dynamic = ownerDocument.defaultView,
      items: Dynamic = [],
      index: Dynamic = 0,
      POSITIVE_INFINITY: Dynamic = Number.POSITIVE_INFINITY,
      NEGATIVE_INFINITY: Dynamic = Number.NEGATIVE_INFINITY,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        input.left < POSITIVE_INFINITY && (POSITIVE_INFINITY = input.left);
        input.right > NEGATIVE_INFINITY && (NEGATIVE_INFINITY = input.right);
      },
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        for (
          let value4: Dynamic =
            input.nodeType === 1 ? input : input.parentElement;
          value4 && value4 !== element;
          value4 = value4.parentElement
        )
          if (value4.getAttribute("data-shrinkwrap") === "fill") return true;
        return false;
      },
      value: Dynamic = ownerDocument.createRange(),
      value2: Dynamic = ownerDocument.createTreeWalker(element, 5, {
        acceptNode: (input?: Dynamic): Dynamic => {
          if (input.nodeType === 1) {
            let value4: Dynamic = defaultView?.getComputedStyle(input);
            return value4 &&
              (value4.display === "none" ||
                value4.position === "absolute" ||
                value4.position === "fixed")
              ? 2
              : 1;
          }
          return callback2(input) ? 2 : 1;
        },
      }),
      value3: Dynamic = value2.nextNode();
    for (; value3; ) {
      if (value3.nodeType === 3) {
        value.selectNodeContents(value3);
        for (let value4 of (value.getClientRects?.() ?? []) as Dynamic)
          value4.width > 0 && (items.push(value4), callback(value4));
      } else {
        let value4: Dynamic = value3,
          value5: Dynamic = defaultView?.getComputedStyle(value4),
          bounds: Dynamic = value4.getBoundingClientRect();
        bounds.width > 0 && callback(bounds);
        if (value5 && !callback2(value4) && isInlineBox(value4, value5))
          for (let value6 of value4.getClientRects() as Dynamic)
            value6.width > 0 && items.push(value6);
        value5 &&
          (value5.overflowX !== "visible" || value5.overflowY !== "visible") &&
          (index +=
            Math.max(0, value4.scrollWidth - value4.clientWidth) +
            Math.max(0, value4.scrollHeight - value4.clientHeight));
      }
      value3 = value2.nextNode();
    }
    return {
      rects: items,
      clipped: index,
      boundLeft: POSITIVE_INFINITY,
      boundRight: NEGATIVE_INFINITY,
    };
  }
  function isInlineBox(input?: Dynamic, options?: Dynamic): Dynamic {
    return ComponentsShrinkWrapSubscribers.has(input.tagName.toUpperCase())
      ? true
      : options.display.startsWith("inline");
  }
  function measureShrinkWrapCandidate(
    element: Dynamic,
    {
      rects: rects,
      clipped: clipped,
      boundLeft: boundLeft,
      boundRight: boundRight,
    }: Dynamic,
  ): Dynamic {
    let value: Dynamic =
        element.ownerDocument.defaultView?.getComputedStyle(element),
      bounds: Dynamic = element.getBoundingClientRect(),
      index: Dynamic = 0;
    if (value && Number.isFinite(boundLeft)) {
      let value2: Dynamic = parseFloat(value.width),
        value3: Dynamic =
          value.boxSizing === "border-box"
            ? value2
            : value2 +
              parseFloat(value.paddingLeft) +
              parseFloat(value.paddingRight) +
              parseFloat(value.borderLeftWidth) +
              parseFloat(value.borderRightWidth),
        value4: Dynamic = (value3 > 0 && bounds.width / value3) || 1,
        value5: Dynamic =
          bounds.left +
          (parseFloat(value.borderLeftWidth) + parseFloat(value.paddingLeft)) *
            value4,
        value6: Dynamic =
          bounds.right -
          (parseFloat(value.borderRightWidth) +
            parseFloat(value.paddingRight)) *
            value4;
      index =
        Math.max(0, boundRight - value6) + Math.max(0, value5 - boundLeft);
    }
    return {
      height: element.scrollHeight,
      overflow: element.scrollWidth,
      client: element.clientWidth,
      spill: index,
      clipped: clipped,
      widths: rects.map((input?: Dynamic): Dynamic => input.width),
    };
  }
  function preservesContentLayout(input?: Dynamic, options?: Dynamic): Dynamic {
    return options.height > input.height ||
      options.overflow > options.client + 0.5 ||
      options.spill > input.spill + 0.5 ||
      options.clipped > input.clipped + 0.5
      ? false
      : input.widths.length === options.widths.length &&
          input.widths.every(
            (input2?: Dynamic, options2?: Dynamic): Dynamic =>
              Math.abs(input2 - (options.widths[options2] ?? NaN)) <= 0.5,
          );
  }
  function restoreShrinkWrapWidth(input?: Dynamic): Dynamic {
    ComponentsShrinkWrapElementCache.has(input) &&
      (rememberOriginalWidth(input),
      applyShrinkWrapWidth(
        input,
        ComponentsShrinkWrapElementCache.get(input) ?? "",
      ));
  }
  function createShrinkWrapJob(input?: Dynamic, options?: Dynamic): Dynamic {
    return {
      el: input,
      done: options,
      boxWidth: 0,
      borderBoxSizing: true,
      natural: null,
      candidate: 0,
      stage: "read",
      lo: 0,
      hi: 0,
      probes: 0,
      resizeDue: false,
    };
  }
  function settleShrinkWrapJob(input?: Dynamic, options?: Dynamic): Dynamic {
    options === null
      ? restoreShrinkWrapWidth(input.el)
      : applyShrinkWrapWidth(input.el, `${options}px`);
    input.stage = "settled";
    input.done(options);
  }
  function measureShrinkWrapJob(input?: Dynamic): Dynamic {
    let { el: value }: Dynamic = input,
      defaultView: Dynamic = value.ownerDocument.defaultView;
    if (!defaultView || typeof value.getBoundingClientRect != "function") {
      settleShrinkWrapJob(input, null);
      return;
    }
    let style: Dynamic = defaultView.getComputedStyle(value),
      value2: Dynamic = parseFloat(style.width);
    if (!Number.isFinite(value2) || value2 <= 0) {
      settleShrinkWrapJob(input, null);
      return;
    }
    let value3: Dynamic = style.boxSizing === "border-box",
      value4: Dynamic =
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.borderRightWidth),
      value5: Dynamic = measureInlineContent(value),
      { rects: value6 }: Dynamic = value5;
    if (value6.length === 0) {
      settleShrinkWrapJob(input, null);
      return;
    }
    input.natural = measureShrinkWrapCandidate(value, value5);
    input.boxWidth = value2;
    input.borderBoxSizing = value3;
    let POSITIVE_INFINITY: Dynamic = Number.POSITIVE_INFINITY,
      NEGATIVE_INFINITY: Dynamic = Number.NEGATIVE_INFINITY;
    for (let value12 of value6 as Dynamic) {
      value12.left < POSITIVE_INFINITY && (POSITIVE_INFINITY = value12.left);
      value12.right > NEGATIVE_INFINITY && (NEGATIVE_INFINITY = value12.right);
    }
    let value7: Dynamic = value3 ? value2 : value2 + value4,
      value8: Dynamic = value.getBoundingClientRect().width / value7 || 1,
      value9: Dynamic = (NEGATIVE_INFINITY - POSITIVE_INFINITY) / value8,
      value10: Dynamic = value3 ? value9 + value4 : value9,
      value11: Dynamic = Math.ceil(value10 - 0.001);
    if (value11 >= value2 - 0.5) {
      settleShrinkWrapJob(input, null);
      return;
    }
    input.candidate = value11;
    input.stage = "verify";
  }
  function verifyShrinkWrapJob(input?: Dynamic): Dynamic {
    return (
      input.natural !== null &&
      preservesContentLayout(
        input.natural,
        measureShrinkWrapCandidate(input.el, measureInlineContent(input.el)),
      )
    );
  }
  function nextShrinkWrapCandidate(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let { boxWidth: value }: Dynamic = input;
    if (input.stage === "verify") {
      if (options) {
        settleShrinkWrapJob(input, input.candidate);
        return null;
      }
      input.stage = "nudge1";
      if (input.candidate + 1 < value) return input.candidate + 1;
      input.stage = "bisect";
    } else if (input.stage === "nudge1") {
      if (options) {
        settleShrinkWrapJob(input, input.candidate + 1);
        return null;
      }
      input.stage = "nudge2";
      if (input.candidate + 2 < value) return input.candidate + 2;
      input.stage = "bisect";
    } else if (input.stage === "nudge2") {
      if (options) {
        settleShrinkWrapJob(input, input.candidate + 2);
        return null;
      }
      input.stage = "bisect";
    } else if (input.stage === "bisect") {
      input.probes += 1;
      let value2: Dynamic =
        input.lo > 0 ? Math.floor((input.lo + input.hi) / 2) : NaN;
      options ? (input.hi = value2) : (input.lo = value2);
    }
    return input.stage === "bisect"
      ? (input.lo === 0 &&
          ((input.lo = input.candidate + 2), (input.hi = Math.ceil(value))),
        input.probes >= ComponentsShrinkWrapLimit || input.hi - input.lo <= 1
          ? (input.hi < value - 0.5
              ? settleShrinkWrapJob(input, input.hi)
              : settleShrinkWrapJob(input, null),
            null)
          : Math.floor((input.lo + input.hi) / 2))
      : null;
  }
  function runShrinkWrapBatch(input?: Dynamic): Dynamic {
    for (let value2 of input as Dynamic) {
      rememberOriginalWidth(value2.el);
      restoreShrinkWrapWidth(value2.el);
    }
    for (let value2 of input as Dynamic) measureShrinkWrapJob(value2);
    let value: Dynamic = input.filter(
      (input2?: Dynamic): Dynamic => input2.stage === "verify",
    );
    for (let value2 of value as Dynamic)
      applyShrinkWrapWidth(value2.el, `${value2.candidate}px`);
    for (let index: Dynamic = 0; value.length > 0 && index < 16; index++) {
      let value2: Dynamic = value.map(
          (input2?: Dynamic): Dynamic => [input2, verifyShrinkWrapJob(input2)],
        ),
        items: Dynamic = [];
      for (let [value3, value4] of value2 as Dynamic) {
        let value5: Dynamic = nextShrinkWrapCandidate(value3, value4);
        value5 !== null && items.push([value3, value5]);
      }
      for (let [value3, value4] of items as Dynamic)
        applyShrinkWrapWidth(value3.el, `${value4}px`);
      value = items.map(([input2]: Dynamic): Dynamic => input2);
    }
    for (let value2 of value as Dynamic)
      value2.stage !== "settled" && settleShrinkWrapJob(value2, null);
  }
  function shrinkWrapElement(input?: Dynamic): Dynamic {
    let value: Dynamic = null;
    runShrinkWrapBatch([
      createShrinkWrapJob(input, (input2?: Dynamic): Dynamic => {
        value = input2;
      }),
    ]);
    return value;
  }
  function getShrinkWrapQueue(input?: Dynamic): Dynamic {
    let entry: Dynamic = ComponentsShrinkWrapElementCache_3.get(input);
    entry ||
      ((entry = {
        queue: new Map(),
        microtaskQueued: false,
        frameQueued: 0,
      }),
      ComponentsShrinkWrapElementCache_3.set(input, entry));
    return entry;
  }
  function flushShrinkWrapJobs(
    input?: Dynamic,
    options?: Dynamic,
    items?: Dynamic,
  ): Dynamic {
    items.length > 0 && runShrinkWrapBatch(items);
    !(options.queue.size > 0) &&
      (options.frameQueued &&
        (input.cancelAnimationFrame(options.frameQueued),
        (options.frameQueued = 0)),
      options.microtaskQueued ||
        ComponentsShrinkWrapElementCache_3.delete(input));
  }
  function flushShrinkWrapMicrotask(input?: Dynamic): Dynamic {
    let entry: Dynamic = ComponentsShrinkWrapElementCache_3.get(input);
    if (!entry) return;
    entry.microtaskQueued = false;
    entry.frameQueued &&
      (input.cancelAnimationFrame(entry.frameQueued), (entry.frameQueued = 0));
    let items: Dynamic = [...entry.queue.values()];
    entry.queue.clear();
    flushShrinkWrapJobs(input, entry, items);
  }
  function flushShrinkWrapResizeJobs(input?: Dynamic): Dynamic {
    let entry: Dynamic = ComponentsShrinkWrapElementCache_3.get(input);
    if (!entry) return;
    let items: Dynamic = [];
    for (let [value, value2] of entry.queue as Dynamic)
      value2.resizeDue && (entry.queue.delete(value), items.push(value2));
    flushShrinkWrapJobs(input, entry, items);
  }
  function scheduleShrinkWrapJob(
    element?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let defaultView: Dynamic = element.ownerDocument.defaultView;
    if (!defaultView) {
      options(shrinkWrapElement(element));
      return;
    }
    let value: Dynamic = getShrinkWrapQueue(defaultView),
      entry: Dynamic = value.queue.get(element);
    entry
      ? (entry.done = options)
      : ((entry = createShrinkWrapJob(element, options)),
        value.queue.set(element, entry));
    context === "microtask"
      ? value.microtaskQueued ||
        ((value.microtaskQueued = true),
        queueMicrotask((): Dynamic => {
          flushShrinkWrapMicrotask(defaultView);
        }))
      : context === "resize"
        ? (entry.resizeDue = true)
        : !value.frameQueued &&
          !value.microtaskQueued &&
          (value.frameQueued = defaultView.requestAnimationFrame(
            (): Dynamic => {
              flushShrinkWrapMicrotask(defaultView);
            },
          ));
  }
  function cancelShrinkWrapJob(element?: Dynamic): Dynamic {
    let defaultView: Dynamic = element.ownerDocument.defaultView;
    if (!defaultView) return;
    let entry: Dynamic = ComponentsShrinkWrapElementCache_3.get(defaultView);
    entry &&
      (entry.queue.delete(element),
      flushShrinkWrapJobs(defaultView, entry, []));
  }
  function shrinkWrapNeedsResize(input?: Dynamic): Dynamic {
    if (input.self) {
      let value: Dynamic =
        input.applied !== null && Math.abs(input.inline - input.applied) <= 1;
      return (
        Math.abs(input.block - input.prevBlock) > 1 ||
        (!value && Math.abs(input.inline - input.prevInline) > 1)
      );
    }
    return Math.abs(input.inline - input.prevInline) > 1;
  }
  function observeShrinkWrapResize(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = ComponentsShrinkWrapElementCache_4.get(input);
    if (!entry) {
      let entries: Dynamic = new Map();
      entry = {
        observer: new input.ResizeObserver((input2?: Dynamic): Dynamic => {
          for (let value of input2 as Dynamic)
            for (let value2 of (entries.get(value.target) ?? []) as Dynamic)
              value2(value);
          flushShrinkWrapResizeJobs(input);
        }),
        handlers: entries,
        paused: new Set(),
        resumeQueued: 0,
      };
      ComponentsShrinkWrapElementCache_4.set(input, entry);
    }
    let entry2: Dynamic = entry.handlers.get(options);
    entry2 ||
      ((entry2 = new Set()),
      entry.handlers.set(options, entry2),
      entry.observer.observe(options));
    entry2.add(context);
  }
  function unobserveShrinkWrapResize(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let entry: Dynamic = ComponentsShrinkWrapElementCache_4.get(input),
      value: Dynamic = entry?.handlers.get(options);
    !entry ||
      !value ||
      (value.delete(context),
      value.size === 0 &&
        (entry.handlers.delete(options),
        entry.paused.delete(options),
        entry.observer.unobserve(options)),
      entry.handlers.size === 0 &&
        (entry.observer.disconnect(),
        entry.resumeQueued && input.cancelAnimationFrame(entry.resumeQueued),
        ComponentsShrinkWrapElementCache_4.delete(input)));
  }
  function pauseShrinkWrapResize(input?: Dynamic, options?: Dynamic): Dynamic {
    let entry: Dynamic = ComponentsShrinkWrapElementCache_4.get(input);
    !entry ||
      !entry.handlers.has(options) ||
      entry.paused.has(options) ||
      (entry.observer.unobserve(options),
      entry.paused.add(options),
      entry.resumeQueued ||
        (entry.resumeQueued = input.requestAnimationFrame((): Dynamic => {
          entry.resumeQueued = 0;
          for (let value of entry.paused as Dynamic)
            entry.handlers.has(value) && entry.observer.observe(value);
          entry.paused.clear();
        })));
  }
  function observeShrinkWrap(
    element?: Dynamic,
    { immediate: options = false }: Dynamic = {},
  ): Dynamic {
    let flag: Dynamic = false,
      value: Dynamic = null,
      defaultView: Dynamic = element.ownerDocument.defaultView,
      entries: Dynamic = new Map(),
      items: Dynamic = [],
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        let value4: Dynamic = input;
        entries.set(input, {
          inline: value4.offsetWidth ?? 0,
          block: value4.offsetHeight ?? 0,
        });
      },
      value2: Dynamic = defaultView?.ResizeObserver ? defaultView : null,
      index: Dynamic = 0,
      callback2: Dynamic = (input?: Dynamic): Dynamic => {
        if (!flag) {
          value = input;
          for (let value4 of items as Dynamic) callback(value4);
          if (value2 && index > 0)
            for (let value4 of items.slice(index) as Dynamic)
              pauseShrinkWrapResize(value2, value4);
          index = 0;
        }
      },
      callback3: Dynamic = (input?: Dynamic): Dynamic => {
        flag || scheduleShrinkWrapJob(element, callback2, input);
      };
    options ? (value = shrinkWrapElement(element)) : callback3("microtask");
    let callback4: Dynamic = (event?: Dynamic): Dynamic => {
        let value4: Dynamic = event.borderBoxSize?.[0],
          value5: Dynamic = value4
            ? value4.inlineSize
            : event.contentRect.width,
          value6: Dynamic = value4
            ? value4.blockSize
            : event.contentRect.height,
          value7: Dynamic = entries.get(event.target) ?? {
            inline: value5,
            block: value6,
          };
        entries.set(event.target, {
          inline: value5,
          block: value6,
        });
        let value8: Dynamic = event.target === element;
        shrinkWrapNeedsResize({
          self: value8,
          inline: value5,
          block: value6,
          prevInline: value7.inline,
          prevBlock: value7.block,
          applied: value,
        }) &&
          (value8 || (index = Math.max(index, items.indexOf(event.target))),
          callback3(value8 ? "frame" : "resize"));
      },
      callback5: Dynamic = (input?: Dynamic): Dynamic => {
        value2 && observeShrinkWrapResize(value2, input, callback4);
        items.push(input);
        options && callback(input);
      };
    callback5(element);
    for (
      let parentElement: Dynamic = element.parentElement, index2: Dynamic = 0;
      parentElement && index2 < ComponentsShrinkWrapLimit_2;
      parentElement = parentElement.parentElement, index2++
    )
      callback5(parentElement);
    let value3: Dynamic = defaultView?.MutationObserver
      ? new defaultView.MutationObserver((): Dynamic => {
          callback3("microtask");
        })
      : null;
    value3?.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [ShrinkwrapAttribute],
    });
    let fonts: Dynamic = element.ownerDocument.fonts,
      callback6: Dynamic = (): Dynamic => callback3("microtask");
    fonts?.addEventListener?.("loadingdone", callback6);
    fonts && fonts.status !== "loaded" && fonts.ready.then(callback6);
    return (): Dynamic => {
      flag = true;
      cancelShrinkWrapJob(element);
      if (value2)
        for (let value4 of items as Dynamic)
          unobserveShrinkWrapResize(value2, value4, callback4);
      value3?.disconnect();
      fonts?.removeEventListener?.("loadingdone", callback6);
      restoreShrinkWrapWidth(element);
    };
  }
  function useShrinkWrap({
    enabled: input = true,
    immediate: input2 = false,
  }: Dynamic = {}): Dynamic {
    let value: Dynamic = (0, reactComponentsShrinkWrap.useRef)(null);
    return (0, reactComponentsShrinkWrap.useCallback)(
      (input3?: Dynamic): Dynamic => {
        value.current?.();
        value.current = null;
        if (!!input3) {
          if (!input) {
            restoreShrinkWrapWidth(input3);
            return;
          }
          value.current = observeShrinkWrap(input3, {
            immediate: input2,
          });
        }
      },
      [input, input2],
    );
  }
  bindRuntimeValue(runtime, "applyShrinkWrapWidth", () => applyShrinkWrapWidth);
  bindRuntimeValue(
    runtime,
    "rememberOriginalWidth",
    () => rememberOriginalWidth,
  );
  bindRuntimeValue(runtime, "measureInlineContent", () => measureInlineContent);
  bindRuntimeValue(runtime, "isInlineBox", () => isInlineBox);
  bindRuntimeValue(
    runtime,
    "measureShrinkWrapCandidate",
    () => measureShrinkWrapCandidate,
  );
  bindRuntimeValue(
    runtime,
    "preservesContentLayout",
    () => preservesContentLayout,
  );
  bindRuntimeValue(
    runtime,
    "restoreShrinkWrapWidth",
    () => restoreShrinkWrapWidth,
  );
  bindRuntimeValue(runtime, "createShrinkWrapJob", () => createShrinkWrapJob);
  bindRuntimeValue(runtime, "settleShrinkWrapJob", () => settleShrinkWrapJob);
  bindRuntimeValue(runtime, "measureShrinkWrapJob", () => measureShrinkWrapJob);
  bindRuntimeValue(runtime, "verifyShrinkWrapJob", () => verifyShrinkWrapJob);
  bindRuntimeValue(
    runtime,
    "nextShrinkWrapCandidate",
    () => nextShrinkWrapCandidate,
  );
  bindRuntimeValue(runtime, "runShrinkWrapBatch", () => runShrinkWrapBatch);
  bindRuntimeValue(runtime, "shrinkWrapElement", () => shrinkWrapElement);
  bindRuntimeValue(runtime, "getShrinkWrapQueue", () => getShrinkWrapQueue);
  bindRuntimeValue(runtime, "flushShrinkWrapJobs", () => flushShrinkWrapJobs);
  bindRuntimeValue(
    runtime,
    "flushShrinkWrapMicrotask",
    () => flushShrinkWrapMicrotask,
  );
  bindRuntimeValue(
    runtime,
    "flushShrinkWrapResizeJobs",
    () => flushShrinkWrapResizeJobs,
  );
  bindRuntimeValue(
    runtime,
    "scheduleShrinkWrapJob",
    () => scheduleShrinkWrapJob,
  );
  bindRuntimeValue(runtime, "cancelShrinkWrapJob", () => cancelShrinkWrapJob);
  bindRuntimeValue(
    runtime,
    "shrinkWrapNeedsResize",
    () => shrinkWrapNeedsResize,
  );
  bindRuntimeValue(
    runtime,
    "observeShrinkWrapResize",
    () => observeShrinkWrapResize,
  );
  bindRuntimeValue(
    runtime,
    "unobserveShrinkWrapResize",
    () => unobserveShrinkWrapResize,
  );
  bindRuntimeValue(
    runtime,
    "pauseShrinkWrapResize",
    () => pauseShrinkWrapResize,
  );
  bindRuntimeValue(runtime, "observeShrinkWrap", () => observeShrinkWrap);
  bindRuntimeValue(
    runtime,
    "MaxWidthValue",
    () => MaxWidthValue,
    (value) => {
      MaxWidthValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShrinkWrapElementCache",
    () => ComponentsShrinkWrapElementCache,
    (value) => {
      ComponentsShrinkWrapElementCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShrinkWrapElementCache_2",
    () => ComponentsShrinkWrapElementCache_2,
    (value) => {
      ComponentsShrinkWrapElementCache_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShrinkWrapLimit",
    () => ComponentsShrinkWrapLimit,
    (value) => {
      ComponentsShrinkWrapLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ShrinkwrapAttribute",
    () => ShrinkwrapAttribute,
    (value) => {
      ShrinkwrapAttribute = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShrinkWrapLimit_2",
    () => ComponentsShrinkWrapLimit_2,
    (value) => {
      ComponentsShrinkWrapLimit_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShrinkWrapSubscribers",
    () => ComponentsShrinkWrapSubscribers,
    (value) => {
      ComponentsShrinkWrapSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShrinkWrapElementCache_3",
    () => ComponentsShrinkWrapElementCache_3,
    (value) => {
      ComponentsShrinkWrapElementCache_3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ComponentsShrinkWrapElementCache_4",
    () => ComponentsShrinkWrapElementCache_4,
    (value) => {
      ComponentsShrinkWrapElementCache_4 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsShrinkWrap",
    () => initializeComponentsShrinkWrap,
    (value) => {
      initializeComponentsShrinkWrap = value;
    },
  );
  bindRuntimeValue(runtime, "useShrinkWrap", () => useShrinkWrap);
  bindRuntimeValue(
    runtime,
    "reactComponentsShrinkWrap",
    () => reactComponentsShrinkWrap,
    (value) => {
      reactComponentsShrinkWrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxComponentsShrinkWrap",
    () => jsxComponentsShrinkWrap,
    (value) => {
      jsxComponentsShrinkWrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ShrinkWrap",
    () => ShrinkWrap,
    (value) => {
      ShrinkWrap = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeComponentsShrinkWrap_2",
    () => initializeComponentsShrinkWrap_2,
    (value) => {
      initializeComponentsShrinkWrap_2 = value;
    },
  );
  return () => {
    initializeComponentsShrinkWrap = (0, runtime.initializeOnce)(
      (): Dynamic => {
        MaxWidthValue = "maxWidth";
        ComponentsShrinkWrapElementCache = new WeakMap();
        ComponentsShrinkWrapElementCache_2 = new WeakMap();
        ComponentsShrinkWrapLimit = 12;
        ShrinkwrapAttribute = "data-shrinkwrap";
        ComponentsShrinkWrapLimit_2 = 16;
        ComponentsShrinkWrapSubscribers = new Set([
          "IMG",
          "SVG",
          "VIDEO",
          "AUDIO",
          "CANVAS",
          "IFRAME",
          "EMBED",
          "OBJECT",
          "PICTURE",
          "INPUT",
          "TEXTAREA",
          "SELECT",
          "PROGRESS",
          "METER",
        ]);
        ComponentsShrinkWrapElementCache_3 = new WeakMap();
        ComponentsShrinkWrapElementCache_4 = new WeakMap();
      },
    );
    initializeComponentsShrinkWrap_2 = (0, runtime.initializeOnce)(
      (): Dynamic => {
        "use client";

        (0, runtime.initializeDomRefComposition)();
        initializeComponentsShrinkWrap();
        reactComponentsShrinkWrap = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react)(),
        );
        jsxComponentsShrinkWrap = (0, runtime.toModuleNamespace)(
          (0, runtime.load_react_jsx_runtime)(),
        );
        ShrinkWrap = (0, reactComponentsShrinkWrap.forwardRef)(
          (
            {
              enabled = true,
              immediate = false,
              children: children,
              ...props
            }: Dynamic,
            options?: Dynamic,
          ): Dynamic => {
            let value: Dynamic = useShrinkWrap({
                enabled: enabled,
                immediate: immediate,
              }),
              value2: Dynamic = (0, runtime.useMergedRefs)(options, value);
            return (
              <div ref={value2} data-cds={"ShrinkWrap"} {...props}>
                {children}
              </div>
            );
          },
        );
        ShrinkWrap.displayName = "ShrinkWrap";
      },
    );
  };
}
