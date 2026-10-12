/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
(function (this: Dynamic, ..._extraArguments: Dynamic[]): Dynamic {
  /* Viewport guard */
  var value_doc: Dynamic = document;
  var value_align: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    detail?: Dynamic,
    ..._extraArguments2: Dynamic[]
  ): Dynamic {
    if (detail === "start") return input - context;
    if (detail === "end") return options - value;
    if (detail === "center")
      return (input + options) / 2 - (context + value) / 2;
    if (
      (input >= context && options <= value) ||
      (input < context && options > value)
    )
      return 0; /* fully visible, or covering */
    /* center-if-needed centres only a fully hidden target; a partly visible one moves to the nearest edge */
    if (detail === "center-if-needed" && (options <= context || input >= value))
      return (input + options) / 2 - (context + value) / 2;
    var value_fits: Dynamic = options - input <= value - context;
    if (input < context) return value_fits ? input - context : options - value;
    return value_fits ? options - value : input - context;
  };
  var value_styleOf: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments3: Dynamic[]
  ): Dynamic {
    try {
      return getComputedStyle(input);
    } catch (value_e: Dynamic) {
      return null;
    }
  };
  var value_set: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments4: Dynamic[]
  ): Dynamic {
    return !!input && input !== "none" && input !== "auto";
  };
  /* transform-like properties make a box the containing block of its absolute AND fixed descendants */
  var value_containsFixed: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments5: Dynamic[]
  ): Dynamic {
    return (
      value_set(input.transform) ||
      value_set(input.translate) ||
      value_set(input.rotate) ||
      value_set(input.scale) ||
      value_set(input.perspective) ||
      value_set(input.filter) ||
      value_set(input.backdropFilter) ||
      input.transformStyle === "preserve-3d" ||
      /layout|paint|strict|content/.test(input.contain || "") ||
      /(^|,)\s*(transform|translate|rotate|scale|perspective|filter|backdrop-filter)\s*(,|$)/.test(
        input.willChange || "",
      )
    );
  };
  var value_scrolls: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments6: Dynamic[]
  ): Dynamic {
    var value_v: Dynamic =
      options.overflow + " " + options.overflowX + " " + options.overflowY;
    return (
      /auto|scroll|hidden/.test(value_v) &&
      (input.scrollHeight > input.clientHeight ||
        input.scrollWidth > input.clientWidth)
    );
  };
  var value_up: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments7: Dynamic[]
  ): Dynamic {
    if (input.assignedSlot) return input.assignedSlot;
    var parentNode: Dynamic = input.parentNode;
    return parentNode && parentNode.nodeType === 11 && parentNode.host
      ? parentNode.host
      : parentNode;
  };
  /* Reveal el inside this document only: each scrolling ancestor, then the frame's own viewport. Never the parent's. */
  var value_reveal: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    ..._extraArguments8: Dynamic[]
  ): Dynamic {
    if (
      !input ||
      typeof input.getClientRects !== "function" ||
      input.getClientRects().length === 0
    )
      return; /* no box: nothing to reveal */
    var value_d: Dynamic = input.ownerDocument || value_doc;
    var value_root: Dynamic =
      value_d.scrollingElement || value_d.documentElement;
    /* Only boxes in el's containing-block chain can move it: an absolute box skips static ancestors up to a positioned or
     * transform-like one; a fixed box skips everything up to a transform-like one (none: not even the viewport moves it). */
    var value_es: Dynamic = value_styleOf(input);
    var value_pos: Dynamic = (value_es && value_es.position) || "static";
    var value_seekAbs: Dynamic = value_pos === "absolute",
      value_seekFixed: Dynamic = value_pos === "fixed";
    for (
      var value_n: Dynamic = value_up(input);
      value_n && value_n !== value_root && value_n.nodeType === 1;
      value_n = value_up(value_n)
    ) {
      var value_cs: Dynamic = value_styleOf(value_n);
      if (!value_cs) continue;
      value_pos = value_cs.position || "static";
      if (
        value_seekFixed
          ? !value_containsFixed(value_cs)
          : value_seekAbs &&
            value_pos === "static" &&
            !value_containsFixed(value_cs)
      )
        continue;
      value_seekAbs = value_pos === "absolute";
      value_seekFixed = value_pos === "fixed";
      if (!value_scrolls(value_n, value_cs)) continue;
      var bounds: Dynamic = input.getBoundingClientRect();
      var bounds2: Dynamic = value_n.getBoundingClientRect();
      var value_cTop: Dynamic = bounds2.top + value_n.clientTop,
        value_cLeft: Dynamic = bounds2.left + value_n.clientLeft;
      var scrollTop: Dynamic = value_align(
        bounds.top,
        bounds.bottom,
        value_cTop,
        value_cTop + value_n.clientHeight,
        options,
      );
      var scrollLeft: Dynamic = value_align(
        bounds.left,
        bounds.right,
        value_cLeft,
        value_cLeft + value_n.clientWidth,
        context,
      );
      if (!scrollLeft && !scrollTop) continue;
      /* instant even under CSS scroll-behavior:smooth: the next step must read the settled position ('smooth' applies to the viewport step) */
      if (typeof value_n.scrollTo === "function")
        value_n.scrollTo({
          left: value_n.scrollLeft + scrollLeft,
          top: value_n.scrollTop + scrollTop,
          behavior: "instant",
        });
      else {
        value_n.scrollTop += scrollTop;
        value_n.scrollLeft += scrollLeft;
      }
    }
    if (value_seekFixed) return;
    var bounds3: Dynamic = input.getBoundingClientRect();
    var value_vw: Dynamic =
        (value_root && value_root.clientWidth) ||
        (window as Dynamic).innerWidth,
      value_vh: Dynamic =
        (value_root && value_root.clientHeight) ||
        (window as Dynamic).innerHeight;
    var top: Dynamic = value_align(
      bounds3.top,
      bounds3.bottom,
      0,
      value_vh,
      options,
    );
    var left: Dynamic = value_align(
      bounds3.left,
      bounds3.right,
      0,
      value_vw,
      context,
    );
    if (left || top)
      (window as Dynamic).scrollBy({
        left: left,
        top: top,
        behavior: value ? "smooth" : "auto",
      });
  };
  var value_deepActive: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments9: Dynamic[]
  ): Dynamic {
    var value_r: Dynamic = input.getRootNode
      ? input.getRootNode()
      : options; /* el's own (possibly closed) shadow root sees its activeElement */
    var activeElement: Dynamic = (
      value_r && "activeElement" in value_r ? value_r : options
    ).activeElement;
    while (
      activeElement &&
      activeElement.shadowRoot &&
      activeElement.shadowRoot.activeElement
    )
      activeElement = activeElement.shadowRoot.activeElement;
    return activeElement;
  };
  var value_within: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    options?: Dynamic,
    ..._extraArguments0: Dynamic[]
  ): Dynamic {
    for (var value_n: Dynamic = input; value_n; value_n = value_up(value_n))
      if (value_n === options) return true;
    return false;
  };
  var value_guardFocus: Dynamic = function (
    this: Dynamic,
    input?: Dynamic,
    ..._extraArguments1: Dynamic[]
  ): Dynamic {
    if (!input || typeof input.focus !== "function") return;
    var focus: Dynamic = input.focus;
    /* reveal only what actually took focus (el, or its delegate inside it), and only if focus moved - as the native does */
    input.focus = function value_focus(
      this: Dynamic,
      input2?: Dynamic,
      ..._extraArguments10: Dynamic[]
    ): Dynamic {
      var value_d: Dynamic = this.ownerDocument || value_doc;
      var value_before: Dynamic = value_deepActive(this, value_d);
      // CucCut: restorer fix — call the saved native focus, as the original script does (`native.call`); the restored
      // code called the wrapper itself and recursed until the stack overflowed whenever an artboard element was focused.
      focus.call(
        this,
        input2 && input2.focusVisible !== undefined
          ? {
              preventScroll: true,
              focusVisible: input2.focusVisible,
            }
          : {
              preventScroll: true,
            },
      );
      if (input2 && input2.preventScroll) return;
      try {
        var value_a: Dynamic = value_deepActive(this, value_d);
        if (value_a && value_a !== value_before && value_within(value_a, this))
          value_reveal(value_a, "center-if-needed", "center-if-needed", false);
      } catch (value_e: Dynamic) {}
    };
  };
  value_guardFocus(
    (window as Dynamic).HTMLElement &&
      (window as Dynamic).HTMLElement.prototype,
  );
  value_guardFocus(
    (window as Dynamic).SVGElement && (window as Dynamic).SVGElement.prototype,
  );
  value_guardFocus(
    (window as Dynamic).MathMLElement &&
      (window as Dynamic).MathMLElement.prototype,
  );
  var Element: Dynamic = (window as Dynamic).Element;
  if (Element) {
    Element.prototype.scrollIntoView = function value_scrollIntoView(
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments11: Dynamic[]
    ): Dynamic {
      var value_dict: Dynamic = input == null || typeof input === "object";
      var value_o: Dynamic = (value_dict && input) || {};
      var value_block: Dynamic = value_dict
        ? value_o.block || "start"
        : input
          ? "start"
          : "end";
      try {
        value_reveal(
          this,
          value_block,
          value_o.inline || "nearest",
          value_o.behavior === "smooth",
        );
      } catch (value_e: Dynamic) {}
    };
    Element.prototype.scrollIntoViewIfNeeded =
      function value_scrollIntoViewIfNeeded(
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments12: Dynamic[]
      ): Dynamic {
        var value_mode: Dynamic =
          input === undefined || input ? "center-if-needed" : "nearest";
        try {
          value_reveal(this, value_mode, value_mode, false);
        } catch (value_e: Dynamic) {}
      };
  }
})();
