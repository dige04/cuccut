/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorLayoutGroupCapture(
  runtime: RuntimeBindings,
): () => void {
  var LayoutGroupCaptureBackgroundColorBorderStyleBorderColorValues: Dynamic;
  function captureGroupLayout(
    input?: Dynamic,
    items?: Dynamic,
    items2?: Dynamic,
    value?: Dynamic,
    items3?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    let items4: Dynamic = ["transform", "translate", "rotate", "scale"];
    function value2(input2?: Dynamic): Dynamic {
      let value17: Dynamic = input2.hasAttribute("data-sc-name")
          ? input2.parentElement
          : input2,
        value18: Dynamic = value17 ? value17.closest("[data-sc-name]") : null;
      return value18 ? value18.getAttribute("data-sc-name") : null;
    }
    function value3(input2?: Dynamic): Dynamic {
      let value17: Dynamic = (document as Dynamic).querySelectorAll(
        '[data-dc-tpl="' + String(input2) + '"]',
      );
      for (let index2: Dynamic = 0; index2 < value17.length; index2++) {
        let value18: Dynamic = value17[index2];
        if (
          value2(value18) === input &&
          !value18.closest("[data-dc-editor-overlay]")
        )
          return value18;
      }
      return null;
    }
    let callback: Dynamic = function (input2?: Dynamic): Dynamic {
        let value17: Dynamic = parseFloat(input2);
        return isFinite(value17) ? value17 : 0;
      },
      items5: Dynamic = [];
    function value4(element?: Dynamic, options?: Dynamic): Dynamic {
      let attribute: Dynamic = element.getAttribute("style"),
        value17: Dynamic = (attribute || "") + ";transition:none!important";
      element.setAttribute("style", value17 + options);
      items5.push(function (): Dynamic {
        element.setAttribute("style", value17);
        element.getBoundingClientRect();
        attribute === null
          ? element.removeAttribute("style")
          : element.setAttribute("style", attribute);
      });
    }
    function value5(input2?: Dynamic): Dynamic {
      let text: Dynamic = "";
      for (let index2: Dynamic = 0; index2 < items4.length; index2++)
        text +=
          ";" +
          items4[index2] +
          ":" +
          (input2.getPropertyValue(items4[index2]) || "none");
      return text;
    }
    function value6(input2?: Dynamic): Dynamic {
      let items13: Dynamic = [];
      for (let index2: Dynamic = 0; index2 < items4.length; index2++) {
        let value17: Dynamic = value12(input2, items4[index2]);
        if (value17 === null) return null;
        items13.push(value17 || "none");
      }
      return items13;
    }
    function value7(
      input2?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value17?: Dynamic,
      extra?: Dynamic,
    ): Dynamic {
      let value18: Dynamic = input2.cloneNode(false);
      input2.firstChild &&
        value18.appendChild((document as Dynamic).createTextNode("x"));
      value18.style.setProperty("transition", "none", "important");
      value18.style.setProperty("animation", "none", "important");
      let value19: Dynamic = value18;
      value17 &&
        ((value19 = (document as Dynamic).createElement("div")),
        value19.appendChild(value18));
      try {
        options.insertBefore(value19, context);
        extra(value18);
      } finally {
        value19.parentNode && value19.parentNode.removeChild(value19);
      }
    }
    let items6: Dynamic = [];
    function value8(input2?: Dynamic, options?: Dynamic): Dynamic {
      for (let index2: Dynamic = 0; index2 < items6.length; index2++)
        if (
          items6[index2].container === input2 &&
          items6[index2].fixed === options
        )
          return items6[index2];
      return null;
    }
    function value9(
      input2?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      if (value8(input2, options)) return;
      let state: Dynamic = {
        container: input2,
        fixed: options,
        made: [],
        a: null,
        b: null,
      };
      items6.push(state);
      items5.push(function (): Dynamic {
        for (let index2: Dynamic = 0; index2 < state.made.length; index2++)
          state.made[index2].parentNode &&
            state.made[index2].parentNode.removeChild(state.made[index2]);
      });
      let items13: Dynamic = [
        [0, 0],
        [100, 0],
        [0, 100],
      ];
      for (let index2: Dynamic = 0; index2 < 3; index2++) {
        let value17: Dynamic = (document as Dynamic).createElement("div");
        value17.style.cssText =
          "all:initial!important;display:block!important;position:" +
          (options ? "fixed" : "absolute") +
          "!important;left:" +
          String(items13[index2][0]) +
          "px!important;top:" +
          String(items13[index2][1]) +
          "px!important;width:0!important;height:0!important;visibility:hidden!important;pointer-events:none!important";
        state.made.push(value17);
        input2.insertBefore(
          value17,
          context && context.parentNode === input2 ? context : null,
        );
      }
    }
    function value10(input2?: Dynamic): Dynamic {
      for (let index2: Dynamic = 0; index2 < items6.length; index2++) {
        let value17: Dynamic = items6[index2].made.map(function (
          input3?: Dynamic,
        ): Dynamic {
          let bounds: Dynamic = input3.getBoundingClientRect();
          return [bounds.left, bounds.top];
        });
        value17.length < 3 ||
          (items6[index2][input2] = {
            ox: value17[0][0],
            oy: value17[0][1],
            ux: (value17[1][0] - value17[0][0]) / 100,
            uy: (value17[1][1] - value17[0][1]) / 100,
            vx: (value17[2][0] - value17[0][0]) / 100,
            vy: (value17[2][1] - value17[0][1]) / 100,
          });
      }
    }
    function value11(input2?: Dynamic, options?: Dynamic): Dynamic {
      return (
        Math.abs(input2.ux - options.ux) < 0.002 &&
        Math.abs(input2.uy - options.uy) < 0.002 &&
        Math.abs(input2.vx - options.vx) < 0.002 &&
        Math.abs(input2.vy - options.vy) < 0.002
      );
    }
    function value12(input2?: Dynamic, options?: Dynamic): Dynamic {
      let computedStyleMap: Dynamic = input2.computedStyleMap;
      if (typeof computedStyleMap != "function") return null;
      try {
        let entry: Dynamic = computedStyleMap.call(input2).get(options);
        return entry == null ? "" : String(entry);
      } catch {
        return null;
      }
    }
    let value13: Dynamic =
        /^(INPUT|SELECT|TEXTAREA|OPTION|IMG|IFRAME|VIDEO|AUDIO|CANVAS|OBJECT|EMBED|SCRIPT|LINK|STYLE)$/,
      items7: Dynamic = [],
      value14: Dynamic = null;
    for (let index2: Dynamic = 0; index2 < items.length; index2++) {
      let value17: Dynamic = value3(items[index2]);
      items7.push(value17);
      value17 && !value14 && (value14 = value17);
    }
    if (!value14) return null;
    let value15: Dynamic = null;
    for (let index2: Dynamic = 0; index2 < items2.length && !value15; index2++)
      value15 = value3(items2[index2]);
    if (!value15) {
      let value17: Dynamic = value14.hasAttribute("data-sc-name")
        ? value14.parentElement
        : value14;
      value15 = value17 ? value17.closest("[data-sc-name]") : null;
    }
    if (!value15) return null;
    let value16: Dynamic = value15,
      items8: Dynamic = [],
      items9: Dynamic = [],
      items10: Dynamic = [],
      items11: Dynamic = [],
      items12: Dynamic = [];
    try {
      for (let index2: Dynamic = 0; index2 < items7.length; index2++) {
        let value19: Dynamic = items7[index2];
        if (
          !value19 ||
          !value19.parentElement ||
          !value16.contains(value19) ||
          value19 === value16
        )
          continue;
        let value20: Dynamic = getComputedStyle(value19),
          value21: Dynamic = value12(value19, "width"),
          value22: Dynamic = null;
        if (value21 !== null) {
          let value23: Dynamic = value12(value19, "height") || "",
            value24: Dynamic = ["left", "right", "top", "bottom"].map(function (
              input2?: Dynamic,
            ): Dynamic {
              return (value12(value19, input2) || "auto") !== "auto";
            }),
            value25: Dynamic = [
              "margin-left",
              "margin-right",
              "margin-top",
              "margin-bottom",
            ].some(function (input2?: Dynamic): Dynamic {
              return value12(value19, input2) === "auto";
            });
          value22 = {
            widthAuto: value21 === "auto",
            heightAuto: value23 === "auto",
            widthPercent: value21.indexOf("%") >= 0,
            heightPercent: value23.indexOf("%") >= 0,
            left: value24[0],
            right: value24[1],
            top: value24[2],
            bottom: value24[3],
            marginAuto: value25,
          };
        }
        items8.push({
          el: value19,
          cs: value20,
          fixed: value20.position === "fixed",
          abs: value20.position === "absolute",
          rendered: value22,
        });
        for (
          let parentElement: Dynamic = value19.parentElement;
          parentElement && parentElement !== value16;
          parentElement = parentElement.parentElement
        ) {
          if (
            items9.indexOf(parentElement) >= 0 ||
            !parentElement.matches(":hover") ||
            !parentElement.parentNode ||
            value13.test(parentElement.tagName) ||
            parentElement.tagName.indexOf("-") >= 0
          )
            continue;
          items9.push(parentElement);
          let value23: Dynamic = value6(parentElement);
          if (!value23) continue;
          let value24: Dynamic = null;
          value7(
            parentElement,
            parentElement.parentNode,
            parentElement,
            false,
            function (input2?: Dynamic): Dynamic {
              value24 = value6(input2);
            },
          );
          let value25: Dynamic = value24;
          !value25 ||
            value25.join("|") === value23.join("|") ||
            (items10.push([parentElement, value25]),
            value4(
              parentElement,
              value25
                .map(function (input2?: Dynamic, options?: Dynamic): Dynamic {
                  return ";" + items4[options] + ":" + input2 + "!important";
                })
                .join(""),
            ));
        }
      }
      for (let index2: Dynamic = 0; index2 < items8.length; index2++)
        value5(items8[index2].cs) !==
          ";transform:none;translate:none;rotate:none;scale:none" &&
          value4(
            items8[index2].el,
            ";transform:none!important;translate:none!important;rotate:none!important;scale:none!important",
          );
      let value17: Dynamic = items8.some(function (input2?: Dynamic): Dynamic {
          return input2.fixed;
        }),
        value18: Dynamic = null;
      if (items8.length > 0) {
        let el: Dynamic = items8[items8.length - 1].el;
        for (; el.parentElement && el.parentElement !== value16; )
          el = el.parentElement;
        el.parentElement === value16 && (value18 = value ? el.nextSibling : el);
      }
      value9(value16, false, value18);
      value17 && value9(value16, true, value18);
      value10("a");
      for (let index2: Dynamic = 0; index2 < items8.length; index2++)
        items12.push(items8[index2].el.getBoundingClientRect());
      for (let index2: Dynamic = 0; index2 < items8.length; index2++)
        value9(items8[index2].el.parentElement, items8[index2].fixed, null);
      value10("b");
    } finally {
      for (let value17: Dynamic = items5.length - 1; value17 >= 0; value17--)
        try {
          items5[value17]();
        } catch {}
      items5 = [];
    }
    let index: Dynamic = 0;
    for (let index2: Dynamic = 0; index2 < items7.length; index2++) {
      let value17: Dynamic = items7[index2];
      if (
        !value17 ||
        !value17.parentElement ||
        !value16.contains(value17) ||
        value17 === value16
      ) {
        items11.push(null);
        continue;
      }
      let value18: Dynamic = items8[index],
        value19: Dynamic = items12[index];
      index++;
      let cs2: Dynamic = value18.cs,
        value20: Dynamic = value8(value16, value18.fixed),
        value21: Dynamic = value8(value17.parentElement, value18.fixed),
        value22: Dynamic = value20 ? value20.a : null,
        value23: Dynamic = value20 ? value20.b : null,
        value24: Dynamic = value21 ? value21.b : null,
        value25: Dynamic = value22
          ? value22.ux * value22.vy - value22.uy * value22.vx
          : 0,
        value26: Dynamic = cs2.zoom || "1";
      if (
        !value22 ||
        !value23 ||
        !value24 ||
        !value19 ||
        Math.abs(value25) < 1e-6 ||
        cs2.display === "none" ||
        !/^(1|normal)$/.test(value26) ||
        (value19.width === 0 &&
          value19.height === 0 &&
          value17.getClientRects().length === 0)
      ) {
        items11.push(null);
        continue;
      }
      let value27: Dynamic = callback(cs2.width),
        value28: Dynamic = callback(cs2.height);
      cs2.boxSizing !== "border-box" &&
        ((value27 +=
          callback(cs2.paddingLeft) +
          callback(cs2.paddingRight) +
          callback(cs2.borderLeftWidth) +
          callback(cs2.borderRightWidth)),
        (value28 +=
          callback(cs2.paddingTop) +
          callback(cs2.paddingBottom) +
          callback(cs2.borderTopWidth) +
          callback(cs2.borderBottomWidth)));
      let value29: Dynamic = value17,
        value30: Dynamic =
          Math.abs(value22.uy) < 0.001 && Math.abs(value22.vx) < 0.001;
      callback(cs2.width) > 0 ||
        (value27 = value30
          ? value19.width / Math.abs(value22.ux)
          : value29.offsetWidth || 0);
      callback(cs2.height) > 0 ||
        (value28 = value30
          ? value19.height / Math.abs(value22.vy)
          : value29.offsetHeight || 0);
      let value31: Dynamic = value19.left + value19.width / 2 - value22.ox,
        value32: Dynamic = value19.top + value19.height / 2 - value22.oy,
        value33: Dynamic =
          (value22.vy * value31 - value22.vx * value32) / value25,
        value34: Dynamic =
          (value22.ux * value32 - value22.uy * value31) / value25,
        index3: Dynamic = 0,
        flag: Dynamic = false;
      for (
        let parentElement: Dynamic = value17.parentElement;
        parentElement && parentElement !== value16;
        parentElement = parentElement.parentElement
      ) {
        let value40: Dynamic = getComputedStyle(parentElement),
          value41: Dynamic = parseInt(value40.zIndex, 10),
          value42: Dynamic =
            value40.zIndex !== "auto" &&
            (/^(relative|absolute|fixed|sticky)$/.test(value40.position) ||
              /flex|grid/.test(
                parentElement.parentElement
                  ? getComputedStyle(parentElement.parentElement).display
                  : "",
              )),
          value43: Dynamic = null;
        for (let index4: Dynamic = 0; index4 < items10.length; index4++)
          items10[index4][0] === parentElement &&
            (value43 = items10[index4][1]);
        let value44: Dynamic = value43
          ? value43.some(function (input2?: Dynamic): Dynamic {
              return input2 !== "none";
            })
          : (!!value40.transform && value40.transform !== "none") ||
            ["translate", "rotate", "scale"].some(function (
              input2?: Dynamic,
            ): Dynamic {
              let value45: Dynamic = value40.getPropertyValue(input2);
              return !!value45 && value45 !== "none";
            });
        (value42 ||
          parseFloat(value40.opacity) < 1 ||
          value44 ||
          (value40.filter && value40.filter !== "none") ||
          value40.isolation === "isolate" ||
          (value40.mixBlendMode && value40.mixBlendMode !== "normal") ||
          /transform|opacity|filter|translate|rotate|scale|perspective|clip-path|mask/.test(
            value40.willChange || "",
          ) ||
          /paint|layout|strict|content/.test(value40.contain || "") ||
          value40.position === "fixed" ||
          value40.position === "sticky" ||
          [
            "perspective",
            "clip-path",
            "mask-image",
            "-webkit-mask-image",
            "backdrop-filter",
          ].some(function (input2?: Dynamic): Dynamic {
            let value45: Dynamic = value40.getPropertyValue(input2);
            return !!value45 && value45 !== "none";
          })) &&
          ((index3 =
            value42 && isFinite(value41) && value41 > 0
              ? Math.min(value41, 2147483647)
              : 0),
          (flag = true));
      }
      let value35: Dynamic = /^(relative|absolute|fixed|sticky)$/.test(
        cs2.position,
      )
        ? parseInt(cs2.zIndex, 10)
        : NaN;
      !flag &&
        isFinite(value35) &&
        value35 > index3 &&
        (index3 = Math.min(value35, 2147483647));
      let flag2: Dynamic = false;
      if (
        (value17.textContent || "").trim() !== "" &&
        (document as Dynamic).createRange
      ) {
        let value40: Dynamic = (document as Dynamic).createRange();
        value40.selectNodeContents(value17);
        let value41: Dynamic = value40.getClientRects();
        for (let count: Dynamic = 1; count < value41.length && !flag2; count++)
          Math.abs(value41[count].top - value41[0].top) >
            value41[0].height / 2 && (flag2 = true);
      }
      let display: Dynamic = getComputedStyle(value17.parentElement).display,
        value36: Dynamic =
          cs2.boxSizing === "border-box"
            ? 0
            : callback(cs2.paddingLeft) +
              callback(cs2.paddingRight) +
              callback(cs2.borderLeftWidth) +
              callback(cs2.borderRightWidth),
        value37: Dynamic =
          value18.abs || value18.fixed
            ? 0
            : detail.width(cs2) ||
              Math.ceil(Math.max(0, value27 - value36) * 100) / 100,
        value38: Dynamic =
          value18.abs || value18.fixed
            ? 0
            : /flex|grid/.test(display)
              ? Math.ceil(callback(cs2.height) * 100) / 100
              : detail.height(value17, cs2),
        value39: Dynamic = null,
        items13: Dynamic = [],
        state: Dynamic = {},
        flag3: Dynamic = false,
        flag4: Dynamic = false,
        flag5: Dynamic = false,
        text: Dynamic = "";
      if (value)
        if (
          value13.test(value17.tagName) ||
          value17.tagName.indexOf("-") >= 0 ||
          !(value17 instanceof HTMLElement)
        ) {
          value39 = detail.capture(value17, cs2, value);
          let value40: Dynamic = getComputedStyle(value17.parentElement),
            value41: Dynamic = getComputedStyle(value16);
          if (value39)
            for (let value42 in value39)
              value40.getPropertyValue(value42) !==
                value41.getPropertyValue(value42) && items13.push(value42);
        } else {
          let value40: Dynamic = null,
            state2: Dynamic = {},
            state3: Dynamic = {},
            callback2: Dynamic = function (
              input2?: Dynamic,
              options?: Dynamic,
            ): Dynamic {
              let value42: Dynamic = getComputedStyle(input2);
              for (let index4: Dynamic = 0; index4 < items3.length; index4++)
                options[items3[index4]] = value42.getPropertyValue(
                  items3[index4],
                );
              options.position = value42.position;
              options["box-sizing"] = value42.boxSizing;
              options.width = value12(input2, "width") || "";
              options.height = value12(input2, "height") || "";
            };
          if (value17.matches(":hover")) {
            let value42: Dynamic = null,
              value43: Dynamic = null,
              state4: Dynamic = {},
              state5: Dynamic = {};
            value7(
              value17,
              value17.parentElement,
              value17,
              false,
              function (input2?: Dynamic): Dynamic {
                value42 = detail.capture(
                  value17,
                  getComputedStyle(input2),
                  value,
                );
                callback2(input2, state3);
              },
            );
            value7(
              value17,
              value17.parentElement,
              value17.nextSibling,
              false,
              function (input2?: Dynamic): Dynamic {
                value43 = detail.capture(
                  value17,
                  getComputedStyle(input2),
                  value,
                );
                callback2(input2, state4);
              },
            );
            let value44: Dynamic = detail.capture(value17, cs2, value);
            callback2(value17, state5);
            value39 = value42;
            let value45: Dynamic = value42,
              value46: Dynamic = value43;
            if (value45 && value46 && value44)
              for (let value47 in value45)
                value45[value47] !== value46[value47] &&
                  value44[value47] !== undefined &&
                  (value45[value47] = value44[value47]);
            for (let value47 in state3)
              state3[value47] !== state4[value47] &&
                (state3[value47] = state5[value47] || "");
          } else
            try {
              value4(value17, ";animation:none!important");
              value39 = detail.capture(
                value17,
                getComputedStyle(value17),
                value,
              );
              callback2(value17, state3);
            } finally {
              for (; items5.length > 0; ) items5.pop()();
            }
          value7(
            value17,
            value16,
            null,
            true,
            function (input2?: Dynamic): Dynamic {
              value40 = detail.capture(
                value17,
                getComputedStyle(input2),
                value,
              );
              callback2(input2, state2);
            },
          );
          if (value39)
            for (let value42 in value39)
              (!value40 || value40[value42] !== value39[value42]) &&
                items13.push(value42);
          let value41: Dynamic = [
            "border-top-width",
            "border-right-width",
            "border-bottom-width",
            "border-left-width",
          ].some(function (input2?: Dynamic): Dynamic {
            return callback(state3[input2] || "") > 0;
          });
          for (let index4: Dynamic = 0; index4 < items3.length; index4++) {
            let value42: Dynamic = items3[index4];
            (!value41 &&
              (value42 === "border-style" || value42 === "border-color")) ||
              (state3[value42] !== state2[value42] &&
                (state[value42] = state3[value42] || ""));
          }
          flag3 = state3.position !== state2.position;
          flag4 =
            state3.width !== state2.width &&
            state3.width !== "auto" &&
            state3.width !== "";
          flag5 =
            state3.height !== state2.height &&
            state3.height !== "auto" &&
            state3.height !== "";
          state3["box-sizing"] !== state2["box-sizing"] &&
            (text =
              state3["box-sizing"] === "border-box"
                ? "border-box"
                : "content-box");
          if (value12(value17, "width") === null) {
            let items14: Dynamic = ["", ""],
              items15: Dynamic = ["", ""];
            value7(
              value17,
              value17.parentElement,
              value17,
              false,
              function (input2?: Dynamic): Dynamic {
                let value42: Dynamic = getComputedStyle(input2);
                items14 = [value42.width, value42.height];
              },
            );
            value7(
              value17,
              value16,
              null,
              true,
              function (input2?: Dynamic): Dynamic {
                let value42: Dynamic = getComputedStyle(input2);
                items15 = [value42.width, value42.height];
              },
            );
            flag4 = items14[0] !== items15[0];
            flag5 = items14[1] !== items15[1];
          }
        }
      items11.push({
        left: value33 - value27 / 2,
        top: value34 - value28 / 2,
        width: value27,
        height: value28,
        marginLeft: callback(cs2.marginLeft),
        marginTop: callback(cs2.marginTop),
        marginRight: callback(cs2.marginRight),
        marginBottom: callback(cs2.marginBottom),
        cssWidth: Math.ceil(callback(cs2.width) * 100) / 100,
        cssHeight: Math.ceil(callback(cs2.height) * 100) / 100,
        position: value18.fixed ? "fixed" : value18.abs ? "absolute" : "flow",
        pinWidth: value37,
        pinHeight: value38,
        freeze: value39,
        changed: items13,
        carry: state,
        lostPosition: flag3,
        lostWidth: flag4,
        lostHeight: flag5,
        lostBoxSizing: text,
        rendered: value18.rendered,
        transformed: !value11(value24, value23),
        sameSpace:
          value11(value24, value23) &&
          Math.abs(value24.ox - value23.ox) < 0.01 &&
          Math.abs(value24.oy - value23.oy) < 0.01,
        zIndex: index3,
        localZ: flag && isFinite(value35) && value35 > 0,
        liftable:
          !/^(LI|TR|TD|TH|THEAD|TBODY|TFOOT|CAPTION|COL|COLGROUP)$/.test(
            value17.tagName,
          ) &&
          !(
            !value18.abs &&
            !value18.fixed &&
            (/^table-/.test(cs2.display) || cs2.display === "list-item")
          ),
        positioned: /^(relative|absolute|fixed|sticky)$/.test(cs2.position),
        wraps: flag2,
        opaque:
          value13.test(value17.tagName) ||
          value17.tagName.indexOf("-") >= 0 ||
          !(value17 instanceof HTMLElement),
      });
    }
    return items11;
  }
  bindRuntimeValue(
    runtime,
    "LayoutGroupCaptureBackgroundColorBorderStyleBorderColorValues",
    () => LayoutGroupCaptureBackgroundColorBorderStyleBorderColorValues,
    (value) => {
      LayoutGroupCaptureBackgroundColorBorderStyleBorderColorValues = value;
    },
  );
  bindRuntimeValue(runtime, "captureGroupLayout", () => captureGroupLayout);
  return () => {
    LayoutGroupCaptureBackgroundColorBorderStyleBorderColorValues = [
      "background-color",
      "border-style",
      "border-color",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
    ];
  };
}
