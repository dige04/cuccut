/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorPickerBridge(
  runtime: RuntimeBindings,
): () => void {
  var PickerBridgePattern: Dynamic;
  var PickerBridgeHandler: Dynamic;
  var PickerBridgeStringify: Dynamic;
  var PickerBridgeJoin: Dynamic;
  var PickerBridgeLimit: Dynamic;
  var PickerBridgePattern_2: Dynamic;
  var PickerBridgeConstant: Dynamic;
  var PickerBridgePattern_3: Dynamic;
  var PickerBridgeBoldItalicUnderlineSet: Dynamic;
  var PickerBridgeLabel: Dynamic;
  var PickerBridgeConstant_2: Dynamic;
  function isPickerInstalled(input?: Dynamic): Dynamic {
    return input.executeJavaScript("!!window.__dcEditorPicker", 5e3).then(
      (input2?: Dynamic): Dynamic => input2 === true,
      (): Dynamic => false,
    );
  }
  function installPicker(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked((0, runtime.buildPickerRuntimeScript)());
    options && setPickerTheme(input, options);
  }
  function setPickerTheme(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setAppTheme && window.__dcEditorPicker.setAppTheme(${JSON.stringify(options)})`,
    );
  }
  function enablePicker(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.enable()",
    );
  }
  function disablePicker(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.disable()",
    );
  }
  function enablePickerPanZoom(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.enablePanZoomOnly()",
    );
  }
  function setPickerInteractive(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic =
      options === "scroll" || options === "play"
        ? "'" + options + "'"
        : options
          ? "true"
          : "false";
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setHostPanZoom && window.__dcEditorPicker.setHostPanZoom(${value})`,
    );
  }
  function setPickerHostScale(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = Number(options);
    !isFinite(value) ||
      value <= 0 ||
      input.executeJavaScriptUnchecked(
        `window.__dcEditorPicker && window.__dcEditorPicker.setHostScale && window.__dcEditorPicker.setHostScale(${value})`,
      );
  }
  function resizePickerSelection(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.resizeWith && window.__dcEditorPicker.resizeWith(${JSON.stringify(options)})`,
    );
  }
  function pickerGesturePhase(input?: Dynamic, source?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        String(Number.isFinite(input2) ? input2 : 0),
      value: Dynamic =
        source.phase === "start"
          ? (source.kind === "endpoint"
              ? source.which === 1
                ? "1"
                : "0"
              : JSON.stringify(
                  source.kind === "resize" ? source.dir : source.corner,
                )) +
            "," +
            callback(source.x) +
            "," +
            callback(source.y)
          : source.phase === "move"
            ? callback(source.x) +
              "," +
              callback(source.y) +
              (source.shift ? ",true" : ",false")
            : source.commit
              ? "true"
              : "false",
      value2: Dynamic =
        source.kind + source.phase[0].toUpperCase() + source.phase.slice(1);
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.${value2} && window.__dcEditorPicker.${value2}(${value})`,
    );
  }
  function pickerPenPreview(
    input?: Dynamic,
    options?: Dynamic,
    items?: Dynamic,
  ): Dynamic {
    (items !== null && items.length > 1e5) ||
      input.executeJavaScriptUnchecked(
        `window.__dcEditorPicker && window.__dcEditorPicker.penPreview && window.__dcEditorPicker.penPreview(${String(Math.trunc(options))},${items === null ? "null" : JSON.stringify(items)})`,
      );
  }
  function pickerVectorPreview(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    items?: Dynamic,
  ): Dynamic {
    if (items.length > 1e5) return;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      String(Number.isFinite(input2) ? Math.round(input2 * 100) / 100 : 0);
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.penCommit && window.__dcEditorPicker.penCommit(${String(Math.trunc(options))},${callback(context.x)},${callback(context.y)},${callback(context.w)},${callback(context.h)},${JSON.stringify(items)})`,
    );
  }
  function pickerContextMenuAt(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      String(Number.isFinite(input2) ? input2 : 0);
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.contextMenuAt && window.__dcEditorPicker.contextMenuAt(" +
        callback(options) +
        "," +
        callback(context) +
        ")",
    );
  }
  function pickerContextMenuBySelection(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.contextMenuBySelection && window.__dcEditorPicker.contextMenuBySelection()",
    );
  }
  function pickerDragModifiers(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.dragModifiers && window.__dcEditorPicker.dragModifiers(" +
        [options, context, value]
          .map((input2?: Dynamic): Dynamic => String(input2 === true))
          .join(",") +
        ")",
    );
  }
  function cancelPickerDrag(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.cancelDrag && window.__dcEditorPicker.cancelDrag()",
    );
  }
  function cancelPickerBox(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.cancelBox && window.__dcEditorPicker.cancelBox(${JSON.stringify(options)})`,
    );
  }
  function armPickerByClick(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.armedByClick && window.__dcEditorPicker.armedByClick(${JSON.stringify(options)},${JSON.stringify(context)})`,
    );
  }
  function finishExitedPickerDrag(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    if (!/^[0-9a-f]{16}$/.test(context)) return;
    let value2: Dynamic =
      options === "exit"
        ? "exitDrag"
        : options === "finish"
          ? "finishExitedDrag"
          : "abortDrag";
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker." +
        value2 +
        " && window.__dcEditorPicker." +
        value2 +
        "('" +
        context +
        "'," +
        (value ? "true" : "false") +
        ")",
    );
  }
  async function beginPickerMove(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Promise<Dynamic> {
    if (
      !PickerBridgePattern.test(options) ||
      !Number.isInteger(context) ||
      context < 0
    )
      return null;
    try {
      return await input.executeJavaScript(
        "window.__dcEditorPicker && window.__dcEditorPicker.moveStart ? window.__dcEditorPicker.moveStart(" +
          PickerBridgeJoin(options, context, value, extra, detail) +
          ") : null",
        4e3,
      );
    } catch {
      return null;
    }
  }
  function updatePickerMove(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    PickerBridgePattern.test(options) &&
      input.executeJavaScriptUnchecked(
        "window.__dcEditorPicker && window.__dcEditorPicker.moveMove && window.__dcEditorPicker.moveMove(" +
          PickerBridgeJoin(options, null, context, value, extra) +
          ")",
      );
  }
  async function finishPickerMove(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Promise<Dynamic> {
    if (!PickerBridgePattern.test(options)) return null;
    try {
      return await input.executeJavaScript(
        "window.__dcEditorPicker && window.__dcEditorPicker.moveEnd ? window.__dcEditorPicker.moveEnd(" +
          PickerBridgeJoin(options, null, context, value, extra) +
          ") : null",
        4e3,
      );
    } catch {
      return null;
    }
  }
  function cancelPickerMove(input?: Dynamic, options?: Dynamic): Dynamic {
    PickerBridgePattern.test(options) &&
      input.executeJavaScriptUnchecked(
        "window.__dcEditorPicker && window.__dcEditorPicker.moveCancel && window.__dcEditorPicker.moveCancel('" +
          options +
          "')",
      );
  }
  function pickerMoveHold(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    return !PickerBridgePattern.test(options) ||
      (context !== "open" && context !== "close")
      ? Promise.resolve(false)
      : input
          .executeJavaScript(
            "window.__dcEditorPicker && window.__dcEditorPicker.moveHost ? window.__dcEditorPicker.moveHost('" +
              options +
              "', '" +
              context +
              "') : false",
            1e4,
          )
          .then(
            (input2?: Dynamic): Dynamic => input2 === true,
            (): Dynamic => false,
          );
  }
  function exitPickerMove(input?: Dynamic, options?: Dynamic): Dynamic {
    PickerBridgePattern.test(options) &&
      input.executeJavaScriptUnchecked(
        "window.__dcEditorPicker && window.__dcEditorPicker.moveExit && window.__dcEditorPicker.moveExit('" +
          options +
          "')",
      );
  }
  function returnPickerMove(input?: Dynamic, options?: Dynamic): Dynamic {
    PickerBridgePattern.test(options) &&
      input.executeJavaScriptUnchecked(
        "window.__dcEditorPicker && window.__dcEditorPicker.moveReturn && window.__dcEditorPicker.moveReturn('" +
          options +
          "')",
      );
  }
  function touchPickerMove(input?: Dynamic, options?: Dynamic): Dynamic {
    PickerBridgePattern.test(options) &&
      input.executeJavaScriptUnchecked(
        "window.__dcEditorPicker && window.__dcEditorPicker.moveTouch && window.__dcEditorPicker.moveTouch('" +
          options +
          "')",
      );
  }
  async function planPickerDrop(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Promise<Dynamic> {
    if (
      !PickerBridgePattern.test(options) ||
      !Number.isFinite(context) ||
      !Number.isFinite(value)
    )
      return null;
    let value2: Dynamic = extra
      .filter(
        (input2?: Dynamic): Dynamic =>
          Number.isInteger(input2.tid) &&
          /^[a-z][a-z0-9-]{0,63}$/.test(input2.tag) &&
          [input2.w, input2.h, input2.dx, input2.dy].every(Number.isFinite),
      )
      .map(
        (input2?: Dynamic): Dynamic => ({
          tid: input2.tid,
          tag: input2.tag,
          w: input2.w,
          h: input2.h,
          dx: input2.dx,
          dy: input2.dy,
        }),
      );
    if (value2.length === 0) return null;
    try {
      return await input.executeJavaScript(
        "window.__dcEditorPicker && window.__dcEditorPicker.dropPlanAt ? window.__dcEditorPicker.dropPlanAt('" +
          options +
          "'," +
          JSON.stringify(context) +
          "," +
          JSON.stringify(value) +
          "," +
          JSON.stringify(value2) +
          "," +
          JSON.stringify(detail === "keep" ? "keep" : "flow") +
          ") : null",
        1500,
      );
    } catch {
      return null;
    }
  }
  function clearPickerDropPlan(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Dynamic {
    PickerBridgePattern.test(options) &&
      input.executeJavaScriptUnchecked(
        "window.__dcEditorPicker && window.__dcEditorPicker.dropPlanClear && window.__dcEditorPicker.dropPlanClear('" +
          options +
          "'," +
          (context ? "true" : "false") +
          ")",
      );
  }
  function settlePickerMove(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.moveSettle && window.__dcEditorPicker.moveSettle()",
    );
  }
  function repostPickerChrome(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.repostChrome && window.__dcEditorPicker.repostChrome()",
    );
  }
  function setPickerPanZoomArmed(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setPanZoomArmed(${options ? "true" : "false"})`,
    );
  }
  function setPickerReadOnly(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setReadOnly && window.__dcEditorPicker.setReadOnly(${options ? "true" : "false"})`,
    );
  }
  function setPickerMeasure(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setMeasure && window.__dcEditorPicker.setMeasure(${options ? "true" : "false"})`,
    );
  }
  function setPickerDeepSelection(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setDeep && window.__dcEditorPicker.setDeep(${options ? "true" : "false"})`,
    );
  }
  function setPickerRingsOnly(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.${options ? "enableRingsOnly" : "disableRingsOnly"} && window.__dcEditorPicker.${options ? "enableRingsOnly" : "disableRingsOnly"}()`,
    );
  }
  function setPickerHiddenTags(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = JSON.stringify(
      options
        .filter(
          (input2?: Dynamic): Dynamic =>
            runtime.PickerHiddenTagsPattern.test(input2),
        )
        .slice(0, 32),
    );
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setBusyDrops && window.__dcEditorPicker.setBusyDrops(${value})`,
    );
  }
  async function pickAtPoint(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = "plain",
    extra: Dynamic = [],
    detail: Dynamic = [],
  ): Promise<Dynamic> {
    try {
      let value2: Dynamic = await input.executeJavaScript(
        `window.__dcEditorPicker && window.__dcEditorPicker.pickAt ? window.__dcEditorPicker.pickAt(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)},${JSON.stringify(extra.filter((input2?: Dynamic): Dynamic => Number.isInteger(input2)))},${JSON.stringify(detail.filter((input2?: Dynamic): Dynamic => Number.isInteger(input2)))}) : null`,
        4e3,
      );
      if (value2 == null || typeof value2 != "object") return null;
      if (value2.empty === true)
        return {
          empty: true,
        };
      let callback: Dynamic = (input2?: Dynamic): Dynamic =>
          typeof input2 == "number" &&
          Number.isFinite(input2) &&
          Math.abs(input2) < 1e6
            ? input2
            : null,
        callback2: Dynamic = (input2?: Dynamic): Dynamic => {
          if (input2 == null || typeof input2 != "object") return null;
          let value6: Dynamic = Number(input2.tid);
          if (
            !Number.isInteger(value6) ||
            value6 < 0 ||
            value6 > 1e6 ||
            typeof input2.tag != "string" ||
            !/^[a-z][a-z0-9-]{0,63}$/.test(input2.tag)
          )
            return null;
          let value7: Dynamic = callback(input2.rect?.x),
            value8: Dynamic = callback(input2.rect?.y),
            value9: Dynamic = callback(input2.rect?.w),
            value10: Dynamic = callback(input2.rect?.h);
          return {
            tid: value6,
            tag: input2.tag,
            rect:
              value7 != null &&
              value8 != null &&
              value9 != null &&
              value10 != null
                ? {
                    x: value7,
                    y: value8,
                    w: value9,
                    h: value10,
                  }
                : null,
          };
        },
        value3: Dynamic = callback2(value2);
      if (!value3) return null;
      let value4: Dynamic = callback2(value2.text),
        value5: Dynamic =
          value4 && value4.rect
            ? {
                tid: value4.tid,
                tag: value4.tag,
                rect: value4.rect,
              }
            : null;
      return {
        tid: value3.tid,
        tag: value3.tag,
        rect: value3.rect ?? {
          x: 0,
          y: 0,
          w: 0,
          h: 0,
        },
        root: value2.root === true,
        page: value2.root === true && value2.page === true,
        text: value5,
      };
    } catch {
      return null;
    }
  }
  async function pickInBox(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value: Dynamic = [options.x0, options.y0, options.x1, options.y1]
          .map((input2?: Dynamic): Dynamic => JSON.stringify(Number(input2)))
          .join(","),
        value2: Dynamic = await input.executeJavaScript(
          `window.__dcEditorPicker && window.__dcEditorPicker.pickIn ? window.__dcEditorPicker.pickIn(${value},${JSON.stringify(context)}) : []`,
          4e3,
        );
      if (!Array.isArray(value2)) return null;
      let items: Dynamic = [];
      for (let value3 of value2.slice(0, 512) as Dynamic) {
        if (value3 == null || typeof value3 != "object") continue;
        let value4: Dynamic = Number(value3.tid),
          tag: Dynamic = value3.tag;
        !Number.isInteger(value4) ||
          value4 < 0 ||
          value4 > 1e6 ||
          typeof tag != "string" ||
          !/^[a-z][a-z0-9-]{0,63}$/.test(tag) ||
          items.push({
            tid: value4,
            tag: tag,
          });
      }
      return items;
    } catch {
      return null;
    }
  }
  function normalizePickerRect(input?: Dynamic): Dynamic {
    let value: Dynamic = input;
    if (!value || typeof value != "object") return null;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" &&
        Number.isFinite(input2) &&
        Math.abs(input2) < 1e6
          ? input2
          : null,
      value2: Dynamic = callback(value.x),
      value3: Dynamic = callback(value.y),
      value4: Dynamic = callback(value.w),
      value5: Dynamic = callback(value.h);
    return value2 != null &&
      value3 != null &&
      value4 != null &&
      value5 != null &&
      value4 >= 0 &&
      value5 >= 0
      ? {
          x: value2,
          y: value3,
          w: value4,
          h: value5,
        }
      : null;
  }
  function normalizeCommentAnchor(input?: Dynamic): Dynamic {
    let value: Dynamic = input;
    if (!value || typeof value != "object") return null;
    let value2: Dynamic =
      typeof value.path == "string" &&
      value.path !== "" &&
      value.path.length <= PickerBridgeLimit
        ? value.path
        : value.path == null
          ? null
          : undefined;
    if (value2 === undefined) return null;
    let value3: Dynamic = normalizePickerRect(value.rect);
    if (!value3) return null;
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
        typeof input2 == "number" && Number.isFinite(input2)
          ? Math.min(1, Math.max(0, input2))
          : 0.5,
      value4: Dynamic =
        typeof value.tid == "number" &&
        Number.isInteger(value.tid) &&
        value.tid >= 0 &&
        value.tid < 1e6
          ? value.tid
          : null,
      value5: Dynamic =
        typeof value.tag == "string" && PickerBridgePattern_2.test(value.tag)
          ? value.tag
          : null,
      value6: Dynamic =
        (typeof value.text == "string" &&
          value.text
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, PickerBridgeConstant)) ||
        null,
      value7: Dynamic =
        value4 != null &&
        typeof value.fp == "string" &&
        PickerBridgePattern_3.test(value.fp)
          ? value.fp
          : null;
    return {
      path: value2,
      tid: value4,
      fp: value7,
      rect: value3,
      fx: callback(value.fx),
      fy: callback(value.fy),
      tag: value5,
      text: value6,
      page: normalizePickerRect(value.page),
    };
  }
  async function pickerCommentAt(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = 3e3,
  ): Promise<Dynamic> {
    try {
      return normalizeCommentAnchor(
        await input.executeJavaScript(
          `window.__dcEditorPicker && window.__dcEditorPicker.commentAt ? window.__dcEditorPicker.commentAt(${JSON.stringify(options)},${JSON.stringify(context)}) : null`,
          value,
        ),
      );
    } catch {
      return null;
    }
  }
  async function pickerCommentIn(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail: Dynamic = 3e3,
  ): Promise<Dynamic> {
    try {
      let value2: Dynamic = await input.executeJavaScript(
        `window.__dcEditorPicker && window.__dcEditorPicker.commentIn ? window.__dcEditorPicker.commentIn(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)},${JSON.stringify(extra)}) : null`,
        detail,
      );
      if (!value2 || typeof value2 != "object") return null;
      let items: Dynamic = [];
      if (Array.isArray(value2.covered))
        for (let value4 of value2.covered.slice(0, 16) as Dynamic) {
          let value5: Dynamic = normalizePickerRect(value4?.rect),
            value6: Dynamic =
              typeof value4?.tid == "number" &&
              Number.isInteger(value4.tid) &&
              value4.tid >= 0 &&
              value4.tid < 1e6
                ? value4.tid
                : null,
            value7: Dynamic =
              typeof value4?.tag == "string" &&
              PickerBridgePattern_2.test(value4.tag)
                ? value4.tag
                : null;
          value5 &&
            value6 != null &&
            value7 != null &&
            items.push({
              tid: value6,
              tag: value7,
              rect: value5,
            });
        }
      let value3: Dynamic =
        typeof value2.total == "number" && Number.isInteger(value2.total)
          ? Math.max(items.length, Math.min(1e4, value2.total))
          : items.length;
      return {
        enclosing:
          value2.enclosing == null
            ? null
            : normalizeCommentAnchor(value2.enclosing),
        covered: items,
        total: value3,
      };
    } catch {
      return null;
    }
  }
  async function pickerCommentFor(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Promise<Dynamic> {
    try {
      return normalizeCommentAnchor(
        await input.executeJavaScript(
          `window.__dcEditorPicker && window.__dcEditorPicker.commentFor ? window.__dcEditorPicker.commentFor(${JSON.stringify(options)},${JSON.stringify(context)}) : null`,
          4e3,
        ),
      );
    } catch {
      return null;
    }
  }
  async function pickerCommentRects(
    input?: Dynamic,
    options?: Dynamic,
  ): Promise<Dynamic> {
    try {
      let value: Dynamic = await input.executeJavaScript(
        `window.__dcEditorPicker && window.__dcEditorPicker.commentRects ? window.__dcEditorPicker.commentRects(${JSON.stringify(options.slice(0, 256))}) : null`,
        3e3,
      );
      return Array.isArray(value)
        ? options.map(
            (input2?: Dynamic, options2?: Dynamic): Dynamic =>
              normalizePickerRect(value[options2]),
          )
        : null;
    } catch {
      return null;
    }
  }
  async function pickerPeerRects(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = false,
  ): Promise<Dynamic> {
    let value: Dynamic = options.slice(0, 64);
    try {
      let value2: Dynamic = await input.executeJavaScript(
        `window.__dcEditorPicker && window.__dcEditorPicker.peerRects ? window.__dcEditorPicker.peerRects(${JSON.stringify(value)}, ${context ? "true" : "false"}) : null`,
        3e3,
      );
      if (!Array.isArray(value2)) return null;
      let value3: Dynamic = value.map((): Dynamic => []);
      for (let value4 of value2.slice(0, 256) as Dynamic) {
        let value5: Dynamic = typeof value4?.i == "number" ? value4.i : -1,
          value6: Dynamic = normalizePickerRect(value4);
        value6 &&
          Number.isInteger(value5) &&
          value5 >= 0 &&
          value5 < value3.length &&
          value3[value5].push(value6);
      }
      return value3;
    } catch {
      return null;
    }
  }
  function repaintPickerSelection(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.repaintSelected && window.__dcEditorPicker.repaintSelected()",
    );
  }
  function setPickerSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.select(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value ?? null)},${Number.isSafeInteger(extra) ? String(extra) : "null"})`,
    );
  }
  function pickerHoverAt(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = [],
    value: Dynamic = false,
    extra: Dynamic = [],
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      options
        ? `window.__dcEditorPicker && window.__dcEditorPicker.hoverAt && window.__dcEditorPicker.hoverAt(${Number(options.x)},${Number(options.y)},${JSON.stringify(context.filter((input2?: Dynamic): Dynamic => Number.isInteger(input2)))},${value ? "true" : "false"},${JSON.stringify(extra.filter((input2?: Dynamic): Dynamic => Number.isInteger(input2)))})`
        : "window.__dcEditorPicker && window.__dcEditorPicker.hover(null,null)",
    );
  }
  function pickerHover(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.hover(${JSON.stringify(options)},${JSON.stringify(context)})`,
    );
  }
  function setPickerDirectiveMap(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setDirectiveMap && window.__dcEditorPicker.setDirectiveMap(${JSON.stringify(options)},${JSON.stringify(context)})`,
    );
  }
  function formatPickerText(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
  ): Dynamic {
    PickerBridgeBoldItalicUnderlineSet.has(options) &&
      ((context !== undefined && !Number.isInteger(context)) ||
        input.executeJavaScriptUnchecked(
          `window.__dcEditorPicker && window.__dcEditorPicker.format && window.__dcEditorPicker.format(${JSON.stringify(options)}${context === undefined ? "" : "," + String(context)})`,
        ));
  }
  function setPickerTool(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setTool(${JSON.stringify(options === "vector" ? "select" : options)}, ${options === "vector" ? "true" : "false"})`,
    );
  }
  function setPickerOverlayHidden(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setOverlayHidden(${options ? "true" : "false"})`,
    );
  }
  function patchPickerStyle(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.patchStyle(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)},${JSON.stringify(extra ?? null)})`,
    );
  }
  function holdPickerStyle(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.holdStyle && window.__dcEditorPicker.holdStyle(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)},${JSON.stringify(extra)})`,
    );
  }
  function unpatchPickerStyle(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.unpatchStyle && window.__dcEditorPicker.unpatchStyle(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)})`,
    );
  }
  function setPickerScrubbing(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setScrubbing && window.__dcEditorPicker.setScrubbing(${options ? "true" : "false"})`,
    );
  }
  function setPickerTextEditable(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
    detail?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.setTextEditable(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value ?? [])},${JSON.stringify(extra ?? {})},${JSON.stringify(detail ?? [])})`,
    );
  }
  async function getPickerFirstTextFont(input?: Dynamic): Promise<Dynamic> {
    try {
      return (
        (await input.executeJavaScript(
          "window.__dcEditorPicker && window.__dcEditorPicker.firstTextFont ? window.__dcEditorPicker.firstTextFont() : null",
          2e3,
        )) || null
      );
    } catch {
      return null;
    }
  }
  function startPickerTextEdit(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value: Dynamic = "all",
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.startTextEdit(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)})`,
    );
  }
  function beginPickerTextPlacing(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.textPlacing && window.__dcEditorPicker.textPlacing()",
    );
  }
  function notePickerTextInsert(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.noteTextInsert && window.__dcEditorPicker.noteTextInsert()",
    );
  }
  function startPickerInsertedTextEdit(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.startInsertedTextEdit && window.__dcEditorPicker.startInsertedTextEdit(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)},${String(Math.round(extra))})`,
    );
  }
  function pickerHeldTextKey(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.heldTextKey && window.__dcEditorPicker.heldTextKey(${JSON.stringify(options)})`,
    );
  }
  function dropPickerInsertedTextEdit(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.dropInsertedTextEdit && window.__dcEditorPicker.dropInsertedTextEdit(${options ? "true" : "false"})`,
    );
  }
  function repostPickerTextEditState(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.repostTextEditState && window.__dcEditorPicker.repostTextEditState()",
    );
  }
  function startPickerTextEditAt(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Dynamic {
    !Number.isFinite(options) ||
      !Number.isFinite(context) ||
      input.executeJavaScriptUnchecked(
        `window.__dcEditorPicker && window.__dcEditorPicker.startTextEditAt && window.__dcEditorPicker.startTextEditAt(${String(options)},${String(context)},${JSON.stringify(value)},${JSON.stringify(extra)})`,
      );
  }
  function applyPickerLink(input?: Dynamic, options?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      `window.__dcEditorPicker && window.__dcEditorPicker.applyLink && window.__dcEditorPicker.applyLink(${JSON.stringify(options)})`,
    );
  }
  function clearPickerPart(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.clearPart && window.__dcEditorPicker.clearPart()",
    );
  }
  function dropPickerLeftCopy(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.dropLeftCopy && window.__dcEditorPicker.dropLeftCopy()",
    );
  }
  function cancelPickerLinkEdit(input?: Dynamic): Dynamic {
    input.executeJavaScriptUnchecked(
      "window.__dcEditorPicker && window.__dcEditorPicker.cancelLinkEdit && window.__dcEditorPicker.cancelLinkEdit()",
    );
  }
  async function verifyPickerSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
  ): Promise<Dynamic> {
    try {
      return (
        (await input.executeJavaScript(
          `window.__dcEditorPicker ? window.__dcEditorPicker.verify(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)}) : null`,
          4e3,
        )) ?? null
      );
    } catch {
      return null;
    }
  }
  async function finishPickerEdit(input?: Dynamic): Promise<Dynamic> {
    try {
      let value: Dynamic = await input.executeJavaScript(
        "window.__dcEditorPicker && window.__dcEditorPicker.finishEdit ? window.__dcEditorPicker.finishEdit() : null",
        2e3,
      );
      return typeof value == "object" ? value : null;
    } catch {
      return null;
    }
  }
  async function inspectPickerSelection(
    input?: Dynamic,
    options?: Dynamic,
    context?: Dynamic,
    value?: Dynamic,
    extra?: Dynamic,
  ): Promise<Dynamic> {
    let value2: Dynamic = `window.__dcEditorPicker ? window.__dcEditorPicker.inspect(${JSON.stringify(options)},${JSON.stringify(context)},${JSON.stringify(value)},${extra?.srgb ? "true" : "false"},${extra?.unpinned ? "true" : "false"},${extra?.ground ? "true" : "false"},${extra?.pose ? "true" : "false"}) : null`,
      value3: Dynamic = extra?.afterPaint
        ? `new Promise(function(r){var d=false,go=function(){if(!d){d=true;r(${value2})}};requestAnimationFrame(function(){requestAnimationFrame(go)});setTimeout(go,250)})`
        : value2;
    try {
      return (
        (await input.executeJavaScript(value3, PickerBridgeConstant_2)) ?? null
      );
    } catch {
      return null;
    }
  }
  bindRuntimeValue(runtime, "isPickerInstalled", () => isPickerInstalled);
  bindRuntimeValue(runtime, "installPicker", () => installPicker);
  bindRuntimeValue(runtime, "setPickerTheme", () => setPickerTheme);
  bindRuntimeValue(runtime, "enablePicker", () => enablePicker);
  bindRuntimeValue(runtime, "disablePicker", () => disablePicker);
  bindRuntimeValue(runtime, "enablePickerPanZoom", () => enablePickerPanZoom);
  bindRuntimeValue(runtime, "setPickerInteractive", () => setPickerInteractive);
  bindRuntimeValue(runtime, "setPickerHostScale", () => setPickerHostScale);
  bindRuntimeValue(
    runtime,
    "resizePickerSelection",
    () => resizePickerSelection,
  );
  bindRuntimeValue(runtime, "pickerGesturePhase", () => pickerGesturePhase);
  bindRuntimeValue(runtime, "pickerPenPreview", () => pickerPenPreview);
  bindRuntimeValue(runtime, "pickerVectorPreview", () => pickerVectorPreview);
  bindRuntimeValue(runtime, "pickerContextMenuAt", () => pickerContextMenuAt);
  bindRuntimeValue(
    runtime,
    "pickerContextMenuBySelection",
    () => pickerContextMenuBySelection,
  );
  bindRuntimeValue(runtime, "pickerDragModifiers", () => pickerDragModifiers);
  bindRuntimeValue(runtime, "cancelPickerDrag", () => cancelPickerDrag);
  bindRuntimeValue(runtime, "cancelPickerBox", () => cancelPickerBox);
  bindRuntimeValue(runtime, "armPickerByClick", () => armPickerByClick);
  bindRuntimeValue(
    runtime,
    "finishExitedPickerDrag",
    () => finishExitedPickerDrag,
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgePattern",
    () => PickerBridgePattern,
    (value) => {
      PickerBridgePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgeHandler",
    () => PickerBridgeHandler,
    (value) => {
      PickerBridgeHandler = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgeStringify",
    () => PickerBridgeStringify,
    (value) => {
      PickerBridgeStringify = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgeJoin",
    () => PickerBridgeJoin,
    (value) => {
      PickerBridgeJoin = value;
    },
  );
  bindRuntimeValue(runtime, "beginPickerMove", () => beginPickerMove);
  bindRuntimeValue(runtime, "updatePickerMove", () => updatePickerMove);
  bindRuntimeValue(runtime, "finishPickerMove", () => finishPickerMove);
  bindRuntimeValue(runtime, "cancelPickerMove", () => cancelPickerMove);
  bindRuntimeValue(runtime, "pickerMoveHold", () => pickerMoveHold);
  bindRuntimeValue(runtime, "exitPickerMove", () => exitPickerMove);
  bindRuntimeValue(runtime, "returnPickerMove", () => returnPickerMove);
  bindRuntimeValue(runtime, "touchPickerMove", () => touchPickerMove);
  bindRuntimeValue(runtime, "planPickerDrop", () => planPickerDrop);
  bindRuntimeValue(runtime, "clearPickerDropPlan", () => clearPickerDropPlan);
  bindRuntimeValue(runtime, "settlePickerMove", () => settlePickerMove);
  bindRuntimeValue(runtime, "repostPickerChrome", () => repostPickerChrome);
  bindRuntimeValue(
    runtime,
    "setPickerPanZoomArmed",
    () => setPickerPanZoomArmed,
  );
  bindRuntimeValue(runtime, "setPickerReadOnly", () => setPickerReadOnly);
  bindRuntimeValue(runtime, "setPickerMeasure", () => setPickerMeasure);
  bindRuntimeValue(
    runtime,
    "setPickerDeepSelection",
    () => setPickerDeepSelection,
  );
  bindRuntimeValue(runtime, "setPickerRingsOnly", () => setPickerRingsOnly);
  bindRuntimeValue(runtime, "setPickerHiddenTags", () => setPickerHiddenTags);
  bindRuntimeValue(runtime, "pickAtPoint", () => pickAtPoint);
  bindRuntimeValue(runtime, "pickInBox", () => pickInBox);
  bindRuntimeValue(
    runtime,
    "PickerBridgeLimit",
    () => PickerBridgeLimit,
    (value) => {
      PickerBridgeLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgePattern_2",
    () => PickerBridgePattern_2,
    (value) => {
      PickerBridgePattern_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgeConstant",
    () => PickerBridgeConstant,
    (value) => {
      PickerBridgeConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgePattern_3",
    () => PickerBridgePattern_3,
    (value) => {
      PickerBridgePattern_3 = value;
    },
  );
  bindRuntimeValue(runtime, "normalizePickerRect", () => normalizePickerRect);
  bindRuntimeValue(
    runtime,
    "normalizeCommentAnchor",
    () => normalizeCommentAnchor,
  );
  bindRuntimeValue(runtime, "pickerCommentAt", () => pickerCommentAt);
  bindRuntimeValue(runtime, "pickerCommentIn", () => pickerCommentIn);
  bindRuntimeValue(runtime, "pickerCommentFor", () => pickerCommentFor);
  bindRuntimeValue(runtime, "pickerCommentRects", () => pickerCommentRects);
  bindRuntimeValue(runtime, "pickerPeerRects", () => pickerPeerRects);
  bindRuntimeValue(
    runtime,
    "repaintPickerSelection",
    () => repaintPickerSelection,
  );
  bindRuntimeValue(runtime, "setPickerSelection", () => setPickerSelection);
  bindRuntimeValue(runtime, "pickerHoverAt", () => pickerHoverAt);
  bindRuntimeValue(runtime, "pickerHover", () => pickerHover);
  bindRuntimeValue(
    runtime,
    "setPickerDirectiveMap",
    () => setPickerDirectiveMap,
  );
  bindRuntimeValue(
    runtime,
    "PickerBridgeBoldItalicUnderlineSet",
    () => PickerBridgeBoldItalicUnderlineSet,
    (value) => {
      PickerBridgeBoldItalicUnderlineSet = value;
    },
  );
  bindRuntimeValue(runtime, "formatPickerText", () => formatPickerText);
  bindRuntimeValue(runtime, "setPickerTool", () => setPickerTool);
  bindRuntimeValue(
    runtime,
    "setPickerOverlayHidden",
    () => setPickerOverlayHidden,
  );
  bindRuntimeValue(runtime, "patchPickerStyle", () => patchPickerStyle);
  bindRuntimeValue(runtime, "holdPickerStyle", () => holdPickerStyle);
  bindRuntimeValue(runtime, "unpatchPickerStyle", () => unpatchPickerStyle);
  bindRuntimeValue(runtime, "setPickerScrubbing", () => setPickerScrubbing);
  bindRuntimeValue(
    runtime,
    "PickerBridgeLabel",
    () => PickerBridgeLabel,
    (value) => {
      PickerBridgeLabel = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setPickerTextEditable",
    () => setPickerTextEditable,
  );
  bindRuntimeValue(
    runtime,
    "getPickerFirstTextFont",
    () => getPickerFirstTextFont,
  );
  bindRuntimeValue(runtime, "startPickerTextEdit", () => startPickerTextEdit);
  bindRuntimeValue(
    runtime,
    "beginPickerTextPlacing",
    () => beginPickerTextPlacing,
  );
  bindRuntimeValue(runtime, "notePickerTextInsert", () => notePickerTextInsert);
  bindRuntimeValue(
    runtime,
    "startPickerInsertedTextEdit",
    () => startPickerInsertedTextEdit,
  );
  bindRuntimeValue(runtime, "pickerHeldTextKey", () => pickerHeldTextKey);
  bindRuntimeValue(
    runtime,
    "dropPickerInsertedTextEdit",
    () => dropPickerInsertedTextEdit,
  );
  bindRuntimeValue(
    runtime,
    "repostPickerTextEditState",
    () => repostPickerTextEditState,
  );
  bindRuntimeValue(
    runtime,
    "startPickerTextEditAt",
    () => startPickerTextEditAt,
  );
  bindRuntimeValue(runtime, "applyPickerLink", () => applyPickerLink);
  bindRuntimeValue(runtime, "clearPickerPart", () => clearPickerPart);
  bindRuntimeValue(runtime, "dropPickerLeftCopy", () => dropPickerLeftCopy);
  bindRuntimeValue(runtime, "cancelPickerLinkEdit", () => cancelPickerLinkEdit);
  bindRuntimeValue(
    runtime,
    "verifyPickerSelection",
    () => verifyPickerSelection,
  );
  bindRuntimeValue(runtime, "finishPickerEdit", () => finishPickerEdit);
  bindRuntimeValue(
    runtime,
    "PickerBridgeConstant_2",
    () => PickerBridgeConstant_2,
    (value) => {
      PickerBridgeConstant_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inspectPickerSelection",
    () => inspectPickerSelection,
  );
  return () => {
    PickerBridgePattern = /^[0-9a-f]{16}$/;
    PickerBridgeHandler = (input?: Dynamic): Dynamic =>
      input != null && Number.isFinite(input) ? String(input) : "null";
    PickerBridgeStringify = (input?: Dynamic): Dynamic =>
      JSON.stringify({
        alt: input.alt === true,
        ctrl: input.ctrl === true,
        meta: input.meta === true,
        shift: input.shift === true,
      });
    PickerBridgeJoin = (
      input?: Dynamic,
      options?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
      extra?: Dynamic,
    ): Dynamic =>
      [
        "'" + input + "'",
        ...(options == null ? [] : [String(options)]),
        PickerBridgeHandler(context),
        PickerBridgeHandler(value),
        PickerBridgeStringify(extra),
      ].join(",");
    PickerBridgeLimit = 500;
    PickerBridgePattern_2 = /^[a-z][a-z0-9-]{0,30}$/;
    PickerBridgeConstant = 120;
    PickerBridgePattern_3 = /^x[0-9a-z]{7}$/;
    PickerBridgeBoldItalicUnderlineSet = new Set([
      "bold",
      "italic",
      "underline",
      "ul",
      "ol",
      "link",
    ]);
    PickerBridgeLabel =
      "window.__dcEditorPicker&&window.__dcEditorPicker.afterPush&&window.__dcEditorPicker.afterPush()";
    PickerBridgeConstant_2 = 4e3;
  };
}
