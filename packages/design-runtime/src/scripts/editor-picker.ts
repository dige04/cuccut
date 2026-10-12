/** Restored injected script; compiled as an isolated IIFE before insertion into a preview. */
import type { Dynamic } from "../runtime-types";
interface PickerRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface PickerTextHit {
  tid: number;
  tag: string;
  rect: PickerRect;
}
interface PickerHit extends PickerTextHit {
  root: boolean;
  page: boolean;
  text: PickerTextHit | null;
}
interface PickerInspection {
  tag: string;
  instances: number;
  computed: Record<string, string>;
  parent: {
    display: string;
    flexDirection: string;
  } | null;
  rendered: boolean;
  missing?: boolean;
  ground?: Dynamic;
  pose?: Dynamic;
}
interface EditorPickerApi {
  [method: string]: Dynamic;
  enable(): void;
  disable(keepPreview?: boolean): void;
  enableRingsOnly(): void;
  disableRingsOnly(): void;
  pickAt(
    x: number,
    y: number,
    mode?: "plain" | "deep" | "deeper",
    selectedIds?: number[],
    textIds?: number[],
  ): Promise<
    | PickerHit
    | {
        empty: true;
      }
    | null
  > | null;
  pickIn(
    left: number,
    top: number,
    right: number,
    bottom: number,
    mode?: "plain" | "deep",
  ): Array<{
    tid: number;
    tag: string;
  }>;
  select(
    templateIds: number[] | number | null,
    componentName?: string | null,
    reason?: string,
    sequence?: number,
  ): void;
  hover(templateId: number | null, componentName?: string | null): void;
  hoverAt(
    x: number,
    y: number,
    selectedIds?: number[],
    deep?: boolean,
    textIds?: number[],
  ): void;
  setTool(tool: string, freehand?: boolean): void;
  setReadOnly(readOnly: boolean): void;
  setHostScale(scale: number): void;
  inspect(
    templateId: number,
    componentName: string | null,
    properties: string[],
    normalizeColors?: boolean,
    inherited?: boolean,
    ground?: boolean,
    pose?: boolean,
  ): PickerInspection | null;
}
(function (this: Dynamic, ..._extraArguments: Dynamic[]): Dynamic {
  if ((window as Dynamic).__dcEditorPicker) return;
  var DRAW_CURSOR: Dynamic =
    "url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%20viewBox=%220%200%2016%2016%22%3E%3Cpath%20d=%22M2%2014l1-4%208-8a2.1%202.1%200%200%201%203%203l-8%208-4%201z%22%20fill=%22%23333%22%20stroke=%22%23fff%22%20stroke-width=%221%22/%3E%3C/svg%3E') 1 15, crosshair";
  var TOOL_CURSORS: Dynamic = {
    rect: "crosshair",
    frame: "crosshair",
    grid: "crosshair",
    oval: "crosshair",
    text: "text",
    arrow: "crosshair",
    line: "crosshair",
    draw: DRAW_CURSOR,
    interact: "",
  };
  var editorStylesheet: Dynamic = (document as Dynamic).createElement("style");
  editorStylesheet.setAttribute("data-dc-editor-style", "");
  editorStylesheet.textContent =
    'body:not([data-dc-editor-overlay-hidden]) [data-dc-editor-hover][data-dc-editor-hover-stroke]:not([data-dc-editor-selected]){filter:drop-shadow(0 0 calc(1*var(--dc-chrome-unit,1px)) color-mix(in srgb,#2a78d6 90%,transparent)) drop-shadow(0 0 calc(2*var(--dc-chrome-unit,1px)) color-mix(in srgb,#2a78d6 55%,transparent))!important;}body:not([data-dc-editor-overlay-hidden]):not([data-dc-editor-proxy="copy"]) [data-dc-editor-dragging],body:not([data-dc-editor-overlay-hidden]):not([data-dc-editor-proxy]) [data-dc-dragging],body[data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-drag-follower]{outline:calc(2*var(--dc-chrome-unit,1px)) solid #2a78d6!important;outline-offset:calc(-1*var(--dc-chrome-unit,1px))!important;opacity:0.55!important;}body[data-dc-editor-proxy="move"]:not([data-dc-editor-overlay-hidden]) [data-dc-editor-dragging],body[data-dc-editor-proxy="move"]:not([data-dc-editor-overlay-hidden]) [data-dc-dragging],body[data-dc-editor-proxy="move"]:not([data-dc-editor-overlay-hidden]) [data-dc-editor-dragging]>*,body[data-dc-editor-proxy="move"]:not([data-dc-editor-overlay-hidden]) [data-dc-dragging]>*{opacity:0!important;outline:none!important;}[data-dc-editor-drag-proxy],[data-dc-editor-drag-proxy] *{pointer-events:none!important;}body[data-dc-editor-on]:not([data-dc-editor-tool="interact"]) *{cursor:default!important;user-select:none!important;}body[data-dc-editor-on]:not([data-dc-editor-tool="interact"]) :not([data-dc-editor-overlay-root]):not([data-dc-editor-overlay-root] *){pointer-events:auto!important;transition:none!important;animation:none!important;}body[data-dc-editor-on][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-editor-dragging]:not([data-dc-editor-overlay-root]) :not([data-dc-editor-overlay-root]),body[data-dc-editor-on][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-dragging]:not([data-dc-editor-overlay-root]) :not([data-dc-editor-overlay-root]),body[data-dc-editor-on][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-drag-follower]:not([data-dc-editor-overlay-root]),body[data-dc-editor-on][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-drag-follower]:not([data-dc-editor-overlay-root]) :not([data-dc-editor-overlay-root]),body[data-dc-editor-move][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-editor-dragging]:not([data-dc-editor-overlay-root]) :not([data-dc-editor-overlay-root]),body[data-dc-editor-move][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-dragging]:not([data-dc-editor-overlay-root]) :not([data-dc-editor-overlay-root]),body[data-dc-editor-move][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-drag-follower]:not([data-dc-editor-overlay-root]),body[data-dc-editor-move][data-dc-editor-brk]:not([data-dc-editor-overlay-hidden]) [data-dc-drag-follower]:not([data-dc-editor-overlay-root]) :not([data-dc-editor-overlay-root]){pointer-events:none!important;}body[data-dc-editor-move] :not([data-dc-editor-overlay-root]):not([data-dc-editor-overlay-root] *){pointer-events:auto!important;transition:none!important;animation-duration:0s!important;animation-delay:0s!important;}body[data-dc-editor-on][data-dc-editor-tool="rect"] *,body[data-dc-editor-on][data-dc-editor-tool="frame"] *,body[data-dc-editor-on][data-dc-editor-tool="grid"] *,body[data-dc-editor-on][data-dc-editor-tool="oval"] *,body[data-dc-editor-on][data-dc-editor-tool="arrow"] *,body[data-dc-editor-on][data-dc-editor-tool="line"] *{cursor:crosshair!important;}body[data-dc-editor-on][data-dc-editor-tool="text"] *{cursor:text!important;}body[data-dc-editor-on][data-dc-editor-tool="draw"] *{cursor:' +
    DRAW_CURSOR +
    '!important;}body[data-dc-editor-on]:not([data-dc-editor-tool]) [data-drags-parent],body[data-dc-editor-on]:not([data-dc-editor-tool]) [data-drags-parent] *{cursor:grab!important;}body[data-dc-editor-on]:not([data-dc-editor-tool]) [data-drags-parent]:active,body[data-dc-editor-on]:not([data-dc-editor-tool]) [data-drags-parent]:active *{cursor:grabbing!important;}body[data-dc-editor-on] [data-dc-editor-editing][contenteditable][contenteditable],body[data-dc-editor-on] [data-dc-editor-editing][contenteditable][contenteditable] *,body[data-dc-editor-on] [data-dc-editor-svg-editing]{cursor:text!important;}body[data-dc-editor-on] [data-dc-editor-editing="import"]{outline:none!important;}html:not([data-dc-canvas]):has(body[data-dc-editor-on]:not([data-dc-capturing]) .sc-host){background:var(--dc-editor-backdrop,#ededeb);}html:not([data-dc-canvas]) body[data-dc-editor-on]:not([data-dc-capturing]):has(.sc-host){background:var(--dc-editor-backdrop,#ededeb);}html:not([data-dc-canvas]) body[data-dc-editor-on] .sc-host:not(.sc-host .sc-host){min-height:calc(100vh - var(--dc-editor-host-vpad,0px));}html:not([data-dc-canvas]) body[data-dc-editor-on]:not([data-dc-capturing]) .sc-host:not(.sc-host .sc-host){background:var(--dc-editor-host-bg,#fff);}html[data-dc-frameless],html[data-dc-frameless] body[data-dc-editor-on],html[data-dc-frameless] body[data-dc-editor-on] .sc-host:not(.sc-host .sc-host){background:transparent!important;min-height:0!important;}html:has(body[data-dc-capturing]),body[data-dc-capturing]{transition:none!important;}html[data-dc-canvas]{overflow:hidden;}html[data-dc-canvas] body[data-dc-editor-on] .sc-host:not(.sc-host .sc-host)::before{content:"";position:absolute;left:-100000px;top:-100000px;width:200000px;height:200000px;pointer-events:none;background:repeating-linear-gradient(45deg,var(--dc-editor-hatch-ink,rgba(0,0,0,.05)) 0 8px,transparent 8px 16px);clip-path:polygon(0 0,100% 0,100% 50%,50% 50%,50% 100%,0 100%);}';
  var enabled: Dynamic = false;
  var hostDrag: Dynamic = null;
  var isMacPlatform: Dynamic = /Mac|iPhone|iPad/.test(
    (navigator as Dynamic).platform || "",
  );
  var value_ud: Dynamic =
    typeof MessageEvent == "function" &&
    "userActivation" in MessageEvent.prototype;
  var ringsOnlyEnabled: Dynamic = false;
  var state2: Dynamic = {};
  var index: Dynamic = 0;
  var readOnly: Dynamic = false;
  var resumeRingsOnly: Dynamic = false;
  var panZoomOnly: Dynamic = false;
  var value_Do: Dynamic = false;
  var index2: Dynamic = 0;
  var index3: Dynamic = 0;
  var hostPanZoom: Dynamic = false;
  var nativeScrollMode: Dynamic = false;
  var playbackPanZoom: Dynamic = false;
  var selectedTemplateIds: Dynamic = [];
  var selectedComponentName: Dynamic = null;
  var selectedPart: Dynamic = null;
  var value_nn: Dynamic = null;
  var textEditableTemplates: Dynamic = {};
  var state4: Dynamic = {};
  var items: Dynamic = [];
  var state5: Dynamic = {};
  var state6: Dynamic = {};
  var textEdit: Dynamic = null;
  var pendingDoubleClick: Dynamic = null;
  var index4: Dynamic = 0;
  var pendingTextTarget: Dynamic = null;
  var index5: Dynamic = 0;
  var textMapReady: Dynamic = false;
  var value_bt: Dynamic = null;
  var value_Ke: Dynamic = null;
  var value_Ja: Dynamic = null;
  var leftTextCopy: Dynamic = null;
  var value_Ko: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments2: Dynamic[]
  ): Dynamic {
    const position: Dynamic = (document as Dynamic).createElement("div");
    position.innerHTML = innerHTML;
    const shaft: Dynamic = position.querySelectorAll("*");
    for (let tag: Dynamic = 0; tag < shaft.length; tag++) {
      const rot: Dynamic = shaft[tag];
      for (; rot.attributes.length; )
        rot.removeAttribute(rot.attributes[0].name);
    }
    return position.innerHTML.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  };
  var value_Oo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments3: Dynamic[]
  ): Dynamic {
    if (typeof innerHTML != "string") return null;
    const shaft: Dynamic = new DOMParser()
      .parseFromString(innerHTML, "text/html")
      .querySelector('[data-dc-tpl="' + position + '"]');
    if (!shaft) return null;
    const tag: Dynamic = shaft.querySelectorAll("*");
    for (let rot: Dynamic = 0; rot < tag.length; rot++) {
      const ref: Dynamic = tag[rot];
      for (; ref.attributes.length; )
        ref.removeAttribute(ref.attributes[0].name);
    }
    return shaft.innerHTML;
  };
  var value_Io: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments4: Dynamic[]
  ): Dynamic {
    const tag: Dynamic = (
      ref?: Dynamic,
      ..._extraArguments5: Dynamic[]
    ): Dynamic => {
      if (ref.textContent === "" && !ref.querySelector("*")) return null;
      const top: Dynamic = innerHTML.cloneNode(false);
      top.removeAttribute("data-dc-tpl");
      top.removeAttribute("data-dc-link-new");
      top.appendChild(ref);
      const name3: Dynamic = top.querySelectorAll("[data-dc-tpl]");
      for (let bottom: Dynamic = 0; bottom < name3.length; bottom++)
        name3[bottom].removeAttribute("data-dc-tpl");
      return top;
    };
    const rot: Dynamic = innerHTML.parentNode;
    if (position && innerHTML.contains(position)) {
      const ref: Dynamic = (document as Dynamic).createRange();
      ref.setStart(innerHTML, 0);
      ref.setEndBefore(position);
      if (!ref.collapsed) {
        const top: Dynamic = tag(ref.extractContents());
        if (top) {
          rot.insertBefore(top, innerHTML);
        }
      }
    }
    if (shaft && innerHTML.contains(shaft)) {
      const ref: Dynamic = (document as Dynamic).createRange();
      ref.setStartAfter(shaft);
      ref.setEnd(innerHTML, innerHTML.childNodes.length);
      if (!ref.collapsed) {
        const top: Dynamic = tag(ref.extractContents());
        if (top) {
          rot.insertBefore(top, innerHTML.nextSibling);
        }
      }
    }
    for (; innerHTML.firstChild; )
      rot.insertBefore(innerHTML.firstChild, innerHTML);
    rot.removeChild(innerHTML);
  };
  var value_sd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments6: Dynamic[]
  ): Dynamic {
    const rot: Dynamic =
      position === "into" ? innerHTML : innerHTML.parentElement;
    if (!rot || rot.getAttribute("data-dc-tpl") == null)
      return {
        el: innerHTML,
        position: position,
      };
    const ref: Dynamic = [];
    for (let adjust: Dynamic = 0; adjust < rot.children.length; adjust++) {
      const axis: Dynamic = rot.children[adjust];
      if (!axis.getAttribute || axis.getAttribute("data-dc-tpl") == null)
        continue;
      const y: Dynamic = getComputedStyle(axis).position;
      if (!(y === "absolute" || y === "fixed")) {
        ref.push(axis);
      }
    }
    if (ref.length === 0)
      return {
        el: innerHTML,
        position: position,
        slotless: true,
      };
    const top: Dynamic = getComputedStyle(rot);
    const name3: Dynamic = top.display || "";
    const bottom: Dynamic = name3.indexOf("flex") !== -1;
    const left: Dynamic =
      bottom && top.flexDirection.indexOf("-reverse") !== -1;
    if (left) {
      ref.reverse();
    }
    const scope: Dynamic = (
      adjust?: Dynamic,
      ..._extraArguments7: Dynamic[]
    ): Dynamic => (left ? (adjust === "before" ? "after" : "before") : adjust);
    if (name3.indexOf("grid") !== -1) {
      let adjust: Dynamic = ref[0];
      let axis: Dynamic = 1 / 0;
      for (let lock: Dynamic = 0; lock < ref.length; lock++) {
        const paint: Dynamic = ref[lock].getBoundingClientRect();
        const lastKey: Dynamic = shaft - (paint.left + paint.right) / 2;
        const lim: Dynamic = tag - (paint.top + paint.bottom) / 2;
        const text8: Dynamic = lastKey * lastKey + lim * lim;
        if (text8 < axis) {
          axis = text8;
          adjust = ref[lock];
        }
      }
      const y: Dynamic = adjust.getBoundingClientRect();
      const pose: Dynamic =
        tag < y.top || (tag <= y.bottom && shaft < (y.left + y.right) / 2);
      return {
        el: adjust,
        position: pose ? "before" : "after",
      };
    }
    const top2: Dynamic =
      (bottom && top.flexDirection.indexOf("row") === 0) ||
      name3 === "table-row" ||
      rot.tagName.toLowerCase() === "tr";
    for (let adjust: Dynamic = 0; adjust < ref.length; adjust++) {
      const axis: Dynamic = ref[adjust].getBoundingClientRect();
      const y: Dynamic = top2
        ? (axis.left + axis.right) / 2
        : (axis.top + axis.bottom) / 2;
      if ((top2 ? shaft : tag) < y)
        return {
          el: ref[adjust],
          position: scope("before"),
        };
    }
    return {
      el: ref[ref.length - 1],
      position: scope("after"),
    };
  };
  var value_dd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments8: Dynamic[]
  ): Dynamic {
    if (!innerHTML) return false;
    if (innerHTML === position) return true;
    const shaft: Dynamic = innerHTML.getBoundingClientRect();
    const tag: Dynamic = position.getBoundingClientRect();
    return shaft.width >= tag.width * 0.9 && shaft.height >= tag.height * 0.9;
  };
  var value_fd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments9: Dynamic[]
  ): Dynamic {
    let tag: Dynamic = null;
    let rot: Dynamic = 1 / 0;
    for (let ref: Dynamic = 0; ref < shaft.length; ref++) {
      const top: Dynamic = shaft[ref];
      if (top.right - top.left < 8 || top.bottom - top.top < 8) continue;
      const name3: Dynamic = Math.max(
        top.left - innerHTML,
        0,
        innerHTML - top.right,
      );
      const bottom: Dynamic = Math.max(
        top.top - position,
        0,
        position - top.bottom,
      );
      const left: Dynamic = name3 * name3 + bottom * bottom;
      if (left < rot) {
        rot = left;
        tag = top;
      }
    }
    return tag
      ? {
          x: Math.min(Math.max(innerHTML, tag.left + 2), tag.right - 2),
          y: Math.min(Math.max(position, tag.top + 2), tag.bottom - 2),
        }
      : null;
  };
  var value_Fo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments0: Dynamic[]
  ): Dynamic {
    const rot: Dynamic = shaft.right - shaft.left;
    const ref: Dynamic = shaft.bottom - shaft.top;
    const top: Dynamic = tag.right - tag.left;
    const name3: Dynamic = tag.bottom - tag.top;
    if (rot < 4 || ref < 4 || top < 8 || name3 < 8) return null;
    const bottom: Dynamic = Math.min(
      Math.max((innerHTML - shaft.left) / rot, 0),
      1,
    );
    const left: Dynamic = Math.min(
      Math.max((position - shaft.top) / ref, 0),
      1,
    );
    return {
      x: Math.min(
        Math.max(tag.left + bottom * top, tag.left + 2),
        tag.right - 2,
      ),
      y: Math.min(
        Math.max(tag.top + left * name3, tag.top + 2),
        tag.bottom - 2,
      ),
    };
  };
  var value_Xo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments1: Dynamic[]
  ): Dynamic {
    if (innerHTML !== "dc-import" && innerHTML !== "x-import") return null;
    const shaft: Dynamic = innerHTML === "dc-import";
    const tag: Dynamic = position["component-from-global-scope"] || "";
    const rot: Dynamic = position.component || "";
    const ref: Dynamic = shaft
      ? position.name || rot
      : tag || (position.from != null ? rot : "");
    if (
      ((position.from || "") + " " + tag + " " + rot)
        .toLowerCase()
        .includes("deck-stage") ||
      ref.toLowerCase() === "image-slot"
    )
      return null;
    const top: Dynamic = ref.lastIndexOf(shaft ? "/" : ".");
    const name3: Dynamic = ref.slice(top + 1);
    if (name3 === "" || ref.includes("{{")) return null;
    const bottom: Dynamic = {
      kind: shaft
        ? "canvas"
        : position.from == null && tag.includes(".")
          ? "system"
          : "module",
      ref: ref,
      name: name3,
    };
    const left: Dynamic = ref.slice(0, Math.max(top, 0));
    const scope: Dynamic = shaft
      ? left
          .split("/")
          .filter(function (
            this: Dynamic,
            top2?: Dynamic,
            ..._extraArguments10: Dynamic[]
          ): Dynamic {
            return top2 !== "" && top2 !== "." && top2 !== "..";
          })
          .join("/")
      : left;
    if (scope !== "") {
      bottom.scope = scope;
    }
    return bottom;
  };
  var value_cd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments11: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = {};
    const tag: Dynamic = /<x-import\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
    const rot: Dynamic = /\s([^\s=>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
    let ref: Dynamic;
    for (; (ref = tag.exec(innerHTML)) !== null; ) {
      const top: Dynamic = {};
      let name3: Dynamic;
      for (rot.lastIndex = 0; (name3 = rot.exec(ref[1])) !== null; )
        top[name3[1].toLowerCase()] =
          name3[2] !== undefined
            ? name3[2]
            : name3[3] !== undefined
              ? name3[3]
              : "";
      const bottom: Dynamic = top["data-dc-tpl"];
      if (
        bottom !== undefined &&
        /^\d+$/.test(bottom) &&
        position("x-import", top)
      ) {
        shaft[bottom] = 1;
      }
    }
    return shaft;
  };
  var value_pd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments12: Dynamic[]
  ): Dynamic {
    const tag: Dynamic = function (
      this: Dynamic,
      bottom?: Dynamic,
      ..._extraArguments13: Dynamic[]
    ): Dynamic {
      return (bottom.nodeValue || "")
        .replace(/[ \t\n\r\f]+/g, " ")
        .replace(/^ | $/g, "");
    };
    const rot: Dynamic = function (
      this: Dynamic,
      bottom?: Dynamic,
      ..._extraArguments14: Dynamic[]
    ): Dynamic {
      const left: Dynamic = bottom.parentElement;
      return (
        bottom.nodeType === 3 &&
        !!left &&
        innerHTML.contains(bottom) &&
        left.closest("[data-dc-tpl]") === innerHTML &&
        !left.closest(".sc-interp") &&
        left.namespaceURI === "http://www.w3.org/1999/xhtml" &&
        !left.closest("textarea,select,option,title,script,style,noscript")
      );
    };
    let ref: Dynamic = null;
    const top: Dynamic = innerHTML.ownerDocument.createTreeWalker(innerHTML, 4);
    if (shaft) {
      if (!rot(shaft)) return null;
      for (
        let bottom: Dynamic = top.nextNode();
        bottom;
        bottom = top.nextNode()
      )
        if (bottom !== shaft && rot(bottom) && tag(bottom) === tag(shaft))
          return null;
      ref = shaft;
    } else
      for (
        let bottom: Dynamic = top.nextNode();
        bottom;
        bottom = top.nextNode()
      )
        if (!(!rot(bottom) || !/[\p{L}\p{N}]/u.test(bottom.nodeValue || ""))) {
          if (ref) return null;
          ref = bottom;
        }
    if (!ref) return null;
    const name3: Dynamic = tag(ref);
    for (let bottom: Dynamic = 0; bottom < position.length; bottom++)
      if (position[bottom].words === name3)
        return {
          node: ref,
          key: position[bottom].key,
          words: name3,
        };
    return null;
  };
  var items2: Dynamic = [
    "font-size",
    "font-family",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "color",
    "text-align",
    "text-transform",
    "white-space",
    "list-style-type",
  ];
  var value__o: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments15: Dynamic[]
  ): Dynamic {
    const tag: Dynamic =
      position.display === "list-item" || innerHTML.tagName === "LI";
    if (!tag && (innerHTML.textContent || "").trim() === "") return null;
    const rot: Dynamic = {};
    for (let ref: Dynamic = 0; ref < shaft.length; ref++) {
      const top: Dynamic = shaft[ref];
      if (
        (top === "list-style-type" && !tag) ||
        (top === "text-align" && position.display === "inline")
      )
        continue;
      const name3: Dynamic = position.getPropertyValue(top);
      if (name3) {
        rot[top] = name3;
      }
    }
    return rot;
  };
  var value_hd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ..._extraArguments16: Dynamic[]
  ): Dynamic {
    if (innerHTML <= 0) return -1;
    if (rot === "deep") return innerHTML - 1;
    if (rot === "deeper" && shaft >= 0)
      return Math.min(shaft + 1, innerHTML - 1);
    const ref: Dynamic = Math.max(shaft, tag >= 0 ? tag + 1 : -1);
    return ref >= 0
      ? Math.min(ref, innerHTML - 1)
      : position && innerHTML > 1
        ? 1
        : 0;
  };
  var value_gd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments17: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = (
      ref?: Dynamic,
      ..._extraArguments18: Dynamic[]
    ): Dynamic => {
      const top: Dynamic = (ref.localName || ref.tagName || "").toLowerCase();
      return top.indexOf("sc-raw-") === 0 ? top.slice(7) : top;
    };
    const tag: Dynamic = (
      ref?: Dynamic,
      ..._extraArguments19: Dynamic[]
    ): Dynamic => {
      const top: Dynamic = shaft(ref);
      return (
        /^(svg|img|video|audio|canvas|picture|iframe|object|embed|input|textarea|select|button|hr|dc-import|x-import)$/.test(
          top,
        ) ||
        top.indexOf("-") > 0 ||
        ref.hasAttribute("data-sc-name") ||
        !!(ref.classList && ref.classList.contains("sc-host-x"))
      );
    };
    if (
      tag(innerHTML) ||
      position(shaft(innerHTML)) ||
      innerHTML.querySelector("[data-dc-tpl]")
    )
      return false;
    const rot: Dynamic = innerHTML.querySelectorAll("*");
    for (let ref: Dynamic = 0; ref < rot.length; ref++)
      if (tag(rot[ref])) return false;
    return !(innerHTML.textContent || "").trim();
  };
  var value_md: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments20: Dynamic[]
  ): Dynamic {
    return (
      innerHTML.left <= 1 &&
      innerHTML.top <= 1 &&
      innerHTML.right >= position - 1
    );
  };
  var value_Yo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments21: Dynamic[]
  ): Dynamic {
    return position.position === "absolute" ||
      position.position === "fixed" ||
      /^(LI|TR|TD|TH|THEAD|TBODY|TFOOT)$/i.test(innerHTML.tagName)
      ? false
      : !/^table-/.test(position.display) && position.display !== "list-item";
  };
  var value_Ho: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments22: Dynamic[]
  ): Dynamic {
    const position: Dynamic = parseFloat(innerHTML.width);
    return position > 0 ? Math.ceil(position * 100) / 100 : 0;
  };
  var value_Wo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments23: Dynamic[]
  ): Dynamic {
    if (
      (innerHTML.textContent || "").trim() !== "" ||
      innerHTML.matches("img,svg,video,canvas,iframe,picture") ||
      innerHTML.querySelector("img,svg,video,canvas,iframe,picture")
    )
      return 0;
    const shaft: Dynamic = parseFloat(position.height);
    return shaft > 0 ? Math.ceil(shaft * 100) / 100 : 0;
  };
  var value_yd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments24: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = {
      margin: "0px",
    };
    const tag: Dynamic = [
      innerHTML.gridRowStart,
      innerHTML.gridRowEnd,
      innerHTML.gridColumnStart,
      innerHTML.gridColumnEnd,
    ];
    if (
      /grid/.test(position) ||
      tag.some(
        (rot?: Dynamic, ..._extraArguments25: Dynamic[]): Dynamic =>
          !!rot && rot !== "auto",
      )
    ) {
      shaft["grid-area"] = "auto";
    }
    return shaft;
  };
  var value_bd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments26: Dynamic[]
  ): Dynamic {
    const tag: Dynamic = {
      lines: [],
      labels: [],
    };
    const rot: Dynamic = shaft > 0 && isFinite(shaft) ? shaft : 1;
    const ref: Dynamic = (
      axis?: Dynamic,
      y?: Dynamic,
      ..._extraArguments27: Dynamic[]
    ): Dynamic =>
      y.l <= axis.l + 0.01 &&
      y.t <= axis.t + 0.01 &&
      y.r >= axis.r - 0.01 &&
      y.b >= axis.b - 0.01;
    if (ref(position, innerHTML)) {
      const axis: Dynamic = innerHTML;
      innerHTML = position;
      position = axis;
    }
    const top: Dynamic = ref(innerHTML, position);
    const name3: Dynamic = (
      axis?: Dynamic,
      y2?: Dynamic,
      pose?: Dynamic,
      lock?: Dynamic,
      ..._extraArguments28: Dynamic[]
    ): Dynamic => {
      const paint: Dynamic = Math.max(axis, pose);
      const lastKey: Dynamic = Math.min(y2, lock);
      return lastKey > paint ? (paint + lastKey) / 2 : null;
    };
    const bottom: Dynamic = (
      axis?: Dynamic,
      y2?: Dynamic,
      pose?: Dynamic,
      lock?: Dynamic,
      paint?: Dynamic,
      lastKey?: Dynamic,
      ..._extraArguments29: Dynamic[]
    ): Dynamic => {
      const lim: Dynamic = Math.round(Math.abs(pose - y2) / rot);
      if (lim < 1) return;
      const text8: Dynamic = String(lim);
      if (axis === "x") {
        tag.lines.push({
          x1: Math.min(y2, pose),
          y1: lock,
          x2: Math.max(y2, pose),
          y2: lock,
        });
        tag.labels.push({
          x: (y2 + pose) / 2,
          y: lock,
          text: text8,
          axis: axis,
        });
        if (lock < paint) {
          tag.lines.push({
            x1: pose,
            y1: lock,
            x2: pose,
            y2: paint,
            ext: 1,
          });
        } else {
          if (lock > lastKey) {
            tag.lines.push({
              x1: pose,
              y1: lastKey,
              x2: pose,
              y2: lock,
              ext: 1,
            });
          }
        }
      } else {
        tag.lines.push({
          x1: lock,
          y1: Math.min(y2, pose),
          x2: lock,
          y2: Math.max(y2, pose),
        });
        tag.labels.push({
          x: lock,
          y: (y2 + pose) / 2,
          text: text8,
          axis: axis,
        });
        if (lock < paint) {
          tag.lines.push({
            x1: lock,
            y1: pose,
            x2: paint,
            y2: pose,
            ext: 1,
          });
        } else {
          if (lock > lastKey) {
            tag.lines.push({
              x1: lastKey,
              y1: pose,
              x2: lock,
              y2: pose,
              ext: 1,
            });
          }
        }
      }
    };
    const left: Dynamic = name3(
      innerHTML.t,
      innerHTML.b,
      position.t,
      position.b,
    );
    const scope: Dynamic = left ?? (innerHTML.t + innerHTML.b) / 2;
    const top2: Dynamic = name3(
      innerHTML.l,
      innerHTML.r,
      position.l,
      position.r,
    );
    const adjust: Dynamic = top2 ?? (innerHTML.l + innerHTML.r) / 2;
    return top
      ? (bottom("x", innerHTML.l, position.l, scope, position.t, position.b),
        bottom("x", innerHTML.r, position.r, scope, position.t, position.b),
        bottom("y", innerHTML.t, position.t, adjust, position.l, position.r),
        bottom("y", innerHTML.b, position.b, adjust, position.l, position.r),
        tag)
      : (position.r <= innerHTML.l
          ? bottom("x", innerHTML.l, position.r, scope, position.t, position.b)
          : position.l >= innerHTML.r &&
            bottom("x", innerHTML.r, position.l, scope, position.t, position.b),
        position.b <= innerHTML.t
          ? bottom("y", innerHTML.t, position.b, adjust, position.l, position.r)
          : position.t >= innerHTML.b &&
            bottom(
              "y",
              innerHTML.b,
              position.t,
              adjust,
              position.l,
              position.r,
            ),
        tag);
  };
  var value_xd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments30: Dynamic[]
  ): Dynamic {
    const rot: Dynamic = {
      dx: 0,
      dy: 0,
      guides: [],
    };
    for (const ref of ["x", "y"] as Dynamic) {
      if (tag && !tag[ref]) continue;
      const top: Dynamic = ref === "x" ? innerHTML.x : innerHTML.y;
      const name3: Dynamic = ref === "x" ? innerHTML.w : innerHTML.h;
      const bottom: Dynamic = [
        {
          kind: "edge",
          at: top,
        },
        {
          kind: "center",
          at: top + name3 / 2,
        },
        {
          kind: "edge",
          at: top + name3,
        },
      ];
      let left: Dynamic = null;
      for (const scope of position as Dynamic)
        if (
          !(
            scope.axis !== ref ||
            !(typeof scope.pos == "number" && isFinite(scope.pos))
          )
        )
          for (const top2 of bottom as Dynamic) {
            if (top2.kind !== scope.kind) continue;
            const adjust: Dynamic = scope.pos - top2.at;
            const axis: Dynamic = Math.abs(adjust);
            if (
              axis <= shaft &&
              (!left ||
                axis < left.dist ||
                (axis === left.dist &&
                  scope.kind === "center" &&
                  left.line.kind !== "center"))
            ) {
              left = {
                adjust: adjust,
                dist: axis,
                line: scope,
              };
            }
          }
      if (left) {
        if (ref === "x") {
          rot.dx = left.adjust;
        } else {
          rot.dy = left.adjust;
        }
        rot.guides.push(left.line);
      }
    }
    return rot;
  };
  var value_wd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments31: Dynamic[]
  ): Dynamic {
    const position: Dynamic = {
      defs: 1,
      title: 1,
      desc: 1,
      metadata: 1,
      style: 1,
      script: 1,
    };
    let shaft: Dynamic = null;
    for (let lock: Dynamic = 0; lock < innerHTML.children.length; lock++) {
      const paint: Dynamic = innerHTML.children[lock];
      if (position[(paint.tagName || "").toLowerCase()] !== 1) {
        if (shaft) return null;
        shaft = paint;
      }
    }
    if (
      !shaft ||
      shaft.hasAttribute("transform") ||
      /transform\s*:/.test(shaft.getAttribute("style") || "")
    )
      return null;
    const tag: Dynamic = (shaft.tagName || "").toLowerCase();
    const rot: Dynamic = (
      lock?: Dynamic,
      ..._extraArguments32: Dynamic[]
    ): Dynamic => {
      if (lock == null) return 0;
      const paint: Dynamic = lock.trim();
      return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:px)?$/.test(paint)
        ? parseFloat(paint)
        : null;
    };
    const ref: Dynamic = (
      lock?: Dynamic,
      paint?: Dynamic,
      lastKey?: Dynamic,
      lim?: Dynamic,
      text8?: Dynamic,
      ..._extraArguments33: Dynamic[]
    ): Dynamic => ({
      shaft: shaft,
      tag: tag,
      sx: lock,
      sy: paint,
      ex: lastKey,
      ey: lim,
      legacy: text8,
    });
    if (tag === "line") {
      const lock: Dynamic = rot(shaft.getAttribute("x1"));
      const paint: Dynamic = rot(shaft.getAttribute("y1"));
      const lastKey: Dynamic = rot(shaft.getAttribute("x2"));
      const lim: Dynamic = rot(shaft.getAttribute("y2"));
      return lock == null || paint == null || lastKey == null || lim == null
        ? null
        : ref(lock, paint, lastKey, lim, false);
    }
    if (tag === "polyline") {
      const lock: Dynamic = (shaft.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .filter(
          (paint?: Dynamic, ..._extraArguments34: Dynamic[]): Dynamic =>
            paint !== "",
        )
        .map(rot);
      return lock.length !== 4 ||
        lock.some(
          (paint?: Dynamic, ..._extraArguments35: Dynamic[]): Dynamic =>
            paint == null,
        )
        ? null
        : ref(lock[0], lock[1], lock[2], lock[3], false);
    }
    if (tag !== "path") return null;
    const top: Dynamic = shaft.getAttribute("d") || "";
    const name3: Dynamic =
      top.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
    if (name3.join("").length !== top.replace(/[\s,]/g, "").length) return null;
    const bottom: Dynamic = (
      lock?: Dynamic,
      ..._extraArguments36: Dynamic[]
    ): Dynamic => lock != null && /^[-+.\d]/.test(lock);
    if (
      name3.length === 15 &&
      name3[0] === "M" &&
      name3[3] === "L" &&
      name3[6] === "M" &&
      name3[9] === "L" &&
      name3[12] === "L" &&
      [1, 2, 4, 5, 7, 8, 10, 11, 13, 14].every(
        (lock?: Dynamic, ..._extraArguments37: Dynamic[]): Dynamic =>
          bottom(name3[lock]),
      )
    )
      return (innerHTML.getAttribute("preserveAspectRatio") ||
        innerHTML.getAttribute("sc-camel-preserve-aspect-ratio")) === "none" &&
        /(^|;)\s*fill:\s*none/.test(innerHTML.getAttribute("style") || "")
        ? ref(+name3[1], +name3[2], +name3[4], +name3[5], true)
        : null;
    if (
      name3.length < 5 ||
      (name3[0] !== "M" && name3[0] !== "m") ||
      !bottom(name3[1]) ||
      !bottom(name3[2])
    )
      return null;
    const left: Dynamic = +name3[1];
    const scope: Dynamic = +name3[2];
    const top2: Dynamic = name3[3];
    const adjust: Dynamic = top2 === top2.toLowerCase();
    let axis: Dynamic;
    let y: Dynamic;
    let pose: Dynamic;
    if (bottom(top2)) {
      if (!bottom(name3[4])) return null;
      axis = +top2;
      y = +name3[4];
      pose = 5;
      if (name3[0] === "m") {
        axis += left;
        y += scope;
      }
    } else if (top2 === "L" || top2 === "l") {
      if (!bottom(name3[4]) || !bottom(name3[5])) return null;
      axis = +name3[4];
      y = +name3[5];
      pose = 6;
      if (adjust) {
        axis += left;
        y += scope;
      }
    } else if (top2 === "H" || top2 === "h") {
      if (!bottom(name3[4])) return null;
      axis = +name3[4] + (adjust ? left : 0);
      y = scope;
      pose = 5;
    } else if (top2 === "V" || top2 === "v") {
      if (!bottom(name3[4])) return null;
      axis = left;
      y = +name3[4] + (adjust ? scope : 0);
      pose = 5;
    } else return null;
    return name3.length === pose ? ref(left, scope, axis, y, false) : null;
  };
  var value_zo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft: Dynamic = "end",
    ..._extraArguments38: Dynamic[]
  ): Dynamic {
    const tag: Dynamic = /^\s*url\(\s*["']?#([^"')\s]+)["']?\s*\)\s*$/.exec(
      position.getAttribute("marker-" + shaft) || "",
    );
    if (!tag) return 0;
    const rot: Dynamic = innerHTML.getElementsByTagName("marker");
    let ref: Dynamic = null;
    for (let axis: Dynamic = 0; axis < rot.length; axis++)
      if (rot[axis].getAttribute("id") === tag[1]) {
        ref = rot[axis];
        break;
      }
    if (!ref) return 0;
    const top: Dynamic = (
      axis?: Dynamic,
      ..._extraArguments39: Dynamic[]
    ): Dynamic =>
      ref.getAttribute(axis) ??
      ref.getAttribute(
        "sc-camel-" +
          axis.replace(
            /[A-Z]/g,
            (y?: Dynamic, ..._extraArguments40: Dynamic[]): Dynamic =>
              "-" + y.toLowerCase(),
          ),
      );
    const name3: Dynamic = ref.getAttribute("orient") || "";
    if (
      top("viewBox") != null ||
      (top("markerUnits") ?? "strokeWidth") !== "strokeWidth" ||
      !(shaft === "start"
        ? name3 === "auto-start-reverse"
        : /^auto/.test(name3))
    )
      return 0;
    const bottom: Dynamic = ref.getElementsByTagName("path")[0];
    const left: Dynamic = (bottom && bottom.getAttribute("d")) || "";
    if (
      !bottom ||
      bottom.hasAttribute("transform") ||
      !/^[MLZz\d\s,.+-]+$/.test(left)
    )
      return 0;
    const scope: Dynamic = left.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g) || [];
    let top2: Dynamic = -1 / 0;
    for (let axis: Dynamic = 0; axis + 1 < scope.length; axis += 2)
      top2 = Math.max(top2, parseFloat(scope[axis]));
    if (
      ref.getAttribute("overflow") !== "visible" &&
      !/(^|;)\s*overflow\s*:\s*visible/.test(ref.getAttribute("style") || "")
    ) {
      top2 = Math.min(top2, parseFloat(top("markerWidth") || "3") || 0);
    }
    const adjust: Dynamic = top2 - parseFloat(top("refX") || "0");
    return adjust > 0 && adjust < 64 ? adjust : 0;
  };
  var value_Ad: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ..._extraArguments41: Dynamic[]
  ): Dynamic {
    const ref: Dynamic = Math.hypot(shaft - innerHTML, tag - position);
    if (!(ref > 0) || !(rot > 0))
      return {
        x: shaft,
        y: tag,
      };
    const top: Dynamic = Math.max(ref - rot, Math.min(ref, 0.5)) / ref;
    const name3: Dynamic = (
      bottom?: Dynamic,
      ..._extraArguments42: Dynamic[]
    ): Dynamic => Math.round(bottom * 100) / 100;
    return {
      x: name3(innerHTML + (shaft - innerHTML) * top),
      y: name3(position + (tag - position) * top),
    };
  };
  var value_qo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments43: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = Math.hypot(
      innerHTML.ex - innerHTML.sx,
      innerHTML.ey - innerHTML.sy,
    );
    return shaft > 0 && position > 0
      ? {
          x: innerHTML.ex + ((innerHTML.ex - innerHTML.sx) * position) / shaft,
          y: innerHTML.ey + ((innerHTML.ey - innerHTML.sy) * position) / shaft,
        }
      : {
          x: innerHTML.ex,
          y: innerHTML.ey,
        };
  };
  var value_Go: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments44: Dynamic[]
  ): Dynamic {
    const rot: Dynamic = shaft(innerHTML);
    if (rot === innerHTML) return innerHTML;
    for (let ref: Dynamic = 0; position && ref < position.length; ref++)
      if (position[ref].el === rot) return position[ref].sep ? rot : innerHTML;
    return tag(rot) ? rot : innerHTML;
  };
  var value_Cd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments45: Dynamic[]
  ): Dynamic {
    if (!innerHTML || !(innerHTML.back > 0 || innerHTML.startBack > 0))
      return null;
    const tag: Dynamic =
      position.left + (innerHTML.px / innerHTML.vbW) * position.width;
    const rot: Dynamic =
      position.top + (innerHTML.py / innerHTML.vbH) * position.height;
    const ref: Dynamic =
      position.left + (innerHTML.tx / innerHTML.vbW) * position.width;
    const top: Dynamic =
      position.top + (innerHTML.ty / innerHTML.vbH) * position.height;
    const name3: Dynamic = innerHTML.px === innerHTML.tx;
    const bottom: Dynamic = innerHTML.py === innerHTML.ty;
    const left: Dynamic = name3 ? shaft.left : Math.min(tag, ref, shaft.left);
    const scope: Dynamic = name3
      ? shaft.right
      : Math.max(tag, ref, shaft.right);
    const top2: Dynamic = bottom ? shaft.top : Math.min(rot, top, shaft.top);
    const adjust: Dynamic = bottom
      ? shaft.bottom
      : Math.max(rot, top, shaft.bottom);
    return {
      left: left,
      top: top2,
      right: scope,
      bottom: adjust,
      width: scope - left,
      height: adjust - top2,
    };
  };
  var value_Ed: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments46: Dynamic[]
  ): Dynamic {
    const tag: Dynamic = Math.min(position.x, shaft.x);
    const rot: Dynamic = Math.min(position.y, shaft.y);
    const ref: Dynamic = Math.abs(shaft.x - position.x) / innerHTML.scl;
    const top: Dynamic = Math.abs(shaft.y - position.y) / innerHTML.scl;
    const name3: Dynamic = Math.max(Math.round(ref), 8);
    const bottom: Dynamic = Math.max(Math.round(top), 8);
    const left: Dynamic = (name3 - ref) / 2;
    const scope: Dynamic = (bottom - top) / 2;
    const top2: Dynamic = (
      lim?: Dynamic,
      ..._extraArguments47: Dynamic[]
    ): Dynamic => Math.round(lim * 100) / 100;
    let adjust: Dynamic = top2(left + (position.x - tag) / innerHTML.scl);
    let axis: Dynamic = top2(scope + (position.y - rot) / innerHTML.scl);
    let y2: Dynamic = top2(left + (shaft.x - tag) / innerHTML.scl);
    let pose: Dynamic = top2(scope + (shaft.y - rot) / innerHTML.scl);
    const lock: Dynamic =
      innerHTML.back && innerHTML.back > 0 ? innerHTML.back : 0;
    const paint: Dynamic =
      innerHTML.startBack && innerHTML.startBack > 0 ? innerHTML.startBack : 0;
    const lastKey: Dynamic = Math.hypot(y2 - adjust, pose - axis);
    if (lock + paint > 0 && lastKey > 0) {
      const lim: Dynamic = Math.min(lastKey, 0.5);
      const text8: Dynamic = lastKey - paint - lock >= lim;
      const value_S: Dynamic = paint > 0 && lock > 0 ? 1e4 : 100;
      const expected: Dynamic = (
        input?: Dynamic,
        ..._extraArguments48: Dynamic[]
      ): Dynamic => Math.round(input * value_S) / value_S;
      const value_k: Dynamic = text8
        ? paint
        : ((lastKey - lim) * paint) / (paint + lock);
      const value_N: Dynamic = text8 ? lastKey - lock : value_k + lim;
      const el: Dynamic = adjust;
      const startRect: Dynamic = axis;
      const value_O: Dynamic = (y2 - adjust) / lastKey;
      const covered: Dynamic = (pose - axis) / lastKey;
      if (paint > 0) {
        adjust = expected(el + value_O * value_k);
        axis = expected(startRect + covered * value_k);
      }
      y2 = expected(el + value_O * value_N);
      pose = expected(startRect + covered * value_N);
    }
    return {
      left: Math.round(
        innerHTML.startLeft +
          (tag - innerHTML.startRect.left) / innerHTML.scl -
          left,
      ),
      top: Math.round(
        innerHTML.startTop +
          (rot - innerHTML.startRect.top) / innerHTML.scl -
          scope,
      ),
      w: name3,
      h: bottom,
      sx: adjust,
      sy: axis,
      ex: y2,
      ey: pose,
      d: "M " + adjust + " " + axis + " L " + y2 + " " + pose,
    };
  };
  var value_Vo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments49: Dynamic[]
  ): Dynamic {
    const position: Dynamic = {};
    for (const shaft of ((innerHTML.tagName || "").toLowerCase() === "line"
      ? ["x1", "y1", "x2", "y2"]
      : ["d", "points"]) as Dynamic)
      position[shaft] = innerHTML.getAttribute(shaft);
    return position;
  };
  var value_Sd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ..._extraArguments50: Dynamic[]
  ): Dynamic {
    const ref: Dynamic = (innerHTML.tagName || "").toLowerCase();
    if (ref === "line") {
      innerHTML.setAttribute("x1", String(position));
      innerHTML.setAttribute("y1", String(shaft));
      innerHTML.setAttribute("x2", String(tag));
      innerHTML.setAttribute("y2", String(rot));
    } else {
      if (ref === "polyline") {
        innerHTML.setAttribute(
          "points",
          position + "," + shaft + " " + tag + "," + rot,
        );
      } else {
        innerHTML.setAttribute(
          "d",
          "M " + position + " " + shaft + " L " + tag + " " + rot,
        );
      }
    }
  };
  var value_Uo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments51: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = {
      defs: 1,
      marker: 1,
      metadata: 1,
      title: 1,
      desc: 1,
      style: 1,
    };
    const tag: Dynamic = (
      rot?: Dynamic,
      ..._extraArguments52: Dynamic[]
    ): Dynamic => {
      for (let ref: Dynamic = 0; ref < rot.children.length; ref++) {
        const top: Dynamic = rot.children[ref];
        const name3: Dynamic = (top.tagName || "").toLowerCase();
        if (
          !(shaft[name3] === 1 || position(top)) &&
          !(name3 === "g" && tag(top))
        )
          return false;
      }
      return true;
    };
    return tag(innerHTML);
  };
  var value_$o: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments53: Dynamic[]
  ): Dynamic {
    return position &&
      position !== innerHTML &&
      position.contains(innerHTML) &&
      shaft(
        position,
        (tag?: Dynamic, ..._extraArguments54: Dynamic[]): Dynamic =>
          tag === innerHTML,
      )
      ? position
      : innerHTML;
  };
  var value_Td: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments55: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = (
      tag?: Dynamic,
      rot?: Dynamic,
      ..._extraArguments56: Dynamic[]
    ): Dynamic => tag < position && (rot >= position || (tag === 0 && rot > 0));
    return shaft(innerHTML.height, innerHTML.width)
      ? {
          left: innerHTML.left,
          top: innerHTML.top - (position - innerHTML.height) / 2,
          width: innerHTML.width,
          height: position,
        }
      : shaft(innerHTML.width, innerHTML.height)
        ? {
            left: innerHTML.left - (position - innerHTML.width) / 2,
            top: innerHTML.top,
            width: position,
            height: innerHTML.height,
          }
        : innerHTML;
  };
  var value_Md: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments57: Dynamic[]
  ): Dynamic {
    let [shaft, tag, rot, ref]: Dynamic = [0, 0, 1 / 0, 1 / 0];
    for (const name3 of position as Dynamic) {
      if (name3.w > 0 && name3.min?.w !== undefined && name3.w >= name3.min.w) {
        shaft = Math.max(shaft, name3.min.w / name3.w);
      }
      if (name3.h > 0 && name3.min?.h !== undefined && name3.h >= name3.min.h) {
        tag = Math.max(tag, name3.min.h / name3.h);
      }
      if (name3.w > 0 && name3.max?.w !== undefined && name3.w <= name3.max.w) {
        rot = Math.min(rot, name3.max.w / name3.w);
      }
      if (name3.h > 0 && name3.max?.h !== undefined && name3.h <= name3.max.h) {
        ref = Math.min(ref, name3.max.h / name3.h);
      }
    }
    const top: Dynamic = (
      name3?: Dynamic,
      bottom?: Dynamic,
      ..._extraArguments58: Dynamic[]
    ): Dynamic => (bottom === 1 / 0 ? 1 / 0 : name3 * bottom);
    return {
      min: {
        w: innerHTML.w * shaft,
        h: innerHTML.h * tag,
      },
      max: {
        w: top(innerHTML.w, rot),
        h: top(innerHTML.h, ref),
      },
    };
  };
  var value_Pd: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments59: Dynamic[]
  ): Dynamic {
    const [tag, rot]: Dynamic = [
      position.w > 0 ? shaft.w / position.w : 1,
      position.h > 0 ? shaft.h / position.h : 1,
    ];
    return {
      x: shaft.x + (innerHTML.x - position.x) * tag,
      y: shaft.y + (innerHTML.y - position.y) * rot,
    };
  };
  var value_Qa: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments60: Dynamic[]
  ): Dynamic {
    const tag: Dynamic = (shaft * Math.PI) / 180;
    const [rot, ref, top, name3]: Dynamic = [
      Math.cos(tag),
      Math.sin(tag),
      innerHTML.x - position.x,
      innerHTML.y - position.y,
    ];
    return {
      x: position.x + top * rot - name3 * ref,
      y: position.y + top * ref + name3 * rot,
    };
  };
  var value_Zo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments61: Dynamic[]
  ): Dynamic {
    let shaft: Dynamic = position
      ? Math.round(innerHTML / 15) * 15
      : Math.round(innerHTML);
    const tag: Dynamic = Math.round(innerHTML / 90) * 90;
    if (!position && Math.abs(innerHTML - tag) <= 3) {
      shaft = tag;
    }
    shaft = ((shaft % 360) + 360) % 360;
    return shaft > 180 ? shaft - 360 : shaft;
  };
  var value_Jo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments62: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = position.x - innerHTML.x;
    const tag: Dynamic = position.y - innerHTML.y;
    const rot: Dynamic = Math.hypot(shaft, tag);
    const ref: Dynamic =
      ((Math.round(Math.atan2(tag, shaft) / (Math.PI / 4)) % 8) + 8) % 8;
    const top: Dynamic = Math.SQRT1_2;
    const name3: Dynamic = [1, top, 0, -top, -1, -top, 0, top][ref];
    const bottom: Dynamic = [0, top, 1, top, 0, -top, -1, -top][ref];
    return {
      x: innerHTML.x + rot * name3,
      y: innerHTML.y + rot * bottom,
    };
  };
  var value_Qo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments63: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = [];
    const tag: Dynamic = [];
    for (const [paint, lastKey] of innerHTML as Dynamic)
      if (
        shaft.length === 0 ||
        paint !== shaft[shaft.length - 1] ||
        lastKey !== tag[tag.length - 1]
      ) {
        shaft.push(paint);
        tag.push(lastKey);
      }
    const rot: Dynamic = shaft.length;
    if (rot < 2) return null;
    if (rot === 2) return [shaft[0], tag[0], shaft[1], tag[1]];
    const ref: Dynamic = (
      paint?: Dynamic,
      lastKey?: Dynamic,
      ..._extraArguments64: Dynamic[]
    ): Dynamic => {
      const lim: Dynamic = Math.sqrt(paint * paint + lastKey * lastKey);
      return lim > 0 ? [paint / lim, lastKey / lim] : [0, 0];
    };
    const top: Dynamic = [shaft[0], tag[0]];
    const name3: Dynamic = (
      paint?: Dynamic,
      lastKey?: Dynamic,
      lim?: Dynamic,
      text8?: Dynamic,
      detail?: Dynamic,
      expected?: Dynamic,
      ..._extraArguments65: Dynamic[]
    ): Dynamic => {
      top.push(paint, lastKey, lim, text8, detail, expected);
    };
    const bottom: Dynamic = Array(rot).fill(0);
    const left: Dynamic = position * position;
    const scope: Dynamic = (
      paint?: Dynamic,
      lastKey?: Dynamic,
      ..._extraArguments66: Dynamic[]
    ): Dynamic =>
      Math.sqrt(
        (shaft[paint] - shaft[lastKey]) ** 2 + (tag[paint] - tag[lastKey]) ** 2,
      );
    const top2: Dynamic = (
      paint?: Dynamic,
      lastKey?: Dynamic,
      ..._extraArguments67: Dynamic[]
    ): Dynamic => {
      const lim: Dynamic = lastKey > paint ? 1 : -1;
      let text8: Dynamic = paint + lim;
      for (; text8 !== lastKey && scope(paint, text8) < 4 * position; )
        text8 += lim;
      return ref(shaft[text8] - shaft[paint], tag[text8] - tag[paint]);
    };
    const adjust: Dynamic = (
      paint?: Dynamic,
      lastKey?: Dynamic,
      lim?: Dynamic,
      text8?: Dynamic,
      detail?: Dynamic,
      expected?: Dynamic,
      ..._extraArguments68: Dynamic[]
    ): Dynamic => {
      const value_k: Dynamic = shaft[paint];
      const value_N: Dynamic = tag[paint];
      const el: Dynamic = shaft[lastKey];
      const startRect: Dynamic = tag[lastKey];
      let index21: Dynamic = 0;
      let covered: Dynamic = 0;
      let index22: Dynamic = 0;
      let back: Dynamic = 0;
      let x: Dynamic = 0;
      for (let value_tt: Dynamic = paint; value_tt <= lastKey; value_tt++) {
        const value_vt: Dynamic = bottom[value_tt - paint];
        const tid: Dynamic = 1 - value_vt;
        const freezeStyle: Dynamic = 3 * tid * tid * value_vt;
        const value_V: Dynamic = 3 * tid * value_vt * value_vt;
        const value_ot: Dynamic = tid * tid * tid + freezeStyle;
        const value_et: Dynamic = value_V + value_vt * value_vt * value_vt;
        const value_st: Dynamic = lim * freezeStyle;
        const value_ae: Dynamic = text8 * freezeStyle;
        const absStyles: Dynamic = detail * value_V;
        const value__t: Dynamic = expected * value_V;
        const value_Jt: Dynamic =
          shaft[value_tt] - value_k * value_ot - el * value_et;
        const value_kt: Dynamic =
          tag[value_tt] - value_N * value_ot - startRect * value_et;
        index21 += value_st * value_st + value_ae * value_ae;
        covered += value_st * absStyles + value_ae * value__t;
        index22 += absStyles * absStyles + value__t * value__t;
        back += value_st * value_Jt + value_ae * value_kt;
        x += absStyles * value_Jt + value__t * value_kt;
      }
      const y: Dynamic = index21 * index22 - covered * covered;
      let K: Dynamic = 0;
      let index23: Dynamic = 0;
      if (Math.abs(y) > 1e-12) {
        K = (back * index22 - x * covered) / y;
        index23 = (index21 * x - covered * back) / y;
      } else {
        if (Math.abs(index21 + covered) > 1e-12) {
          K = index23 = back / (index21 + covered);
        }
      }
      const value_Z: Dynamic = el - value_k;
      const value_pt: Dynamic = startRect - value_N;
      const value_ut: Dynamic = Math.sqrt(
        value_Z * value_Z + value_pt * value_pt,
      );
      if (
        K < 1e-6 * value_ut ||
        index23 < 1e-6 * value_ut ||
        K * (lim * value_Z + text8 * value_pt) -
          index23 * (detail * value_Z + expected * value_pt) >
          value_ut * value_ut
      ) {
        K = index23 = value_ut / 3;
      }
      return [
        value_k + lim * K,
        value_N + text8 * K,
        el + detail * index23,
        startRect + expected * index23,
      ];
    };
    const axis: Dynamic = (
      paint?: Dynamic,
      lastKey?: Dynamic,
      lim?: Dynamic,
      text8?: Dynamic,
      detail?: Dynamic,
      expected?: Dynamic,
      ..._extraArguments69: Dynamic[]
    ): Dynamic => {
      const value_k: Dynamic = shaft[paint];
      const value_N: Dynamic = tag[paint];
      const el: Dynamic = shaft[lastKey];
      const startRect: Dynamic = tag[lastKey];
      if (lastKey - paint === 1) {
        const value_Z: Dynamic = Math.sqrt(
          (el - value_k) * (el - value_k) +
            (startRect - value_N) * (startRect - value_N),
        );
        const [value_pt, value_ut]: Dynamic = ref(
          el - value_k,
          startRect - value_N,
        );
        const value_tt: Dynamic =
          (value_Z / 3) * Math.max(0.05, lim * value_pt + text8 * value_ut);
        const value_vt: Dynamic =
          (value_Z / 3) *
          Math.max(0.05, -(detail * value_pt + expected * value_ut));
        name3(
          value_k + lim * value_tt,
          value_N + text8 * value_tt,
          el + detail * value_vt,
          startRect + expected * value_vt,
          el,
          startRect,
        );
        return;
      }
      bottom[0] = 0;
      for (let value_Z: Dynamic = paint + 1; value_Z <= lastKey; value_Z++)
        bottom[value_Z - paint] =
          bottom[value_Z - paint - 1] +
          Math.sqrt(
            (shaft[value_Z] - shaft[value_Z - 1]) ** 2 +
              (tag[value_Z] - tag[value_Z - 1]) ** 2,
          );
      for (let count15: Dynamic = 1; count15 <= lastKey - paint; count15++)
        bottom[count15] =
          bottom[lastKey - paint] > 0
            ? bottom[count15] / bottom[lastKey - paint]
            : 0;
      let value_O: Dynamic = (paint + lastKey) >> 1;
      let covered: Dynamic = 4 * left;
      for (let index21: Dynamic = 0; index21 <= 4; index21++) {
        const [value_pt, value_ut, value_tt, value_vt]: Dynamic = adjust(
          paint,
          lastKey,
          lim,
          text8,
          detail,
          expected,
        );
        let tid: Dynamic = 0;
        let freezeStyle: Dynamic = (paint + lastKey) >> 1;
        let value_V: Dynamic = true;
        for (
          let value_ot: Dynamic = paint + 1;
          value_ot < lastKey;
          value_ot++
        ) {
          const value_et: Dynamic = bottom[value_ot - paint];
          const value_st: Dynamic = 1 - value_et;
          const value_ae: Dynamic = 3 * value_st * value_st * value_et;
          const absStyles: Dynamic = 3 * value_st * value_et * value_et;
          const value__t: Dynamic =
            value_st * value_st * value_st * value_k +
            value_ae * value_pt +
            absStyles * value_tt +
            value_et * value_et * value_et * el -
            shaft[value_ot];
          const value_Jt: Dynamic =
            value_st * value_st * value_st * value_N +
            value_ae * value_ut +
            absStyles * value_vt +
            value_et * value_et * value_et * startRect -
            tag[value_ot];
          if (value__t * value__t + value_Jt * value_Jt >= tid) {
            tid = value__t * value__t + value_Jt * value_Jt;
            freezeStyle = value_ot;
          }
          const value_kt: Dynamic =
            3 *
            (value_st * value_st * (value_pt - value_k) +
              2 * value_st * value_et * (value_tt - value_pt) +
              value_et * value_et * (el - value_tt));
          const absStyles2: Dynamic =
            3 *
            (value_st * value_st * (value_ut - value_N) +
              2 * value_st * value_et * (value_vt - value_ut) +
              value_et * value_et * (startRect - value_vt));
          const value_Jr: Dynamic =
            6 *
            (value_st * (value_tt - 2 * value_pt + value_k) +
              value_et * (el - 2 * value_tt + value_pt));
          const value_Qr: Dynamic =
            6 *
            (value_st * (value_vt - 2 * value_ut + value_N) +
              value_et * (startRect - 2 * value_vt + value_ut));
          const value_Pr: Dynamic =
            value_kt * value_kt +
            absStyles2 * absStyles2 +
            value__t * value_Jr +
            value_Jt * value_Qr;
          const value_jr: Dynamic =
            Math.abs(value_Pr) > 1e-9
              ? value_et -
                (value__t * value_kt + value_Jt * absStyles2) / value_Pr
              : value_et;
          if (value_jr <= bottom[value_ot - paint - 1] || value_jr >= 1) {
            value_V = false;
          }
          bottom[value_ot - paint] = value_jr;
        }
        if (tid < left) {
          name3(value_pt, value_ut, value_tt, value_vt, el, startRect);
          return;
        }
        value_O = freezeStyle;
        if (tid >= covered || !value_V) break;
        covered = tid;
      }
      const [value_G, back]: Dynamic = top2(value_O, paint);
      const [x, y]: Dynamic = top2(value_O, lastKey);
      const [K, value_Y]: Dynamic = ref(value_G - x, back - y);
      axis(paint, value_O, lim, text8, K, value_Y);
      axis(value_O, lastKey, -K, -value_Y, detail, expected);
    };
    const y2: Dynamic = (
      paint?: Dynamic,
      lastKey?: Dynamic,
      ..._extraArguments70: Dynamic[]
    ): Dynamic => {
      let [lim, text8]: Dynamic = [shaft[paint], tag[paint]];
      for (let value_S: Dynamic = paint + 1; value_S < lastKey; value_S++) {
        const [expected, items14]: Dynamic = [shaft[value_S], tag[value_S]];
        if (
          scope(value_S, value_S + 1) < 4 * position &&
          Math.sqrt((expected - lim) ** 2 + (items14 - text8) ** 2) <
            4 * position
        ) {
          shaft[value_S] = (lim + 2 * expected + shaft[value_S + 1]) / 4;
          tag[value_S] = (text8 + 2 * items14 + tag[value_S + 1]) / 4;
        }
        [lim, text8] = [expected, items14];
      }
      axis(paint, lastKey, ...top2(paint, lastKey), ...top2(lastKey, paint));
    };
    let pose: Dynamic = 0;
    const lock: Dynamic = (
      paint?: Dynamic,
      ..._extraArguments71: Dynamic[]
    ): Dynamic => {
      if (
        paint <= pose ||
        paint + 1 >= rot ||
        scope(paint, paint - 1) > 16 * position ||
        scope(paint, paint + 1) > 16 * position
      )
        return 1;
      let [lastKey, lim]: Dynamic = [paint - 1, paint + 1];
      for (; lastKey > pose && scope(paint, lastKey) < 4 * position; )
        lastKey--;
      for (; lim < rot - 1 && scope(paint, lim) < 4 * position; ) lim++;
      const [text8, value_S]: Dynamic = ref(
        shaft[paint] - shaft[lastKey],
        tag[paint] - tag[lastKey],
      );
      const [expected, value_k]: Dynamic = ref(
        shaft[lim] - shaft[paint],
        tag[lim] - tag[paint],
      );
      return text8 * expected + value_S * value_k;
    };
    for (let paint: Dynamic = 1; paint + 1 < rot; paint++) {
      const lastKey: Dynamic = lock(paint);
      if (lastKey < 0.5 && lastKey <= lock(paint + 1)) {
        y2(pose, paint);
        pose = paint;
      }
    }
    y2(pose, rot - 1);
    return top;
  };
  var value_jo: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments72: Dynamic[]
  ): Dynamic {
    const shaft: Dynamic = Math.pow(10, position);
    const tag: Dynamic = (
      ref?: Dynamic,
      ..._extraArguments73: Dynamic[]
    ): Dynamic => {
      let top: Dynamic = (Math.round(ref * shaft) / shaft).toFixed(position);
      if (top.indexOf(".") >= 0) {
        top = top.replace(/\.?0+$/, "");
      }
      return top === "-0" ? "0" : top;
    };
    let rot: Dynamic = "M" + tag(innerHTML[0]) + " " + tag(innerHTML[1]);
    if (innerHTML.length === 4)
      return rot + " L" + tag(innerHTML[2]) + " " + tag(innerHTML[3]);
    for (let ref: Dynamic = 2; ref < innerHTML.length; ref++)
      rot += ((ref - 2) % 6 === 0 ? " C" : " ") + tag(innerHTML[ref]);
    return rot;
  };
  var CHROME_STROKE: Dynamic = "#2a78d6";
  var hostScale: Dynamic = 1;
  function chromePixels(
    this: Dynamic,
    pixels?: Dynamic,
    ..._extraArguments74: Dynamic[]
  ): Dynamic {
    return pixels / hostScale;
  }
  var measurementEnabled: Dynamic = false;
  function setMeasurementEnabled(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments75: Dynamic[]
  ): Dynamic {
    if (measurementEnabled !== !!fillStyle) {
      measurementEnabled = !!fillStyle;
      onContentMutation();
    }
  }
  var deepPickingEnabled: Dynamic = false;
  var lastPointer: Dynamic = null;
  var artboardHovered: Dynamic = false;
  function setDeepPickingEnabled(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments76: Dynamic[]
  ): Dynamic {
    if (deepPickingEnabled !== !!fillStyle) {
      deepPickingEnabled = !!fillStyle;
      refreshPointerHover();
    }
  }
  function refreshPointerHover(
    this: Dynamic,
    ..._extraArguments77: Dynamic[]
  ): Dynamic {
    if (
      !(
        !enabled ||
        textEdit ||
        activeTool !== "select" ||
        !pointerInside ||
        !lastPointer ||
        pendingDrag ||
        value_St ||
        pendingMarquee ||
        marqueeGesture ||
        penGesture ||
        transformGesture ||
        endpointGesture ||
        drawingGesture ||
        dragGesture
      )
    ) {
      hoverHitElement(
        (document as Dynamic).elementFromPoint(lastPointer.x, lastPointer.y),
      );
    }
  }
  function hoverHitElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments78: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = resolveHitTarget(
      fillStyle,
      deepPickingEnabled ? "deep" : "click",
      selectedTemplateIds,
      selectedComponentName,
    );
    if (innerHTML && innerHTML.el && !innerHTML.page) {
      setHoveredTemplate(
        innerHTML.el.getAttribute("data-dc-tpl"),
        componentScopeName(innerHTML.el),
      );
      return;
    }
    var position: Dynamic =
      fillStyle && fillStyle.nodeType === 1
        ? fillStyle
        : fillStyle
          ? fillStyle.target
          : null;
    hoverArtboard(
      innerHTML === "empty" ||
        !!(innerHTML && innerHTML.page) ||
        (deepPickingEnabled &&
          innerHTML === "unstamped" &&
          classifyForeignHit(position) === "artboard"),
    );
  }
  function hoverArtboard(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments79: Dynamic[]
  ): Dynamic {
    artboardHovered = !!fillStyle;
    clearHoverAttributes();
    paintEditorChrome();
  }
  var pendingDrag: Dynamic = null;
  var dragGesture: Dynamic = null;
  function hasControlModifier(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments80: Dynamic[]
  ): Dynamic {
    return !!fillStyle.ctrlKey;
  }
  function restoreResizeDimensions(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments81: Dynamic[]
  ): Dynamic {
    if (innerHTML.startW > 0) {
      fillStyle.width = +innerHTML.startW.toFixed(2) + "px";
    }
    if (innerHTML.startH > 0) {
      fillStyle.height = +innerHTML.startH.toFixed(2) + "px";
    }
    var shaft: Dynamic = value_yd(innerHTML.startLines, position);
    for (var tag in shaft) fillStyle[tag] = shaft[tag];
    return fillStyle;
  }
  var snapGuides: Dynamic = null;
  var value_ln: Dynamic = null;
  var value_ti: Dynamic = false;
  function onEditorPointerDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments82: Dynamic[]
  ): Dynamic {
    value_je = false;
    if (event.pointerType === "mouse") {
      value_ln = event.pointerId;
    }
    value_ti = event.pointerType === "touch";
    suppressClick = false;
    if (event.button === 0) {
      value_Vn = eventInsideTextEditor(event);
    }
    if (event.isTrusted && event.button === 0 && !(event.timeStamp < index18)) {
      value_Mr = false;
    }
  }
  function onEditorPointerMove(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments83: Dynamic[]
  ): Dynamic {
    if (event.pointerType === "mouse") {
      value_ti = false;
    }
  }
  function capturePointer(
    this: Dynamic,
    ..._extraArguments84: Dynamic[]
  ): Dynamic {
    if (value_ln != null)
      try {
        (document as Dynamic).documentElement.setPointerCapture(value_ln);
      } catch {}
  }
  function releasePointer(
    this: Dynamic,
    ..._extraArguments85: Dynamic[]
  ): Dynamic {
    if (value_ln != null)
      try {
        (document as Dynamic).documentElement.releasePointerCapture(value_ln);
      } catch {}
  }
  var suppressClick: Dynamic = false;
  var value_Vn: Dynamic = false;
  var pendingMarquee: Dynamic = null;
  var marqueeGesture: Dynamic = null;
  var gestureKey: Dynamic = null;
  var value_un: Dynamic = null;
  var foreignSelection: Dynamic = null;
  var activeTool: Dynamic = "select";
  var placementOverlay: Dynamic = null;
  var value_St: Dynamic = null;
  var drawingGesture: Dynamic = null;
  var lastChromeJson: Dynamic = null;
  var contentObserver: Dynamic = null;
  var stylesheetObserver: Dynamic = null;
  var chromeResizeObserver: Dynamic = null;
  var items3: Dynamic = [];
  var chromeRefreshPending: Dynamic = false;
  var directiveMap: Dynamic = null;
  var directiveComponentName: Dynamic = null;
  var value_al: Dynamic = null;
  var layoutGeneration: Dynamic = 0;
  var value_dn: Dynamic = null;
  var transformGesture: Dynamic = null;
  var endpointGesture: Dynamic = null;
  var items4: Dynamic = [];
  var value_$n: Dynamic = null;
  var penGesture: Dynamic = null;
  var penOverlay: Dynamic = null;
  var pendingInserts: Dynamic = null;
  var gapOverlay: Dynamic = null;
  var gapSegments: Dynamic = [];
  var gapOverlayTarget: Dynamic = null;
  var overlayRoot: Dynamic = null;
  function ensureOverlayRoot(
    this: Dynamic,
    ..._extraArguments86: Dynamic[]
  ): Dynamic {
    if (!(overlayRoot && overlayRoot.isConnected)) {
      overlayRoot = (document as Dynamic).createElement("div");
      overlayRoot.setAttribute("data-dc-editor-overlay-root", "");
      overlayRoot.setAttribute("data-dc-editor-overlay", "");
      (document as Dynamic).documentElement.appendChild(overlayRoot);
    }
    return overlayRoot;
  }
  function templateKey(
    this: Dynamic,
    requestedTemplateId?: Dynamic,
    componentName?: Dynamic,
    ..._extraArguments87: Dynamic[]
  ): Dynamic {
    return String(componentName || "") + "\0" + String(requestedTemplateId);
  }
  function clearAttributeEverywhere(
    this: Dynamic,
    attribute?: Dynamic,
    ..._extraArguments88: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = (document as Dynamic).querySelectorAll(
          "[" + attribute + "]",
        ),
        position: Dynamic = 0;
      position < innerHTML.length;
      position++
    )
      innerHTML[position].removeAttribute(attribute);
  }
  function unwrapDisplayContentsHost(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments89: Dynamic[]
  ): Dynamic {
    if (
      fillStyle &&
      fillStyle.classList &&
      fillStyle.classList.contains("sc-host-x") &&
      fillStyle.firstElementChild
    )
      try {
        if (getComputedStyle(fillStyle).display === "contents")
          return fillStyle.firstElementChild;
      } catch {}
    return fillStyle;
  }
  function nearestComponentName(
    this: Dynamic,
    element?: Dynamic,
    ..._extraArguments90: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = element.closest("[data-sc-name]");
    return innerHTML ? innerHTML.getAttribute("data-sc-name") : null;
  }
  var state7: Dynamic = {};
  function findDisplayContentsHost(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments91: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle && fillStyle.parentElement;
    if (
      !innerHTML ||
      !innerHTML.classList.contains("sc-host-x") ||
      innerHTML.firstElementChild !== fillStyle ||
      fillStyle.getAttribute("data-dc-tpl") != null
    )
      return null;
    try {
      return getComputedStyle(innerHTML).display === "contents"
        ? innerHTML
        : null;
    } catch {
      return null;
    }
  }
  function isNestedComponentImport(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments92: Dynamic[]
  ): Dynamic {
    if (
      fillStyle &&
      fillStyle.hasAttribute &&
      fillStyle.hasAttribute("data-sc-name")
    )
      return (
        !!(
          fillStyle.parentElement &&
          fillStyle.parentElement.closest("[data-sc-name]")
        ) &&
        !!value_Xo("dc-import", {
          name: fillStyle.getAttribute("data-sc-name") || "",
        })
      );
    var innerHTML: Dynamic =
      fillStyle &&
      fillStyle.classList &&
      fillStyle.classList.contains("sc-host-x")
        ? fillStyle
        : findDisplayContentsHost(fillStyle);
    if (!innerHTML || innerHTML.getAttribute("data-dc-tpl") == null)
      return false;
    var position: Dynamic = nearestComponentName(innerHTML);
    var shaft: Dynamic = null;
    try {
      shaft =
        position != null && (window as Dynamic).__dcAnnotatedTemplate
          ? (window as Dynamic).__dcAnnotatedTemplate(position)
          : null;
    } catch {}
    if (typeof shaft != "string") return false;
    var tag: Dynamic = state7[position];
    if (!tag || tag.src !== shaft) {
      tag = state7[position] = {
        src: shaft,
        tids: value_cd(shaft, value_Xo),
      };
    }
    return tag.tids[innerHTML.getAttribute("data-dc-tpl")] === 1;
  }
  function componentScopeName(
    this: Dynamic,
    element?: Dynamic,
    ..._extraArguments93: Dynamic[]
  ): Dynamic {
    return element.hasAttribute("data-sc-name")
      ? element.parentElement
        ? nearestComponentName(element.parentElement)
        : null
      : nearestComponentName(element);
  }
  function findOuterComponentHost(
    this: Dynamic,
    ..._extraArguments94: Dynamic[]
  ): Dynamic {
    return (document as Dynamic).querySelector(
      ".sc-host:not(.sc-host .sc-host)",
    );
  }
  var state8: Dynamic = {
    path: 1,
    line: 1,
    circle: 1,
    rect: 1,
    ellipse: 1,
    polygon: 1,
    polyline: 1,
  };
  function normalizeSvgHit(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments95: Dynamic[]
  ): Dynamic {
    if (!fillStyle || !fillStyle.closest) return fillStyle;
    var innerHTML: Dynamic = fillStyle.closest("svg[data-dc-tpl]");
    if (
      !innerHTML ||
      innerHTML === fillStyle ||
      componentScopeName(innerHTML) !== componentScopeName(fillStyle)
    )
      return fillStyle;
    var position: Dynamic = (fillStyle.tagName || "").toLowerCase();
    return state8[position] === 1 &&
      fillStyle.getAttribute("data-dc-tpl") != null
      ? fillStyle
      : innerHTML;
  }
  function outerSvgElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments96: Dynamic[]
  ): Dynamic {
    if (!fillStyle || !fillStyle.closest || !fillStyle.getAttribute)
      return fillStyle;
    var innerHTML: Dynamic = (fillStyle.tagName || "").toLowerCase();
    if (state8[innerHTML] !== 1) return fillStyle;
    var position: Dynamic = fillStyle.closest("svg[data-dc-tpl]");
    return position &&
      position !== fillStyle &&
      componentScopeName(position) === componentScopeName(fillStyle)
      ? position
      : fillStyle;
  }
  function expandedSvgBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments97: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle.getBoundingClientRect();
    return state8[(fillStyle.tagName || "").toLowerCase()] === 1
      ? value_Td(innerHTML, 8)
      : innerHTML;
  }
  function normalizeComponentHit(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments98: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = findOuterComponentHost();
    var position: Dynamic = innerHTML
      ? innerHTML.getAttribute("data-sc-name")
      : null;
    if (
      !position ||
      fillStyle === innerHTML ||
      componentScopeName(fillStyle) === position
    )
      return fillStyle;
    for (
      var shaft: Dynamic = fillStyle.closest("[data-sc-name]");
      shaft && shaft !== innerHTML;

    ) {
      var tag: Dynamic = shaft.parentElement;
      if (tag && nearestComponentName(tag) === position)
        return shaft.getAttribute("data-dc-tpl") != null ? shaft : fillStyle;
      shaft = tag ? tag.closest("[data-sc-name]") : null;
    }
    return fillStyle;
  }
  function belongsToOuterComponent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments99: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = findOuterComponentHost();
    var position: Dynamic = innerHTML
      ? innerHTML.getAttribute("data-sc-name")
      : null;
    return !position || componentScopeName(fillStyle) === position
      ? true
      : fillStyle.hasAttribute("data-sc-name") &&
          fillStyle.parentElement != null &&
          nearestComponentName(fillStyle.parentElement) === position;
  }
  function editorRootElement(
    this: Dynamic,
    ..._extraArguments100: Dynamic[]
  ): Dynamic {
    return findOuterComponentHost() || (document as Dynamic).body;
  }
  function editorRootName(
    this: Dynamic,
    ..._extraArguments101: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = editorRootElement();
    return fillStyle
      ? fillStyle.getAttribute("data-sc-name") ||
          nearestComponentName(fillStyle)
      : null;
  }
  var value_Kd: Dynamic =
    /^(helmet|sc-helmet|script|style|link|noscript|template)$/i;
  function rootStampedElements(
    this: Dynamic,
    ..._extraArguments102: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = editorRootElement();
    if (!fillStyle) return [];
    var innerHTML: Dynamic = editorRootName();
    var position: Dynamic = [];
    (function shaft(
      this: Dynamic,
      tag?: Dynamic,
      ..._extraArguments103: Dynamic[]
    ): Dynamic {
      for (
        var rot: Dynamic = tag.firstElementChild;
        rot;
        rot = rot.nextElementSibling
      )
        if (
          !(
            rot.hasAttribute("data-dc-editor-overlay") ||
            value_Kd.test(rot.tagName || "")
          )
        ) {
          if (rot.getAttribute("data-dc-tpl") != null) {
            if (!innerHTML || componentScopeName(rot) === innerHTML) {
              position.push(rot);
            }
            continue;
          }
          shaft(rot);
        }
    })(fillStyle);
    return position;
  }
  function singleRootStampedElement(
    this: Dynamic,
    ..._extraArguments104: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = rootStampedElements();
    return fillStyle.length === 1 ? fillStyle[0] : null;
  }
  function isEmptyArtboard(
    this: Dynamic,
    ..._extraArguments105: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = rootStampedElements();
    if (fillStyle.length === 0) return true;
    if (fillStyle.length !== 1) return false;
    var innerHTML: Dynamic = fillStyle[0];
    return isUneditableElement(innerHTML) ||
      isDeckManagedElement(innerHTML) ||
      hasCustomElementDescendant(innerHTML, innerHTML.querySelectorAll("*"))
      ? false
      : value_gd(
          innerHTML,
          function (
            this: Dynamic,
            position?: Dynamic,
            ..._extraArguments106: Dynamic[]
          ): Dynamic {
            return value_bl.test(position);
          },
        );
  }
  function isUnselectedEmptyArtboard(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments107: Dynamic[]
  ): Dynamic {
    if (!editorRootName() || !isEmptyArtboard()) return false;
    var position: Dynamic = singleRootStampedElement();
    var shaft: Dynamic =
      position &&
      fillStyle &&
      fillStyle.indexOf(parseInt(position.getAttribute("data-dc-tpl"), 10)) >=
        0 &&
      (innerHTML == null || innerHTML === editorRootName());
    return !shaft;
  }
  function hitArtboardBackground(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments108: Dynamic[]
  ): Dynamic {
    if (
      fillStyle !== innerHTML ||
      (document as Dynamic).documentElement.hasAttribute("data-dc-frameless") ||
      fillStyle !== singleRootStampedElement() ||
      (position &&
        position.indexOf(parseInt(fillStyle.getAttribute("data-dc-tpl"), 10)) >=
          0 &&
        (shaft == null || shaft === componentScopeName(fillStyle))) ||
      !isSelectableContainer(fillStyle)
    )
      return false;
    var tag: Dynamic =
      (document as Dynamic).scrollingElement ||
      (document as Dynamic).documentElement;
    var rot: Dynamic = fillStyle.getBoundingClientRect();
    return value_md(
      {
        left: rot.left + tag.scrollLeft,
        top: rot.top + tag.scrollTop,
        right: rot.right + tag.scrollLeft,
      },
      (document as Dynamic).documentElement.clientWidth,
    );
  }
  function stampedAncestorChain(
    this: Dynamic,
    element?: Dynamic,
    ..._extraArguments109: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = editorRootElement();
    var position: Dynamic = editorRootName();
    var shaft: Dynamic = [];
    var tag: Dynamic = element;
    var rot: Dynamic = null;
    for (
      state8[(element.tagName || "").toLowerCase()] === 1 &&
      (rot = element.closest("svg[data-dc-tpl]"));
      tag && tag.getAttribute && tag !== innerHTML;

    ) {
      if (
        tag !== rot &&
        tag.getAttribute("data-dc-tpl") != null &&
        (!position || componentScopeName(tag) === position) &&
        !isDeckManagedElement(tag) &&
        !tag.closest("[data-dc-editor-overlay]")
      ) {
        shaft.unshift(tag);
      }
      tag = tag.parentElement;
    }
    return shaft;
  }
  var value_lt: Dynamic = null;
  function selectElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments110: Dynamic[]
  ): Dynamic {
    clearForeignSelection();
    var position: Dynamic = parseInt(fillStyle.getAttribute("data-dc-tpl"), 10);
    var shaft: Dynamic = componentScopeName(fillStyle);
    if (
      innerHTML &&
      selectedComponentName === shaft &&
      selectedTemplateIds.length > 0
    ) {
      if (selectedTemplateIds.indexOf(position) < 0) {
        selectedTemplateIds.push(position);
      }
    } else {
      selectedTemplateIds = [position];
      selectedComponentName = shaft;
    }
    selectedPart = null;
    repaintSelection();
    emitSelection(sourceElementTag(fillStyle), undefined, innerHTML);
  }
  var selectionInstanceCache: Dynamic = {
    key: "",
    els: [],
  };
  function selectedElementInstances(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments111: Dynamic[]
  ): Dynamic {
    var position: Dynamic = innerHTML + "|" + fillStyle.join(",");
    if (
      selectionInstanceCache.key === position &&
      selectionInstanceCache.els.every(function (
        this: Dynamic,
        top?: Dynamic,
        ..._extraArguments112: Dynamic[]
      ): Dynamic {
        return top.isConnected;
      })
    )
      return selectionInstanceCache.els;
    for (
      var shaft: Dynamic = [], tag: Dynamic = 0;
      tag < fillStyle.length;
      tag++
    )
      for (
        var rot: Dynamic = findTemplateInstances(
            String(fillStyle[tag]),
            innerHTML,
          ),
          ref: Dynamic = 0;
        ref < rot.length;
        ref++
      )
        shaft.push(rot[ref]);
    selectionInstanceCache = {
      key: position,
      els: shaft,
    };
    return shaft;
  }
  var freehandMode: Dynamic = false;
  function lastFreehandAncestor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments113: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle[fillStyle.length - 1];
    return innerHTML && editableFreehandPath(outerSvgElement(innerHTML))
      ? innerHTML
      : null;
  }
  function resolveSelectionAncestor(
    this: Dynamic,
    element?: Dynamic,
    mode?: Dynamic,
    selectedIds?: Dynamic,
    componentName?: Dynamic,
    ..._extraArguments114: Dynamic[]
  ): Dynamic {
    var tag: Dynamic = mode === "click";
    if (tag) {
      mode = "plain";
    }
    var rot: Dynamic = stampedAncestorChain(element);
    if (!rot.length) return null;
    if (freehandMode && mode === "plain" && lastFreehandAncestor(rot))
      return rot[rot.length - 1];
    var ref: Dynamic = editorRootName();
    var top: Dynamic = -1;
    var name3: Dynamic = -1;
    if (selectedIds && selectedIds.length)
      for (
        var bottom: Dynamic = selectedElementInstances(
            selectedIds,
            componentName ?? ref,
          ),
          left: Dynamic = 0;
        left < bottom.length;
        left++
      )
        for (var scope: Dynamic = rot.length - 1; scope >= 0; scope--) {
          if (rot[scope] === bottom[left]) {
            if (scope > top) {
              top = scope;
            }
            break;
          }
          if (rot[scope].contains(bottom[left])) {
            if (scope > name3) {
              name3 = scope;
            }
            break;
          }
        }
    var top2: Dynamic = value_hd(
      rot.length,
      rot[0] === singleRootStampedElement(),
      top,
      name3,
      mode,
    );
    if (tag && top2 >= 0 && !isTextEditable(rot[top2])) {
      var adjust: Dynamic = nextEditableAncestorIndex(rot, top2);
      if (adjust >= 0) {
        top2 = adjust;
      }
    }
    return top2 < 0 ? null : rot[top2];
  }
  function isTextEditable(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments115: Dynamic[]
  ): Dynamic {
    return !!textEditableTemplates[
      templateKey(
        parseInt(fillStyle.getAttribute("data-dc-tpl"), 10),
        nearestComponentName(fillStyle),
      )
    ];
  }
  function nextEditableAncestorIndex(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments116: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = innerHTML + 1;
      position < fillStyle.length;
      position++
    )
      if (isTextEditable(fillStyle[position])) return position;
    return -1;
  }
  function editableDescendantAncestor(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments117: Dynamic[]
  ): Dynamic {
    if (!innerHTML || innerHTML === fillStyle || !fillStyle.contains(innerHTML))
      return null;
    var position: Dynamic = stampedAncestorChain(innerHTML);
    var shaft: Dynamic = position.indexOf(fillStyle);
    var tag: Dynamic =
      shaft >= 0 ? nextEditableAncestorIndex(position, shaft) : -1;
    return tag >= 0 ? position[tag] : null;
  }
  function resolveTextPickTarget(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments118: Dynamic[]
  ): Dynamic {
    if (!(Array as Dynamic).isArray(position) || !position.length) return null;
    for (
      var shaft: Dynamic = {}, tag: Dynamic = 0;
      tag < position.length;
      tag++
    )
      shaft[position[tag]] = true;
    var rot: Dynamic = function (
      this: Dynamic,
      bottom?: Dynamic,
      ..._extraArguments119: Dynamic[]
    ): Dynamic {
      return !!shaft[parseInt(bottom.getAttribute("data-dc-tpl"), 10)];
    };
    if (rot(fillStyle)) return null;
    var ref: Dynamic = stampedAncestorChain(innerHTML);
    var top: Dynamic = ref.indexOf(fillStyle);
    if (top < 0) return null;
    for (var name3: Dynamic = top + 1; name3 < ref.length; name3++)
      if (rot(ref[name3])) return ref[name3];
    return null;
  }
  function normalizePickElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments120: Dynamic[]
  ): Dynamic {
    return normalizeComponentHit(normalizeSvgHit(fillStyle));
  }
  function resolveHitTarget(
    this: Dynamic,
    eventOrElement?: Dynamic,
    mode?: Dynamic,
    selectedIds?: Dynamic,
    componentName?: Dynamic,
    ..._extraArguments121: Dynamic[]
  ): Dynamic {
    var tag: Dynamic =
      eventOrElement && eventOrElement.nodeType === 1
        ? eventOrElement
        : eventOrElement
          ? eventOrElement.target
          : null;
    if (!tag || tag.nodeType !== 1 || !tag.closest) return null;
    if (isUnselectedEmptyArtboard(selectedIds, componentName)) return "empty";
    var rot: Dynamic = eventHitsEditorOverlay(eventOrElement)
      ? null
      : tag.closest("[data-dc-tpl]");
    if (!rot) return "unstamped";
    var ref: Dynamic = normalizePickElement(rot);
    var top: Dynamic = resolveSelectionAncestor(
      ref,
      mode,
      selectedIds,
      componentName,
    );
    var name3: Dynamic = value_ti && eventOrElement.nodeType !== 1;
    return {
      el: top || ref,
      hit: ref,
      ruled: !!top,
      page:
        mode !== "deep" &&
        !name3 &&
        hitArtboardBackground(top, ref, selectedIds, componentName),
    };
  }
  function classifyForeignHit(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments122: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = findOuterComponentHost();
    var position: Dynamic =
      fillStyle !== (document as Dynamic).body &&
      fillStyle !== (document as Dynamic).documentElement &&
      !(innerHTML && fillStyle.contains(innerHTML)) &&
      !fillStyle.querySelector("[data-dc-tpl]") &&
      !fillStyle.closest("[data-dc-editor-overlay]") &&
      !fillStyle.closest("[data-dc-tpl]");
    return position ? "foreign" : "artboard";
  }
  function resolvePickTarget(
    this: Dynamic,
    element?: Dynamic,
    mode?: Dynamic,
    selectedIds?: Dynamic,
    ..._extraArguments123: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = resolveHitTarget(element, mode, selectedIds, null);
    return shaft && shaft.el && belongsToOuterComponent(shaft.hit)
      ? shaft
      : null;
  }
  function findTemplateInstances(
    this: Dynamic,
    requestedTemplateId?: Dynamic,
    componentName?: Dynamic,
    ..._extraArguments124: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = (document as Dynamic).querySelectorAll(
          '[data-dc-tpl="' + requestedTemplateId + '"]',
        ),
        shaft: Dynamic = [],
        tag: Dynamic = 0;
      tag < position.length;
      tag++
    )
      if (componentScopeName(position[tag]) === componentName) {
        shaft.push(position[tag]);
      }
    return shaft;
  }
  var value_Ie: Dynamic = null;
  function normalizeColor(
    this: Dynamic,
    color?: Dynamic,
    ..._extraArguments125: Dynamic[]
  ): Dynamic {
    if (typeof color != "string" || color.indexOf("rgb") === 0) return color;
    try {
      if (!value_Ie) {
        var innerHTML: Dynamic = (document as Dynamic).createElement("canvas");
        innerHTML.width = innerHTML.height = 1;
        value_Ie = innerHTML.getContext("2d", {
          willReadFrequently: true,
        });
      }
      if (
        !value_Ie ||
        ((value_Ie.fillStyle = "#010203"),
        (value_Ie.fillStyle = color),
        value_Ie.fillStyle === "#010203")
      )
        return color;
      value_Ie.clearRect(0, 0, 1, 1);
      value_Ie.fillRect(0, 0, 1, 1);
      var position: Dynamic = value_Ie.getImageData(0, 0, 1, 1).data;
      return position[3] === 255
        ? "rgb(" + position[0] + ", " + position[1] + ", " + position[2] + ")"
        : "rgba(" +
            position[0] +
            ", " +
            position[1] +
            ", " +
            position[2] +
            ", " +
            Math.round(position[3] / 2.55) / 100 +
            ")";
    } catch {
      return color;
    }
  }
  var value_Xd: Dynamic = /^[A-Za-z_][A-Za-z0-9_-]{0,31}$/;
  var value__d: Dynamic = /^[a-z][a-z0-9-]{0,23}$/;
  var count2: Dynamic = 8;
  function hasUniqueId(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments126: Dynamic[]
  ): Dynamic {
    try {
      return (
        (document as Dynamic).querySelector("#" + fillStyle.id) === fillStyle
      );
    } catch {
      return false;
    }
  }
  function elementSelectorPath(
    this: Dynamic,
    element?: Dynamic,
    ..._extraArguments127: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = [],
        position: Dynamic = [],
        shaft: Dynamic = element;
      shaft &&
      shaft.nodeType === 1 &&
      shaft !== (document as Dynamic).body &&
      shaft !== (document as Dynamic).documentElement;

    ) {
      if (shaft.id && value_Xd.test(shaft.id) && hasUniqueId(shaft)) {
        innerHTML.push("#" + shaft.id);
        position.push(shaft);
        break;
      }
      for (
        var tag: Dynamic = shaft.tagName.toLowerCase(),
          rot: Dynamic = 1,
          ref: Dynamic = shaft;
        (ref = ref.previousElementSibling);

      )
        if (ref.tagName === shaft.tagName) {
          rot++;
        }
      if (!value__d.test(tag) || rot > 9999) {
        innerHTML = [];
        position = [];
      } else {
        innerHTML.push(tag + ":nth-of-type(" + rot + ")");
        position.push(shaft);
      }
      shaft = shaft.parentElement;
    }
    if (!innerHTML.length)
      return {
        path: null,
        el: null,
      };
    var top: Dynamic = Math.max(0, innerHTML.length - count2);
    return {
      path: innerHTML.slice(top).reverse().join(" > "),
      el: position[top],
    };
  }
  function accessibleElementLabel(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments128: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = String(fillStyle.tagName || "").toLowerCase();
    var position: Dynamic = "";
    try {
      position =
        innerHTML === "img"
          ? fillStyle.getAttribute("alt") || ""
          : innerHTML === "input" || innerHTML === "textarea"
            ? fillStyle.getAttribute("placeholder") ||
              fillStyle.getAttribute("aria-label") ||
              ""
            : authoredAccessibilityAttribute(fillStyle, "aria-label") || "";
      if (!position) {
        var shaft: Dynamic = function (
          this: Dynamic,
          tag?: Dynamic,
          ..._extraArguments129: Dynamic[]
        ): Dynamic {
          if (!(position.length >= 160)) {
            if (tag.nodeType === 3)
              position = (position + tag.data).replace(/\s+/g, " ").trimStart();
            else if (
              tag.nodeType === 1 &&
              !/^(style|script|template)$/i.test(tag.tagName)
            )
              for (
                var rot: Dynamic = tag.firstChild;
                rot;
                rot = rot.nextSibling
              )
                shaft(rot);
          }
        };
        shaft(fillStyle);
      }
    } catch {
      position = "";
    }
    return {
      tag: innerHTML,
      text: String(position)
        .slice(0, 400)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120),
    };
  }
  function authoredAccessibilityAttribute(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments130: Dynamic[]
  ): Dynamic {
    var position: Dynamic = fillStyle.getAttribute(innerHTML);
    if (!fillStyle.hasAttribute("data-dc-editor-named")) return position;
    var shaft: Dynamic =
      fillStyle.getAttribute("data-dc-editor-named") === "one-line"
        ? "false"
        : "true";
    return (innerHTML === "role" && position === "textbox") ||
      (innerHTML === "aria-label" && position === "Edit text") ||
      (innerHTML === "aria-multiline" && position === shaft)
      ? null
      : position;
  }
  function normalizedTextContent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments131: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = "";
    var position: Dynamic = function (
      this: Dynamic,
      ref?: Dynamic,
      ..._extraArguments132: Dynamic[]
    ): Dynamic {
      for (
        var top: Dynamic = ref.firstChild;
        top && innerHTML.length < 4096;
        top = top.nextSibling
      )
        if (top.nodeType === 3) {
          innerHTML += top.data;
        } else {
          if (
            top.nodeType === 1 &&
            !/^(style|script|template)$/i.test(top.tagName)
          ) {
            position(top);
          }
        }
    };
    try {
      position(fillStyle);
    } catch {
      return "";
    }
    innerHTML = innerHTML
      .slice(0, 4096)
      .replace(
        /[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g,
        " ",
      )
      .replace(/^ | $/g, "");
    if (!innerHTML) return "";
    for (
      var shaft: Dynamic =
          String(fillStyle.tagName || "").toLowerCase() + ":" + innerHTML,
        tag: Dynamic = 2166136261,
        rot: Dynamic = 0;
      rot < shaft.length;
      rot++
    )
      tag = Math.imul(tag ^ shaft.charCodeAt(rot), 16777619);
    return "x" + ("000000" + (tag >>> 0).toString(36)).slice(-7);
  }
  function visibleContentBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments133: Dynamic[]
  ): Dynamic {
    if (fillStyle.getClientRects().length)
      return fillStyle.getBoundingClientRect();
    for (
      var innerHTML: Dynamic = null,
        position: Dynamic = null,
        shaft: Dynamic = fillStyle.firstChild;
      shaft;
      shaft = shaft.nextSibling
    ) {
      var tag: Dynamic = null;
      if (shaft.nodeType === 1)
        tag =
          getComputedStyle(shaft).display === "contents"
            ? visibleContentBounds(shaft)
            : shaft.getBoundingClientRect();
      else if (shaft.nodeType === 3) {
        var rot: Dynamic = elementTextRange(shaft);
        tag = rot && rot.getBoundingClientRect();
      }
      if (tag) {
        if (!(tag.width > 0 && tag.height > 0)) {
          if (!position && (tag.width || tag.height || tag.left || tag.top)) {
            position = tag;
          }
          continue;
        }
        if (!innerHTML) {
          innerHTML = tag;
          continue;
        }
        var ref: Dynamic = Math.min(innerHTML.left, tag.left);
        var top: Dynamic = Math.min(innerHTML.top, tag.top);
        var name3: Dynamic = Math.max(innerHTML.right, tag.right);
        var bottom: Dynamic = Math.max(innerHTML.bottom, tag.bottom);
        innerHTML = {
          left: ref,
          top: top,
          right: name3,
          bottom: bottom,
          width: name3 - ref,
          height: bottom - top,
        };
      }
    }
    return innerHTML || position || fillStyle.getBoundingClientRect();
  }
  function viewportRect(
    this: Dynamic,
    ..._extraArguments134: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = (document as Dynamic).documentElement;
    return {
      x: -((window as Dynamic).scrollX || 0),
      y: -((window as Dynamic).scrollY || 0),
      w: Math.max(
        fillStyle ? fillStyle.scrollWidth : 0,
        (window as Dynamic).innerWidth || 0,
      ),
      h: Math.max(
        fillStyle ? fillStyle.scrollHeight : 0,
        (window as Dynamic).innerHeight || 0,
      ),
    };
  }
  function commentAnchorForElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments135: Dynamic[]
  ): Dynamic {
    if (fillStyle && fillStyle.nodeType !== 1) {
      fillStyle = fillStyle.parentElement;
    }
    if (
      fillStyle &&
      fillStyle.closest &&
      fillStyle.closest(
        "[data-dc-editor-overlay],[data-dc-editor-overlay-root],[data-omelette-chrome],[data-omelette-injected]",
      )
    ) {
      fillStyle = null;
    }
    if (fillStyle && fillStyle.closest) {
      fillStyle = normalizeSvgHit(
        fillStyle.closest("[data-dc-tpl]") || fillStyle,
      );
    }
    var shaft: Dynamic = fillStyle
      ? elementSelectorPath(fillStyle)
      : {
          path: null,
          el: null,
        };
    if (!shaft.el) {
      var tag: Dynamic = (window as Dynamic).innerWidth || 1;
      var rot: Dynamic = (window as Dynamic).innerHeight || 1;
      return {
        path: null,
        rect: {
          x: 0,
          y: 0,
          w: tag,
          h: rot,
        },
        page: viewportRect(),
        fx: innerHTML == null ? 0.5 : Math.min(1, Math.max(0, innerHTML / tag)),
        fy: position == null ? 0.5 : Math.min(1, Math.max(0, position / rot)),
      };
    }
    var ref: Dynamic = findOuterComponentHost();
    var top: Dynamic = ref ? ref.getAttribute("data-sc-name") : null;
    var name3: Dynamic =
      fillStyle.hasAttribute("data-dc-tpl") &&
      top &&
      componentScopeName(fillStyle) === top
        ? parseInt(fillStyle.getAttribute("data-dc-tpl") || "-1", 10)
        : -1;
    if (!(isFinite(name3) && name3 >= 0)) {
      name3 = -1;
    }
    var bottom: Dynamic = shaft.el;
    var left: Dynamic =
      name3 >= 0 ? findTemplateInstances(String(name3), top) : [];
    if (left.indexOf(bottom) < 0 && left.length === 1) {
      bottom = left[0];
    }
    var scope: Dynamic = left.length === 1 && left[0] === fillStyle;
    try {
      scope =
        scope && (document as Dynamic).querySelector(shaft.path) === fillStyle;
    } catch {
      scope = false;
    }
    var top2: Dynamic = visibleContentBounds(bottom);
    var adjust: Dynamic = accessibleElementLabel(bottom);
    return {
      path: shaft.path,
      tid: name3 >= 0 ? name3 : null,
      fp: scope ? normalizedTextContent(fillStyle) : "",
      page: viewportRect(),
      rect: {
        x: top2.left,
        y: top2.top,
        w: top2.width,
        h: top2.height,
      },
      fx:
        innerHTML == null || !(top2.width > 0)
          ? 0.5
          : Math.min(1, Math.max(0, (innerHTML - top2.left) / top2.width)),
      fy:
        position == null || !(top2.height > 0)
          ? 0.5
          : Math.min(1, Math.max(0, (position - top2.top) / top2.height)),
      tag: adjust.tag,
      text: adjust.text,
    };
  }
  function templateOrDirectiveInstances(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments136: Dynamic[]
  ): Dynamic {
    var position: Dynamic = findTemplateInstances(String(fillStyle), innerHTML);
    if (
      position.length ||
      !directiveMap ||
      (innerHTML || null) !== directiveComponentName
    )
      return position;
    var shaft: Dynamic = directiveMap[fillStyle];
    if (!shaft) return position;
    for (var tag: Dynamic = 0; tag < shaft.kids.length; tag++)
      for (
        var rot: Dynamic = findTemplateInstances(
            String(shaft.kids[tag]),
            innerHTML,
          ),
          ref: Dynamic = 0;
        ref < rot.length;
        ref++
      )
        position.push(rot[ref]);
    return position;
  }
  function clearHoverAttributes(
    this: Dynamic,
    ..._extraArguments137: Dynamic[]
  ): Dynamic {
    clearAttributeEverywhere("data-dc-editor-hover");
    clearAttributeEverywhere("data-dc-editor-hover-stroke");
  }
  function clearHover(
    this: Dynamic,
    ..._extraArguments138: Dynamic[]
  ): Dynamic {
    artboardHovered = false;
    clearHoverAttributes();
    paintEditorChrome();
  }
  function setHoveredTemplate(
    this: Dynamic,
    requestedTemplateId?: Dynamic,
    componentName?: Dynamic,
    ..._extraArguments139: Dynamic[]
  ): Dynamic {
    artboardHovered = false;
    clearHoverAttributes();
    if (requestedTemplateId == null) {
      paintEditorChrome();
      return;
    }
    templateOrDirectiveInstances(
      requestedTemplateId,
      componentName || null,
    ).forEach(function (
      this: Dynamic,
      position?: Dynamic,
      ..._extraArguments140: Dynamic[]
    ): Dynamic {
      var shaft: Dynamic = unwrapDisplayContentsHost(position);
      var tag: Dynamic = outerSvgElement(shaft);
      var rot: Dynamic = !!editableSvgGeometry(tag);
      if (rot && !enabled) {
        if (shaft.hasAttribute("data-dc-editor-selected")) return;
        shaft = tag;
      }
      shaft.setAttribute("data-dc-editor-hover", "");
      if (rot && enabled) {
        shaft.setAttribute("data-dc-editor-hover-stroke", "");
      }
    });
    paintEditorChrome();
  }
  function repaintSelection(
    this: Dynamic,
    ..._extraArguments141: Dynamic[]
  ): Dynamic {
    selectionInstanceCache = {
      key: "",
      els: [],
    };
    clearAttributeEverywhere("data-dc-editor-selected");
    for (
      var fillStyle: Dynamic = 0;
      fillStyle < selectedTemplateIds.length;
      fillStyle++
    )
      templateOrDirectiveInstances(
        selectedTemplateIds[fillStyle],
        selectedComponentName,
      ).forEach(function (
        this: Dynamic,
        innerHTML?: Dynamic,
        ..._extraArguments142: Dynamic[]
      ): Dynamic {
        unwrapDisplayContentsHost(innerHTML).setAttribute(
          "data-dc-editor-selected",
          "",
        );
      });
    refreshChrome();
  }
  function selectedInstanceCount(
    this: Dynamic,
    ..._extraArguments143: Dynamic[]
  ): Dynamic {
    for (
      var fillStyle: Dynamic = 0, innerHTML: Dynamic = 0;
      innerHTML < selectedTemplateIds.length;
      innerHTML++
    )
      fillStyle += findTemplateInstances(
        selectedTemplateIds[innerHTML],
        selectedComponentName,
      ).length;
    return fillStyle;
  }
  function stampedEventTarget(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments144: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle.target;
    return !innerHTML || !innerHTML.closest || eventHitsEditorOverlay(fillStyle)
      ? null
      : innerHTML.closest("[data-dc-tpl]");
  }
  var state10: Dynamic = {
    stylePreview: 1,
    movePreview: 1,
    movePreviewCancel: 1,
    styleRevert: 1,
    dragState: 1,
    dragExit: 1,
    dragMove: 1,
    dragReturn: 1,
    dragCancel: 1,
    dragDrop: 1,
    selection: 1,
    pointerPresence: 1,
    pointerAt: 1,
    repeatRefused: 1,
  };
  function emitEditorEvent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments145: Dynamic[]
  ): Dynamic {
    if (hostDrag) {
      if (fillStyle.type === "move") {
        hostDrag.plan = fillStyle;
        return;
      }
      if (state10[fillStyle.type]) return;
    }
    if (fillStyle.type !== "pointerAt")
      try {
        var innerHTML: Dynamic = ((window as Dynamic).__dcEditorDebug =
          (window as Dynamic).__dcEditorDebug || {});
        (innerHTML.lastEvents = innerHTML.lastEvents || []).push(fillStyle);
        if (innerHTML.lastEvents.length > 20) {
          innerHTML.lastEvents.shift();
        }
      } catch {}
    try {
      parent.postMessage(
        {
          __dcEditorEvt: fillStyle,
        },
        "*",
      );
    } catch {}
  }
  function selectionBounds(
    this: Dynamic,
    ..._extraArguments146: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = null;
    if (selectedPart === "text" && selectedTemplateIds.length === 1) {
      var innerHTML: Dynamic = findTemplateInstances(
        selectedTemplateIds[0],
        selectedComponentName,
      );
      var position: Dynamic = innerHTML.length
        ? textContentBounds(innerHTML[0])
        : null;
      if (position)
        return {
          x: position.l,
          y: position.t,
          w: position.r - position.l,
          h: position.b - position.t,
        };
    }
    for (var shaft: Dynamic = 0; shaft < selectedTemplateIds.length; shaft++)
      for (
        var tag: Dynamic = findTemplateInstances(
            selectedTemplateIds[shaft],
            selectedComponentName,
          ),
          rot: Dynamic = 0;
        rot < tag.length;
        rot++
      )
        try {
          var ref: Dynamic = pickElementBounds(tag[rot]);
          if (!ref || (ref.width === 0 && ref.height === 0)) continue;
          if (fillStyle) {
            fillStyle.l = Math.min(fillStyle.l, ref.left);
            fillStyle.t = Math.min(fillStyle.t, ref.top);
            fillStyle.r = Math.max(fillStyle.r, ref.right);
            fillStyle.b = Math.max(fillStyle.b, ref.bottom);
          } else {
            fillStyle = {
              l: ref.left,
              t: ref.top,
              r: ref.right,
              b: ref.bottom,
            };
          }
        } catch {}
    return fillStyle
      ? {
          x: fillStyle.l,
          y: fillStyle.t,
          w: fillStyle.r - fillStyle.l,
          h: fillStyle.b - fillStyle.t,
        }
      : null;
  }
  function pickElementBounds(
    this: Dynamic,
    element?: Dynamic,
    ..._extraArguments147: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = svgGeometryBounds(
      unwrapDisplayContentsHost(element),
    );
    return innerHTML.width || innerHTML.height
      ? innerHTML
      : visibleContentBounds(element);
  }
  function randomGestureKey(
    this: Dynamic,
    ..._extraArguments148: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = new Uint8Array(8);
    if (((window as Dynamic).crypto || {}).getRandomValues) {
      crypto.getRandomValues(fillStyle);
    } else {
      fillStyle.forEach(function (
        this: Dynamic,
        shaft?: Dynamic,
        tag?: Dynamic,
        ..._extraArguments149: Dynamic[]
      ): Dynamic {
        fillStyle[tag] = (Math.random() * 256) | 0;
      });
    }
    for (
      var innerHTML: Dynamic = "", position: Dynamic = 0;
      position < fillStyle.length;
      position++
    )
      innerHTML += ("0" + fillStyle[position].toString(16)).slice(-2);
    return innerHTML;
  }
  function elementTextRange(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments150: Dynamic[]
  ): Dynamic {
    try {
      var innerHTML: Dynamic = (document as Dynamic).createRange();
      innerHTML.selectNodeContents(fillStyle);
      return innerHTML;
    } catch {
      return null;
    }
  }
  function textContentBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments151: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = elementTextRange(fillStyle);
    if (!innerHTML) return null;
    for (
      var position: Dynamic = innerHTML.getClientRects(),
        shaft: Dynamic = null,
        tag: Dynamic = 0;
      tag < position.length;
      tag++
    ) {
      var rot: Dynamic = position[tag];
      if (!(!(rot.width > 0) || !(rot.height > 0))) {
        if (shaft) {
          shaft.l = Math.min(shaft.l, rot.left);
          shaft.t = Math.min(shaft.t, rot.top);
          shaft.r = Math.max(shaft.r, rot.right);
          shaft.b = Math.max(shaft.b, rot.bottom);
        } else {
          shaft = {
            l: rot.left,
            t: rot.top,
            r: rot.right,
            b: rot.bottom,
          };
        }
      }
    }
    return shaft;
  }
  function pointHitsText(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments152: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = elementTextRange(fillStyle);
    if (!shaft) return false;
    for (
      var tag: Dynamic = shaft.getClientRects(), rot: Dynamic = 0;
      rot < tag.length;
      rot++
    ) {
      var ref: Dynamic = tag[rot];
      if (
        innerHTML >= ref.left - 2 &&
        innerHTML <= ref.right + 2 &&
        position >= ref.top - 2 &&
        position <= ref.bottom + 2 &&
        ref.width > 0
      )
        return true;
    }
    return false;
  }
  function elementPaintInfo(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments153: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = getComputedStyle(fillStyle);
    var position: Dynamic = /^rgba?\(([^)]*)\)$/.exec(
      innerHTML.backgroundColor || "",
    );
    var shaft: Dynamic = position
      ? position[1].split(/[\s,\/]+/).filter(Boolean)
      : null;
    var tag: Dynamic =
      !innerHTML.backgroundColor || innerHTML.backgroundColor === "transparent"
        ? 0
        : shaft && shaft.length > 3
          ? parseFloat(shaft[3])
          : 1;
    var rot: Dynamic =
      tag >= 0.2 &&
      innerHTML.backgroundClip !== "text" &&
      innerHTML.webkitBackgroundClip !== "text";
    var ref: Dynamic = ["Top", "Right", "Bottom", "Left"].some(function (
      this: Dynamic,
      left?: Dynamic,
      ..._extraArguments154: Dynamic[]
    ): Dynamic {
      return (
        innerHTML["border" + left + "Style"] !== "none" &&
        parseFloat(innerHTML["border" + left + "Width"]) > 0
      );
    });
    if (!(rot || ref)) return false;
    var top: Dynamic = (fillStyle.textContent || "").trim();
    if (!top) return false;
    for (
      var name3: Dynamic = fillStyle.querySelectorAll("*"), bottom: Dynamic = 0;
      bottom < name3.length;
      bottom++
    )
      if (
        name3[bottom].hasAttribute("data-dc-tpl") &&
        name3[bottom].children.length > 0
      )
        return false;
    return true;
  }
  function sourceElementTag(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments155: Dynamic[]
  ): Dynamic {
    return fillStyle.hasAttribute("data-sc-name")
      ? "dc-import"
      : fillStyle.tagName.toLowerCase();
  }
  function editorElementTag(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments156: Dynamic[]
  ): Dynamic {
    return fillStyle.classList && fillStyle.classList.contains("sc-host-x")
      ? "x-import"
      : sourceElementTag(fillStyle);
  }
  var value_bl: Dynamic =
    /^(h[1-6]|p|button|label|li|blockquote|td|th|dt|dd|caption|figcaption|pre|time|a|abbr|b|bdi|bdo|br|cite|code|del|dfn|em|i|ins|kbd|mark|q|s|samp|small|span|strike|strong|sub|sup|u|var|wbr)$/i;
  function isTextElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments157: Dynamic[]
  ): Dynamic {
    return (
      value_bl.test(fillStyle.tagName) ||
      !!textEditableTemplates[
        templateKey(innerHTML, nearestComponentName(fillStyle))
      ]
    );
  }
  var index6: Dynamic = 0;
  function emitSelection(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments158: Dynamic[]
  ): Dynamic {
    var tag: Dynamic =
      selectedComponentName + "|" + selectedTemplateIds.join(",");
    if (tag !== text) {
      items8 = [];
      text = tag;
    }
    if (innerHTML == null && !shaft) {
      index6++;
    }
    if (selectedTemplateIds.length === 0) {
      emitEditorEvent({
        type: "select",
        tids: null,
        re: innerHTML,
        additive: !!position,
        s: index6,
      });
      return;
    }
    emitEditorEvent({
      type: "select",
      tids: selectedTemplateIds.slice(),
      name: selectedComponentName,
      tag: fillStyle,
      instances: selectedInstanceCount(),
      rect: selectionBounds(),
      part: selectedPart,
      embed: selectedEmbeddedTemplate(),
      re: innerHTML,
      additive: !!position,
      s: index6,
    });
  }
  function emitArtboardSelection(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments159: Dynamic[]
  ): Dynamic {
    index6++;
    emitEditorEvent({
      type: "select",
      tids: null,
      artboard: true,
      additive: !!fillStyle,
      s: index6,
    });
  }
  function selectedEmbeddedTemplate(
    this: Dynamic,
    ..._extraArguments160: Dynamic[]
  ): Dynamic {
    if (!value_nn || !value_nn.isConnected || !selectedTemplateIds.length)
      return null;
    for (
      var fillStyle: Dynamic = findTemplateInstances(
          selectedTemplateIds[0],
          selectedComponentName,
        ),
        innerHTML: Dynamic = 0;
      innerHTML < fillStyle.length;
      innerHTML++
    )
      if (value_nn.contains(fillStyle[innerHTML]))
        return parseInt(value_nn.getAttribute("data-dc-tpl"), 10);
    return null;
  }
  function canPageScrollAxis(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments161: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = (document as Dynamic).documentElement;
    var position: Dynamic = (document as Dynamic).scrollingElement || innerHTML;
    var shaft: Dynamic = getComputedStyle(innerHTML);
    var tag: Dynamic =
      shaft.overflowX === "visible" &&
      shaft.overflowY === "visible" &&
      (document as Dynamic).body
        ? getComputedStyle((document as Dynamic).body)
        : shaft;
    var rot: Dynamic = fillStyle === "x" ? tag.overflowX : tag.overflowY;
    return rot === "hidden" || rot === "clip"
      ? false
      : fillStyle === "x"
        ? position.scrollWidth > position.clientWidth + 1
        : position.scrollHeight > position.clientHeight + 1;
  }
  function snapAbsoluteDrag(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments162: Dynamic[]
  ): Dynamic {
    snapGuides = null;
    if (fillStyle.metaKey || fillStyle.ctrlKey)
      return {
        x: position,
        y: shaft,
      };
    var rot: Dynamic = dragGesture.startRect;
    var ref: Dynamic =
      (document as Dynamic).scrollingElement ||
      (document as Dynamic).documentElement;
    var top: Dynamic = unwrapDisplayContentsHost(innerHTML);
    var name3: Dynamic = top.getBoundingClientRect();
    var bottom: Dynamic = getComputedStyle(top).position;
    if (
      dragGesture.mode !== "abs" &&
      bottom !== "absolute" &&
      bottom !== "fixed"
    )
      return {
        x: position,
        y: shaft,
      };
    if (
      name3.width > 0 &&
      name3.height > 0 &&
      (dragGesture.sizeEl !== innerHTML ||
        dragGesture.sizePos !== bottom ||
        name3.width >= dragGesture.sizeW)
    ) {
      dragGesture.sizeEl = innerHTML;
      dragGesture.sizePos = bottom;
      dragGesture.sizeW = name3.width;
      dragGesture.sizeH = name3.height;
    }
    var left: Dynamic = dragGesture.sizeW || rot.width;
    var scope: Dynamic = dragGesture.sizeH || rot.height;
    var top2: Dynamic = {
      x: (!tag || tag.x) && !dragGesture.maskX,
      y: (!tag || tag.y) && !dragGesture.maskY,
    };
    var adjust: Dynamic = (nativeScrollMode ? ref.clientWidth : innerWidth) / 2;
    var axis: Dynamic = (nativeScrollMode ? ref.clientHeight : innerHeight) / 2;
    var y: Dynamic = value_xd(
      {
        x: rot.left + position,
        y: rot.top + shaft,
        w: left,
        h: scope,
      },
      [
        {
          axis: "x",
          pos: adjust,
          kind: "center",
        },
        {
          axis: "y",
          pos: axis,
          kind: "center",
        },
      ],
      chromePixels(8),
      top2,
    );
    if (y.guides.length) {
      snapGuides = y.guides;
    }
    return {
      x: position + y.dx,
      y: shaft + y.dy,
    };
  }
  function ensureAltClone(
    this: Dynamic,
    ..._extraArguments163: Dynamic[]
  ): Dynamic {
    if (dragGesture)
      if (
        dragGesture.alt &&
        dragGesture.mode === "abs" &&
        !dragGesture.altClone &&
        dragGesture.origParent
      ) {
        var fillStyle: Dynamic = dragGesture.el.cloneNode(true);
        fillStyle.removeAttribute("data-dc-editor-selected");
        fillStyle.removeAttribute("data-dc-editor-dragging");
        fillStyle.removeAttribute("data-dc-dragging");
        fillStyle.setAttribute("data-dc-editor-overlay", "");
        fillStyle.setAttribute("style", dragGesture.origStyle);
        fillStyle.removeAttribute("data-dc-tpl");
        for (
          var innerHTML: Dynamic = fillStyle.querySelectorAll("[data-dc-tpl]"),
            position: Dynamic = 0;
          position < innerHTML.length;
          position++
        )
          innerHTML[position].removeAttribute("data-dc-tpl");
        fillStyle.style.setProperty("pointer-events", "none", "important");
        if (
          dragGesture.origNext &&
          dragGesture.origNext.parentNode === dragGesture.origParent
        ) {
          dragGesture.origParent.insertBefore(fillStyle, dragGesture.origNext);
        } else {
          dragGesture.origParent.appendChild(fillStyle);
        }
        dragGesture.altClone = fillStyle;
      } else if (!dragGesture.alt && dragGesture.altClone) {
        dragGesture.altClone.remove();
        dragGesture.altClone = null;
      }
  }
  var state11: Dynamic = {
    area: 1,
    base: 1,
    br: 1,
    col: 1,
    embed: 1,
    hr: 1,
    img: 1,
    input: 1,
    link: 1,
    meta: 1,
    param: 1,
    source: 1,
    track: 1,
    wbr: 1,
    canvas: 1,
    iframe: 1,
    option: 1,
    script: 1,
    select: 1,
    style: 1,
    textarea: 1,
    title: 1,
    video: 1,
    audio: 1,
    path: 1,
    circle: 1,
    rect: 1,
    line: 1,
    ellipse: 1,
    polygon: 1,
    polyline: 1,
    use: 1,
  };
  var state12: Dynamic = {
    "": 1,
    deg: 1,
    rad: 180 / Math.PI,
    turn: 360,
    grad: 0.9,
  };
  var state13: Dynamic = {
    translate: 0,
    translatex: 0,
    translatey: 0,
    rotate: 1,
    scale: 2,
    scalex: 2,
    scaley: 2,
  };
  var state14: Dynamic = {
    translate: ["x", "y"],
    translatex: ["x"],
    translatey: ["y"],
    rotate: ["r"],
    scale: ["sx", "sy"],
    scalex: ["sx"],
    scaley: ["sy"],
  };
  function parseTransformFunctions(
    this: Dynamic,
    transform?: Dynamic,
    ..._extraArguments164: Dynamic[]
  ): Dynamic {
    transform = String(transform || "").trim();
    var innerHTML: Dynamic = {
      x: "0px",
      y: "0px",
      deg: 0,
      sx: 1,
      sy: 1,
    };
    if (!transform || transform === "none") return innerHTML;
    if (/\{\{|var\(/.test(transform)) return null;
    var position: Dynamic = /([a-zA-Z]+)\(([^)]*)\)/g;
    var shaft: Dynamic = /^(-?\d*\.?\d+)([a-z%]*)$/i;
    if (transform.replace(position, "").trim() !== "") return null;
    for (
      var tag: Dynamic, rot: Dynamic = {}, ref: Dynamic = 0;
      (tag = position.exec(transform));

    ) {
      var top: Dynamic = tag[1].toLowerCase();
      var name3: Dynamic = tag[2].split(",");
      if (
        !(Object as Dynamic).prototype.hasOwnProperty.call(state13, top) ||
        state13[top] < ref
      )
        return null;
      for (
        var bottom: Dynamic = state14[top], left: Dynamic = 0;
        left < bottom.length;
        left++
      ) {
        if (rot[bottom[left]]) return null;
        rot[bottom[left]] = 1;
      }
      if (name3.length > bottom.length) return null;
      ref = state13[top];
      var scope: Dynamic = shaft.exec(name3[0].trim());
      var top2: Dynamic = name3.length > 1 ? shaft.exec(name3[1].trim()) : null;
      if (!scope) return null;
      var adjust: Dynamic = function (
        this: Dynamic,
        paint?: Dynamic,
        ..._extraArguments165: Dynamic[]
      ): Dynamic {
        return !!paint && !paint[2] && parseFloat(paint[1]) !== 0;
      };
      if (state13[top] < 2 && (adjust(scope) || adjust(top2))) return null;
      var axis: Dynamic = scope[1] + (scope[2] || "px");
      var y2: Dynamic = top2 ? top2[1] + (top2[2] || "px") : null;
      if (top === "translate") {
        if (name3.length > 1 && !top2) return null;
        innerHTML.x = axis;
        if (y2) {
          innerHTML.y = y2;
        }
      } else if (top === "translatex") innerHTML.x = axis;
      else if (top === "translatey") innerHTML.y = axis;
      else if (top === "rotate") {
        var pose: Dynamic = (scope[2] || "").toLowerCase();
        if (!(Object as Dynamic).prototype.hasOwnProperty.call(state12, pose))
          return null;
        var lock: Dynamic = state12[pose];
        innerHTML.deg = parseFloat(scope[1]) * lock;
      } else if (top === "scale") {
        if ((name3.length > 1 && !top2) || scope[2] || (top2 && top2[2]))
          return null;
        innerHTML.sx = parseFloat(scope[1]);
        innerHTML.sy = top2 ? parseFloat(top2[1]) : innerHTML.sx;
      } else if (top === "scalex" || top === "scaley") {
        if (scope[2]) return null;
        if (top === "scalex") {
          innerHTML.sx = parseFloat(scope[1]);
        } else {
          innerHTML.sy = parseFloat(scope[1]);
        }
      } else return null;
    }
    return innerHTML;
  }
  function serializeRotatedTransform(
    this: Dynamic,
    transform?: Dynamic,
    degrees?: Dynamic,
    ..._extraArguments166: Dynamic[]
  ): Dynamic {
    var position: Dynamic = [];
    if (parseFloat(transform.x) !== 0 || parseFloat(transform.y) !== 0) {
      position.push("translate(" + transform.x + ", " + transform.y + ")");
    }
    position.push("rotate(" + degrees + "deg)");
    if (transform.sx !== 1 || transform.sy !== 1) {
      position.push(
        transform.sx === transform.sy
          ? "scale(" + transform.sx + ")"
          : "scale(" + transform.sx + ", " + transform.sy + ")",
      );
    }
    return position.join(" ");
  }
  function resizeMatrixOffsets(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ref?: Dynamic,
    top?: Dynamic,
    ..._extraArguments167: Dynamic[]
  ): Dynamic {
    var name3: Dynamic = fillStyle.indexOf("w") >= 0 ? 1 : 0;
    var bottom: Dynamic = fillStyle.indexOf("n") >= 0 ? 1 : 0;
    var left: Dynamic = (name3 - position) * (tag - ref);
    var scope: Dynamic = (bottom - shaft) * (rot - top);
    var top2: Dynamic =
      position * (tag - ref) + innerHTML.a * left + innerHTML.c * scope;
    var adjust: Dynamic =
      shaft * (rot - top) + innerHTML.b * left + innerHTML.d * scope;
    return {
      x: top2,
      y: adjust,
      r: tag - ref - top2,
      b: rot - top - adjust,
    };
  }
  var value_aa: Dynamic = function (
    this: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments168: Dynamic[]
  ): Dynamic {
    if (!innerHTML) return null;
    var position: Dynamic = Math.sqrt(
      innerHTML.a * innerHTML.a + innerHTML.b * innerHTML.b,
    );
    var shaft: Dynamic = Math.sqrt(
      innerHTML.c * innerHTML.c + innerHTML.d * innerHTML.d,
    );
    var tag: Dynamic = innerHTML.a * innerHTML.d - innerHTML.b * innerHTML.c;
    if (
      !(position > 0) ||
      !(shaft > 0) ||
      !(
        Math.abs(innerHTML.a * innerHTML.c + innerHTML.b * innerHTML.d) <=
        0.001 * position * shaft
      )
    )
      return null;
    var rot: Dynamic = Math.atan2(innerHTML.b, innerHTML.a);
    var ref: Dynamic = tag < 0;
    if (ref) {
      var top: Dynamic = Math.atan2(-innerHTML.b, -innerHTML.a);
      if (Math.abs(top) <= Math.abs(rot)) {
        rot = top;
        position = -position;
      } else {
        shaft = -shaft;
      }
    }
    return {
      m: innerHTML,
      rot: rot,
      sx: position,
      sy: shaft,
      mirror: ref,
      plain:
        !ref &&
        Math.abs(rot) < 1e-6 &&
        Math.abs(position - 1) < 1e-6 &&
        Math.abs(shaft - 1) < 1e-6,
    };
  };
  function transformedResizeDirections(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments169: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = !innerHTML || innerHTML.plain;
    var tag: Dynamic = (shaft ? 1 : innerHTML.sx) * position.x;
    var rot: Dynamic = (shaft ? 1 : innerHTML.sy) * position.y;
    var ref: Dynamic = fillStyle.indexOf(tag < 0 ? "e" : "w") >= 0;
    var top: Dynamic = fillStyle.indexOf(tag < 0 ? "w" : "e") >= 0;
    var name3: Dynamic = fillStyle.indexOf(rot < 0 ? "s" : "n") >= 0;
    var bottom: Dynamic = fillStyle.indexOf(rot < 0 ? "n" : "s") >= 0;
    return {
      dir: (name3 ? "n" : bottom ? "s" : "") + (ref ? "w" : top ? "e" : ""),
      west: ref,
      east: top,
      north: name3,
      south: bottom,
      rot: (shaft ? 0 : innerHTML.rot) * position.x * position.y,
      sx: tag,
      sy: rot,
    };
  }
  function unrotateDragDelta(
    this: Dynamic,
    transform?: Dynamic,
    scale?: Dynamic,
    dx?: Dynamic,
    dy?: Dynamic,
    ..._extraArguments170: Dynamic[]
  ): Dynamic {
    var tag: Dynamic = Math.cos(transform.rot);
    var rot: Dynamic = Math.sin(transform.rot);
    return {
      x: (dx * tag + dy * rot) / (scale * transform.sx),
      y: (dy * tag - dx * rot) / (scale * transform.sy),
    };
  }
  var state15: Dynamic = {
    img: 1,
    svg: 1,
    video: 1,
    canvas: 1,
    iframe: 1,
    embed: 1,
    object: 1,
    audio: 1,
    input: 1,
    textarea: 1,
    select: 1,
    button: 1,
  };
  function computedBoxDimensions(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments171: Dynamic[]
  ): Dynamic {
    var tag: Dynamic = function (
      this: Dynamic,
      adjust?: Dynamic,
      ..._extraArguments172: Dynamic[]
    ): Dynamic {
      return parseFloat(shaft[adjust]) || 0;
    };
    var rot: Dynamic = shaft.boxSizing === "border-box" ? 0 : 1;
    var ref: Dynamic = function (
      this: Dynamic,
      adjust?: Dynamic,
      axis?: Dynamic,
      y?: Dynamic,
      ..._extraArguments173: Dynamic[]
    ): Dynamic {
      var pose: Dynamic = parseFloat(adjust) + rot * y;
      return typeof axis != "number"
        ? isFinite(pose)
          ? pose
          : 0
        : isFinite(pose) && Math.abs(pose - axis) <= 0.501
          ? pose
          : axis;
    };
    var top: Dynamic = ref(
      shaft.width,
      innerHTML,
      tag("paddingLeft") +
        tag("paddingRight") +
        tag("borderLeftWidth") +
        tag("borderRightWidth"),
    );
    var name3: Dynamic = ref(
      shaft.height,
      position,
      tag("paddingTop") +
        tag("paddingBottom") +
        tag("borderTopWidth") +
        tag("borderBottomWidth"),
    );
    var bottom: Dynamic = String(shaft.transformOrigin || "").split(" ");
    var left: Dynamic = parseFloat(bottom[0]);
    var scope: Dynamic = parseFloat(bottom[1]);
    var top2: Dynamic = !state15[fillStyle];
    return {
      centre: {
        x: top / 2 - (isFinite(left) ? left : top / 2),
        y: name3 / 2 - (isFinite(scope) ? scope : name3 / 2),
      },
      inline: shaft.display === "inline" && top2,
      flat: {
        x: top2 && !(top > 0),
        y: top2 && !(name3 > 0),
      },
    };
  }
  function axisTransformSigns(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments174: Dynamic[]
  ): Dynamic {
    if (!fillStyle || Math.abs(Math.sin(fillStyle.rot)) > 1e-4) return null;
    var innerHTML: Dynamic = Math.cos(fillStyle.rot) < 0 ? -1 : 1;
    return {
      x: innerHTML * (fillStyle.sx < 0 ? -1 : 1),
      y: innerHTML * (fillStyle.sy < 0 ? -1 : 1),
    };
  }
  function resizeBoxDimensions(
    this: Dynamic,
    box?: Dynamic,
    direction?: Dynamic,
    dx?: Dynamic,
    dy?: Dynamic,
    preserveRatio?: Dynamic,
    rot?: Dynamic,
    ..._extraArguments175: Dynamic[]
  ): Dynamic {
    var ref: Dynamic = direction.indexOf("w") >= 0;
    var top: Dynamic = direction.indexOf("e") >= 0;
    var name3: Dynamic = direction.indexOf("n") >= 0;
    var bottom: Dynamic = direction.indexOf("s") >= 0;
    var left: Dynamic = ref ? box.w - dx : top ? box.w + dx : box.w;
    var scope: Dynamic = name3 ? box.h - dy : bottom ? box.h + dy : box.h;
    if (
      preserveRatio &&
      (ref || top) &&
      (name3 || bottom) &&
      box.w > 0 &&
      box.h > 0
    ) {
      var top2: Dynamic = left / box.w;
      var adjust: Dynamic = scope / box.h;
      var axis: Dynamic =
        Math.abs(top2 - 1) >= Math.abs(adjust - 1) ? top2 : adjust;
      axis = Math.min(axis, rot.max.w / box.w, rot.max.h / box.h);
      axis = Math.max(axis, rot.min.w / box.w, rot.min.h / box.h);
      left = box.w * axis;
      scope = box.h * axis;
    } else {
      if (ref || top) {
        left = Math.min(rot.max.w, Math.max(rot.min.w, left));
      }
      if (name3 || bottom) {
        scope = Math.min(rot.max.h, Math.max(rot.min.h, scope));
      }
    }
    return {
      x: ref ? box.x + box.w - left : box.x,
      y: name3 ? box.y + box.h - scope : box.y,
      w: left,
      h: scope,
    };
  }
  function transformOriginCompensation(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ref?: Dynamic,
    top?: Dynamic,
    ..._extraArguments176: Dynamic[]
  ): Dynamic {
    var name3: Dynamic = (0.5 - position) * tag;
    var bottom: Dynamic = (0.5 - shaft) * rot;
    var left: Dynamic = (0.5 - position) * ref;
    var scope: Dynamic = (0.5 - shaft) * top;
    return {
      x:
        position * (ref - tag) +
        (innerHTML.a * left + innerHTML.c * scope) -
        (fillStyle.a * name3 + fillStyle.c * bottom),
      y:
        shaft * (top - rot) +
        (innerHTML.b * left + innerHTML.d * scope) -
        (fillStyle.b * name3 + fillStyle.d * bottom),
    };
  }
  function rotateMatrix(
    this: Dynamic,
    matrix?: Dynamic,
    radians?: Dynamic,
    ..._extraArguments177: Dynamic[]
  ): Dynamic {
    var position: Dynamic = Math.cos(radians);
    var shaft: Dynamic = Math.sin(radians);
    return {
      a: position * matrix.a - shaft * matrix.b,
      b: shaft * matrix.a + position * matrix.b,
      c: position * matrix.c - shaft * matrix.d,
      d: shaft * matrix.c + position * matrix.d,
    };
  }
  function normalizeDegrees(
    this: Dynamic,
    degrees?: Dynamic,
    ..._extraArguments178: Dynamic[]
  ): Dynamic {
    degrees = ((degrees % 360) + 360) % 360;
    return degrees > 180 ? degrees - 360 : degrees;
  }
  function positioningAnchors(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments179: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = function (
      this: Dynamic,
      position?: Dynamic,
      ..._extraArguments180: Dynamic[]
    ): Dynamic {
      return !!position && position !== "auto";
    };
    return {
      x:
        innerHTML(fillStyle.left) || !innerHTML(fillStyle.right)
          ? "left"
          : "right",
      y:
        innerHTML(fillStyle.top) || !innerHTML(fillStyle.bottom)
          ? "top"
          : "bottom",
    };
  }
  function hasIndependentTransforms(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments181: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = function (
      this: Dynamic,
      position?: Dynamic,
      ..._extraArguments182: Dynamic[]
    ): Dynamic {
      return !!position && position !== "none";
    };
    return (
      innerHTML(fillStyle.rotate) ||
      innerHTML(fillStyle.scale) ||
      innerHTML(fillStyle.translate)
    );
  }
  function pixelLengthOrFallback(
    this: Dynamic,
    length?: Dynamic,
    fallback?: Dynamic,
    ..._extraArguments183: Dynamic[]
  ): Dynamic {
    return /^-?[\d.]+px$/i.test(String(length || "").trim())
      ? parseFloat(length)
      : parseFloat(fallback) || 0;
  }
  var state16: Dynamic = {
    img: 1,
    svg: 1,
    video: 1,
    canvas: 1,
    iframe: 1,
    embed: 1,
    object: 1,
    input: 1,
    textarea: 1,
    select: 1,
    button: 1,
  };
  var state17: Dynamic = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    none: true,
  };
  function computedTransformMatrix(
    this: Dynamic,
    element?: Dynamic,
    ..._extraArguments184: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic;
    try {
      innerHTML = getComputedStyle(element);
    } catch {
      return null;
    }
    if (hasIndependentTransforms(innerHTML)) return null;
    var position: Dynamic = innerHTML.transform;
    if (!position || position === "none") return state17;
    var shaft: Dynamic = /^matrix\(([^)]+)\)$/.exec(position);
    if (!shaft) return null;
    var tag: Dynamic = shaft[1].split(",");
    var rot: Dynamic = {
      a: +tag[0],
      b: +tag[1],
      c: +tag[2],
      d: +tag[3],
    };
    return isFinite(rot.a) &&
      isFinite(rot.b) &&
      isFinite(rot.c) &&
      isFinite(rot.d)
      ? rot
      : null;
  }
  function decomposedElementTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments185: Dynamic[]
  ): Dynamic {
    return value_aa(computedTransformMatrix(fillStyle));
  }
  function effectiveTransformSigns(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments186: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = ancestorTransformSigns(fillStyle);
    var position: Dynamic = computedTransformMatrix(fillStyle);
    var shaft: Dynamic =
      position && !position.none
        ? axisTransformSigns(value_aa(position))
        : {
            x: 1,
            y: 1,
          };
    return shaft && position
      ? {
          x: innerHTML.x * shaft.x,
          y: innerHTML.y * shaft.y,
        }
      : {
          x: 1,
          y: 1,
        };
  }
  function ancestorTransformSigns(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments187: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 1,
        position: Dynamic = 1,
        shaft: Dynamic = fillStyle ? composedParent(fillStyle) : null;
      shaft;
      shaft = composedParent(shaft)
    )
      if (shaft.nodeType === 1) {
        var tag: Dynamic = computedTransformMatrix(shaft);
        if (!tag)
          return {
            x: 1,
            y: 1,
          };
        if (!tag.none) {
          var rot: Dynamic = axisTransformSigns(value_aa(tag));
          if (!rot)
            return {
              x: 1,
              y: 1,
            };
          innerHTML *= rot.x;
          position *= rot.y;
        }
      }
    return {
      x: innerHTML,
      y: position,
    };
  }
  function elementLayoutDimensions(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments188: Dynamic[]
  ): Dynamic {
    return fillStyle.offsetWidth > 0 || fillStyle.offsetHeight > 0
      ? {
          w: fillStyle.offsetWidth,
          h: fillStyle.offsetHeight,
        }
      : ((innerHTML = innerHTML || getComputedStyle(fillStyle)),
        {
          w: parseFloat(innerHTML.width) || 0,
          h: parseFloat(innerHTML.height) || 0,
        });
  }
  function fractionalTransformOrigin(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments189: Dynamic[]
  ): Dynamic {
    var position: Dynamic = String(fillStyle.transformOrigin || "").split(" ");
    var shaft: Dynamic = parseFloat(position[0]);
    var tag: Dynamic = parseFloat(position[1]);
    return {
      fx: innerHTML.w > 0 && isFinite(shaft) ? shaft / innerHTML.w : 0.5,
      fy: innerHTML.h > 0 && isFinite(tag) ? tag / innerHTML.h : 0.5,
    };
  }
  function boundsWithoutTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments190: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle.style;
    var position: Dynamic = fillStyle.getAttribute("style");
    if (!innerHTML || !fillStyle.getBoundingClientRect) return null;
    function shaft(this: Dynamic, ..._extraArguments191: Dynamic[]): Dynamic {
      innerHTML.setProperty("transition", "none", "important");
    }
    try {
      shaft();
      innerHTML.setProperty("transform", "none", "important");
      innerHTML.setProperty("rotate", "none", "important");
      innerHTML.setProperty("scale", "none", "important");
      innerHTML.setProperty("translate", "none", "important");
      var tag: Dynamic = fillStyle.getBoundingClientRect();
      if (position == null) {
        fillStyle.removeAttribute("style");
      } else {
        fillStyle.setAttribute("style", position);
      }
      shaft();
      fillStyle.getBoundingClientRect();
      return tag;
    } catch {
      return null;
    } finally {
      if (position == null) {
        fillStyle.removeAttribute("style");
      } else {
        fillStyle.setAttribute("style", position);
      }
    }
  }
  function inferredElementScale(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments192: Dynamic[]
  ): Dynamic {
    var position: Dynamic = boundsWithoutTransform(fillStyle) || innerHTML;
    var shaft: Dynamic = elementLayoutDimensions(fillStyle);
    var tag: Dynamic = getComputedStyle(fillStyle);
    var rot: Dynamic = parseFloat(tag.width);
    if (rot > 0 && tag.boxSizing !== "border-box") {
      rot +=
        (parseFloat(tag.paddingLeft) || 0) +
        (parseFloat(tag.paddingRight) || 0) +
        (parseFloat(tag.borderLeftWidth) || 0) +
        (parseFloat(tag.borderRightWidth) || 0);
    }
    var ref: Dynamic = rot > 0 && Math.abs(rot - shaft.w) < 1 ? rot : shaft.w;
    var top: Dynamic =
      ref > 0 && position.width > 0
        ? position.width / ref
        : elementViewportScale(fillStyle);
    if (!(top > 0) || !isFinite(top)) {
      top = 1;
    }
    return {
      s: top,
      w: Math.ceil(innerHTML.width / top),
      h: Math.ceil(innerHTML.height / top),
      ew: Math.ceil(ref) || Math.ceil(position.width / top),
      eh: Math.ceil(shaft.h) || Math.ceil(position.height / top),
      ox: Math.round((position.left - innerHTML.left) / top),
      oy: Math.round((position.top - innerHTML.top) / top),
    };
  }
  function parentLayoutScale(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments193: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle && computedTransformMatrix(fillStyle);
    if (!innerHTML || innerHTML.none) return elementViewportScale(fillStyle);
    for (
      var position: Dynamic = fillStyle.parentElement;
      position &&
      position.parentElement &&
      !(position.offsetWidth > 0 || position.offsetHeight > 0);

    )
      position = position.parentElement;
    return elementViewportScale(position || fillStyle);
  }
  function elementViewportScale(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments194: Dynamic[]
  ): Dynamic {
    try {
      if (fillStyle && fillStyle.getBoundingClientRect) {
        var innerHTML: Dynamic = fillStyle.getBoundingClientRect();
        if (fillStyle.offsetWidth > 0 && innerHTML.width > 0)
          return innerHTML.width / fillStyle.offsetWidth;
        if (fillStyle.offsetHeight > 0 && innerHTML.height > 0)
          return innerHTML.height / fillStyle.offsetHeight;
      }
    } catch {}
    return panZoomScale || 1;
  }
  function canContainElements(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments195: Dynamic[]
  ): Dynamic {
    return !state11[(fillStyle.tagName || "").toLowerCase()];
  }
  var state18: Dynamic = {
    address: 1,
    article: 1,
    aside: 1,
    blockquote: 1,
    details: 1,
    div: 1,
    dl: 1,
    fieldset: 1,
    figcaption: 1,
    figure: 1,
    footer: 1,
    form: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
    header: 1,
    hgroup: 1,
    hr: 1,
    main: 1,
    menu: 1,
    nav: 1,
    ol: 1,
    p: 1,
    pre: 1,
    section: 1,
    table: 1,
    ul: 1,
  };
  var state19: Dynamic = {
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
  };
  var state20: Dynamic = {
    tr: {
      thead: 1,
      tbody: 1,
      tfoot: 1,
      table: 1,
    },
    td: {
      tr: 1,
    },
    th: {
      tr: 1,
    },
    thead: {
      table: 1,
    },
    tbody: {
      table: 1,
    },
    tfoot: {
      table: 1,
    },
    caption: {
      table: 1,
    },
    colgroup: {
      table: 1,
    },
    col: {
      colgroup: 1,
    },
  };
  var state21: Dynamic = {
    table: {
      caption: 1,
      colgroup: 1,
      thead: 1,
      tbody: 1,
      tfoot: 1,
      tr: 1,
    },
    thead: {
      tr: 1,
    },
    tbody: {
      tr: 1,
    },
    tfoot: {
      tr: 1,
    },
    tr: {
      td: 1,
      th: 1,
    },
    colgroup: {
      col: 1,
    },
  };
  var state22: Dynamic = {
    span: 1,
    a: 1,
    b: 1,
    i: 1,
    em: 1,
    strong: 1,
    u: 1,
    s: 1,
    small: 1,
    sub: 1,
    sup: 1,
    code: 1,
    label: 1,
    button: 1,
    abbr: 1,
    cite: 1,
    q: 1,
    mark: 1,
    time: 1,
    kbd: 1,
    samp: 1,
    var: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
  };
  var state23: Dynamic = {
    address: 1,
    article: 1,
    aside: 1,
    blockquote: 1,
    details: 1,
    div: 1,
    dl: 1,
    fieldset: 1,
    figcaption: 1,
    figure: 1,
    footer: 1,
    form: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
    header: 1,
    hgroup: 1,
    hr: 1,
    main: 1,
    menu: 1,
    nav: 1,
    ol: 1,
    p: 1,
    pre: 1,
    section: 1,
    table: 1,
    ul: 1,
    li: 1,
    dt: 1,
    dd: 1,
  };
  function permitsElementNesting(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments196: Dynamic[]
  ): Dynamic {
    var position: Dynamic = (fillStyle || "").toLowerCase();
    var shaft: Dynamic = (innerHTML || "").toLowerCase();
    return !(
      state11[position] ||
      (position === "p" && state18[shaft]) ||
      (state22[position] && state23[shaft]) ||
      (state19[position] && state19[shaft]) ||
      (position === shaft &&
        (position === "a" ||
          position === "form" ||
          position === "button" ||
          position === "label")) ||
      (state20[shaft] && !state20[shaft][position]) ||
      (state21[position] && !state21[position][shaft])
    );
  }
  function findDropContainer(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ..._extraArguments197: Dynamic[]
  ): Dynamic {
    var ref: Dynamic = tag || (position ? position.tagName : "div");
    var top: Dynamic = (document as Dynamic).elementFromPoint(
      fillStyle,
      innerHTML,
    );
    for (
      top = top && top.closest ? top.closest("[data-dc-tpl]") : null;
      top && rejectDropContainer(top, position, ref, shaft, rot);

    )
      top = top.parentElement
        ? top.parentElement.closest("[data-dc-tpl]")
        : null;
    return top
      ? {
          el: top,
          tid: parseInt(top.getAttribute("data-dc-tpl"), 10),
        }
      : {
          el:
            (document as Dynamic).querySelector(".sc-host") ||
            (document as Dynamic).body,
          tid: null,
        };
  }
  function dropContainerAncestors(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments198: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = [],
        position: Dynamic = fillStyle.parentElement
          ? fillStyle.parentElement.closest("[data-dc-tpl]")
          : null;
      position;

    ) {
      innerHTML.push(position);
      position = position.parentElement
        ? position.parentElement.closest("[data-dc-tpl]")
        : null;
    }
    var shaft: Dynamic = findOuterComponentHost();
    if (shaft) {
      innerHTML.push(shaft);
    }
    return innerHTML;
  }
  function repeatedDragParent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments199: Dynamic[]
  ): Dynamic {
    if (!fillStyle.peerParent) return null;
    for (
      var innerHTML: Dynamic = (document as Dynamic).querySelectorAll(
          "[data-dc-drag-parent]",
        ),
        position: Dynamic = null,
        shaft: Dynamic = 0;
      shaft < innerHTML.length && !position;
      shaft++
    )
      if (componentScopeName(innerHTML[shaft]) === fillStyle.name) {
        position = innerHTML[shaft];
      }
    position =
      position ||
      findTemplateInstances(String(fillStyle.peerTid), fillStyle.name)[0];
    if (!position || position.tagName !== fillStyle.peerParent.tagName)
      return null;
    var tag: Dynamic = getComputedStyle(position).display || "";
    return tag.indexOf("flex") !== -1 || tag.indexOf("grid") !== -1
      ? position
      : null;
  }
  function acceptsDraggedElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments200: Dynamic[]
  ): Dynamic {
    if (innerHTML == null || position.origAncestorEls.indexOf(fillStyle) !== -1)
      return true;
    var shaft: Dynamic = position.brk ? null : repeatedDragParent(position);
    if (shaft === fillStyle) return true;
    if (shaft && shaft.contains(fillStyle)) return false;
    var tag: Dynamic = fillStyle.getBoundingClientRect();
    var rot: Dynamic = position.startRect.width;
    var ref: Dynamic = position.startRect.height;
    return tag.width <= rot && tag.height <= ref
      ? false
      : tag.width * tag.height >= 1.1 * rot * ref;
  }
  function isDeckStage(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments201: Dynamic[]
  ): Dynamic {
    return (fillStyle.tagName || "").toLowerCase() === "deck-stage";
  }
  function isDeckStageWrapper(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments202: Dynamic[]
  ): Dynamic {
    if (!fillStyle || !fillStyle.tagName) return false;
    var innerHTML: Dynamic = fillStyle.tagName.toLowerCase();
    if (
      innerHTML === "deck-stage" ||
      (innerHTML === "x-import" &&
        fillStyle.getAttribute("component-from-global-scope") === "deck-stage")
    )
      return true;
    if (fillStyle.classList && fillStyle.classList.contains("sc-host-x")) {
      for (
        var position: Dynamic = fillStyle.firstElementChild;
        position;
        position = position.nextElementSibling
      )
        if (
          (position.tagName &&
            position.tagName.toLowerCase() === "deck-stage") ||
          (position.classList &&
            position.classList.contains("sc-placeholder") &&
            position.getAttribute("title") === "deck-stage")
        )
          return true;
    }
    return false;
  }
  function isImageSlotWrapper(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments203: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic =
      fillStyle &&
      fillStyle.classList &&
      fillStyle.classList.contains("sc-host-x")
        ? fillStyle.firstElementChild
        : null;
    return !innerHTML || !innerHTML.tagName
      ? false
      : innerHTML.tagName.toLowerCase() === "image-slot" ||
          (innerHTML.classList.contains("sc-placeholder") &&
            innerHTML.getAttribute("title") === "image-slot");
  }
  function isCollapsedDeckWrapper(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments204: Dynamic[]
  ): Dynamic {
    if (!fillStyle || !fillStyle.getBoundingClientRect) return false;
    var innerHTML: Dynamic = fillStyle.getBoundingClientRect();
    if (innerHTML.width !== 0 && innerHTML.height !== 0) return false;
    for (
      var position: Dynamic = fillStyle.firstElementChild;
      position;
      position = position.nextElementSibling
    )
      if (
        getComputedStyle(position).display !== "none" &&
        (isDeckStageWrapper(position) || isCollapsedDeckWrapper(position))
      )
        return true;
    return false;
  }
  function eventHitsDeckChrome(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments205: Dynamic[]
  ): Dynamic {
    if (!fillStyle || typeof fillStyle.composedPath != "function") return false;
    for (
      var innerHTML: Dynamic = fillStyle.composedPath(), position: Dynamic = 0;
      position < innerHTML.length;
      position++
    ) {
      var shaft: Dynamic = innerHTML[position];
      if (
        shaft &&
        shaft.nodeType === 1 &&
        shaft.matches &&
        shaft.matches("[data-omelette-chrome]")
      ) {
        var tag: Dynamic = shaft.getRootNode && shaft.getRootNode();
        return !!(tag && tag.host && isDeckStage(tag.host));
      }
    }
    return false;
  }
  function isDeckManagedElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments206: Dynamic[]
  ): Dynamic {
    return (
      isDeckStageWrapper(fillStyle) ||
      isCollapsedDeckWrapper(fillStyle) ||
      !!(
        fillStyle &&
        fillStyle.parentElement &&
        isDeckStage(fillStyle.parentElement)
      )
    );
  }
  function isUneditableElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments207: Dynamic[]
  ): Dynamic {
    return (
      !!fillStyle &&
      fillStyle.hasAttribute &&
      (fillStyle.hasAttribute("data-uneditable") ||
        isDeckStage(fillStyle) ||
        isDeckStageWrapper(fillStyle) ||
        isCollapsedDeckWrapper(fillStyle))
    );
  }
  function rejectDropContainer(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments208: Dynamic[]
  ): Dynamic {
    if (
      (innerHTML &&
        (fillStyle === innerHTML || innerHTML.contains(fillStyle))) ||
      !permitsElementNesting(fillStyle.tagName, position) ||
      (innerHTML &&
        !tag &&
        fillStyle.namespaceURI === "http://www.w3.org/2000/svg")
    )
      return true;
    for (var rot: Dynamic = 0; shaft && rot < shaft.length; rot++)
      if (
        shaft[rot].contains(fillStyle) ||
        (innerHTML &&
          !permitsElementNesting(fillStyle.tagName, shaft[rot].tagName))
      )
        return true;
    return false;
  }
  function hasSvgAncestor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments209: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = fillStyle.parentElement;
      innerHTML;
      innerHTML = innerHTML.parentElement
    )
      if (innerHTML.namespaceURI === "http://www.w3.org/2000/svg") return true;
    return false;
  }
  function resolveDropContainer(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments210: Dynamic[]
  ): Dynamic {
    for (
      var rot: Dynamic = findDropContainer(
          fillStyle,
          innerHTML,
          shaft,
          tag,
          shaft ? null : position.tag,
          position.fromDrawing,
        ),
        ref: Dynamic = rot.el,
        top: Dynamic = rot.tid;
      ;

    ) {
      if (
        ref &&
        (isDeckStage(ref) ||
          isDeckStageWrapper(ref) ||
          isCollapsedDeckWrapper(ref))
      )
        return {
          el: null,
          tid: null,
          invalid: true,
        };
      if (
        ref &&
        top != null &&
        parseFloat(getComputedStyle(ref).opacity || "1") === 0
      ) {
        var name3: Dynamic = ref.parentElement
          ? ref.parentElement.closest("[data-dc-tpl]")
          : null;
        if (name3) {
          ref = name3;
          top = parseInt(name3.getAttribute("data-dc-tpl"), 10);
          continue;
        }
        ref =
          (document as Dynamic).querySelector(".sc-host") ||
          (document as Dynamic).body;
        top = null;
        break;
      }
      if (top == null || acceptsDraggedElement(ref, top, position)) break;
      for (
        var bottom: Dynamic = ref.parentElement
          ? ref.parentElement.closest("[data-dc-tpl]")
          : null;
        bottom &&
        rejectDropContainer(
          bottom,
          shaft,
          position.tag,
          tag,
          position.fromDrawing,
        );

      )
        bottom = bottom.parentElement
          ? bottom.parentElement.closest("[data-dc-tpl]")
          : null;
      if (!bottom) {
        ref =
          (document as Dynamic).querySelector(".sc-host") ||
          (document as Dynamic).body;
        top = null;
        break;
      }
      ref = bottom;
      top = parseInt(bottom.getAttribute("data-dc-tpl"), 10);
    }
    return {
      el: ref,
      tid: top,
    };
  }
  function flowChildren(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments211: Dynamic[]
  ): Dynamic {
    for (
      var shaft: Dynamic = [], tag: Dynamic = 0;
      tag < fillStyle.children.length;
      tag++
    ) {
      var rot: Dynamic = fillStyle.children[tag];
      if (
        !(rot === innerHTML || (position && position.indexOf(rot) >= 0)) &&
        !(!rot.getAttribute || rot.getAttribute("data-dc-tpl") == null)
      ) {
        var ref: Dynamic = getComputedStyle(rot).position;
        if (!(ref === "absolute" || ref === "fixed")) {
          shaft.push(rot);
        }
      }
    }
    return shaft;
  }
  function flowInsertionCounts(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments212: Dynamic[]
  ): Dynamic {
    for (
      var shaft: Dynamic = [], tag: Dynamic = 0, rot: Dynamic = 0;
      rot < fillStyle.length;
      rot++
    ) {
      if (
        fillStyle[rot] !== innerHTML &&
        !(position && position.indexOf(fillStyle[rot]) >= 0)
      ) {
        tag++;
      }
      shaft[rot] = tag;
    }
    return shaft;
  }
  function templateId(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments213: Dynamic[]
  ): Dynamic {
    return parseInt(fillStyle.getAttribute("data-dc-tpl"), 10);
  }
  function pointInsideRect(
    this: Dynamic,
    rect?: Dynamic,
    x?: Dynamic,
    y?: Dynamic,
    ..._extraArguments214: Dynamic[]
  ): Dynamic {
    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  }
  function flowInsertionPlan(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ref?: Dynamic,
    top?: Dynamic,
    ..._extraArguments215: Dynamic[]
  ): Dynamic {
    var name3: Dynamic = flowChildren(fillStyle, position, top);
    if (name3.length === 0)
      return {
        targetTid: innerHTML,
        position: innerHTML == null ? "root-end" : "into",
        n: 0,
      };
    var bottom: Dynamic = function (
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments216: Dynamic[]
    ): Dynamic {
      return input < name3.length
        ? {
            targetTid: templateId(name3[input]),
            position: "before",
            n: input,
          }
        : {
            targetTid: templateId(name3[name3.length - 1]),
            position: "after",
            n: name3.length,
          };
    };
    var left: Dynamic = rot && rot.n <= name3.length ? bottom(rot.n) : null;
    var scope: Dynamic = getComputedStyle(fillStyle);
    var top2: Dynamic = scope.display || "";
    var adjust: Dynamic = top2.indexOf("flex") !== -1;
    var axis: Dynamic = top2.indexOf("grid") !== -1;
    if (axis || (adjust && scope.flexWrap !== "nowrap")) {
      if (left && ref) return left;
      for (
        var y2: Dynamic = adjust
            ? scope.flexDirection.indexOf("column") === 0
            : String(scope.gridTemplateColumns || "none")
                .trim()
                .split(/\s+/).length < 2,
          pose: Dynamic =
            adjust && scope.flexDirection.indexOf("reverse") !== -1,
          lock: Dynamic = effectiveTransformSigns(fillStyle),
          paint: Dynamic = y2
            ? pose !== lock.y < 0
            : ((scope.direction === "rtl") !== pose) != lock.x < 0,
          lastKey: Dynamic = function (
            this: Dynamic,
            input?: Dynamic,
            ..._extraArguments217: Dynamic[]
          ): Dynamic {
            var value_et: Dynamic = y2
              ? (tag - input.top) / (input.bottom - input.top || 1)
              : (shaft - input.left) / (input.right - input.left || 1);
            return paint ? 1 - value_et : value_et;
          },
          lim: Dynamic = flowChildren(fillStyle, null),
          text8: Dynamic = flowInsertionCounts(lim, position, top),
          value_S: Dynamic = function (
            this: Dynamic,
            input?: Dynamic,
            ..._extraArguments218: Dynamic[]
          ): Dynamic {
            var value_et: Dynamic = lim.indexOf(input);
            return value_et < 0 ? null : bottom(text8[value_et]);
          },
          expected: Dynamic = value_S(position),
          value_k: Dynamic = [position].concat(top || []),
          index21: Dynamic = 0;
        index21 < value_k.length;
        index21++
      ) {
        var el: Dynamic = value_S(value_k[index21]);
        if (
          el &&
          pointInsideRect(
            unwrapDisplayContentsHost(value_k[index21]).getBoundingClientRect(),
            shaft,
            tag,
          )
        )
          return el;
      }
      for (var startRect: Dynamic = 0; startRect < name3.length; startRect++) {
        var bounds: Dynamic = unwrapDisplayContentsHost(
          name3[startRect],
        ).getBoundingClientRect();
        if (pointInsideRect(bounds, shaft, tag)) {
          var covered: Dynamic = lastKey(bounds);
          return left &&
            ((left.n === startRect && covered < 0.65) ||
              (left.n === startRect + 1 && covered > 0.35))
            ? left
            : bottom(covered < 0.5 ? startRect : startRect + 1);
        }
      }
      var bounds2: Dynamic = unwrapDisplayContentsHost(
        name3[name3.length - 1],
      ).getBoundingClientRect();
      var back: Dynamic = y2
        ? (paint ? tag < bounds2.top : tag > bounds2.bottom) &&
          shaft >= bounds2.left &&
          shaft <= bounds2.right
        : (paint ? shaft < bounds2.left : shaft > bounds2.right) &&
          tag >= bounds2.top &&
          tag <= bounds2.bottom;
      if (back) return bottom(name3.length);
      if (left || expected) return left || expected;
      for (
        var x: Dynamic = -1, y: Dynamic = 1 / 0, K: Dynamic = 0;
        K < name3.length;
        K++
      ) {
        var bounds3: Dynamic = unwrapDisplayContentsHost(
          name3[K],
        ).getBoundingClientRect();
        if (!(bounds3.right <= bounds3.left || bounds3.bottom <= bounds3.top)) {
          var value_Z: Dynamic = shaft - (bounds3.left + bounds3.right) / 2;
          var value_pt: Dynamic = tag - (bounds3.top + bounds3.bottom) / 2;
          if (value_Z * value_Z + value_pt * value_pt < y) {
            y = value_Z * value_Z + value_pt * value_pt;
            x = K;
          }
        }
      }
      return x < 0
        ? bottom(name3.length)
        : bottom(
            lastKey(
              unwrapDisplayContentsHost(name3[x]).getBoundingClientRect(),
            ) < 0.5
              ? x
              : x + 1,
          );
    }
    for (
      var value_ut: Dynamic =
          (adjust && scope.flexDirection.indexOf("row") === 0) ||
          top2 === "table-row" ||
          (fillStyle.tagName || "").toLowerCase() === "tr",
        value_tt: Dynamic = value_ut ? shaft : tag,
        value_vt: Dynamic = value_ut
          ? effectiveTransformSigns(fillStyle).x < 0
          : effectiveTransformSigns(fillStyle).y < 0,
        tid: Dynamic = 0;
      tid < name3.length;
      tid++
    ) {
      var freezeStyle: Dynamic = name3[tid].getBoundingClientRect();
      var value_V: Dynamic = value_ut
        ? (freezeStyle.left + freezeStyle.right) / 2
        : (freezeStyle.top + freezeStyle.bottom) / 2;
      if (value_vt ? value_tt > value_V : value_tt < value_V)
        return bottom(tid);
    }
    return bottom(name3.length);
  }
  var flowOverlay: Dynamic = null;
  function ensureFlowOverlay(
    this: Dynamic,
    ..._extraArguments219: Dynamic[]
  ): Dynamic {
    return (
      flowOverlay ||
      ((flowOverlay = (document as Dynamic).createElement("div")),
      flowOverlay.setAttribute("data-dc-editor-overlay", ""),
      (flowOverlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483643;pointer-events:none;display:none;"),
      ensureOverlayRoot().appendChild(flowOverlay),
      flowOverlay)
    );
  }
  function clearFlowOverlay(
    this: Dynamic,
    ..._extraArguments220: Dynamic[]
  ): Dynamic {
    if (flowOverlay)
      for (flowOverlay.style.display = "none"; flowOverlay.firstChild; )
        flowOverlay.removeChild(flowOverlay.firstChild);
  }
  function appendFlowIndicator(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ..._extraArguments221: Dynamic[]
  ): Dynamic {
    var ref: Dynamic = (document as Dynamic).createElement("div");
    ref.style.cssText =
      "position:fixed;pointer-events:none;border-radius:2px;background:color-mix(in srgb," +
      CHROME_STROKE +
      (rot ? " 90%" : " 40%") +
      ",transparent);";
    ref.style.left = innerHTML + "px";
    ref.style.top = position + "px";
    ref.style.width = shaft + "px";
    ref.style.height = tag + "px";
    fillStyle.appendChild(ref);
  }
  function paintFlowInsertion(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments222: Dynamic[]
  ): Dynamic {
    for (var rot: Dynamic = ensureFlowOverlay(); rot.firstChild; )
      rot.removeChild(rot.firstChild);
    rot.style.display = "block";
    var ref: Dynamic = flowChildren(fillStyle, innerHTML, shaft);
    var top: Dynamic =
      dragGesture && dragGesture.parked ? flowChildren(fillStyle, null) : [];
    var name3: Dynamic = top.indexOf(innerHTML);
    var bottom: Dynamic = tag ?? -1;
    if (name3 >= 0) {
      bottom = flowInsertionCounts(top, innerHTML, shaft)[name3];
      for (
        var left: Dynamic = [innerHTML].concat(shaft || []),
          scope: Dynamic = [],
          top2: Dynamic = 0;
        top2 < left.length;
        top2++
      )
        if (top.indexOf(left[top2]) >= 0) {
          scope.push(
            unwrapDisplayContentsHost(left[top2]).getBoundingClientRect(),
          );
        }
      for (top2 = 0; top2 < scope.length; top2++)
        appendDropBounds(rot, scope[top2]);
    }
    if (ref.length !== 0) {
      var adjust: Dynamic = getComputedStyle(fillStyle);
      var axis: Dynamic = adjust.display || "";
      var y2: Dynamic =
        axis.indexOf("flex") !== -1 && adjust.flexWrap !== "nowrap";
      var pose: Dynamic =
        axis.indexOf("grid") !== -1 ||
        y2 ||
        axis === "table-row" ||
        (fillStyle.tagName || "").toLowerCase() === "tr";
      if (pose) {
        for (
          var lock: Dynamic = ref.map(function (
              this: Dynamic,
              K?: Dynamic,
              ..._extraArguments223: Dynamic[]
            ): Dynamic {
              return unwrapDisplayContentsHost(K).getBoundingClientRect();
            }),
            paint: Dynamic = 0;
          paint < ref.length;
          paint++
        ) {
          var lastKey: Dynamic = lock[paint];
          var lim: Dynamic = (document as Dynamic).createElement("div");
          lim.style.cssText =
            "position:fixed;pointer-events:none;border:1px dotted color-mix(in srgb," +
            CHROME_STROKE +
            " 60%,transparent);background:color-mix(in srgb," +
            CHROME_STROKE +
            " 5%,transparent);border-radius:3px;";
          lim.style.left = lastKey.left + "px";
          lim.style.top = lastKey.top + "px";
          lim.style.width = lastKey.width + "px";
          lim.style.height = lastKey.height + "px";
          rot.appendChild(lim);
        }
        return;
      }
      for (
        var text8: Dynamic =
            axis.indexOf("flex") !== -1 &&
            adjust.flexDirection.indexOf("row") === 0,
          bounds: Dynamic = fillStyle.getBoundingClientRect(),
          expected: Dynamic = ref.map(function (
            this: Dynamic,
            K?: Dynamic,
            ..._extraArguments224: Dynamic[]
          ): Dynamic {
            return K.getBoundingClientRect();
          }),
          index21: Dynamic = 0;
        index21 <= ref.length;
        index21++
      ) {
        var value_N: Dynamic = !!position && position.n === index21;
        if (index21 !== bottom) {
          var el: Dynamic = index21 > 0 ? expected[index21 - 1] : null;
          var startRect: Dynamic =
            index21 < ref.length ? expected[index21] : null;
          if (text8) {
            var value_O: Dynamic =
              el && startRect
                ? (el.right + startRect.left) / 2
                : el
                  ? el.right + 3
                  : startRect.left - 3;
            if (
              (!el && value_O < bounds.left) ||
              (!startRect && value_O > bounds.right)
            )
              continue;
            var covered: Dynamic = Math.min(
              el ? el.top : startRect.top,
              startRect ? startRect.top : el.top,
            );
            var value_G: Dynamic = Math.max(
              el ? el.bottom : startRect.bottom,
              startRect ? startRect.bottom : el.bottom,
            );
            appendFlowIndicator(
              rot,
              value_O - 1,
              covered,
              2,
              value_G - covered,
              value_N,
            );
          } else {
            var back: Dynamic =
              el && startRect
                ? (el.bottom + startRect.top) / 2
                : el
                  ? el.bottom + 3
                  : startRect.top - 3;
            if (
              (!el && back < bounds.top) ||
              (!startRect && back > bounds.bottom)
            )
              continue;
            var x: Dynamic = Math.min(
              el ? el.left : startRect.left,
              startRect ? startRect.left : el.left,
            );
            var y: Dynamic = Math.max(
              el ? el.right : startRect.right,
              startRect ? startRect.right : el.right,
            );
            appendFlowIndicator(rot, x, back - 1, y - x, 2, value_N);
          }
        }
      }
    }
  }
  function appendDropBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments225: Dynamic[]
  ): Dynamic {
    var position: Dynamic = (document as Dynamic).createElement("div");
    position.style.cssText =
      "position:fixed;pointer-events:none;box-sizing:border-box;border-radius:3px;border:calc(1*var(--dc-chrome-unit,1px)) dashed color-mix(in srgb," +
      CHROME_STROKE +
      " 75%,transparent);background:color-mix(in srgb," +
      CHROME_STROKE +
      " 6%,transparent);";
    position.style.left = innerHTML.left + "px";
    position.style.top = innerHTML.top + "px";
    position.style.width = innerHTML.width + "px";
    position.style.height = innerHTML.height + "px";
    fillStyle.appendChild(position);
  }
  var count3: Dynamic = 32;
  var count4: Dynamic = 150;
  function ensureDropPlaceholder(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ref?: Dynamic,
    top?: Dynamic,
    ..._extraArguments226: Dynamic[]
  ): Dynamic {
    var name3: Dynamic = hostDrag;
    if (name3) {
      var bottom: Dynamic =
        name3.placeholder && name3.placeholder.el.isConnected
          ? name3.placeholder.el
          : null;
      if (!bottom) {
        bottom = (document as Dynamic).createElement("div");
        bottom.setAttribute("data-dc-editor-overlay", "");
        bottom.setAttribute("data-dc-editor-drop-placeholder", "");
        bottom.setAttribute("inert", "");
        bottom.style.cssText =
          "box-sizing:border-box;flex:0 0 auto;margin:0;border-radius:3px;border:calc(1.5*var(--dc-chrome-unit,1px)) dashed color-mix(in srgb," +
          CHROME_STROKE +
          " 85%,transparent);background:color-mix(in srgb," +
          CHROME_STROKE +
          " 8%,transparent);";
        bottom.style.setProperty("pointer-events", "none", "important");
      }
      bottom.style.width = Math.max(1, Math.round(tag)) + "px";
      bottom.style.height = Math.max(1, Math.round(rot)) + "px";
      var left: Dynamic = position < shaft.length ? shaft[position] : null;
      var scope: Dynamic = shaft.length ? shaft[shaft.length - 1] : null;
      var top2: Dynamic =
        bottom.parentNode === fillStyle &&
        (left
          ? bottom.nextSibling === left
          : scope
            ? bottom.previousSibling === scope
            : fillStyle.lastChild === bottom);
      if (!top2) {
        if (left) {
          fillStyle.insertBefore(bottom, left);
        } else {
          if (scope) {
            scope.insertAdjacentElement("afterend", bottom);
          } else {
            fillStyle.appendChild(bottom);
          }
        }
      }
      var adjust: Dynamic =
        name3.placeholder && name3.placeholder.cel === fillStyle
          ? name3.placeholder.watch
          : null;
      if (!adjust) {
        if (name3.placeholder && name3.placeholder.watch) {
          name3.placeholder.watch.disconnect();
        }
        adjust = new MutationObserver(function (
          this: Dynamic,
          axis?: Dynamic,
          ..._extraArguments227: Dynamic[]
        ): Dynamic {
          for (var y2: Dynamic = 0; y2 < axis.length; y2++)
            for (
              var pose: Dynamic = axis[y2].addedNodes, lock: Dynamic = 0;
              lock < pose.length;
              lock++
            )
              if (
                pose[lock].nodeType === 1 &&
                !pose[lock].hasAttribute("data-dc-editor-overlay")
              ) {
                removeDropPlaceholder();
                return;
              }
        });
        adjust.observe(fillStyle, {
          childList: true,
        });
      }
      name3.placeholder = {
        el: bottom,
        cel: fillStyle,
        tid: innerHTML,
        n: position,
        at: ref,
        rect: top,
        watch: adjust,
      };
    }
  }
  function expireDropPlaceholder(
    this: Dynamic,
    ..._extraArguments228: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = hostDrag;
    if (!(!fillStyle || !fillStyle.placeholder || fillStyle.placeholder.cap)) {
      fillStyle.placeholder.cap = setTimeout(removeDropPlaceholder, count4);
    }
  }
  function removeDropPlaceholder(
    this: Dynamic,
    ..._extraArguments229: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = hostDrag;
    if (!(!fillStyle || !fillStyle.placeholder)) {
      if (fillStyle.placeholder.cap) {
        clearTimeout(fillStyle.placeholder.cap);
      }
      fillStyle.placeholder.watch.disconnect();
      if (fillStyle.placeholder.el.parentNode) {
        fillStyle.placeholder.el.parentNode.removeChild(
          fillStyle.placeholder.el,
        );
      }
      fillStyle.placeholder = null;
    }
  }
  function currentDraggedElement(
    this: Dynamic,
    ..._extraArguments230: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = (document as Dynamic).querySelector(
      "[data-dc-dragging]",
    );
    dragGesture.epoch =
      (fillStyle && parseInt(fillStyle.getAttribute("data-dc-dragging"), 10)) ||
      0;
    if (fillStyle) {
      dragGesture.el = fillStyle;
      return fillStyle;
    }
    var innerHTML: Dynamic = findTemplateInstances(
      String(dragGesture.tid),
      dragGesture.name,
    );
    if (innerHTML[0]) {
      dragGesture.el = innerHTML[0];
    } else {
      if (!dragGesture.el || !dragGesture.el.isConnected) {
        dragGesture.el = null;
      }
    }
    return dragGesture.el;
  }
  function currentDragGroup(
    this: Dynamic,
    ..._extraArguments231: Dynamic[]
  ): Dynamic {
    if (!dragGesture || !dragGesture.group) return null;
    var fillStyle: Dynamic = [];
    var innerHTML: Dynamic = {};
    var position: Dynamic;
    if (dragGesture.epoch > 0) {
      var shaft: Dynamic = (document as Dynamic).querySelectorAll(
        "[data-dc-drag-block]",
      );
      for (position = 0; position < shaft.length; position++)
        innerHTML[shaft[position].getAttribute("data-dc-drag-block")] =
          shaft[position];
    }
    for (position = 0; position < dragGesture.group.length; position++) {
      var tag: Dynamic =
        dragGesture.epoch > 0
          ? innerHTML[dragGesture.group[position].tid]
          : findTemplateInstances(
              String(dragGesture.group[position].tid),
              dragGesture.name,
            )[0];
      if (tag) {
        fillStyle.push(tag);
      }
    }
    return fillStyle;
  }
  function markDraggedElements(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments232: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = [fillStyle].concat(innerHTML || []),
        shaft: Dynamic = (document as Dynamic).querySelectorAll(
          "[data-dc-editor-dragging]",
        ),
        tag: Dynamic = 0;
      tag < shaft.length;
      tag++
    )
      if (
        position.indexOf(shaft[tag]) < 0 &&
        !shaft[tag].hasAttribute("data-dc-editor-overlay")
      ) {
        shaft[tag].removeAttribute("data-dc-editor-dragging");
        shaft[tag].style.removeProperty("pointer-events");
      }
    for (var rot: Dynamic = 0; rot < position.length; rot++) {
      var ref: Dynamic = position[rot];
      if (ref.getAttribute("data-dc-editor-dragging") == null) {
        ref.setAttribute("data-dc-editor-dragging", "");
      }
      if (
        ref.style.getPropertyValue("pointer-events") !== "none" ||
        ref.style.getPropertyPriority("pointer-events") !== "important"
      ) {
        ref.style.setProperty("pointer-events", "none", "important");
      }
    }
  }
  var count5: Dynamic = 500;
  function selectedDragFollowers(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments233: Dynamic[]
  ): Dynamic {
    if (
      selectedTemplateIds.length < 2 ||
      selectedComponentName !== position ||
      selectedTemplateIds.indexOf(innerHTML) < 0
    )
      return null;
    for (
      var shaft: Dynamic = [], tag: Dynamic = 0;
      tag < selectedTemplateIds.length && shaft.length < count5;
      tag++
    )
      if (selectedTemplateIds[tag] !== innerHTML) {
        var rot: Dynamic = findTemplateInstances(
          String(selectedTemplateIds[tag]),
          position,
        );
        if (rot.length === 1) {
          var ref: Dynamic = rot[0];
          if (
            !(
              ref === fillStyle ||
              ref.contains(fillStyle) ||
              fillStyle.contains(ref)
            ) &&
            !(
              !isRenderedElement(unwrapDisplayContentsHost(ref)) ||
              isUneditableElement(ref) ||
              isDeckManagedElement(ref) ||
              isRepeatedDirectiveElement(ref)
            )
          ) {
            var top: Dynamic = getComputedStyle(ref);
            var name3: Dynamic = top.position === "absolute";
            if (
              !(top.position === "fixed" || (!name3 && !value_Yo(ref, top)))
            ) {
              if (name3) {
                var bottom: Dynamic = authoredPositioning(ref, top);
                if (
                  bottom.bothX ||
                  bottom.bothY ||
                  bottom.useRight ||
                  bottom.useBottom
                )
                  continue;
              }
              shaft.push({
                tid: selectedTemplateIds[tag],
                el: ref,
                startRect:
                  unwrapDisplayContentsHost(ref).getBoundingClientRect(),
                startW: name3 ? 0 : value_Ho(top),
                startH: name3 ? 0 : value_Wo(ref, top),
                startLines: {
                  gridRowStart: top.gridRowStart,
                  gridRowEnd: top.gridRowEnd,
                  gridColumnStart: top.gridColumnStart,
                  gridColumnEnd: top.gridColumnEnd,
                },
                freezeStyle: undefined,
                absStyles: null,
              });
            }
          }
        }
      }
    shaft = shaft.filter(function (
      this: Dynamic,
      left?: Dynamic,
      ..._extraArguments234: Dynamic[]
    ): Dynamic {
      return !shaft.some(function (
        this: Dynamic,
        scope?: Dynamic,
        ..._extraArguments235: Dynamic[]
      ): Dynamic {
        return scope !== left && scope.el.contains(left.el);
      });
    });
    shaft.sort(function (
      this: Dynamic,
      left?: Dynamic,
      scope?: Dynamic,
      ..._extraArguments236: Dynamic[]
    ): Dynamic {
      return left.el.compareDocumentPosition(scope.el) & 2 ? 1 : -1;
    });
    return shaft.length ? shaft : null;
  }
  function resolveBreakoutFollowers(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments237: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = {},
        position: Dynamic = (document as Dynamic).querySelectorAll(
          "[data-dc-drag-follower]",
        ),
        shaft: Dynamic = 0;
      shaft < position.length;
      shaft++
    )
      innerHTML[position[shaft].getAttribute("data-dc-drag-follower")] =
        position[shaft];
    if (fillStyle.epoch === 0)
      for (var tag: Dynamic = 0; tag < fillStyle.brkFollowers.length; tag++) {
        var rot: Dynamic = fillStyle.brkFollowers[tag];
        if (!innerHTML[rot.tid]) {
          var ref: Dynamic = findTemplateInstances(
            String(rot.tid),
            fillStyle.name,
          );
          if (ref.length === 1) {
            innerHTML[rot.tid] = ref[0];
          }
        }
      }
    return innerHTML;
  }
  var count6: Dynamic = 200;
  var count7: Dynamic = 24;
  var items6: Dynamic = [
    "data-dc-tpl",
    "data-dc-dragging",
    "data-dc-editor-selected",
    "data-dc-editor-hover",
    "data-dc-editor-hover-stroke",
    "data-dc-editor-stroke",
    "data-dc-editor-patch",
    "data-dc-editor-dragging",
    "data-dc-drag-follower",
    "data-dc-drag-block",
    "name",
    "autoplay",
    "srcdoc",
  ];
  function liftableElementBox(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments238: Dynamic[]
  ): Dynamic {
    try {
      var position: Dynamic = unwrapDisplayContentsHost(fillStyle);
      var shaft: Dynamic = position.getBoundingClientRect();
      if (!(shaft.width >= 1 && shaft.height >= 1)) return null;
      var tag: Dynamic = getComputedStyle(position);
      var rot: Dynamic =
        (tag.transform && tag.transform !== "none") ||
        hasIndependentTransforms(tag);
      var ref: Dynamic = shaft;
      if (rot) {
        var top: Dynamic = position.getAttribute("style");
        position.style.setProperty("transform", "none", "important");
        position.style.setProperty("rotate", "none", "important");
        position.style.setProperty("scale", "none", "important");
        position.style.setProperty("translate", "none", "important");
        ref = position.getBoundingClientRect();
        if (top == null) {
          position.removeAttribute("style");
        } else {
          position.setAttribute("style", top);
        }
      }
      var name3: Dynamic =
        position.offsetWidth > 0 && ref.width > 0
          ? ref.width / position.offsetWidth
          : parentLayoutScale(position) || 1;
      var bottom: Dynamic =
        position.offsetWidth > 0 ? position.offsetWidth : ref.width / name3;
      var left: Dynamic =
        position.offsetHeight > 0 ? position.offsetHeight : ref.height / name3;
      var scope: Dynamic = "var(--dc-chrome-unit,1px)";
      var top2: Dynamic = (document as Dynamic).createElement("div");
      top2.setAttribute("data-dc-editor-overlay", "");
      top2.setAttribute("data-dc-editor-drag-proxy", "");
      top2.setAttribute("inert", "");
      top2.style.cssText =
        "position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;display:none;transform-origin:0 0;box-sizing:border-box;width:" +
        bottom +
        "px;height:" +
        left +
        "px;outline:calc(2*" +
        scope +
        ") solid " +
        CHROME_STROKE +
        ";outline-offset:calc(-1*" +
        scope +
        ");";
      var adjust: Dynamic = fillStyle.querySelectorAll("*");
      if (
        adjust.length < count6 &&
        !(innerHTML != null && Date.now() >= innerHTML) &&
        !hasCustomElementDescendant(fillStyle, adjust)
      ) {
        for (
          var axis: Dynamic = [],
            y2: Dynamic = cloneForDragProxy(fillStyle, axis),
            pose: Dynamic = Math.min(Date.now() + count7, innerHTML ?? 1 / 0),
            lock: Dynamic = 0;
          lock < axis.length;
          lock++
        )
          if (lock === 0 || axis[lock][2] || Date.now() < pose) {
            copyComputedStyle(axis[lock][0], axis[lock][1]);
          }
        y2.style.setProperty("position", "static", "important");
        y2.style.setProperty("margin", "0", "important");
        y2.style.setProperty("pointer-events", "none", "important");
        if (rot) {
          top2.style.outline = "none";
        } else {
          top2.style.background = ancestorBackgroundColor(position);
          top2.style.borderRadius = tag.borderRadius;
        }
        top2.appendChild(y2);
      } else {
        top2.style.cssText +=
          "outline:none;border-radius:calc(4*" +
          scope +
          ");border:calc(1.5*" +
          scope +
          ") dashed " +
          CHROME_STROKE +
          ";background:color-mix(in srgb," +
          CHROME_STROKE +
          " 8%,transparent);";
        if (rot) {
          top2.style.width = shaft.width / name3 + "px";
          top2.style.height = shaft.height / name3 + "px";
          ref = shaft;
        }
      }
      ensureOverlayRoot().appendChild(top2);
      return {
        wrap: top2,
        s: name3,
        ox: ref.left - shaft.left,
        oy: ref.top - shaft.top,
      };
    } catch {
      return null;
    }
  }
  function ancestorBackgroundColor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments239: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = fillStyle.parentElement;
      innerHTML;
      innerHTML = innerHTML.parentElement
    ) {
      var position: Dynamic = getComputedStyle(innerHTML).backgroundColor || "";
      var shaft: Dynamic =
        !position ||
        position === "transparent" ||
        (position.indexOf("rgba(") === 0 && position.slice(-4) === ", 0)") ||
        position.slice(-4) === "/ 0)";
      if (!shaft) return position;
    }
    return "#fff";
  }
  var value_Tf: Dynamic =
    /^rgba?\((\d{1,3}(?:\.\d+)?), (\d{1,3}(?:\.\d+)?), (\d{1,3}(?:\.\d+)?)(?:, (\d(?:\.\d+)?|\.\d+))?\)$/;
  function parseRgbaColor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments240: Dynamic[]
  ): Dynamic {
    if (fillStyle === "transparent") return [0, 0, 0, 0];
    var innerHTML: Dynamic = value_Tf.exec(
      typeof fillStyle == "string" ? fillStyle : "",
    );
    return innerHTML
      ? [
          +innerHTML[1],
          +innerHTML[2],
          +innerHTML[3],
          innerHTML[4] === undefined ? 1 : +innerHTML[4],
        ]
      : null;
  }
  var value_Mf: Dynamic =
    /^(img|video|canvas|svg|picture|iframe|embed|object|input|textarea|select|button|meter|progress)$/i;
  var items7: Dynamic = ["Top", "Right", "Bottom", "Left"];
  function hasVisiblePaint(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments241: Dynamic[]
  ): Dynamic {
    if (value_Mf.test(fillStyle.tagName || "")) return true;
    for (
      var innerHTML: Dynamic = fillStyle.firstChild;
      innerHTML;
      innerHTML = innerHTML.nextSibling
    )
      if (innerHTML.nodeType === 3 && /\S/.test(innerHTML.data)) return true;
    var position: Dynamic = getComputedStyle(fillStyle);
    if (position.backgroundImage && position.backgroundImage !== "none")
      return true;
    var shaft: Dynamic = parseRgbaColor(
      normalizeColor(position.backgroundColor || "transparent"),
    );
    if (shaft === null || shaft[3] > 0.02) return true;
    for (var tag: Dynamic = 0; tag < items7.length; tag++)
      if (
        !(
          !(parseFloat(position["border" + items7[tag] + "Width"]) > 0) ||
          position["border" + items7[tag] + "Style"] === "none"
        )
      ) {
        var rot: Dynamic = parseRgbaColor(
          normalizeColor(
            position["border" + items7[tag] + "Color"] || "transparent",
          ),
        );
        if (rot === null || rot[3] > 0.02) return true;
      }
    return false;
  }
  function isElementUnoccluded(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments242: Dynamic[]
  ): Dynamic {
    var tag: Dynamic = fillStyle.getBoundingClientRect();
    var rot: Dynamic = (document as Dynamic).body;
    if (
      typeof (document as Dynamic).elementsFromPoint != "function" ||
      !rot ||
      !rot.hasAttribute("data-dc-editor-on") ||
      rot.getAttribute("data-dc-editor-tool") === "interact"
    )
      return true;
    var ref: Dynamic = Math.max(tag.left, 0);
    var top: Dynamic = Math.min(tag.right, (window as Dynamic).innerWidth);
    var name3: Dynamic = Math.max(tag.top, 0);
    var bottom: Dynamic = Math.min(tag.bottom, (window as Dynamic).innerHeight);
    if (!(top > ref && bottom > name3)) return true;
    for (
      var left: Dynamic = [
          [(ref + top) / 2, (name3 + bottom) / 2],
          [ref + Math.min(4, (top - ref) / 4), (name3 + bottom) / 2],
        ],
        scope: Dynamic = 0;
      scope < left.length;
      scope++
    ) {
      for (
        var top2: Dynamic = (document as Dynamic).elementsFromPoint(
            left[scope][0],
            left[scope][1],
          ),
          adjust: Dynamic = false,
          axis: Dynamic = false,
          y2: Dynamic = 0,
          pose: Dynamic = 0;
        pose < top2.length;
        pose++
      ) {
        var lock: Dynamic = top2[pose];
        if (lock === fillStyle) {
          adjust = true;
        }
        if (lock === innerHTML) {
          if (!adjust) return true;
          axis = true;
          break;
        }
        if (position.indexOf(lock) >= 0) {
          y2++;
        }
        if (
          !(
            lock === fillStyle ||
            fillStyle.contains(lock) ||
            lock.contains(fillStyle)
          ) &&
          !(
            lock.closest &&
            lock.closest(
              "[data-dc-editor-overlay],[data-dc-editor-overlay-root],[data-omelette-chrome],[data-omelette-injected]",
            )
          ) &&
          hasVisiblePaint(lock)
        )
          return true;
      }
      if (!adjust || y2 !== position.length || (!axis && !shaft)) return true;
    }
    return false;
  }
  function backdropPaintLayers(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments243: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = [],
        position: Dynamic = [],
        shaft: Dynamic = null,
        tag: Dynamic = null,
        rot: Dynamic = false,
        ref: Dynamic = fillStyle;
      ref && ref.nodeType === 1;
      ref = ref.parentElement
    ) {
      var top: Dynamic = getComputedStyle(ref);
      if (
        (top.opacity !== "" && parseFloat(top.opacity) < 1) ||
        (top.filter && top.filter !== "none") ||
        (top.mixBlendMode && top.mixBlendMode !== "normal") ||
        (top.maskImage && top.maskImage !== "none") ||
        (top.webkitMaskImage && top.webkitMaskImage !== "none")
      )
        return null;
      if (shaft !== null) {
        if (ref === (document as Dynamic).documentElement) {
          var name3: Dynamic = parseRgbaColor(
            normalizeColor(top.backgroundColor || "transparent"),
          );
          rot =
            (top.backgroundImage && top.backgroundImage !== "none") ||
            name3 === null ||
            name3[3] > 0.02;
        }
        continue;
      }
      if (
        (top.backgroundImage && top.backgroundImage !== "none") ||
        (top.backdropFilter && top.backdropFilter !== "none") ||
        (top.webkitBackdropFilter && top.webkitBackdropFilter !== "none")
      )
        return null;
      var bottom: Dynamic = parseRgbaColor(
        normalizeColor(top.backgroundColor || "transparent"),
      );
      if (bottom === null) return null;
      if (bottom[3] >= 0.98) {
        for (
          var left: Dynamic = bottom[0],
            scope: Dynamic = bottom[1],
            top2: Dynamic = bottom[2],
            adjust: Dynamic = innerHTML.length - 1;
          adjust >= 0;
          adjust--
        ) {
          var axis: Dynamic = innerHTML[adjust];
          var y: Dynamic = axis[3];
          left = y * axis[0] + (1 - y) * left;
          scope = y * axis[1] + (1 - y) * scope;
          top2 = y * axis[2] + (1 - y) * top2;
        }
        shaft =
          "rgb(" +
          Math.round(left) +
          ", " +
          Math.round(scope) +
          ", " +
          Math.round(top2) +
          ")";
        tag = ref;
      } else if (bottom[3] > 0.02) {
        innerHTML.push(bottom);
        position.push(ref);
      }
    }
    if (shaft === null) return null;
    var pose: Dynamic =
      tag === (document as Dynamic).documentElement ||
      (tag === (document as Dynamic).body && !rot);
    return isElementUnoccluded(fillStyle, tag, position, pose) ? null : shaft;
  }
  function textGroundColors(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments244: Dynamic[]
  ): Dynamic {
    if (fillStyle.namespaceURI === "http://www.w3.org/2000/svg") return null;
    var position: Dynamic = backdropPaintLayers(fillStyle);
    return position === null
      ? null
      : {
          behind: position,
          ink: normalizeColor(innerHTML.webkitTextFillColor || innerHTML.color),
        };
  }
  function hasCustomElementDescendant(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments245: Dynamic[]
  ): Dynamic {
    for (var position: Dynamic = -1; position < innerHTML.length; position++) {
      var shaft: Dynamic = position < 0 ? fillStyle : innerHTML[position];
      var tag: Dynamic = shaft.localName || "";
      var rot: Dynamic = shaft.getAttribute("is");
      if (
        shaft.shadowRoot ||
        ((window as Dynamic).customElements &&
          ((tag.indexOf("-") > 0 && customElements.get(tag)) ||
            (rot && customElements.get(rot))))
      )
        return true;
    }
    return false;
  }
  function cloneForDragProxy(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments246: Dynamic[]
  ): Dynamic {
    if (fillStyle.nodeType !== 1) return fillStyle.cloneNode(false);
    var position: Dynamic = fillStyle.localName || "";
    var shaft: Dynamic =
      position.indexOf("-") >= 0 || position.indexOf(":") >= 0;
    if (
      position === "style" ||
      position === "link" ||
      position === "script" ||
      position === "template" ||
      position === "noscript" ||
      position === "meta" ||
      position === "base"
    )
      return null;
    for (
      var tag: Dynamic = shaft
          ? (document as Dynamic).createElement("span")
          : (document as Dynamic).createElementNS(
              fillStyle.namespaceURI,
              position,
            ),
        rot: Dynamic = 0;
      rot < fillStyle.attributes.length;
      rot++
    ) {
      var ref: Dynamic = fillStyle.attributes[rot];
      var top: Dynamic = ref.name.toLowerCase();
      if (
        !(
          top === "is" ||
          top === "autofocus" ||
          top.indexOf("on") === 0 ||
          items6.indexOf(top) >= 0
        )
      )
        try {
          tag.setAttributeNS(ref.namespaceURI, ref.name, ref.value);
        } catch {}
    }
    if (
      position === "iframe" ||
      position === "video" ||
      position === "audio" ||
      position === "source" ||
      position === "embed"
    ) {
      tag.removeAttribute("src");
    }
    if (position === "object") {
      tag.removeAttribute("data");
    }
    innerHTML.push([fillStyle, tag, shaft]);
    for (
      var name3: Dynamic = fillStyle.firstChild;
      name3;
      name3 = name3.nextSibling
    ) {
      var bottom: Dynamic = cloneForDragProxy(name3, innerHTML);
      if (bottom) {
        tag.appendChild(bottom);
      }
    }
    return tag;
  }
  function copyComputedStyle(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments247: Dynamic[]
  ): Dynamic {
    if (innerHTML.style) {
      for (
        var position: Dynamic = getComputedStyle(fillStyle),
          shaft: Dynamic = "",
          tag: Dynamic = 0;
        tag < position.length;
        tag++
      )
        shaft +=
          position[tag] + ":" + position.getPropertyValue(position[tag]) + ";";
      innerHTML.style.cssText = shaft;
    }
  }
  function positionDragProxy(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments248: Dynamic[]
  ): Dynamic {
    var position: Dynamic = dragGesture.proxy;
    if (position) {
      position.wrap.style.display = "block";
      position.wrap.style.opacity = innerHTML ? "0.4" : "0.85";
      position.wrap.style.transform =
        "translate(" +
        (fillStyle.clientX - dragGesture.grabDx + position.ox) +
        "px," +
        (fillStyle.clientY - dragGesture.grabDy + position.oy) +
        "px) scale(" +
        position.s +
        ")";
      for (
        var shaft: Dynamic = 0;
        shaft < (dragGesture.groupProxies || []).length;
        shaft++
      ) {
        var tag: Dynamic = dragGesture.groupProxies[shaft];
        tag.p.wrap.style.display = tag.out ? "none" : "block";
        tag.p.wrap.style.opacity = position.wrap.style.opacity;
        tag.p.wrap.style.transform =
          "translate(" +
          (fillStyle.clientX - dragGesture.grabDx + tag.dx + tag.p.ox) +
          "px," +
          (fillStyle.clientY - dragGesture.grabDy + tag.dy + tag.p.oy) +
          "px) scale(" +
          tag.p.s +
          ")";
      }
      dragGesture.parked = !dragGesture.alt;
      var rot: Dynamic = dragGesture.alt ? "copy" : "move";
      if (
        (document as Dynamic).body.getAttribute("data-dc-editor-proxy") !== rot
      ) {
        (document as Dynamic).body.setAttribute("data-dc-editor-proxy", rot);
      }
    }
  }
  function hideDragProxy(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments249: Dynamic[]
  ): Dynamic {
    if (fillStyle.proxy) {
      fillStyle.proxy.wrap.style.display = "none";
    }
    for (
      var innerHTML: Dynamic = 0;
      innerHTML < (fillStyle.groupProxies || []).length;
      innerHTML++
    )
      fillStyle.groupProxies[innerHTML].p.wrap.style.display = "none";
    fillStyle.parked = false;
    if ((document as Dynamic).body.hasAttribute("data-dc-editor-proxy")) {
      (document as Dynamic).body.removeAttribute("data-dc-editor-proxy");
    }
  }
  function refreshParkedDrag(
    this: Dynamic,
    ..._extraArguments250: Dynamic[]
  ): Dynamic {
    if (!(!dragGesture || !dragGesture.parked)) {
      var fillStyle: Dynamic = currentDraggedElement();
      var innerHTML: Dynamic = currentDragGroup();
      if (fillStyle) {
        markDraggedElements(fillStyle, innerHTML);
      }
      if (
        !(
          !dragGesture.flowBox ||
          !dragGesture.flowBox.isConnected ||
          !flowOverlay ||
          flowOverlay.style.display !== "block"
        ) &&
        fillStyle &&
        fillStyle.parentElement === dragGesture.flowBox
      ) {
        paintFlowInsertion(dragGesture.flowBox, fillStyle, null, innerHTML);
      }
    }
  }
  function emitMovePreview(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments251: Dynamic[]
  ): Dynamic {
    var position: Dynamic = "flow|" + fillStyle.n + "|" + fillStyle.epoch;
    if (
      !(
        dragGesture.previewKey === position &&
        dragGesture.previewBox === dragGesture.flowBox
      )
    ) {
      dragGesture.previewKey = position;
      dragGesture.previewBox = dragGesture.flowBox;
      dragGesture.previewActive = true;
      pendingStyleEvents = {};
      emitEditorEvent({
        type: "movePreview",
        tid: dragGesture.tid,
        name: dragGesture.name,
        gestureKey: dragGesture.gestureKey,
        targetTid: fillStyle.targetTid,
        position: fillStyle.position,
        clearPositioning: innerHTML,
        epoch: fillStyle.epoch,
        freezeStyle: dragGesture.freezeStyle || undefined,
        group: dragGesture.group || undefined,
        markFollowers: dragGesture.brkFollowers
          ? dragGesture.brkFollowers.map(function (
              this: Dynamic,
              shaft?: Dynamic,
              ..._extraArguments252: Dynamic[]
            ): Dynamic {
              return shaft.tid;
            })
          : undefined,
      });
    }
  }
  function inheritedTextStyle(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments253: Dynamic[]
  ): Dynamic {
    if (
      (fillStyle.textContent || "").trim() === "" &&
      fillStyle.tagName !== "LI" &&
      getComputedStyle(fillStyle).display !== "list-item"
    )
      return null;
    var innerHTML: Dynamic = withTemporaryClone(
      fillStyle,
      function (
        this: Dynamic,
        position?: Dynamic,
        shaft?: Dynamic,
        ..._extraArguments254: Dynamic[]
      ): Dynamic {
        return value__o(fillStyle, shaft, items2);
      },
    );
    return innerHTML === undefined
      ? value__o(fillStyle, getComputedStyle(fillStyle), [
          "font-size",
          "font-family",
        ])
      : innerHTML;
  }
  var value_Kf: Dynamic =
    /^(INPUT|SELECT|TEXTAREA|OPTION|IMG|IFRAME|VIDEO|AUDIO|CANVAS|OBJECT|EMBED)$/;
  function withTemporaryClone(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments255: Dynamic[]
  ): Dynamic {
    var position: Dynamic = fillStyle.parentNode;
    if (
      !(
        !position ||
        value_Kf.test(fillStyle.tagName) ||
        fillStyle.tagName.indexOf("-") >= 0
      )
    ) {
      var shaft: Dynamic = fillStyle.cloneNode(false);
      var tag: Dynamic = null;
      shaft.setAttribute("data-dc-editor-overlay", "");
      if (fillStyle.firstChild) {
        shaft.appendChild((document as Dynamic).createTextNode("x"));
      }
      shaft.style.setProperty("transition", "none", "important");
      shaft.style.setProperty("animation", "none", "important");
      try {
        position.insertBefore(shaft, fillStyle);
        tag = innerHTML(shaft, getComputedStyle(shaft));
      } catch {
        tag = null;
      }
      if (shaft.parentNode) {
        shaft.parentNode.removeChild(shaft);
      }
      return tag;
    }
  }
  function cancelMovePreview(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments256: Dynamic[]
  ): Dynamic {
    if (fillStyle && fillStyle.previewActive) {
      fillStyle.previewActive = false;
      fillStyle.previewKey = "";
      pendingStyleEvents = {};
      emitEditorEvent({
        type: "movePreviewCancel",
        tid: fillStyle.tid,
        name: fillStyle.name,
        gestureKey: fillStyle.gestureKey,
      });
    }
  }
  var patchStylesheet: Dynamic = null;
  var stylePatches: Dynamic = {};
  var index7: Dynamic = 0;
  var value_ca: Dynamic = false;
  var heldStyle: Dynamic = null;
  var value_Vl: Dynamic = false;
  function patchElementStyles(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments257: Dynamic[]
  ): Dynamic {
    if (innerHTML.length) {
      var shaft: Dynamic = stylePatches[fillStyle];
      if (!shaft) {
        if (!patchStylesheet) {
          var tag: Dynamic = (document as Dynamic).createElement("style");
          tag.setAttribute("data-dc-editor-overlay", "");
          ensureOverlayRoot().appendChild(tag);
          patchStylesheet = tag.sheet;
        }
        var rot: Dynamic = "p" + ++index7;
        patchStylesheet.insertRule(
          '[data-dc-editor-patch="' + rot + '"]{}',
          patchStylesheet.cssRules.length,
        );
        shaft = stylePatches[fillStyle] = {
          id: rot,
          style:
            patchStylesheet.cssRules[patchStylesheet.cssRules.length - 1].style,
        };
      }
      for (var ref: Dynamic = 0; ref < innerHTML.length; ref++)
        if (innerHTML[ref].getAttribute("data-dc-editor-patch") !== shaft.id) {
          innerHTML[ref].setAttribute("data-dc-editor-patch", shaft.id);
        }
      for (var top in position)
        shaft.style.setProperty(
          top,
          position[top] == null ? "" : String(position[top]),
          "important",
        );
    }
  }
  function hasStylePatch(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments258: Dynamic[]
  ): Dynamic {
    for (var innerHTML in stylePatches)
      if (stylePatches[innerHTML].id === fillStyle) return true;
    return false;
  }
  function clearStylePatches(
    this: Dynamic,
    ..._extraArguments259: Dynamic[]
  ): Dynamic {
    value_ca = false;
    if (!!index7) {
      index7 = 0;
      stylePatches = {};
      if (patchStylesheet)
        for (; patchStylesheet.cssRules.length; ) patchStylesheet.deleteRule(0);
      clearAttributeEverywhere("data-dc-editor-patch");
    }
  }
  function isRootComponent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments260: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic =
      (window as Dynamic).__dcRootName && (window as Dynamic).__dcRootName();
    return !!innerHTML && fillStyle === innerHTML;
  }
  var value_Ul: Dynamic = null;
  var stylesheetRefreshPending: Dynamic = false;
  function onStylesheetMutation(
    this: Dynamic,
    ..._extraArguments261: Dynamic[]
  ): Dynamic {
    if (!stylesheetRefreshPending) {
      stylesheetRefreshPending = true;
      requestAnimationFrame(function (
        this: Dynamic,
        ..._extraArguments262: Dynamic[]
      ): Dynamic {
        stylesheetRefreshPending = false;
        if (enabled && authoredStylesheetText() !== value_Ul) {
          refreshEditorBackdrop();
        }
      });
    }
  }
  function authoredStylesheetText(
    this: Dynamic,
    ..._extraArguments263: Dynamic[]
  ): Dynamic {
    for (
      var fillStyle: Dynamic = "",
        innerHTML: Dynamic = (document as Dynamic).head
          ? (document as Dynamic).head.querySelectorAll("style")
          : [],
        position: Dynamic = 0;
      position < innerHTML.length;
      position++
    )
      if (innerHTML[position] !== editorStylesheet) {
        fillStyle += innerHTML[position].textContent + " ";
      }
    return fillStyle;
  }
  function refreshEditorBackdrop(
    this: Dynamic,
    ..._extraArguments264: Dynamic[]
  ): Dynamic {
    try {
      value_Ul = authoredStylesheetText();
      var fillStyle: Dynamic =
        enabled &&
        !(document as Dynamic).body.hasAttribute("data-dc-capturing");
      if (fillStyle) {
        (document as Dynamic).body.setAttribute("data-dc-capturing", "");
      }
      var innerHTML: Dynamic = "";
      try {
        for (
          var position: Dynamic = [
              (document as Dynamic).body,
              (document as Dynamic).documentElement,
            ],
            shaft: Dynamic = 0;
          shaft < position.length && !innerHTML;
          shaft++
        ) {
          var tag: Dynamic = getComputedStyle(position[shaft]);
          var rot: Dynamic =
            (tag.backgroundColor &&
              tag.backgroundColor !== "transparent" &&
              tag.backgroundColor !== "rgba(0, 0, 0, 0)") ||
            (tag.backgroundImage && tag.backgroundImage !== "none");
          if (rot) {
            innerHTML =
              tag.background ||
              (tag.backgroundImage !== "none"
                ? tag.backgroundImage + " "
                : "") + (tag.backgroundColor || "");
          }
        }
      } finally {
        if (fillStyle) {
          (document as Dynamic).body.removeAttribute("data-dc-capturing");
        }
      }
      if (innerHTML) {
        (document as Dynamic).documentElement.style.setProperty(
          "--dc-editor-host-bg",
          innerHTML,
        );
      } else {
        (document as Dynamic).documentElement.style.removeProperty(
          "--dc-editor-host-bg",
        );
      }
      var ref: Dynamic = getComputedStyle((document as Dynamic).body);
      var top: Dynamic = 0;
      [
        "marginTop",
        "marginBottom",
        "paddingTop",
        "paddingBottom",
        "borderTopWidth",
        "borderBottomWidth",
      ].forEach(function (
        this: Dynamic,
        name3?: Dynamic,
        ..._extraArguments265: Dynamic[]
      ): Dynamic {
        top += parseFloat(ref[name3]) || 0;
      });
      (document as Dynamic).documentElement.style.setProperty(
        "--dc-editor-host-vpad",
        top + "px",
      );
    } catch {}
  }
  function restoreOriginalTextNodes(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments266: Dynamic[]
  ): Dynamic {
    var position: Dynamic = leftTextCopy;
    return !position || position.el !== fillStyle
      ? innerHTML
      : ((leftTextCopy = null), position.origNodes);
  }
  function serializeOriginalTextNodes(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments267: Dynamic[]
  ): Dynamic {
    if (innerHTML === position) return fillStyle.innerHTML;
    for (
      var shaft: Dynamic = (document as Dynamic).createElement("div"),
        tag: Dynamic = 0;
      tag < innerHTML.length;
      tag++
    )
      shaft.appendChild(innerHTML[tag].cloneNode(true));
    for (
      var rot: Dynamic = shaft.querySelectorAll("[data-dc-tpl]"),
        ref: Dynamic = 0;
      ref < rot.length;
      ref++
    )
      rot[ref].removeAttribute("data-dc-tpl");
    return shaft.innerHTML;
  }
  function restoreTextCopy(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments268: Dynamic[]
  ): Dynamic {
    try {
      fillStyle.el.innerHTML = "";
      for (
        var innerHTML: Dynamic = 0;
        innerHTML < fillStyle.origNodes.length;
        innerHTML++
      )
        fillStyle.el.appendChild(fillStyle.origNodes[innerHTML]);
    } catch {}
  }
  function dropLeftCopy(
    this: Dynamic,
    ..._extraArguments269: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = leftTextCopy;
    leftTextCopy = null;
    if (
      fillStyle &&
      fillStyle.el.isConnected &&
      !(
        textEdit &&
        (textEdit.el === fillStyle.el || textEdit.svg === fillStyle.el)
      )
    ) {
      restoreTextCopy(fillStyle);
    }
  }
  function afterPush(this: Dynamic, ..._extraArguments270: Dynamic[]): Dynamic {
    items4 = [];
    if (leftTextCopy) {
      var fillStyle: Dynamic = leftTextCopy;
      var innerHTML: Dynamic = null;
      if (
        !fillStyle.el.isConnected ||
        (textEdit &&
          (textEdit.el === fillStyle.el || textEdit.svg === fillStyle.el))
      )
        leftTextCopy = null;
      else {
        try {
          innerHTML = value_Oo(
            (window as Dynamic).__dcAnnotatedTemplate(fillStyle.name),
            fillStyle.tid,
          );
        } catch {}
        if (innerHTML !== null && innerHTML === fillStyle.content) {
          leftTextCopy = null;
          restoreTextCopy(fillStyle);
        }
      }
    }
    selectionInstanceCache = {
      key: "",
      els: [],
    };
    if (index7) {
      value_ca = true;
      requestAnimationFrame(function (
        this: Dynamic,
        ..._extraArguments271: Dynamic[]
      ): Dynamic {
        requestAnimationFrame(function (
          this: Dynamic,
          ..._extraArguments272: Dynamic[]
        ): Dynamic {
          if (value_ca) {
            reapplyGesturePatches();
          }
        });
      });
    }
  }
  function reapplyGesturePatches(
    this: Dynamic,
    ..._extraArguments273: Dynamic[]
  ): Dynamic {
    clearStylePatches();
    if (transformGesture && transformGesture.lastPatch) {
      patchElementStyles(
        transformGesture.gestureKey,
        transformGesture.els && transformGesture.els.length
          ? transformGesture.els
          : [transformGesture.el],
        transformGesture.lastPatch,
      );
    }
    if (transformGesture && transformGesture.group) {
      reapplyGroupTransforms(transformGesture);
    }
    if (dragGesture && dragGesture.lastPatch) {
      var fillStyle: Dynamic = currentDraggedElement();
      if (fillStyle) {
        patchElementStyles(
          dragGesture.gestureKey,
          [fillStyle],
          dragGesture.lastPatch,
        );
      }
    }
    if (dragGesture && dragGesture.followers) {
      reapplyFollowerStyles(dragGesture);
    }
    if (value_Vl && heldStyle) {
      reapplyHeldStyles();
    }
  }
  function reapplyHeldStyles(
    this: Dynamic,
    ..._extraArguments274: Dynamic[]
  ): Dynamic {
    for (
      var fillStyle: Dynamic = 0;
      fillStyle < heldStyle.tids.length;
      fillStyle++
    )
      patchElementStyles(
        heldStyle.name + "|" + heldStyle.tids[fillStyle],
        findTemplateInstances(
          String(heldStyle.tids[fillStyle]),
          heldStyle.name,
        ),
        heldStyle.styles,
      );
  }
  var stylePreviewPending: Dynamic = false;
  var pendingStyleEvents: Dynamic = {};
  function queueStylePreview(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments275: Dynamic[]
  ): Dynamic {
    pendingStyleEvents[String(fillStyle.name) + "|" + fillStyle.tid] =
      fillStyle;
    if (!stylePreviewPending) {
      stylePreviewPending = true;
      requestAnimationFrame(function (
        this: Dynamic,
        ..._extraArguments276: Dynamic[]
      ): Dynamic {
        stylePreviewPending = false;
        var innerHTML: Dynamic = pendingStyleEvents;
        pendingStyleEvents = {};
        for (var position in innerHTML) emitEditorEvent(innerHTML[position]);
      });
    }
  }
  function autoDimensions(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments277: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = null;
    try {
      innerHTML = fillStyle.computedStyleMap
        ? fillStyle.computedStyleMap()
        : null;
    } catch {}
    var position: Dynamic = function (
      this: Dynamic,
      shaft?: Dynamic,
      ..._extraArguments278: Dynamic[]
    ): Dynamic {
      if (innerHTML) return String(innerHTML.get(shaft)) === "auto";
      var tag: Dynamic = fillStyle.style[shaft];
      if (tag) return value_jl.test(tag);
      var rot: Dynamic = stylesheetProperty(fillStyle, shaft);
      return rot === "auto" || (!rot && !fillStyle.getAttribute(shaft));
    };
    return {
      w: position("width"),
      h: position("height"),
    };
  }
  var value_jl: Dynamic = /^(auto|initial|unset|revert|revert-layer|inherit)$/;
  function stylesheetProperty(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments279: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = "", shaft: Dynamic = 0, tag: Dynamic = 0;
      shaft < (document as Dynamic).styleSheets.length;
      shaft++
    ) {
      var rot: Dynamic = null;
      try {
        rot = (document as Dynamic).styleSheets[shaft].cssRules;
      } catch {}
      for (
        var ref: Dynamic = 0;
        rot && ref < rot.length && tag < 4e3;
        ref++, tag++
      ) {
        var top: Dynamic = rot[ref];
        var name3: Dynamic =
          top.style && top.selectorText ? top.style[innerHTML] : "";
        try {
          if (name3 && fillStyle.matches(top.selectorText)) {
            if (value_jl.test(name3)) return "auto";
            position = "set";
          }
        } catch {}
      }
    }
    return position;
  }
  function authoredPositioning(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments280: Dynamic[]
  ): Dynamic {
    var position: Dynamic = fillStyle.style;
    var shaft: Dynamic = null;
    try {
      shaft = fillStyle.computedStyleMap ? fillStyle.computedStyleMap() : null;
    } catch {}
    function tag(
      this: Dynamic,
      bottom?: Dynamic,
      ..._extraArguments281: Dynamic[]
    ): Dynamic {
      var left: Dynamic = shaft ? shaft.get(bottom) : position[bottom];
      left = left == null ? "" : String(left);
      return left !== "auto" ? left : "";
    }
    var rot: Dynamic = tag("left");
    var ref: Dynamic = tag("right");
    var top: Dynamic = tag("top");
    var name3: Dynamic = tag("bottom");
    return {
      useRight: !!ref && !rot,
      useBottom: !!name3 && !top,
      bothX: !!rot && !!ref,
      bothY: !!top && !!name3,
      startLeft: parseFloat(innerHTML.left) || 0,
      startTop: parseFloat(innerHTML.top) || 0,
      startRight: parseFloat(innerHTML.right) || 0,
      startBottom: parseFloat(innerHTML.bottom) || 0,
    };
  }
  function isRepeatedDirectiveElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments282: Dynamic[]
  ): Dynamic {
    if (
      !directiveMap ||
      !fillStyle ||
      componentScopeName(fillStyle) !== directiveComponentName
    )
      return false;
    var innerHTML: Dynamic = null;
    for (var position in directiveMap) {
      var shaft: Dynamic = directiveMap[position];
      if (shaft && shaft.kind === "for" && shaft.kids) {
        if (!innerHTML) {
          innerHTML = {};
        }
        for (var tag: Dynamic = 0; tag < shaft.kids.length; tag++)
          innerHTML[shaft.kids[tag]] = true;
      }
    }
    if (!innerHTML) return false;
    for (var rot: Dynamic = fillStyle; rot && rot.getAttribute; ) {
      var ref: Dynamic = rot.getAttribute("data-dc-tpl");
      if (ref != null && innerHTML[parseInt(ref, 10)]) return true;
      rot = rot.parentElement;
    }
    return false;
  }
  function enclosingDirectiveId(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments283: Dynamic[]
  ): Dynamic {
    if (!directiveMap || (innerHTML || null) !== directiveComponentName)
      return null;
    var position: Dynamic = null;
    for (var shaft in directiveMap) {
      var tag: Dynamic = directiveMap[shaft];
      if (
        tag &&
        tag.kids &&
        tag.kids.indexOf(fillStyle) >= 0 &&
        (position === null || +shaft > +position)
      ) {
        position = shaft;
      }
    }
    return position;
  }
  function connectedFollowerInstances(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments284: Dynamic[]
  ): Dynamic {
    return fillStyle.el && fillStyle.el.isConnected
      ? [fillStyle.el]
      : findTemplateInstances(String(fillStyle.tid), innerHTML);
  }
  function reapplyFollowerStyles(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments285: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 0;
      innerHTML < fillStyle.followers.length;
      innerHTML++
    ) {
      var position: Dynamic = fillStyle.followers[innerHTML];
      if (position.lastPatch) {
        patchElementStyles(
          fillStyle.gestureKey + ":" + position.tid,
          connectedFollowerInstances(position, fillStyle.name),
          position.lastPatch,
        );
      }
    }
  }
  function revertFollowerStyles(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments286: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 0;
      innerHTML < fillStyle.followers.length;
      innerHTML++
    )
      emitEditorEvent({
        type: "styleRevert",
        tid: fillStyle.followers[innerHTML].tid,
        name: fillStyle.name,
        gestureKey: fillStyle.gestureKey,
        keepUndo: true,
        follower: true,
      });
  }
  function dragExitPayload(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments287: Dynamic[]
  ): Dynamic {
    var position: Dynamic = fillStyle.lift;
    return {
      gestureKey: fillStyle.gestureKey,
      tids: [fillStyle.tid],
      name: fillStyle.name,
      alt: !!innerHTML,
      w: position.w,
      h: position.h,
      ew: position.ew,
      eh: position.eh,
      ox: position.ox,
      oy: position.oy,
      gx: Math.round(fillStyle.grabDx / position.s),
      gy: Math.round(fillStyle.grabDy / position.s),
    };
  }
  function exitDragGesture(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments288: Dynamic[]
  ): Dynamic {
    if (!(!dragGesture || dragGesture.exited || dragGesture.followers)) {
      dragGesture.exited = true;
      cancelMovePreview(dragGesture);
      if (dragGesture.brkFollowers) {
        var innerHTML: Dynamic = currentDraggedElement();
        if (innerHTML) {
          markDraggedElements(innerHTML);
        }
      }
      var position: Dynamic = dragExitPayload(dragGesture, fillStyle);
      position.type = "dragExit";
      emitEditorEvent(position);
      clearFlowOverlay();
      hideParentPlacementBounds();
      hideDragProxy(dragGesture);
      if (placementOverlay) {
        placementOverlay.box.style.display = "none";
      }
      dragGesture.commit = null;
    }
  }
  function finishDragGesture(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments289: Dynamic[]
  ): Dynamic {
    if (dragGesture) {
      var innerHTML: Dynamic = dragGesture;
      dragGesture = null;
      if (snapGuides) {
        snapGuides = null;
        onContentMutation();
      }
      releasePointer();
      emitEditorEvent({
        type: "dragState",
        live: false,
        gestureKey: innerHTML.gestureKey,
      });
      if (innerHTML.exited && !innerHTML.droppedOut) {
        emitEditorEvent({
          type: "dragCancel",
          gestureKey: innerHTML.gestureKey,
        });
      }
      pendingStyleEvents = {};
      hideParentPlacementBounds();
      clearFlowOverlay();
      for (
        var position: Dynamic = (document as Dynamic).querySelectorAll(
            "[data-dc-editor-dragging]",
          ),
          shaft: Dynamic = 0;
        shaft < position.length;
        shaft++
      )
        position[shaft].style.removeProperty("pointer-events");
      clearAttributeEverywhere("data-dc-editor-dragging");
      clearAttributeEverywhere("data-dc-drag-parent");
      clearAttributeEverywhere("data-dc-drag-follower");
      clearAttributeEverywhere("data-dc-drag-block");
      (document as Dynamic).body.removeAttribute("data-dc-editor-brk");
      if (innerHTML.altClone) {
        innerHTML.altClone.remove();
      }
      hideDragProxy(innerHTML);
      if (innerHTML.proxy) {
        innerHTML.proxy.wrap.remove();
      }
      for (
        var tag: Dynamic = 0;
        tag < (innerHTML.groupProxies || []).length;
        tag++
      )
        innerHTML.groupProxies[tag].p.wrap.remove();
      (document as Dynamic).body.style.cursor = "";
      var rot: Dynamic =
        (document as Dynamic).querySelector("[data-dc-dragging]") ||
        (innerHTML.el && innerHTML.el.isConnected
          ? innerHTML.el
          : findTemplateInstances(String(innerHTML.tid), innerHTML.name)[0] ||
            null);
      if (rot) {
        rot.style.removeProperty("pointer-events");
        rot.removeAttribute("data-dc-dragging");
      }
      if (placementOverlay) {
        placementOverlay.box.style.display = "none";
      }
      var ref: Dynamic = innerHTML.commit;
      if (!fillStyle || !ref) {
        cancelMovePreview(innerHTML);
        if (innerHTML.followers) {
          revertFollowerStyles(innerHTML);
        }
        if (innerHTML.brkFollowers)
          for (var top: Dynamic = 0; top < innerHTML.brkFollowers.length; top++)
            if (innerHTML.brkFollowers[top].absStyles) {
              emitEditorEvent({
                type: "styleRevert",
                tid: innerHTML.brkFollowers[top].tid,
                name: innerHTML.name,
                gestureKey: innerHTML.gestureKey,
                keepUndo: true,
                follower: true,
              });
            }
        if (
          innerHTML.mode === "abs" ||
          innerHTML.exited ||
          innerHTML.droppedOut
        ) {
          emitEditorEvent({
            type: "styleRevert",
            tid: innerHTML.tid,
            name: innerHTML.name,
            gestureKey: innerHTML.gestureKey,
            keepUndo: false,
          });
        }
        refreshChrome();
        return;
      }
      if (innerHTML.alt && innerHTML.mode === "abs" && ref.kind !== "flow") {
        emitEditorEvent({
          type: "styleRevert",
          tid: innerHTML.tid,
          name: innerHTML.name,
          gestureKey: innerHTML.gestureKey,
          keepUndo: true,
        });
      }
      if (ref.kind === "absSame") {
        emitEditorEvent({
          type: "move",
          tid: innerHTML.tid,
          name: innerHTML.name,
          gestureKey: innerHTML.gestureKey,
          targetTid: null,
          position: "into",
          alt: innerHTML.alt,
          absolute: true,
          fixed: !!innerHTML.fixed,
          absStyles: innerHTML.absStyles || {},
          followers: innerHTML.followers
            ? innerHTML.followers.map(function (
                this: Dynamic,
                name3?: Dynamic,
                ..._extraArguments290: Dynamic[]
              ): Dynamic {
                return {
                  tid: name3.tid,
                  absStyles: name3.absStyles || {},
                  fixed: !!name3.fixed,
                };
              })
            : undefined,
        });
        return;
      }
      if (ref.kind === "abs") {
        emitEditorEvent({
          type: "move",
          tid: innerHTML.tid,
          name: innerHTML.name,
          gestureKey: innerHTML.gestureKey,
          targetTid: ref.tid,
          position: ref.tid == null ? "root-end" : "into",
          epoch: ref.epoch,
          alt: innerHTML.alt,
          absolute: true,
          absStyles: innerHTML.absStyles || {},
          parentNeedsPositioning: ref.needsPositioning,
          flatten:
            (!innerHTML.alt && !ref.brk && innerHTML.flatten) || undefined,
          breakout: ref.brk || undefined,
          freezeStyle: innerHTML.freezeStyle || undefined,
          followers: ref.followers,
        });
        return;
      }
      emitEditorEvent({
        type: "move",
        tid: innerHTML.tid,
        name: innerHTML.name,
        gestureKey: innerHTML.gestureKey,
        targetTid: ref.slot.targetTid,
        position: ref.slot.position,
        alt: innerHTML.alt,
        epoch: ref.slot.epoch,
        clearPositioning: ref.clearPositioning,
        freezeStyle: innerHTML.freezeStyle || undefined,
        group: innerHTML.group || undefined,
      });
    }
  }
  function armMarquee(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments291: Dynamic[]
  ): Dynamic {
    if (
      !(
        fillStyle.sourceCapabilities &&
        fillStyle.sourceCapabilities.firesTouchEvents
      )
    ) {
      var rot: Dynamic = findOuterComponentHost();
      var ref: Dynamic = rot ? rot.getAttribute("data-sc-name") : null;
      if (ref) {
        var top: Dynamic = tag || {
          tids: selectedTemplateIds.slice(),
          name: selectedComponentName,
        };
        pendingMarquee = {
          x: fillStyle.clientX,
          y: fillStyle.clientY,
          containerEl: innerHTML,
          rootN: ref,
          mode: position,
          toggle: !!shaft,
          gestureKey: gestureKey || randomGestureKey(),
          baseTids: shaft && top.name === ref ? top.tids.slice() : [],
          prevTids: top.tids.slice(),
          prevName: top.name,
          prevForeign: foreignSelection,
        };
        gestureKey = null;
      }
    }
  }
  function isSelectableContainer(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments292: Dynamic[]
  ): Dynamic {
    if (
      isUneditableElement(fillStyle) ||
      isDeckManagedElement(fillStyle) ||
      (fillStyle.tagName || "").toLowerCase() === "svg"
    )
      return false;
    for (
      var innerHTML: Dynamic = selectableDescendants(
          fillStyle,
          componentScopeName(fillStyle),
          "plain",
        ),
        position: Dynamic = 0;
      position < innerHTML.length;
      position++
    ) {
      var shaft: Dynamic = getComputedStyle(innerHTML[position]);
      if (
        shaft.display !== "none" &&
        (shaft.display !== "inline" ||
          shaft.position === "absolute" ||
          shaft.position === "fixed")
      )
        return true;
    }
    return false;
  }
  function removeAncestorSelections(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments293: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = new Set(), position: Dynamic = 0;
      position < fillStyle.length;
      position++
    )
      for (var shaft: Dynamic = fillStyle[position].parentElement; shaft; ) {
        innerHTML.add(shaft);
        shaft = shaft.parentElement;
      }
    return fillStyle.filter(function (
      this: Dynamic,
      tag?: Dynamic,
      ..._extraArguments294: Dynamic[]
    ): Dynamic {
      return !innerHTML.has(tag);
    });
  }
  function selectableDescendants(
    this: Dynamic,
    container?: Dynamic,
    componentName?: Dynamic,
    mode?: Dynamic,
    ..._extraArguments295: Dynamic[]
  ): Dynamic {
    for (
      var shaft: Dynamic = (document as Dynamic).querySelectorAll(
          "[data-dc-tpl]",
        ),
        tag: Dynamic = [],
        rot: Dynamic = 0;
      rot < shaft.length;
      rot++
    ) {
      var ref: Dynamic = shaft[rot];
      if (componentScopeName(ref) === componentName) {
        if (mode !== "deep") {
          var top: Dynamic = ref.parentElement
            ? ref.parentElement.closest("[data-dc-tpl]")
            : null;
          if (top !== container) continue;
        }
        if (
          !(
            isDeckManagedElement(ref) || ref.closest("[data-dc-editor-overlay]")
          )
        ) {
          tag.push(ref);
        }
      }
    }
    return tag;
  }
  function beginMarquee(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments296: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = pendingMarquee;
    pendingMarquee = null;
    var position: Dynamic = (document as Dynamic).createElement("div");
    position.setAttribute("data-dc-editor-overlay", "");
    position.setAttribute("data-dc-editor-marquee", "");
    position.style.cssText =
      "position:fixed;z-index:2147483646;pointer-events:none;border:" +
      chromePixels(1) +
      "px solid " +
      CHROME_STROKE +
      ";background:color-mix(in srgb," +
      CHROME_STROKE +
      " 10%,transparent);";
    ensureOverlayRoot().appendChild(position);
    var shaft: Dynamic = innerHTML.containerEl
      ? parseInt(innerHTML.containerEl.getAttribute("data-dc-tpl"), 10)
      : null;
    marqueeGesture = {
      box: position,
      x: innerHTML.x,
      y: innerHTML.y,
      baseTids: innerHTML.baseTids,
      prevTids: innerHTML.prevTids,
      prevName: innerHTML.prevName,
      prevForeign: innerHTML.prevForeign,
      gestureKey: innerHTML.gestureKey,
      rootN: innerHTML.rootN,
      mode: innerHTML.mode,
      toggle: innerHTML.toggle,
      containerTid: isNaN(shaft) ? null : shaft,
      cands: selectableDescendants(
        innerHTML.containerEl,
        innerHTML.rootN,
        innerHTML.mode,
      ),
      lastKey: null,
      redo: false,
    };
    clearHover();
    clearForeignSelection();
    emitEditorEvent({
      type: "boxLive",
      gestureKey: innerHTML.gestureKey,
    });
    updateMarquee(fillStyle);
  }
  function updateMarquee(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments297: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = marqueeGesture;
    var position: Dynamic = Math.min(innerHTML.x, fillStyle.clientX);
    var shaft: Dynamic = Math.min(innerHTML.y, fillStyle.clientY);
    var tag: Dynamic = Math.abs(fillStyle.clientX - innerHTML.x);
    var rot: Dynamic = Math.abs(fillStyle.clientY - innerHTML.y);
    innerHTML.box.style.left = position + "px";
    innerHTML.box.style.top = shaft + "px";
    innerHTML.box.style.width = tag + "px";
    innerHTML.box.style.height = rot + "px";
    for (
      var ref: Dynamic = innerHTML.baseTids.slice(),
        top: Dynamic =
          innerHTML.cands.length === 0 && innerHTML.lastKey != null,
        name3: Dynamic = 0;
      name3 < innerHTML.cands.length && !top;
      name3++
    )
      top = !innerHTML.cands[name3].isConnected;
    if (top) {
      var bottom: Dynamic =
        innerHTML.containerTid == null
          ? null
          : findTemplateInstances(
              String(innerHTML.containerTid),
              innerHTML.rootN,
            )[0];
      innerHTML.cands =
        innerHTML.containerTid == null || bottom
          ? selectableDescendants(bottom, innerHTML.rootN, innerHTML.mode)
          : [];
      innerHTML.redo = innerHTML.cands.length > 0;
    }
    for (
      var left: Dynamic = [],
        scope: Dynamic = innerHTML.mode === "deep",
        top2: Dynamic = 0;
      top2 < innerHTML.cands.length;
      top2++
    ) {
      var adjust: Dynamic = unwrapDisplayContentsHost(innerHTML.cands[top2]);
      var axis: Dynamic = adjust.getBoundingClientRect();
      if (!(axis.width === 0 && axis.height === 0)) {
        var y2: Dynamic = scope
          ? position <= axis.left &&
            axis.right <= position + tag &&
            shaft <= axis.top &&
            axis.bottom <= shaft + rot
          : position <= axis.right &&
            axis.left <= position + tag &&
            shaft <= axis.bottom &&
            axis.top <= shaft + rot;
        if (y2 && isRenderedElement(adjust)) {
          left.push(innerHTML.cands[top2]);
        }
      }
    }
    if (scope) {
      left = removeAncestorSelections(left);
    }
    for (var pose: Dynamic = 0; pose < left.length; pose++) {
      var lock: Dynamic = parseInt(left[pose].getAttribute("data-dc-tpl"), 10);
      var paint: Dynamic = ref.indexOf(lock);
      if (innerHTML.toggle && paint >= 0) {
        ref.splice(paint, 1);
      } else {
        if (paint < 0) {
          ref.push(lock);
        }
      }
    }
    var lastKey: Dynamic = ref.join(",");
    if (!(lastKey === innerHTML.lastKey && !innerHTML.redo)) {
      innerHTML.lastKey = lastKey;
      innerHTML.redo = false;
      selectedTemplateIds = ref;
      selectedPart = null;
      selectedComponentName = ref.length ? innerHTML.rootN : null;
      repaintSelection();
      emitSelection(undefined, undefined, innerHTML.toggle);
    }
  }
  function finishMarquee(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments298: Dynamic[]
  ): Dynamic {
    if (marqueeGesture) {
      var innerHTML: Dynamic = marqueeGesture;
      marqueeGesture = null;
      innerHTML.box.remove();
      emitEditorEvent({
        type: fillStyle ? "boxCancel" : "boxEnd",
        gestureKey: innerHTML.gestureKey,
      });
      if (!fillStyle && innerHTML.lastKey != null) {
        emitSelection(undefined, undefined, innerHTML.toggle);
      }
      if (fillStyle) {
        selectedTemplateIds = innerHTML.prevTids.slice();
        selectedPart = null;
        selectedComponentName = innerHTML.prevName;
        repaintSelection();
        var position: Dynamic =
          innerHTML.prevForeign && innerHTML.prevForeign.isConnected
            ? innerHTML.prevForeign
            : null;
        if (position) {
          var shaft: Dynamic = position.outerHTML;
          foreignSelection = position;
          position.setAttribute("data-dc-editor-selected", "");
          emitEditorEvent({
            type: "select",
            tids: null,
            foreign: {
              tag: position.tagName.toLowerCase(),
              html: shaft,
              text: "",
            },
            re: "boxcancel:" + innerHTML.gestureKey,
          });
        } else
          emitSelection(
            undefined,
            "boxcancel:" + innerHTML.gestureKey,
            innerHTML.toggle,
          );
      }
      refreshChrome();
    }
  }
  var state26: Dynamic = {
    rect: [120, 120],
    oval: [96, 96],
    frame: [200, 96],
    grid: [200, 120],
    text: [140, 22],
    arrow: null,
    line: null,
    draw: null,
  };
  function ensurePlacementOverlay(
    this: Dynamic,
    ..._extraArguments299: Dynamic[]
  ): Dynamic {
    if (placementOverlay) return placementOverlay;
    var fillStyle: Dynamic = (document as Dynamic).createElement("div");
    fillStyle.setAttribute("data-dc-editor-overlay", "");
    fillStyle.style.cssText =
      "position:fixed;z-index:2147483645;pointer-events:none;display:none;border:1.5px dashed " +
      CHROME_STROKE +
      ";background:color-mix(in srgb," +
      CHROME_STROKE +
      " 8%,transparent);border-radius:4px;";
    var innerHTML: Dynamic = (document as Dynamic).createElement("div");
    innerHTML.setAttribute("data-dc-editor-overlay", "");
    innerHTML.style.cssText =
      "position:fixed;z-index:2147483644;pointer-events:none;display:none;";
    var position: Dynamic = (document as Dynamic).createElement("div");
    position.style.cssText =
      "position:absolute;top:-18px;left:0;font:10px/1.4 ui-monospace,monospace;background:rgba(120,120,120,0.9);color:#fff;padding:1px 5px;border-radius:3px;white-space:nowrap;";
    innerHTML.appendChild(position);
    ensureOverlayRoot().appendChild(innerHTML);
    ensureOverlayRoot().appendChild(fillStyle);
    placementOverlay = {
      box: fillStyle,
      parent: innerHTML,
      label: position,
    };
    return placementOverlay;
  }
  function hidePlacementOverlay(
    this: Dynamic,
    ..._extraArguments300: Dynamic[]
  ): Dynamic {
    if (placementOverlay) {
      placementOverlay.box.style.display = "none";
      placementOverlay.parent.style.display = "none";
    }
  }
  function showParentPlacementBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments301: Dynamic[]
  ): Dynamic {
    var position: Dynamic = ensurePlacementOverlay();
    position.parent.style.display = "block";
    position.parent.style.left = fillStyle.left + "px";
    position.parent.style.top = fillStyle.top + "px";
    position.parent.style.width = fillStyle.width + "px";
    position.parent.style.height = fillStyle.height + "px";
    position.parent.style.outline =
      chromePixels(1.5) + "px solid " + CHROME_STROKE;
    position.parent.style.outlineOffset = "0px";
    position.label.style.display = "none";
  }
  function hideParentPlacementBounds(
    this: Dynamic,
    ..._extraArguments302: Dynamic[]
  ): Dynamic {
    if (placementOverlay) {
      placementOverlay.parent.style.display = "none";
    }
  }
  var state27: Dynamic = {
    button: 1,
    td: 1,
    th: 1,
    caption: 1,
    table: 1,
    object: 1,
    marquee: 1,
    applet: 1,
    template: 1,
    html: 1,
    foreignobject: 1,
    desc: 1,
    title: 1,
    mi: 1,
    mo: 1,
    mn: 1,
    ms: 1,
    mtext: 1,
    "annotation-xml": 1,
  };
  function toolViolatesNesting(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments303: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic =
      activeTool === "arrow" || activeTool === "line" || activeTool === "draw"
        ? "svg"
        : "div";
    var position: Dynamic = (fillStyle.tagName || "").toLowerCase();
    if (state21[position] && !state21[position][innerHTML]) return true;
    for (
      var shaft: Dynamic = state18[innerHTML] ? fillStyle : null;
      shaft && !state27[(position = (shaft.tagName || "").toLowerCase())];
      shaft = shaft.parentElement
    )
      if (position === "p") return true;
    return false;
  }
  function drawingContainerAt(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments304: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = (document as Dynamic).elementFromPoint(
        fillStyle,
        innerHTML,
      );
      position && position instanceof SVGElement;

    )
      position = position.parentElement;
    for (
      position =
        position && position.closest ? position.closest("[data-dc-tpl]") : null;
      position &&
      (!canContainElements(position) ||
        toolViolatesNesting(position) ||
        isDeckStage(position) ||
        isDeckStageWrapper(position) ||
        isCollapsedDeckWrapper(position));

    )
      position =
        position.parentElement && position.parentElement.closest
          ? position.parentElement.closest("[data-dc-tpl]")
          : null;
    if (position)
      return {
        el: position,
        tid: parseInt(position.getAttribute("data-dc-tpl"), 10),
        name: nearestComponentName(position),
        rect: position.getBoundingClientRect(),
      };
    var shaft: Dynamic = (document as Dynamic).querySelector(".sc-host");
    var tag: Dynamic = shaft
      ? shaft.getBoundingClientRect()
      : {
          left: 0,
          top: 0,
          right: innerWidth,
          bottom: innerHeight,
        };
    return {
      el: shaft,
      tid: null,
      name: (shaft && shaft.getAttribute("data-sc-name")) || null,
      rect: {
        left: tag.left,
        top: tag.top,
        right: Math.max(tag.right, innerWidth),
        bottom: Math.max(tag.bottom, innerHeight),
        width: Math.max(tag.right, innerWidth) - tag.left,
        height: Math.max(tag.bottom, innerHeight) - tag.top,
      },
    };
  }
  function previewShapePlacement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments305: Dynamic[]
  ): Dynamic {
    if (
      activeTool === "arrow" ||
      activeTool === "line" ||
      activeTool === "draw"
    ) {
      hidePlacementOverlay();
      return;
    }
    var innerHTML: Dynamic = ensurePlacementOverlay();
    var position: Dynamic =
      activeTool in state26 ? state26[activeTool] : [120, 120];
    if (position) {
      innerHTML.box.style.display = "block";
    } else {
      innerHTML.box.style.display = "none";
      position = [0, 0];
    }
    innerHTML.box.style.left = fillStyle.clientX + "px";
    innerHTML.box.style.top = fillStyle.clientY + "px";
    innerHTML.box.style.width = position[0] + "px";
    innerHTML.box.style.height = position[1] + "px";
    innerHTML.box.style.borderRadius = activeTool === "oval" ? "50%" : "4px";
    innerHTML.parent.style.display = "none";
  }
  function stampedElementCount(
    this: Dynamic,
    ..._extraArguments306: Dynamic[]
  ): Dynamic {
    return (document as Dynamic).querySelectorAll("[data-dc-tpl]").length;
  }
  function removePendingInsert(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments307: Dynamic[]
  ): Dynamic {
    clearTimeout(fillStyle.timer);
    try {
      fillStyle.node.remove();
    } catch {}
  }
  function watchPendingInsert(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments308: Dynamic[]
  ): Dynamic {
    if (!pendingInserts) {
      pendingInserts = {
        els: [],
        obs: null,
      };
      pendingInserts.obs = new MutationObserver(reconcilePendingInserts);
      pendingInserts.obs.observe((document as Dynamic).body, {
        childList: true,
        subtree: true,
      });
    }
    var innerHTML: Dynamic = {
      node: fillStyle,
      base: stampedElementCount(),
      timer: null,
    };
    innerHTML.timer = setTimeout(function (
      this: Dynamic,
      ..._extraArguments309: Dynamic[]
    ): Dynamic {
      removePendingInsert(innerHTML);
      reconcilePendingInserts();
    }, 800);
    pendingInserts.els.push(innerHTML);
  }
  function cancelPendingInserts(
    this: Dynamic,
    ..._extraArguments310: Dynamic[]
  ): Dynamic {
    if (pendingInserts) {
      if (pendingInserts.obs) {
        pendingInserts.obs.disconnect();
      }
      for (
        var fillStyle: Dynamic = 0;
        fillStyle < pendingInserts.els.length;
        fillStyle++
      )
        removePendingInsert(pendingInserts.els[fillStyle]);
      pendingInserts = null;
    }
  }
  function reconcilePendingInserts(
    this: Dynamic,
    ..._extraArguments311: Dynamic[]
  ): Dynamic {
    if (pendingInserts) {
      for (
        var fillStyle: Dynamic = stampedElementCount(),
          innerHTML: Dynamic = [],
          position: Dynamic = false,
          shaft: Dynamic = 0;
        shaft < pendingInserts.els.length;
        shaft++
      ) {
        var tag: Dynamic = pendingInserts.els[shaft];
        if (tag.node.isConnected) {
          if (fillStyle > tag.base) {
            removePendingInsert(tag);
            position = true;
          } else {
            if (fillStyle < tag.base) {
              tag.base = fillStyle;
            }
            innerHTML.push(tag);
          }
        } else {
          clearTimeout(tag.timer);
          position = true;
        }
      }
      if (position) {
        repaintSelection();
      }
      if (innerHTML.length === 0) {
        pendingInserts.obs.disconnect();
        pendingInserts = null;
      } else {
        pendingInserts.els = innerHTML;
      }
    }
  }
  function finishShapeDrawing(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments312: Dynamic[]
  ): Dynamic {
    if (drawingGesture) {
      var innerHTML: Dynamic = drawingGesture;
      drawingGesture = null;
      hidePlacementOverlay();
      var position: Dynamic =
        activeTool === "arrow" || activeTool === "line"
          ? innerHTML.w > 4 || innerHTML.h > 4
          : innerHTML.w > 4 && innerHTML.h > 4;
      if (!fillStyle || !position) {
        innerHTML.box.remove();
        return;
      }
      watchPendingInsert(innerHTML.box);
      var shaft: Dynamic = elementViewportScale(innerHTML.parentEl);
      emitEditorEvent({
        type: "insert",
        name: innerHTML.parentName,
        targetTid: innerHTML.parentTid,
        position: innerHTML.parentTid == null ? "root-end" : "into",
        rect: {
          x: Math.round((innerHTML.x - innerHTML.parentRect.left) / shaft),
          y: Math.round((innerHTML.y - innerHTML.parentRect.top) / shaft),
          w: Math.round(innerHTML.w / shaft),
          h: Math.round(innerHTML.h / shaft),
        },
        dir: {
          x: innerHTML.dirX || 1,
          y: innerHTML.dirY || 1,
        },
      });
    }
  }
  function editableSvgGeometry(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments313: Dynamic[]
  ): Dynamic {
    if (!fillStyle || (fillStyle.tagName || "").toLowerCase() !== "svg")
      return null;
    var innerHTML: Dynamic = value_wd(fillStyle);
    if (!innerHTML) return null;
    var position: Dynamic = computedTransformMatrix(fillStyle);
    if (!position || !position.none) return null;
    try {
      var shaft: Dynamic = getComputedStyle(innerHTML.shaft);
      if (shaft.transform !== "none" || hasIndependentTransforms(shaft))
        return null;
    } catch {}
    var tag: Dynamic =
      innerHTML.tag === "path" &&
      /(^|;)\s*fill:\s*none/.test(fillStyle.getAttribute("style") || "") &&
      fillStyle.style.overflow === "visible" &&
      (innerHTML.legacy ||
        (fillStyle.getAttribute("preserveAspectRatio") === "none" &&
          /^\s*M\s*[-\d.e+]+[\s,]+[-\d.e+]+\s+L\s*[-\d.e+]+[\s,]+[-\d.e+]+\s*$/i.test(
            innerHTML.shaft.getAttribute("d") || "",
          )));
    if (!tag) {
      var rot: Dynamic = getComputedStyle(fillStyle);
      var ref: Dynamic = fillStyle.style;
      var top: Dynamic = function (
        this: Dynamic,
        x?: Dynamic,
        ..._extraArguments314: Dynamic[]
      ): Dynamic {
        return /^-?[\d.]+px$/.test(String(x || "").trim());
      };
      if (
        (rot.position !== "absolute" && rot.position !== "fixed") ||
        !top(ref.left) ||
        !top(ref.top) ||
        ref.right ||
        ref.bottom
      )
        return null;
    }
    var name3: Dynamic = elementLayoutDimensions(fillStyle);
    var bottom: Dynamic = name3.w;
    var left: Dynamic = name3.h;
    if (!(bottom > 0) || !(left > 0)) return null;
    var scope: Dynamic = null;
    try {
      scope = fillStyle.getCTM ? fillStyle.getCTM() : null;
    } catch {}
    var top2: Dynamic = function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      ..._extraArguments315: Dynamic[]
    ): Dynamic {
      if (!scope)
        return {
          x: x,
          y: y,
        };
      var K: Dynamic = fillStyle.createSVGPoint();
      K.x = x;
      K.y = y;
      var value_Y: Dynamic = K.matrixTransform(scope);
      return {
        x: value_Y.x,
        y: value_Y.y,
      };
    };
    var adjust: Dynamic = 1;
    if (scope && !tag) {
      var axis: Dynamic = Math.hypot(scope.a, scope.b);
      var y2: Dynamic = Math.hypot(scope.c, scope.d);
      var pose: Dynamic = innerHTML.ex - innerHTML.sx;
      var lock: Dynamic = innerHTML.ey - innerHTML.sy;
      adjust =
        (axis * y2 * Math.hypot(pose, lock)) /
        Math.hypot(axis * pose, y2 * lock);
      if (!(adjust > 1e-4 && adjust < 1e4)) return null;
    }
    var paint: Dynamic = {};
    var lastKey: Dynamic = {};
    try {
      var lim: Dynamic = getComputedStyle(innerHTML.shaft);
      var text8: Dynamic = getComputedStyle(fillStyle);
      [
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-dasharray",
        "stroke-dashoffset",
        "stroke-opacity",
        "stroke-miterlimit",
        "vector-effect",
      ].forEach(function (
        this: Dynamic,
        x?: Dynamic,
        ..._extraArguments316: Dynamic[]
      ): Dynamic {
        var y: Dynamic = lim.getPropertyValue(x);
        if (y) {
          paint[x] = y;
        }
        var K: Dynamic = text8.getPropertyValue(x);
        if (K) {
          lastKey[x] = K;
        }
      });
    } catch {}
    var value_S: Dynamic = top2(innerHTML.sx, innerHTML.sy);
    var expected: Dynamic = top2(innerHTML.ex, innerHTML.ey);
    var value_k: Dynamic = parseFloat(paint["stroke-width"]) || 0;
    var value_N: Dynamic =
      (innerHTML.legacy ? 0 : value_zo(fillStyle, innerHTML.shaft, "end")) *
      value_k;
    var el: Dynamic = innerHTML.legacy
      ? 0
      : value_zo(fillStyle, innerHTML.shaft, "start") * value_k;
    var startRect: Dynamic = value_qo(
      innerHTML,
      innerHTML.legacy ? 0 : value_N,
    );
    var value_O: Dynamic = top2(startRect.x, startRect.y);
    var covered: Dynamic = value_qo(
      {
        sx: innerHTML.ex,
        sy: innerHTML.ey,
        ex: innerHTML.sx,
        ey: innerHTML.sy,
      },
      el,
    );
    var value_G: Dynamic = top2(covered.x, covered.y);
    var back: Dynamic = innerHTML.legacy ? 0 : value_N * adjust;
    return {
      sx: value_S.x,
      sy: value_S.y,
      ex: expected.x,
      ey: expected.y,
      px: value_G.x,
      py: value_G.y,
      tx: value_O.x,
      ty: value_O.y,
      back: back,
      startBack: el * adjust,
      legacyBack: innerHTML.legacy ? value_N * adjust : 0,
      isArrow:
        innerHTML.shaft.hasAttribute("marker-end") ||
        innerHTML.shaft.hasAttribute("marker-start") ||
        innerHTML.legacy,
      legacy: innerHTML.legacy,
      vbW: bottom,
      vbH: left,
      shaft: innerHTML.shaft,
      tag: innerHTML.tag,
      unitScale: adjust,
      paint: paint,
      svgPaint: lastKey,
    };
  }
  function svgGeometryBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments317: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle.getBoundingClientRect();
    var position: Dynamic = outerSvgElement(fillStyle);
    var shaft: Dynamic =
      position !== fillStyle && (innerHTML.width > 0 || innerHTML.height > 0)
        ? editableSvgGeometry(position)
        : null;
    var tag: Dynamic =
      shaft && shaft.shaft === fillStyle
        ? value_Cd(shaft, position.getBoundingClientRect(), innerHTML)
        : null;
    return tag && !ancestorTransformInfo(position).rotated ? tag : innerHTML;
  }
  function linePathData(
    this: Dynamic,
    startX?: Dynamic,
    startY?: Dynamic,
    endX?: Dynamic,
    endY?: Dynamic,
    ..._extraArguments318: Dynamic[]
  ): Dynamic {
    return "M " + startX + " " + startY + " L " + endX + " " + endY;
  }
  function refreshChrome(
    this: Dynamic,
    ..._extraArguments319: Dynamic[]
  ): Dynamic {
    paintEditorChrome();
  }
  function markSelectedStroke(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments320: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = (document as Dynamic).querySelectorAll(
          "[data-dc-editor-stroke]",
        ),
        position: Dynamic = 0;
      position < innerHTML.length;
      position++
    )
      if (innerHTML[position] !== fillStyle) {
        innerHTML[position].removeAttribute("data-dc-editor-stroke");
      }
    if (fillStyle && !fillStyle.hasAttribute("data-dc-editor-stroke")) {
      fillStyle.setAttribute("data-dc-editor-stroke", "");
    }
  }
  function rotatedElementPose(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments321: Dynamic[]
  ): Dynamic {
    var position: Dynamic = {
      x: innerHTML.left,
      y: innerHTML.top,
      w: innerHTML.width,
      h: innerHTML.height,
      rot: 0,
    };
    var shaft: Dynamic = decomposedElementTransform(fillStyle);
    if (!shaft || Math.abs(shaft.rot) < 1e-4) return position;
    var tag: Dynamic = elementLayoutDimensions(fillStyle);
    var rot: Dynamic = parentLayoutScale(fillStyle);
    var ref: Dynamic = ancestorTransformSigns(fillStyle);
    var top: Dynamic = tag.w * Math.abs(shaft.sx) * rot;
    var name3: Dynamic = tag.h * Math.abs(shaft.sy) * rot;
    return !(top > 0) || !(name3 > 0)
      ? position
      : {
          x: innerHTML.left + (innerHTML.width - top) / 2,
          y: innerHTML.top + (innerHTML.height - name3) / 2,
          w: top,
          h: name3,
          rot: shaft.rot * ref.x * ref.y,
        };
  }
  function hasComplexAncestorTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments322: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = fillStyle.parentElement;
      innerHTML && innerHTML !== (document as Dynamic).documentElement;
      innerHTML = innerHTML.parentElement
    ) {
      var position: Dynamic = computedTransformMatrix(innerHTML);
      if (!position) return true;
      if (!position.none) {
        var shaft: Dynamic = value_aa(position);
        if (
          !shaft ||
          shaft.mirror ||
          Math.abs(shaft.rot) > 1e-4 ||
          Math.abs(shaft.sx - shaft.sy) > 1e-4 * shaft.sx
        )
          return true;
      }
    }
    return false;
  }
  var count8: Dynamic = 500;
  function transformableSelectionMembers(
    this: Dynamic,
    ..._extraArguments323: Dynamic[]
  ): Dynamic {
    if (!isRootComponent(selectedComponentName)) return null;
    for (
      var fillStyle: Dynamic = [],
        innerHTML: Dynamic = [],
        position: Dynamic = [],
        shaft: Dynamic = [],
        tag: Dynamic = function (
          this: Dynamic,
          text8?: Dynamic,
          ..._extraArguments324: Dynamic[]
        ): Dynamic {
          var parentElement: Dynamic = text8.parentElement;
          var expected: Dynamic = position.indexOf(parentElement);
          if (expected < 0) {
            position.push(parentElement);
            shaft.push(hasComplexAncestorTransform(text8));
            expected = position.length - 1;
          }
          return shaft[expected];
        },
        rot: Dynamic = 0;
      rot < selectedTemplateIds.length;
      rot++
    ) {
      var ref: Dynamic = findTemplateInstances(
        String(selectedTemplateIds[rot]),
        selectedComponentName,
      );
      var top: Dynamic = firstRenderedInstance(ref);
      if (
        top &&
        ((top = outerSvgElement(top)), !(innerHTML.indexOf(top) >= 0))
      ) {
        innerHTML.push(top);
        var name3: Dynamic = unwrapDisplayContentsHost(top);
        var bottom: Dynamic = name3.getBoundingClientRect();
        if (!(!(bottom.width > 0) || !(bottom.height > 0))) {
          var left: Dynamic = getComputedStyle(top);
          var scope: Dynamic = (top.tagName || "").toLowerCase();
          var top2: Dynamic =
            left.position === "absolute" || left.position === "fixed";
          var adjust: Dynamic = top2 ? authoredPositioning(top, left) : null;
          var axis: Dynamic = top.hasAttribute("data-sc-name") || name3 !== top;
          var y2: Dynamic = axis ? null : editableSvgGeometry(top);
          var pose: Dynamic =
            axis || y2 ? null : decomposedElementTransform(top);
          var lock: Dynamic =
            fillStyle.length >= count8 ||
            ref.length !== 1 ||
            isUneditableElement(top) ||
            isDeckManagedElement(top) ||
            isRepeatedDirectiveElement(top) ||
            (!!y2 && y2.legacy) ||
            tag(top);
          var paint: Dynamic = !lock && top2 && !adjust.bothX && !adjust.bothY;
          fillStyle.push({
            el: top,
            pe: name3,
            tid: parseInt(top.getAttribute("data-dc-tpl"), 10),
            r: bottom,
            cs: left,
            anc: adjust,
            sep: y2,
            pose: pose,
            deg: pose ? Math.round((pose.rot * 180) / Math.PI) : 0,
            scl: elementViewportScale(name3),
            fixed: left.position === "fixed",
            movable: paint,
            turned: !!pose && Math.abs(pose.rot) >= 1e-4,
            sizable: !lock && !axis && (!y2 || paint),
            rotatable:
              !lock &&
              !axis &&
              (y2
                ? paint
                : !!pose &&
                  (top.style.transform
                    ? !!parseTransformFunctions(top.style.transform)
                    : !!pose.m.none) &&
                  (left.display !== "inline" || !!state16[scope])),
          });
        }
      }
    }
    for (var lastKey: Dynamic = 0; lastKey < fillStyle.length; lastKey++)
      for (var lim: Dynamic = 0; lim < fillStyle.length; lim++)
        if (
          lastKey !== lim &&
          fillStyle[lim].el.contains(fillStyle[lastKey].el)
        ) {
          fillStyle[lastKey].movable =
            fillStyle[lastKey].sizable =
            fillStyle[lastKey].rotatable =
              false;
          break;
        }
    return fillStyle.length ? fillStyle : null;
  }
  function unionMemberBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments325: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 1 / 0,
        position: Dynamic = 1 / 0,
        shaft: Dynamic = -1 / 0,
        tag: Dynamic = -1 / 0,
        rot: Dynamic = 0;
      rot < fillStyle.length;
      rot++
    ) {
      var ref: Dynamic = fillStyle[rot].r;
      innerHTML = Math.min(innerHTML, ref.left);
      position = Math.min(position, ref.top);
      shaft = Math.max(shaft, ref.right);
      tag = Math.max(tag, ref.bottom);
    }
    return {
      x: innerHTML,
      y: position,
      w: shaft - innerHTML,
      h: tag - position,
    };
  }
  function cachedSelectionMembers(
    this: Dynamic,
    ..._extraArguments326: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic =
      selectedComponentName + "|" + selectedTemplateIds.join(",");
    var innerHTML: Dynamic =
      value_dn &&
      value_dn.key === fillStyle &&
      value_dn.gen === layoutGeneration
        ? value_dn
        : null;
    if (innerHTML) {
      for (
        var position: Dynamic = 0;
        position < innerHTML.ms.length;
        position++
      )
        if (!innerHTML.ms[position].pe.isConnected) {
          innerHTML = null;
          break;
        }
    }
    if (innerHTML) {
      for (var shaft: Dynamic = 0; shaft < innerHTML.ms.length; shaft++)
        innerHTML.ms[shaft].r = innerHTML.ms[shaft].pe.getBoundingClientRect();
      return innerHTML.ms;
    }
    var tag: Dynamic = transformableSelectionMembers();
    value_dn = tag
      ? {
          key: fillStyle,
          gen: layoutGeneration,
          ms: tag,
        }
      : null;
    return tag;
  }
  var items8: Dynamic = [];
  var text: Dynamic = "";
  function resolveSelectionAnchors(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments327: Dynamic[]
  ): Dynamic {
    if (fillStyle.anchors.length !== innerHTML.length) return null;
    for (
      var position: Dynamic = 0,
        shaft: Dynamic = 0,
        tag: Dynamic = [],
        rot: Dynamic = 0;
      rot < fillStyle.anchors.length;
      rot++
    ) {
      for (
        var ref: Dynamic = fillStyle.anchors[rot],
          top: Dynamic = null,
          name3: Dynamic = 0;
        name3 < innerHTML.length;
        name3++
      )
        if (innerHTML[name3].tid === ref.tid) {
          top = innerHTML[name3];
          break;
        }
      var bottom: Dynamic = 0.6 + 1.2 * (top && top.scl > 0 ? top.scl : 1);
      if (
        !top ||
        top.deg !== ref.deg ||
        Math.abs(top.r.width - ref.w) > bottom ||
        Math.abs(top.r.height - ref.h) > bottom
      )
        return null;
      var left: Dynamic = {
        x: top.r.left + top.r.width / 2 - ref.dx,
        y: top.r.top + top.r.height / 2 - ref.dy,
        tol: bottom,
      };
      tag.push(left);
      position += left.x;
      shaft += left.y;
    }
    for (
      var scope: Dynamic = {
          x: position / tag.length,
          y: shaft / tag.length,
        },
        top2: Dynamic = 0;
      top2 < tag.length;
      top2++
    )
      if (
        Math.abs(tag[top2].x - scope.x) > tag[top2].tol ||
        Math.abs(tag[top2].y - scope.y) > tag[top2].tol
      )
        return null;
    return {
      c: scope,
      w: fillStyle.w,
      h: fillStyle.h,
      deg: fillStyle.deg,
    };
  }
  function storedSelectionTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments328: Dynamic[]
  ): Dynamic {
    if (
      items8.length &&
      items8[0].key !==
        selectedComponentName + "|" + selectedTemplateIds.join(",")
    ) {
      items8 = [];
    }
    for (
      var innerHTML: Dynamic = items8.length - 1;
      innerHTML >= 0;
      innerHTML--
    ) {
      var position: Dynamic = resolveSelectionAnchors(
        items8[innerHTML],
        fillStyle,
      );
      if (position) return position;
    }
    return null;
  }
  function rotatedSelectionBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments329: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = (fillStyle.deg * Math.PI) / 180;
    var position: Dynamic = Math.abs(Math.cos(innerHTML));
    var shaft: Dynamic = Math.abs(Math.sin(innerHTML));
    var tag: Dynamic = fillStyle.w * position + fillStyle.h * shaft;
    var rot: Dynamic = fillStyle.w * shaft + fillStyle.h * position;
    return {
      x: fillStyle.c.x - tag / 2,
      y: fillStyle.c.y - rot / 2,
      w: tag,
      h: rot,
      box: {
        x: fillStyle.c.x - fillStyle.w / 2,
        y: fillStyle.c.y - fillStyle.h / 2,
        w: fillStyle.w,
        h: fillStyle.h,
        rot: innerHTML,
      },
    };
  }
  function groupTransformChrome(
    this: Dynamic,
    ..._extraArguments330: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic =
      transformGesture && transformGesture.group ? transformGesture : null;
    var innerHTML: Dynamic = fillStyle
      ? fillStyle.members
      : cachedSelectionMembers();
    if (!innerHTML) return null;
    for (
      var position: Dynamic = fillStyle
          ? fillStyle.live
          : storedSelectionTransform(innerHTML),
        shaft: Dynamic = position ? null : unionMemberBounds(innerHTML),
        tag: Dynamic = position
          ? rotatedSelectionBounds(position)
          : {
              x: shaft.x,
              y: shaft.y,
              w: shaft.w,
              h: shaft.h,
              box: {
                x: shaft.x,
                y: shaft.y,
                w: shaft.w,
                h: shaft.h,
                rot: 0,
              },
            },
        rot: Dynamic = false,
        ref: Dynamic = 0,
        top: Dynamic = 0,
        name3: Dynamic = !!position && position.deg !== 0,
        bottom: Dynamic = 0;
      bottom < innerHTML.length;
      bottom++
    ) {
      if (innerHTML[bottom].sizable || innerHTML[bottom].movable) {
        rot = true;
      }
      if (innerHTML[bottom].rotatable) {
        ref++;
        if (!innerHTML[bottom].movable) {
          top++;
        }
      }
      if (innerHTML[bottom].sizable && innerHTML[bottom].turned) {
        name3 = true;
      }
    }
    return {
      el: null,
      group: true,
      members: innerHTML,
      x: tag.x,
      y: tag.y,
      w: tag.w,
      h: tag.h,
      box: tag.box,
      rotatable: ref > 0 && top === 0,
      noRotate: ref === 0 ? "none" : top > 0 ? "layout" : null,
      noResize: !rot,
      aspectLock: name3,
      deg:
        fillStyle && fillStyle.rotate && fillStyle.lastDeg != null
          ? normalizeDegrees(fillStyle.live.deg)
          : null,
      stroke: null,
    };
  }
  function mediaCropChrome(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments331: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = (fillStyle.tagName || "").toLowerCase();
    if (innerHTML !== "img" && innerHTML !== "video") return null;
    var position: Dynamic =
      innerHTML === "img" ? fillStyle.naturalWidth : fillStyle.videoWidth;
    var shaft: Dynamic =
      innerHTML === "img" ? fillStyle.naturalHeight : fillStyle.videoHeight;
    if (
      !(position > 0) ||
      !(shaft > 0) ||
      !(fillStyle.offsetWidth > 0) ||
      !(fillStyle.offsetHeight > 0)
    )
      return {
        off: "unloaded",
      };
    var tag: Dynamic = decomposedElementTransform(fillStyle);
    var rot: Dynamic = getComputedStyle(fillStyle);
    var ref: Dynamic = function (
      this: Dynamic,
      scope?: Dynamic,
      ..._extraArguments332: Dynamic[]
    ): Dynamic {
      return !scope || scope === "none";
    };
    var top: Dynamic =
      !tag && ref(rot.transform) && ref(rot.rotate) && ref(rot.scale);
    if (
      hasComplexAncestorTransform(fillStyle) ||
      (!tag && !top) ||
      (tag && (tag.mirror || Math.abs(tag.sx - tag.sy) > 1e-4 * tag.sx))
    )
      return {
        off: "turned",
      };
    var name3: Dynamic = function (
      this: Dynamic,
      scope?: Dynamic,
      top2?: Dynamic,
      ..._extraArguments333: Dynamic[]
    ): Dynamic {
      return (parseFloat(rot[scope]) || 0) + (parseFloat(rot[top2]) || 0);
    };
    var bottom: Dynamic = {
      tid: parseInt(fillStyle.getAttribute("data-dc-tpl"), 10),
      w: position,
      h: shaft,
      inset: [
        name3("borderLeftWidth", "paddingLeft") / fillStyle.offsetWidth,
        name3("borderTopWidth", "paddingTop") / fillStyle.offsetHeight,
        name3("borderRightWidth", "paddingRight") / fillStyle.offsetWidth,
        name3("borderBottomWidth", "paddingBottom") / fillStyle.offsetHeight,
      ],
      fit: rot.objectFit || "",
      pos: rot.objectPosition || "",
      box: rot.objectViewBox || "",
    };
    if (innerHTML === "video") {
      bottom.video = true;
    }
    if (rot.position === "absolute" || rot.position === "fixed") {
      bottom.abs = true;
    }
    var left: Dynamic = autoDimensions(fillStyle);
    return left.w && left.h
      ? {
          off: "auto",
        }
      : (left.w && (bottom.autoW = true),
        left.h && (bottom.autoH = true),
        bottom);
  }
  function selectedTransformChrome(
    this: Dynamic,
    ..._extraArguments334: Dynamic[]
  ): Dynamic {
    if (
      !enabled ||
      !selectedTemplateIds.length ||
      selectedPart === "text" ||
      textEdit ||
      dragGesture ||
      drawingGesture ||
      marqueeGesture ||
      (document as Dynamic).body.hasAttribute("data-dc-editor-overlay-hidden")
    ) {
      markSelectedStroke(null);
      return null;
    }
    if (selectedTemplateIds.length > 1) {
      markSelectedStroke(null);
      return groupTransformChrome();
    }
    var fillStyle: Dynamic = findTemplateInstances(
      String(selectedTemplateIds[selectedTemplateIds.length - 1]),
      selectedComponentName,
    );
    if (
      fillStyle.length === 0 ||
      fillStyle[0].hasAttribute("data-sc-name") ||
      unwrapDisplayContentsHost(fillStyle[0]) !== fillStyle[0] ||
      isUneditableElement(fillStyle[0]) ||
      !isRootComponent(selectedComponentName)
    ) {
      markSelectedStroke(null);
      return null;
    }
    var innerHTML: Dynamic = firstRenderedInstance(fillStyle);
    if (!innerHTML) {
      if (!transformGesture || transformGesture.group) {
        markSelectedStroke(null);
        return null;
      }
      innerHTML = fillStyle[0];
    }
    var position: Dynamic =
      transformGesture && !transformGesture.group
        ? transformGesture.el
        : outerSvgElement(innerHTML);
    var shaft: Dynamic = position.getBoundingClientRect();
    if (!(shaft.width > 0) || !(shaft.height > 0)) {
      markSelectedStroke(null);
      return null;
    }
    var tag: Dynamic = editableSvgGeometry(position);
    var rot: Dynamic = tag ? null : decomposedElementTransform(position);
    var ref: Dynamic =
      freehandMode && !tag ? editableFreehandPath(position) : null;
    markSelectedStroke(tag ? unwrapDisplayContentsHost(innerHTML) : null);
    return {
      el: position,
      x: shaft.left,
      y: shaft.top,
      w: shaft.width,
      h: shaft.height,
      box: rotatedElementPose(position, shaft),
      media: mediaCropChrome(position),
      pen: ref
        ? {
            tid: parseInt(position.getAttribute("data-dc-tpl"), 10),
            x: shaft.left,
            y: shaft.top,
            w: shaft.width,
            h: shaft.height,
            vbW: ref.vbW,
            vbH: ref.vbH,
            kx: elementLayoutDimensions(position).w / shaft.width,
            ky: elementLayoutDimensions(position).h / shaft.height,
            d: value_wt && value_wt.el === position ? value_wt.origD : ref.d,
          }
        : null,
      rotatable:
        !!rot &&
        (position.style.transform
          ? !!parseTransformFunctions(position.style.transform)
          : !!rot.m.none) &&
        (getComputedStyle(position).display !== "inline" ||
          !!state16[(position.tagName || "").toLowerCase()]),
      deg:
        transformGesture && transformGesture.rotate
          ? transformGesture.lastDeg
          : null,
      stroke: tag
        ? {
            x1: shaft.left + (tag.px / tag.vbW) * shaft.width,
            y1: shaft.top + (tag.py / tag.vbH) * shaft.height,
            x2: shaft.left + (tag.tx / tag.vbW) * shaft.width,
            y2: shaft.top + (tag.ty / tag.vbH) * shaft.height,
          }
        : null,
    };
  }
  function finishEndpointGesture(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments335: Dynamic[]
  ): Dynamic {
    if (endpointGesture) {
      var innerHTML: Dynamic = endpointGesture;
      endpointGesture = null;
      (document as Dynamic).body.style.cursor =
        activeTool === "select" ? "" : "crosshair";
      if (!fillStyle || !innerHTML.last) {
        restoreSvgGeometry(innerHTML);
      } else {
        if (innerHTML.legacyBack > 0) {
          innerHTML.last = calculateSvgEndpointGeometry(
            {
              scl: innerHTML.scl,
              startLeft: innerHTML.startLeft,
              startTop: innerHTML.startTop,
              startRect: innerHTML.startRect,
              back: innerHTML.legacyBack,
            },
            innerHTML.ends[0],
            innerHTML.ends[1],
          );
        }
        items4 = [innerHTML];
        emitEditorEvent({
          type: "strokeEndpoint",
          tid: innerHTML.tid,
          name: innerHTML.name,
          gestureKey: innerHTML.gestureKey,
          left: innerHTML.last.left,
          top: innerHTML.last.top,
          width: innerHTML.last.w,
          height: innerHTML.last.h,
          d: innerHTML.last.d,
          isArrow: innerHTML.isArrow,
          unitScale: innerHTML.unitScale,
          paint: innerHTML.paint,
          svgPaint: innerHTML.svgPaint,
        });
      }
      refreshChrome();
    }
  }
  function beginEndpointGesture(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments336: Dynamic[]
  ): Dynamic {
    if (
      !(
        !enabled ||
        textEdit ||
        endpointGesture ||
        transformGesture ||
        selectedTemplateIds.length !== 1
      )
    ) {
      var shaft: Dynamic = findTemplateInstances(
        String(selectedTemplateIds[selectedTemplateIds.length - 1]),
        selectedComponentName,
      );
      var tag: Dynamic =
        shaft.length > 0
          ? outerSvgElement(firstRenderedInstance(shaft) || shaft[0])
          : null;
      var rot: Dynamic = tag ? editableSvgGeometry(tag) : null;
      if (rot) {
        var ref: Dynamic = tag.getBoundingClientRect();
        var top: Dynamic =
          elementViewportScale(tag.parentElement) ||
          elementViewportScale(tag) ||
          1;
        var name3: Dynamic = tag.style;
        var bottom: Dynamic =
          ref.left +
          ((fillStyle === 0 ? rot.tx : rot.px) / rot.vbW) * ref.width;
        var left: Dynamic =
          ref.top +
          ((fillStyle === 0 ? rot.ty : rot.py) / rot.vbH) * ref.height;
        var scope: Dynamic =
          ref.left +
          ((fillStyle === 0 ? rot.px : rot.tx) / rot.vbW) * ref.width;
        var top2: Dynamic =
          ref.top +
          ((fillStyle === 0 ? rot.py : rot.ty) / rot.vbH) * ref.height;
        items4 = [];
        endpointGesture = {
          el: tag,
          shaft: rot.shaft,
          tid: parseInt(tag.getAttribute("data-dc-tpl"), 10),
          name: componentScopeName(tag),
          which: fillStyle,
          isArrow: rot.isArrow,
          unitScale: rot.unitScale,
          paint: rot.paint,
          svgPaint: rot.svgPaint,
          gestureKey: "g" + Date.now(),
          scl: top,
          back: rot.back,
          startBack: rot.startBack,
          legacyBack: rot.legacyBack,
          fixX: bottom,
          fixY: left,
          grabDx: innerHTML - scope,
          grabDy: position - top2,
          startLeft: parseFloat(name3.left) || 0,
          startTop: parseFloat(name3.top) || 0,
          startRect: ref,
          origStyle: tag.getAttribute("style") || "",
          origGeom: value_Vo(rot.shaft),
          origVb: tag.getAttribute("viewBox"),
          origW: tag.getAttribute("width"),
          origH: tag.getAttribute("height"),
        };
      }
    }
  }
  function calculateSvgEndpointGeometry(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments337: Dynamic[]
  ): Dynamic {
    return value_Ed(fillStyle, innerHTML, position);
  }
  function applySvgEndpointGeometry(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments338: Dynamic[]
  ): Dynamic {
    fillStyle.style.left = position.left + "px";
    fillStyle.style.top = position.top + "px";
    fillStyle.style.width = position.w + "px";
    fillStyle.style.height = position.h + "px";
    fillStyle.setAttribute("width", position.w);
    fillStyle.setAttribute("height", position.h);
    fillStyle.setAttribute("viewBox", "0 0 " + position.w + " " + position.h);
    value_Sd(innerHTML, position.sx, position.sy, position.ex, position.ey);
  }
  function restoreSvgGeometry(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments339: Dynamic[]
  ): Dynamic {
    fillStyle.el.setAttribute("style", fillStyle.origStyle);
    if (fillStyle.origVb != null) {
      fillStyle.el.setAttribute("viewBox", fillStyle.origVb);
    } else {
      fillStyle.el.removeAttribute("viewBox");
    }
    if (fillStyle.origW != null) {
      fillStyle.el.setAttribute("width", fillStyle.origW);
    } else {
      fillStyle.el.removeAttribute("width");
    }
    if (fillStyle.origH != null) {
      fillStyle.el.setAttribute("height", fillStyle.origH);
    } else {
      fillStyle.el.removeAttribute("height");
    }
    for (var innerHTML in fillStyle.origGeom)
      if (fillStyle.origGeom[innerHTML] != null) {
        fillStyle.shaft.setAttribute(innerHTML, fillStyle.origGeom[innerHTML]);
      } else {
        fillStyle.shaft.removeAttribute(innerHTML);
      }
  }
  function updateEndpointGesture(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments340: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = endpointGesture;
    if (shaft) {
      var tag: Dynamic = {
        x: fillStyle - shaft.grabDx,
        y: innerHTML - shaft.grabDy,
      };
      var rot: Dynamic = {
        x: shaft.fixX,
        y: shaft.fixY,
      };
      if (position) {
        tag = value_Jo(rot, tag);
      }
      shaft.ends = shaft.which === 0 ? [tag, rot] : [rot, tag];
      shaft.last = calculateSvgEndpointGeometry(
        shaft,
        shaft.ends[0],
        shaft.ends[1],
      );
      applySvgEndpointGeometry(shaft.el, shaft.shaft, shaft.last);
      refreshChrome();
    }
  }
  function transformTargetInstances(
    this: Dynamic,
    ..._extraArguments341: Dynamic[]
  ): Dynamic {
    if (
      !enabled ||
      textEdit ||
      transformGesture ||
      endpointGesture ||
      selectedTemplateIds.length !== 1
    )
      return null;
    var fillStyle: Dynamic = findTemplateInstances(
      String(selectedTemplateIds[selectedTemplateIds.length - 1]),
      selectedComponentName,
    );
    if (fillStyle.length === 0) return null;
    for (var innerHTML: Dynamic = 0; innerHTML < fillStyle.length; innerHTML++)
      fillStyle[innerHTML] = outerSvgElement(fillStyle[innerHTML]);
    return {
      el: firstRenderedInstance(fillStyle) || fillStyle[0],
      els: fillStyle,
    };
  }
  function beginResize(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments342: Dynamic[]
  ): Dynamic {
    if (/^(n|s|e|w|nw|ne|sw|se)$/.test(fillStyle)) {
      if (selectedTemplateIds.length > 1) {
        beginGroupTransform(fillStyle, innerHTML, position);
        return;
      }
      var shaft: Dynamic = transformTargetInstances();
      if (shaft) {
        var tag: Dynamic = shaft.el;
        var rot: Dynamic = getComputedStyle(tag);
        var ref: Dynamic = tag.style;
        var top: Dynamic =
          rot.position === "absolute" || rot.position === "fixed";
        var name3: Dynamic = tag.getBoundingClientRect();
        var bottom: Dynamic = decomposedElementTransform(tag);
        var left: Dynamic = positioningAnchors(ref);
        var scope: Dynamic = !bottom || bottom.plain;
        var top2: Dynamic = scope
          ? elementViewportScale(tag)
          : parentLayoutScale(tag);
        var adjust: Dynamic = scope
          ? {
              w: name3.width / top2,
              h: name3.height / top2,
            }
          : elementLayoutDimensions(tag, rot);
        var axis: Dynamic = fractionalTransformOrigin(rot, adjust);
        var y: Dynamic = transformedResizeDirections(
          fillStyle,
          bottom,
          ancestorTransformSigns(tag),
        );
        transformGesture = {
          el: tag,
          els: shaft.els,
          tid: parseInt(tag.getAttribute("data-dc-tpl"), 10),
          name: componentScopeName(tag),
          dir: y.dir,
          west: y.west,
          east: y.east,
          north: y.north,
          south: y.south,
          gestureKey: "g" + Date.now(),
          scl: top2,
          x0: innerHTML,
          y0: position,
          w0: adjust.w,
          h0: adjust.h,
          plain: scope,
          m: scope ? state17 : bottom.m,
          grip: y,
          fx: axis.fx,
          fy: axis.fy,
          lastW: null,
          lastH: null,
          boxDx:
            rot.boxSizing === "border-box"
              ? 0
              : (parseFloat(rot.paddingLeft) || 0) +
                (parseFloat(rot.paddingRight) || 0) +
                (parseFloat(rot.borderLeftWidth) || 0) +
                (parseFloat(rot.borderRightWidth) || 0),
          boxDy:
            rot.boxSizing === "border-box"
              ? 0
              : (parseFloat(rot.paddingTop) || 0) +
                (parseFloat(rot.paddingBottom) || 0) +
                (parseFloat(rot.borderTopWidth) || 0) +
                (parseFloat(rot.borderBottomWidth) || 0),
          absX: top && left.x === "left",
          absY: top && left.y === "top",
          pinR: top && left.x === "right",
          pinB: top && left.y === "bottom",
          startLeft: pixelLengthOrFallback(ref.left, rot.left),
          startTop: pixelLengthOrFallback(ref.top, rot.top),
          startRight: pixelLengthOrFallback(ref.right, rot.right),
          startBottom: pixelLengthOrFallback(ref.bottom, rot.bottom),
          lastLeft: null,
          lastTop: null,
          lastRight: null,
          lastBottom: null,
        };
      }
    }
  }
  function beginRotation(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments343: Dynamic[]
  ): Dynamic {
    if (selectedTemplateIds.length > 1) {
      beginGroupTransform(null, fillStyle, innerHTML);
      return;
    }
    var position: Dynamic = transformTargetInstances();
    if (position) {
      var shaft: Dynamic = position.el;
      var tag: Dynamic = decomposedElementTransform(shaft);
      var rot: Dynamic =
        tag && (shaft.style.transform || tag.m.none)
          ? parseTransformFunctions(shaft.style.transform)
          : null;
      if (!(!rot || editableSvgGeometry(shaft))) {
        var ref: Dynamic = getComputedStyle(shaft);
        var top: Dynamic = shaft.getBoundingClientRect();
        var name3: Dynamic = elementLayoutDimensions(shaft, ref);
        var bottom: Dynamic = fractionalTransformOrigin(ref, name3);
        var left: Dynamic = parentLayoutScale(shaft);
        var scope: Dynamic = (0.5 - bottom.fx) * name3.w;
        var top2: Dynamic = (0.5 - bottom.fy) * name3.h;
        var adjust: Dynamic = ancestorTransformSigns(shaft);
        var axis: Dynamic =
          top.left +
          top.width / 2 -
          left * adjust.x * (tag.m.a * scope + tag.m.c * top2);
        var y: Dynamic =
          top.top +
          top.height / 2 -
          left * adjust.y * (tag.m.b * scope + tag.m.d * top2);
        transformGesture = {
          rotate: true,
          el: shaft,
          els: position.els,
          tid: parseInt(shaft.getAttribute("data-dc-tpl"), 10),
          name: componentScopeName(shaft),
          gestureKey: "g" + Date.now(),
          tf: rot,
          sense: adjust.x * adjust.y,
          px: axis,
          py: y,
          a0: Math.atan2(innerHTML - y, fillStyle - axis),
          deg0: rot.deg,
          lastDeg: null,
          lastPatch: null,
        };
      }
    }
  }
  function beginGroupTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments344: Dynamic[]
  ): Dynamic {
    if (!(!enabled || textEdit || transformGesture || endpointGesture)) {
      var shaft: Dynamic = transformableSelectionMembers();
      if (shaft) {
        items4 = [];
        for (
          var tag: Dynamic = storedSelectionTransform(shaft),
            rot: Dynamic = tag ? null : unionMemberBounds(shaft),
            ref: Dynamic = tag || {
              c: {
                x: rot.x + rot.w / 2,
                y: rot.y + rot.h / 2,
              },
              w: rot.w,
              h: rot.h,
              deg: 0,
            },
            top: Dynamic = false,
            name3: Dynamic = [],
            bottom: Dynamic = 0;
          bottom < shaft.length;
          bottom++
        ) {
          var left: Dynamic = shaft[bottom];
          var scope: Dynamic = left.el;
          var top2: Dynamic = left.cs;
          var adjust: Dynamic = left.r;
          left.c0 = {
            x: adjust.left + adjust.width / 2,
            y: adjust.top + adjust.height / 2,
          };
          left.c1 = left.c0;
          if (
            fillStyle
              ? !(left.sizable || left.movable)
              : !(left.rotatable || left.movable)
          ) {
            left.still = true;
            continue;
          }
          top = true;
          if (left.sep) {
            left.scl =
              elementViewportScale(scope.parentElement) ||
              elementViewportScale(scope) ||
              1;
            left.startRect = adjust;
            left.startLeft = parseFloat(scope.style.left) || 0;
            left.startTop = parseFloat(scope.style.top) || 0;
            left.shaft = left.sep.shaft;
            left.origStyle = scope.getAttribute("style") || "";
            left.origGeom = value_Vo(left.shaft);
            left.origVb = scope.getAttribute("viewBox");
            left.origW = scope.getAttribute("width");
            left.origH = scope.getAttribute("height");
            left.p0 = {
              x: adjust.left + (left.sep.px / left.sep.vbW) * adjust.width,
              y: adjust.top + (left.sep.py / left.sep.vbH) * adjust.height,
            };
            left.q0 = {
              x: adjust.left + (left.sep.tx / left.sep.vbW) * adjust.width,
              y: adjust.top + (left.sep.ty / left.sep.vbH) * adjust.height,
            };
            left.back = left.sep.back;
            left.startBack = left.sep.startBack;
            continue;
          }
          var axis: Dynamic = !left.pose || left.pose.plain;
          left.s = axis
            ? elementViewportScale(left.pe)
            : parentLayoutScale(scope);
          var y2: Dynamic = axis
            ? {
                w: adjust.width / left.s,
                h: adjust.height / left.s,
              }
            : elementLayoutDimensions(scope, top2);
          var pose: Dynamic = fractionalTransformOrigin(top2, y2);
          left.w0 = y2.w;
          left.h0 = y2.h;
          left.fx = pose.fx;
          left.fy = pose.fy;
          left.m = axis ? state17 : left.pose.m;
          left.rot = axis ? 0 : left.pose.rot;
          left.boxDx =
            top2.boxSizing === "border-box"
              ? 0
              : (parseFloat(top2.paddingLeft) || 0) +
                (parseFloat(top2.paddingRight) || 0) +
                (parseFloat(top2.borderLeftWidth) || 0) +
                (parseFloat(top2.borderRightWidth) || 0);
          left.boxDy =
            top2.boxSizing === "border-box"
              ? 0
              : (parseFloat(top2.paddingTop) || 0) +
                (parseFloat(top2.paddingBottom) || 0) +
                (parseFloat(top2.borderTopWidth) || 0) +
                (parseFloat(top2.borderBottomWidth) || 0);
          left.tf = left.rotatable
            ? parseTransformFunctions(scope.style.transform)
            : null;
          if (fillStyle && left.sizable) {
            name3.push({
              w: adjust.width,
              h: adjust.height,
              min: {
                w: 8 * left.s,
                h: 8 * left.s,
              },
            });
          }
        }
        for (
          var lock: Dynamic = ref.deg !== 0,
            paint: Dynamic = false,
            lastKey: Dynamic = 0;
          lastKey < shaft.length;
          lastKey++
        ) {
          if (shaft[lastKey].sizable && shaft[lastKey].turned) {
            lock = true;
          }
          if (shaft[lastKey].rotatable && !shaft[lastKey].movable) {
            paint = true;
          }
        }
        if (
          !(
            !top ||
            !(ref.w > 0) ||
            !(ref.h > 0) ||
            (fillStyle ? lock && fillStyle.length < 2 : paint)
          )
        ) {
          var lim: Dynamic = value_Md(
            {
              x: 0,
              y: 0,
              w: ref.w,
              h: ref.h,
            },
            name3,
          );
          lim.min = {
            w: Math.max(lim.min.w, Math.min(8, ref.w)),
            h: Math.max(lim.min.h, Math.min(8, ref.h)),
          };
          transformGesture = {
            group: true,
            rotate: !fillStyle,
            name: selectedComponentName,
            gestureKey: "g" + Date.now(),
            members: shaft,
            dir: fillStyle,
            west: !!fillStyle && fillStyle.indexOf("w") >= 0,
            east: !!fillStyle && fillStyle.indexOf("e") >= 0,
            north: !!fillStyle && fillStyle.indexOf("n") >= 0,
            south: !!fillStyle && fillStyle.indexOf("s") >= 0,
            x0: innerHTML,
            y0: position,
            f0: ref,
            live: ref,
            lim: lim,
            lock: lock,
            a0: Math.atan2(position - ref.c.y, innerHTML - ref.c.x),
            lastDeg: null,
            previewed: false,
          };
        }
      }
    }
  }
  function reapplyGroupTransforms(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments345: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 0;
      innerHTML < fillStyle.members.length;
      innerHTML++
    ) {
      var position: Dynamic = fillStyle.members[innerHTML];
      var shaft: Dynamic = position.el.isConnected
        ? [position.el]
        : findTemplateInstances(String(position.tid), fillStyle.name);
      if (position.lastPatch) {
        patchElementStyles(
          fillStyle.gestureKey + ":" + position.tid,
          shaft,
          position.lastPatch,
        );
      }
      if (position.last && shaft[0]) {
        var tag: Dynamic = editableSvgGeometry(shaft[0]);
        if (tag) {
          applySvgEndpointGeometry(shaft[0], tag.shaft, position.last);
        }
      }
    }
  }
  function pointInGroupCoordinates(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments346: Dynamic[]
  ): Dynamic {
    var position: Dynamic = value_Qa(innerHTML, fillStyle.c, -fillStyle.deg);
    return {
      x: position.x - fillStyle.c.x,
      y: position.y - fillStyle.c.y,
    };
  }
  function pointFromGroupCoordinates(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments347: Dynamic[]
  ): Dynamic {
    return value_Qa(
      {
        x: fillStyle.c.x + innerHTML.x,
        y: fillStyle.c.y + innerHTML.y,
      },
      fillStyle.c,
      fillStyle.deg,
    );
  }
  function updateGroupTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments348: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = transformGesture;
    var tag: Dynamic = shaft.f0;
    var rot: Dynamic = 1;
    var ref: Dynamic;
    if (shaft.rotate) {
      var top: Dynamic = value_Zo(
        tag.deg +
          ((Math.atan2(innerHTML - tag.c.y, fillStyle - tag.c.x) - shaft.a0) *
            180) /
            Math.PI,
        position,
      );
      shaft.lastDeg = top - normalizeDegrees(tag.deg);
      shaft.live = {
        c: tag.c,
        w: tag.w,
        h: tag.h,
        deg: top,
      };
      ref = function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments349: Dynamic[]
      ): Dynamic {
        return value_Qa(input, tag.c, shaft.lastDeg);
      };
    } else {
      var name3: Dynamic = pointInGroupCoordinates(
        {
          c: {
            x: shaft.x0,
            y: shaft.y0,
          },
          deg: tag.deg,
        },
        {
          x: fillStyle,
          y: innerHTML,
        },
      );
      var bottom: Dynamic = {
        x: -tag.w / 2,
        y: -tag.h / 2,
        w: tag.w,
        h: tag.h,
      };
      var left: Dynamic = resizeBoxDimensions(
        bottom,
        shaft.dir,
        name3.x,
        name3.y,
        position || shaft.lock,
        shaft.lim,
      );
      rot = left.w / tag.w;
      shaft.ky = left.h / tag.h;
      shaft.live = {
        c: pointFromGroupCoordinates(tag, {
          x: left.x + left.w / 2,
          y: left.y + left.h / 2,
        }),
        w: left.w,
        h: left.h,
        deg: tag.deg,
      };
      ref = function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments350: Dynamic[]
      ): Dynamic {
        return pointFromGroupCoordinates(
          tag,
          value_Pd(pointInGroupCoordinates(tag, input), bottom, left),
        );
      };
    }
    var scope: Dynamic = rot;
    var top2: Dynamic = shaft.rotate ? 1 : shaft.ky;
    var adjust: Dynamic = ((shaft.lastDeg || 0) * Math.PI) / 180;
    shaft.previewed = true;
    for (var axis: Dynamic = 0; axis < shaft.members.length; axis++) {
      var y2: Dynamic = shaft.members[axis];
      if (!y2.still) {
        if (!y2.el.isConnected) {
          var pose: Dynamic = findTemplateInstances(
            String(y2.tid),
            shaft.name,
          )[0];
          var lock: Dynamic =
            pose && y2.sep ? editableSvgGeometry(outerSvgElement(pose)) : null;
          if (pose && (!y2.sep || lock)) {
            y2.el = outerSvgElement(pose);
            if (lock) {
              y2.shaft = lock.shaft;
            }
          }
        }
        if (y2.sep) {
          y2.last = calculateSvgEndpointGeometry(y2, ref(y2.p0), ref(y2.q0));
          y2.c1 = ref(y2.c0);
          applySvgEndpointGeometry(y2.el, y2.shaft, y2.last);
          continue;
        }
        var paint: Dynamic = {};
        var lastKey: Dynamic = y2.w0;
        var lim: Dynamic = y2.h0;
        var text8: Dynamic = y2.m;
        if (!shaft.rotate && y2.sizable) {
          if (shaft.west || shaft.east || y2.turned) {
            lastKey = y2.w0 * scope;
            paint.width = Math.max(1, Math.round(lastKey - y2.boxDx)) + "px";
          }
          if (shaft.north || shaft.south || y2.turned) {
            lim = y2.h0 * top2;
            paint.height = Math.max(1, Math.round(lim - y2.boxDy)) + "px";
          }
        }
        if (shaft.rotate && y2.tf) {
          text8 = rotateMatrix(y2.m, adjust);
          y2.deg1 = normalizeDegrees(Math.round(y2.tf.deg + shaft.lastDeg));
          paint.transform = serializeRotatedTransform(y2.tf, y2.deg1);
        }
        if (y2.movable) {
          y2.c1 = ref(y2.c0);
          var value_S: Dynamic = transformOriginCompensation(
            y2.m,
            text8,
            y2.fx,
            y2.fy,
            y2.w0,
            y2.h0,
            lastKey,
            lim,
          );
          var expected: Dynamic = (y2.c1.x - y2.c0.x) / y2.s - value_S.x;
          var value_k: Dynamic = (y2.c1.y - y2.c0.y) / y2.s - value_S.y;
          if (y2.anc.useRight) {
            paint.right = Math.round(y2.anc.startRight - expected) + "px";
          } else {
            paint.left = Math.round(y2.anc.startLeft + expected) + "px";
          }
          if (y2.anc.useBottom) {
            paint.bottom = Math.round(y2.anc.startBottom - value_k) + "px";
          } else {
            paint.top = Math.round(y2.anc.startTop + value_k) + "px";
          }
        }
        y2.lastPatch = paint;
        patchElementStyles(shaft.gestureKey + ":" + y2.tid, [y2.el], paint);
        queueStylePreview({
          type: "stylePreview",
          tid: y2.tid,
          name: shaft.name,
          gestureKey: shaft.gestureKey,
          styles: paint,
        });
      }
    }
    refreshChrome();
  }
  function finishGroupTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments351: Dynamic[]
  ): Dynamic {
    if (!fillStyle.previewed) {
      refreshChrome();
      return;
    }
    var position: Dynamic = fillStyle.members.filter(function (
      this: Dynamic,
      top2?: Dynamic,
      ..._extraArguments352: Dynamic[]
    ): Dynamic {
      return !!top2.lastPatch;
    });
    if (
      fillStyle.rotate
        ? !fillStyle.lastDeg
        : Math.abs(fillStyle.live.w - fillStyle.f0.w) < 0.5 &&
          Math.abs(fillStyle.live.h - fillStyle.f0.h) < 0.5
    ) {
      innerHTML = false;
    }
    if (!innerHTML) {
      for (var shaft: Dynamic = 0; shaft < fillStyle.members.length; shaft++)
        if (fillStyle.members[shaft].last) {
          restoreSvgGeometry(fillStyle.members[shaft]);
        }
      for (var tag: Dynamic = 0; tag < position.length; tag++)
        emitEditorEvent({
          type: "styleRevert",
          tid: position[tag].tid,
          name: fillStyle.name,
          gestureKey: fillStyle.gestureKey,
          keepUndo: tag < position.length - 1,
          follower: tag < position.length - 1,
        });
      refreshChrome();
      return;
    }
    for (
      var rot: Dynamic = [], ref: Dynamic = 0;
      ref < fillStyle.members.length;
      ref++
    ) {
      var top: Dynamic = fillStyle.members[ref];
      if (top.last)
        rot.push({
          tid: top.tid,
          stroke: {
            left: top.last.left,
            top: top.last.top,
            width: top.last.w,
            height: top.last.h,
            d: top.last.d,
            isArrow: top.sep.isArrow,
            unitScale: top.sep.unitScale,
            paint: top.sep.paint,
            svgPaint: top.sep.svgPaint,
          },
        });
      else if (top.lastPatch) {
        var name3: Dynamic = {};
        for (var bottom in top.lastPatch)
          if (bottom !== "transform") {
            name3[bottom] = top.lastPatch[bottom];
          }
        rot.push({
          tid: top.tid,
          styles: name3,
          fixed: top.fixed,
          angle: fillStyle.rotate && top.tf ? top.deg1 : undefined,
        });
      }
    }
    items4 = fillStyle.members.filter(function (
      this: Dynamic,
      top2?: Dynamic,
      ..._extraArguments353: Dynamic[]
    ): Dynamic {
      return !!top2.last;
    });
    if (rot.length) {
      emitEditorEvent({
        type: "groupTransform",
        kind: fillStyle.rotate ? "rotate" : "resize",
        name: fillStyle.name,
        gestureKey: fillStyle.gestureKey,
        members: rot,
      });
    }
    var left: Dynamic = fillStyle.live;
    var scope: Dynamic = normalizeDegrees(left.deg);
    if (scope !== 0) {
      items8.push({
        key: fillStyle.name + "|" + selectedTemplateIds.join(","),
        w: left.w,
        h: left.h,
        deg: scope,
        anchors: fillStyle.members.map(function (
          this: Dynamic,
          top2?: Dynamic,
          ..._extraArguments354: Dynamic[]
        ): Dynamic {
          var adjust: Dynamic = unwrapDisplayContentsHost(
            top2.el,
          ).getBoundingClientRect();
          var axis: Dynamic = top2.pose
            ? decomposedElementTransform(top2.el)
            : null;
          return {
            tid: top2.tid,
            dx: adjust.left + adjust.width / 2 - left.c.x,
            dy: adjust.top + adjust.height / 2 - left.c.y,
            w: adjust.width,
            h: adjust.height,
            deg: axis ? Math.round((axis.rot * 180) / Math.PI) : 0,
          };
        }),
      });
      if (items8.length > 8) {
        items8.shift();
      }
    }
    refreshChrome();
  }
  function previewElementTransform(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments355: Dynamic[]
  ): Dynamic {
    if (isRootComponent(fillStyle.name)) {
      fillStyle.lastPatch = fillStyle.extra
        ? (Object as Dynamic).assign({}, innerHTML, fillStyle.extra)
        : innerHTML;
      patchElementStyles(
        fillStyle.gestureKey,
        fillStyle.els && fillStyle.els.length ? fillStyle.els : [fillStyle.el],
        fillStyle.lastPatch,
      );
    }
    var position: Dynamic = {
      type: "stylePreview",
      tid: fillStyle.tid,
      name: fillStyle.name,
      gestureKey: fillStyle.gestureKey,
      styles: innerHTML,
    };
    if (fillStyle.extra) {
      position.crop = true;
    }
    queueStylePreview(position);
    refreshChrome();
  }
  function updateRotation(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments356: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = transformGesture;
    if (!(!shaft || !shaft.rotate)) {
      if (shaft.group) {
        updateGroupTransform(fillStyle, innerHTML, position);
        return;
      }
      shaft.lastDeg = value_Zo(
        shaft.deg0 +
          (shaft.sense *
            (Math.atan2(innerHTML - shaft.py, fillStyle - shaft.px) -
              shaft.a0) *
            180) /
            Math.PI,
        position,
      );
      previewElementTransform(shaft, {
        transform: serializeRotatedTransform(shaft.tf, shaft.lastDeg),
      });
    }
  }
  function updateResize(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments357: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = transformGesture;
    if (!(!shaft || shaft.rotate)) {
      if (shaft.group) {
        updateGroupTransform(fillStyle, innerHTML, position);
        return;
      }
      var tag: Dynamic = unrotateDragDelta(
        shaft.grip,
        shaft.scl,
        fillStyle - shaft.x0,
        innerHTML - shaft.y0,
      );
      var rot: Dynamic = tag.x;
      var ref: Dynamic = tag.y;
      var top: Dynamic = shaft.west;
      var name3: Dynamic = shaft.east;
      var bottom: Dynamic = shaft.north;
      var left: Dynamic = shaft.south;
      var scope: Dynamic = top
        ? shaft.w0 - rot
        : name3
          ? shaft.w0 + rot
          : shaft.w0;
      var top2: Dynamic = bottom
        ? shaft.h0 - ref
        : left
          ? shaft.h0 + ref
          : shaft.h0;
      if (
        position &&
        (top || name3) &&
        (bottom || left) &&
        shaft.w0 > 0 &&
        shaft.h0 > 0
      ) {
        var adjust: Dynamic = shaft.w0 / shaft.h0;
        if (scope / shaft.w0 >= top2 / shaft.h0) {
          top2 = scope / adjust;
        } else {
          scope = top2 * adjust;
        }
      }
      if (top || name3) {
        scope = Math.max(8, scope);
      }
      if (bottom || left) {
        top2 = Math.max(8, top2);
      }
      shaft.lastW = scope;
      shaft.lastH = top2;
      var axis: Dynamic = resizeMatrixOffsets(
        shaft.dir,
        shaft.m,
        shaft.fx,
        shaft.fy,
        shaft.w0,
        shaft.h0,
        scope,
        top2,
      );
      if (shaft.absX && (top || !shaft.plain)) {
        shaft.lastLeft = shaft.startLeft + axis.x;
      } else {
        if (shaft.pinR && (name3 || !shaft.plain)) {
          shaft.lastRight = shaft.startRight + axis.r;
        }
      }
      if (shaft.absY && (bottom || !shaft.plain)) {
        shaft.lastTop = shaft.startTop + axis.y;
      } else {
        if (shaft.pinB && (left || !shaft.plain)) {
          shaft.lastBottom = shaft.startBottom + axis.b;
        }
      }
      var y: Dynamic = {};
      if (top || name3) {
        y.width = Math.round(scope - shaft.boxDx) + "px";
      }
      if (bottom || left) {
        y.height = Math.round(top2 - shaft.boxDy) + "px";
      }
      if (shaft.lastLeft != null) {
        y.left = Math.round(shaft.lastLeft) + "px";
      }
      if (shaft.lastTop != null) {
        y.top = Math.round(shaft.lastTop) + "px";
      }
      if (shaft.lastRight != null) {
        y.right = Math.round(shaft.lastRight) + "px";
      }
      if (shaft.lastBottom != null) {
        y.bottom = Math.round(shaft.lastBottom) + "px";
      }
      previewElementTransform(shaft, y);
    }
  }
  function finishTransformGesture(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments358: Dynamic[]
  ): Dynamic {
    if (transformGesture) {
      var innerHTML: Dynamic = transformGesture;
      transformGesture = null;
      pendingStyleEvents = {};
      (document as Dynamic).body.style.cursor =
        activeTool === "select" ? "" : "crosshair";
      if (innerHTML.group) {
        finishGroupTransform(innerHTML, fillStyle);
        return;
      }
      var position: Dynamic = innerHTML.rotate
        ? innerHTML.lastDeg != null
        : innerHTML.lastW != null;
      if (
        position &&
        (innerHTML.rotate
          ? innerHTML.lastDeg === normalizeDegrees(Math.round(innerHTML.deg0))
          : Math.round(innerHTML.lastW) === Math.round(innerHTML.w0) &&
            Math.round(innerHTML.lastH) === Math.round(innerHTML.h0))
      ) {
        fillStyle = false;
      }
      if (!fillStyle && position) {
        var shaft: Dynamic = {
          type: "styleRevert",
          tid: innerHTML.tid,
          name: innerHTML.name,
          gestureKey: innerHTML.gestureKey,
          keepUndo: false,
        };
        if (innerHTML.extra) {
          shaft.crop = true;
        }
        emitEditorEvent(shaft);
      }
      if (fillStyle && position && innerHTML.rotate)
        emitEditorEvent({
          type: "rotate",
          tid: innerHTML.tid,
          name: innerHTML.name,
          gestureKey: innerHTML.gestureKey,
          angle: innerHTML.lastDeg,
        });
      else if (fillStyle && position) {
        var tag: Dynamic = {
          type: "resize",
          tid: innerHTML.tid,
          name: innerHTML.name,
          gestureKey: innerHTML.gestureKey,
        };
        if (innerHTML.extra) {
          tag.crop = true;
        }
        if (innerHTML.west || innerHTML.east) {
          tag.width = Math.round(innerHTML.lastW - innerHTML.boxDx);
        }
        if (innerHTML.north || innerHTML.south) {
          tag.height = Math.round(innerHTML.lastH - innerHTML.boxDy);
        }
        if (innerHTML.lastLeft != null) {
          tag.left = Math.round(innerHTML.lastLeft);
        }
        if (innerHTML.lastTop != null) {
          tag.top = Math.round(innerHTML.lastTop);
        }
        if (innerHTML.lastRight != null) {
          tag.right = Math.round(innerHTML.lastRight);
        }
        if (innerHTML.lastBottom != null) {
          tag.bottom = Math.round(innerHTML.lastBottom);
        }
        emitEditorEvent(tag);
      }
      refreshChrome();
    }
  }
  function isRenderedElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments359: Dynamic[]
  ): Dynamic {
    try {
      return fillStyle.checkVisibility
        ? fillStyle.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          })
        : getComputedStyle(fillStyle).visibility !== "hidden";
    } catch {
      return true;
    }
  }
  function firstRenderedInstance(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments360: Dynamic[]
  ): Dynamic {
    for (var innerHTML: Dynamic = 0; innerHTML < fillStyle.length; innerHTML++)
      if (isRenderedElement(fillStyle[innerHTML])) return fillStyle[innerHTML];
    return null;
  }
  function visibleMarkedElements(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments361: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = [];
    if (
      fillStyle === "data-dc-editor-selected" &&
      dragGesture &&
      dragGesture.group &&
      !(document as Dynamic).body.hasAttribute("data-dc-editor-brk")
    )
      return innerHTML;
    for (
      var position: Dynamic = (document as Dynamic).querySelectorAll(
          "[" + fillStyle + "]",
        ),
        shaft: Dynamic = 0;
      shaft < position.length;
      shaft++
    ) {
      var tag: Dynamic = position[shaft];
      if (
        !(
          tag.hasAttribute("data-dc-editor-stroke") ||
          tag.hasAttribute("data-dc-editor-dragging") ||
          (tag.closest &&
            tag.closest(
              "[data-dc-editor-overlay-root],[data-dc-editor-overlay]",
            ))
        )
      ) {
        innerHTML.push(tag);
      }
    }
    return innerHTML;
  }
  function paintEditorChrome(
    this: Dynamic,
    ..._extraArguments362: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = selectedTransformChrome();
    var innerHTML: Dynamic = [];
    var position: Dynamic;
    if (
      (enabled || ringsOnlyEnabled) &&
      !(document as Dynamic).body.hasAttribute("data-dc-editor-overlay-hidden")
    ) {
      var shaft: Dynamic = visibleMarkedElements("data-dc-editor-selected");
      for (position = 0; position < shaft.length; position++)
        innerHTML.push({
          el: shaft[position],
          sel: true,
        });
      var tag: Dynamic = visibleMarkedElements("data-dc-editor-hover");
      for (position = 0; position < tag.length; position++)
        if (
          !(
            tag[position].hasAttribute("data-dc-editor-selected") ||
            tag[position].hasAttribute("data-dc-editor-hover-stroke")
          )
        ) {
          innerHTML.push({
            el: tag[position],
            sel: false,
          });
        }
    }
    var rot: Dynamic =
      (document as Dynamic).scrollingElement ||
      (document as Dynamic).documentElement;
    var ref: Dynamic = rot.scrollLeft > 0;
    var top: Dynamic = rot.scrollTop > 0;
    function name3(
      this: Dynamic,
      input?: Dynamic,
      expected?: Dynamic,
      context?: Dynamic,
      value?: Dynamic,
      el?: Dynamic,
      startRect?: Dynamic,
      argument?: Dynamic,
      ..._extraArguments363: Dynamic[]
    ): Dynamic {
      var covered: Dynamic = input + context;
      var value_G: Dynamic = expected + value;
      var back: Dynamic = false;
      if (ref) {
        if (input < 0) {
          input = 0;
          back = true;
        }
        if (covered > innerWidth) {
          covered = innerWidth;
          back = true;
        }
      }
      if (top) {
        if (expected < 0) {
          expected = 0;
          back = true;
        }
        if (value_G > innerHeight) {
          value_G = innerHeight;
          back = true;
        }
      }
      if (!(covered <= input || value_G <= expected)) {
        if (el === "grip" && back && !transformGesture && !endpointGesture) {
          el = "sel";
        }
        var x: Dynamic = {
          x: input,
          y: expected,
          w: covered - input,
          h: value_G - expected,
          k: el,
        };
        if (startRect && startRect.rot && (!back || transformGesture)) {
          x.x = startRect.x;
          x.y = startRect.y;
          x.w = startRect.w;
          x.h = startRect.h;
          x.rot = startRect.rot;
        }
        if (el === "grip" && fillStyle.rotatable) {
          x.rotatable = true;
          if (fillStyle.deg != null) {
            x.deg = fillStyle.deg;
          }
        }
        if (el === "grip" && fillStyle.media) {
          x.media = fillStyle.media;
        }
        if (el === "grip" && fillStyle.group) {
          x.group = true;
          if (fillStyle.noResize) {
            x.noResize = true;
          }
          if (fillStyle.noRotate) {
            x.noRotate = fillStyle.noRotate;
          }
          if (fillStyle.aspectLock) {
            x.aspectLock = true;
          }
        }
        if (argument) {
          x.component = true;
        }
        left.push(x);
      }
    }
    function bottom(
      this: Dynamic,
      input?: Dynamic,
      ..._extraArguments364: Dynamic[]
    ): Dynamic {
      return !input ||
        (ref &&
          (Math.min(input.x1, input.x2) < 0 ||
            Math.max(input.x1, input.x2) > innerWidth)) ||
        (top &&
          (Math.min(input.y1, input.y2) < 0 ||
            Math.max(input.y1, input.y2) > innerHeight))
        ? null
        : input;
    }
    var left: Dynamic = [];
    var scope: Dynamic = [];
    var top2: Dynamic = false;
    var adjust: Dynamic =
      fillStyle && fillStyle.group ? fillStyle.members : null;
    for (
      position = 0;
      position < innerHTML.length && left.length < 255;
      position++
    ) {
      var axis: Dynamic = innerHTML[position].sel
        ? value_Go(
            innerHTML[position].el,
            adjust,
            outerSvgElement,
            editableSvgGeometry,
          )
        : innerHTML[position].el;
      var y2: Dynamic = expandedSvgBounds(axis);
      var pose: Dynamic =
        innerHTML[position].sel &&
        selectedPart === "text" &&
        selectedTemplateIds.length === 1;
      if (pose) {
        var lock: Dynamic = textContentBounds(axis);
        if (lock) {
          y2 = {
            left: lock.l - 2,
            top: lock.t - 1,
            width: lock.r - lock.l + 4,
            height: lock.b - lock.t + 2,
          };
        }
      }
      if (
        !(
          !(y2.width > 0) ||
          !(y2.height > 0) ||
          !isRenderedElement(innerHTML[position].el)
        )
      ) {
        scope.push(axis);
        var paint: Dynamic = innerHTML[position].sel ? "sel" : "hov";
        if (fillStyle && !fillStyle.stroke) {
          if (axis === fillStyle.el) {
            paint = fillStyle.pen ? "sel" : "grip";
            top2 = true;
          } else if (
            innerHTML[position].sel &&
            value_$o(axis, fillStyle.el, value_Uo) !== axis
          )
            continue;
        }
        name3(
          y2.left,
          y2.top,
          y2.width,
          y2.height,
          paint,
          paint === "grip"
            ? fillStyle.box
            : pose
              ? null
              : rotatedElementPose(axis, y2),
          isNestedComponentImport(axis),
        );
      }
    }
    if (
      index > 0 &&
      (enabled || ringsOnlyEnabled) &&
      !(document as Dynamic).body.hasAttribute("data-dc-editor-overlay-hidden")
    ) {
      var lastKey: Dynamic = (document as Dynamic).querySelectorAll(
        "[data-dc-drop]",
      );
      for (
        position = 0;
        position < lastKey.length && left.length < 255;
        position++
      )
        if (
          state2[lastKey[position].getAttribute("data-dc-drop")] === 1 &&
          !lastKey[position].closest(
            "[data-dc-editor-overlay-root],[data-dc-editor-overlay]",
          )
        ) {
          var lim: Dynamic = lastKey[position].getBoundingClientRect();
          if (
            !(
              !(lim.width > 0) ||
              !(lim.height > 0) ||
              !isRenderedElement(lastKey[position])
            )
          ) {
            scope.push(lastKey[position]);
            name3(
              lim.left,
              lim.top,
              lim.width,
              lim.height,
              "busy",
              rotatedElementPose(lastKey[position], lim),
              false,
            );
          }
        }
    }
    if (fillStyle && !fillStyle.stroke && !top2) {
      name3(
        fillStyle.x,
        fillStyle.y,
        fillStyle.w,
        fillStyle.h,
        fillStyle.pen ? "sel" : "grip",
        fillStyle.box,
        isNestedComponentImport(fillStyle.el),
      );
    }
    observeChromeElements(scope);
    var text8: Dynamic =
      artboardHovered &&
      (enabled || ringsOnlyEnabled) &&
      !(document as Dynamic).body.hasAttribute("data-dc-editor-overlay-hidden");
    emitChrome(
      left,
      fillStyle &&
        fillStyle.stroke &&
        (endpointGesture || bottom(fillStyle.stroke))
        ? fillStyle.stroke
        : null,
      innerHTML.length ? measureSelectionChrome(ref, top, adjust) : null,
      text8,
      (fillStyle && fillStyle.pen) || null,
    );
  }
  function measureSelectionChrome(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments365: Dynamic[]
  ): Dynamic {
    if (
      !measurementEnabled ||
      !pointerInside ||
      !enabled ||
      activeTool !== "select" ||
      textEdit ||
      !selectedTemplateIds.length ||
      dragGesture ||
      transformGesture ||
      endpointGesture ||
      marqueeGesture ||
      drawingGesture ||
      penGesture ||
      penOverlay
    )
      return null;
    for (
      var shaft: Dynamic = visibleMarkedElements("data-dc-editor-selected"),
        tag: Dynamic = null,
        rot: Dynamic = null,
        ref: Dynamic = 0;
      ref < shaft.length;
      ref++
    ) {
      var top: Dynamic = value_Go(
        shaft[ref],
        position,
        outerSvgElement,
        editableSvgGeometry,
      ).getBoundingClientRect();
      if (
        !(
          !(top.width > 0) ||
          !(top.height > 0) ||
          !isRenderedElement(shaft[ref])
        )
      ) {
        if (!rot) {
          rot = shaft[ref];
        }
        tag = tag
          ? {
              l: Math.min(tag.l, top.left),
              t: Math.min(tag.t, top.top),
              r: Math.max(tag.r, top.right),
              b: Math.max(tag.b, top.bottom),
            }
          : {
              l: top.left,
              t: top.top,
              r: top.right,
              b: top.bottom,
            };
      }
    }
    if (!tag || !rot) return null;
    var name3: Dynamic = firstRenderedInstance(
      visibleMarkedElements("data-dc-editor-hover"),
    );
    var bottom: Dynamic =
      name3 && !name3.hasAttribute("data-dc-editor-selected") ? name3 : null;
    var left: Dynamic = bottom && svgGeometryBounds(bottom);
    if (left && !(left.width > 0 && left.height > 0)) {
      bottom = null;
      left = null;
    }
    for (
      var scope: Dynamic = findOuterComponentHost(),
        top2: Dynamic = bottom ? null : rot.parentElement;
      top2 && !left;
      top2 = top2.parentElement
    )
      if (
        !(
          !(top2.hasAttribute && top2.hasAttribute("data-dc-tpl")) &&
          top2 !== scope
        )
      ) {
        var adjust: Dynamic = top2.getBoundingClientRect();
        if (adjust.width > 0 && adjust.height > 0) {
          bottom = top2;
          left = adjust;
        }
      }
    for (
      var axis: Dynamic = left
          ? {
              l: left.left,
              t: left.top,
              r: left.right,
              b: left.bottom,
            }
          : {
              l: 0,
              t: 0,
              r: innerWidth,
              b: innerHeight,
            },
        y2: Dynamic = value_bd(tag, axis, ancestorViewportScale(rot)),
        pose: Dynamic = {
          lines: [],
          labels: [],
        },
        lock: Dynamic = 0;
      lock < y2.lines.length;
      lock++
    ) {
      var paint: Dynamic = y2.lines[lock];
      if (fillStyle) {
        paint.x1 = Math.max(0, Math.min(innerWidth, paint.x1));
        paint.x2 = Math.max(0, Math.min(innerWidth, paint.x2));
      }
      if (innerHTML) {
        paint.y1 = Math.max(0, Math.min(innerHeight, paint.y1));
        paint.y2 = Math.max(0, Math.min(innerHeight, paint.y2));
      }
      if (paint.x1 !== paint.x2 || paint.y1 !== paint.y2) {
        pose.lines.push(paint);
      }
    }
    for (var lastKey: Dynamic = 0; lastKey < y2.labels.length; lastKey++) {
      var lim: Dynamic = y2.labels[lastKey];
      if (
        !(
          (fillStyle && (lim.x < 0 || lim.x > innerWidth)) ||
          (innerHTML && (lim.y < 0 || lim.y > innerHeight))
        )
      ) {
        pose.labels.push(lim);
      }
    }
    return pose.lines.length ? pose : null;
  }
  function composedParent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments366: Dynamic[]
  ): Dynamic {
    return (
      fillStyle.assignedSlot ||
      fillStyle.parentElement ||
      (fillStyle.parentNode && fillStyle.parentNode.host) ||
      null
    );
  }
  function ancestorViewportScale(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments367: Dynamic[]
  ): Dynamic {
    return ancestorTransformInfo(fillStyle).scale;
  }
  function ancestorTransformInfo(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments368: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 1,
        position: Dynamic = null,
        shaft: Dynamic = false,
        tag: Dynamic = fillStyle ? composedParent(fillStyle) : null;
      tag;
      tag = composedParent(tag)
    )
      if (tag.nodeType === 1) {
        var rot: Dynamic = getComputedStyle(tag);
        if (rot.transform && rot.transform !== "none")
          try {
            var ref: Dynamic = new DOMMatrixReadOnly(rot.transform);
            innerHTML *= Math.sqrt(ref.a * ref.a + ref.b * ref.b) || 1;
            if (
              Math.abs(ref.b) > 1e-6 ||
              Math.abs(ref.c) > 1e-6 ||
              ref.a < 0 ||
              ref.d < 0
            ) {
              shaft = true;
            }
          } catch {}
        if (
          rot.rotate &&
          rot.rotate !== "none" &&
          parseFloat(rot.rotate) !== 0
        ) {
          shaft = true;
        }
        var top: Dynamic =
          rot.scale && rot.scale !== "none"
            ? Math.abs(parseFloat(rot.scale))
            : NaN;
        if (top > 0) {
          innerHTML *= top;
        }
        if (rot.scale && /(^| )-/.test(rot.scale)) {
          shaft = true;
        }
        var name3: Dynamic = parseFloat(rot.zoom);
        if (name3 > 0 && name3 !== 1) {
          innerHTML *= name3;
        }
        if (!position && tag.offsetWidth >= 16) {
          position = tag;
        }
      }
    if (position && !shaft) {
      var bottom: Dynamic =
        position.getBoundingClientRect().width / position.offsetWidth;
      if (
        bottom > 0 &&
        Math.abs(innerHTML - bottom) >
          bottom * (1.25 / position.offsetWidth + 0.005)
      ) {
        innerHTML = bottom;
      }
    }
    return {
      scale: innerHTML > 0 && isFinite(innerHTML) ? innerHTML : 1,
      rotated: shaft,
    };
  }
  function emitChrome(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments369: Dynamic[]
  ): Dynamic {
    var rot: Dynamic = {
      type: "chrome",
      rings: fillStyle,
      stroke: innerHTML,
      measure: position || null,
      guides: (dragGesture && snapGuides) || null,
      artboard: !!shaft,
      pen: tag || null,
    };
    var ref: Dynamic = JSON.stringify(rot);
    if (ref !== lastChromeJson) {
      lastChromeJson = ref;
      emitEditorEvent(rot);
    }
  }
  function observeChromeElements(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments370: Dynamic[]
  ): Dynamic {
    if (chromeResizeObserver) {
      if (fillStyle.length === items3.length) {
        for (
          var innerHTML: Dynamic = true, position: Dynamic = 0;
          position < fillStyle.length;
          position++
        )
          if (fillStyle[position] !== items3[position]) {
            innerHTML = false;
            break;
          }
        if (innerHTML) return;
      }
      chromeResizeObserver.disconnect();
      for (var shaft: Dynamic = 0; shaft < fillStyle.length; shaft++)
        chromeResizeObserver.observe(fillStyle[shaft]);
      items3 = fillStyle;
    }
  }
  function onlyStylePatchMutations(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments371: Dynamic[]
  ): Dynamic {
    for (var innerHTML: Dynamic = 0; innerHTML < event.length; innerHTML++)
      if (
        event[innerHTML].type &&
        event[innerHTML].attributeName !== "data-dc-editor-patch"
      )
        return false;
    return true;
  }
  function hasContentMutations(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments372: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 0;
      innerHTML < fillStyle.length;
      innerHTML++
    ) {
      var position: Dynamic = fillStyle[innerHTML];
      if (
        position.type !== "attributes" ||
        String(position.attributeName || "").indexOf("data-dc-editor") !== 0
      )
        return true;
    }
    return false;
  }
  function onContentMutation(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments373: Dynamic[]
  ): Dynamic {
    if (value_ca && event && !onlyStylePatchMutations(event)) {
      reapplyGesturePatches();
    }
    if (event && event.length && hasContentMutations(event)) {
      layoutGeneration++;
    }
    if (!chromeRefreshPending) {
      chromeRefreshPending = true;
      requestAnimationFrame(function (
        this: Dynamic,
        ..._extraArguments374: Dynamic[]
      ): Dynamic {
        chromeRefreshPending = false;
        refreshParkedDrag();
        refreshChrome();
        emitDirectiveState(false);
      });
    }
  }
  function maximumInstanceCount(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments375: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 0, position: Dynamic = 0;
      position < fillStyle.length;
      position++
    ) {
      var shaft: Dynamic = findTemplateInstances(
        String(fillStyle[position]),
        directiveComponentName,
      ).length;
      if (shaft > innerHTML) {
        innerHTML = shaft;
      }
    }
    return innerHTML;
  }
  function emitDirectiveState(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments376: Dynamic[]
  ): Dynamic {
    if (directiveMap) {
      var innerHTML: Dynamic = {};
      for (var position in directiveMap) {
        var shaft: Dynamic = directiveMap[position];
        if (shaft.kind === "if") {
          innerHTML[position] = {
            on: maximumInstanceCount(shaft.kids) > 0,
          };
        } else {
          if (shaft.countKids && shaft.countKids.length > 0) {
            innerHTML[position] = {
              count: maximumInstanceCount(shaft.countKids),
            };
          }
        }
      }
      var tag: Dynamic = JSON.stringify(innerHTML);
      if (!(!fillStyle && tag === value_al)) {
        value_al = tag;
        emitEditorEvent({
          type: "directiveState",
          name: directiveComponentName,
          states: innerHTML,
        });
      }
    }
  }
  var count9: Dynamic = 14;
  function clearGapOverlay(
    this: Dynamic,
    ..._extraArguments377: Dynamic[]
  ): Dynamic {
    gapSegments = [];
    gapOverlayTarget = null;
    if (gapOverlay && gapOverlay.style.display !== "none") {
      for (
        var fillStyle: Dynamic = 0;
        fillStyle < gapOverlay.children.length;
        fillStyle++
      )
        gapOverlay.children[fillStyle].style.opacity = "0";
      setTimeout(function (
        this: Dynamic,
        ..._extraArguments378: Dynamic[]
      ): Dynamic {
        if (gapOverlay && gapOverlayTarget === null) {
          gapOverlay.style.display = "none";
        }
      }, 160);
    }
  }
  function ensureGapOverlay(
    this: Dynamic,
    ..._extraArguments379: Dynamic[]
  ): Dynamic {
    return (
      gapOverlay ||
      ((gapOverlay = (document as Dynamic).createElement("div")),
      gapOverlay.setAttribute("data-dc-editor-overlay", ""),
      (gapOverlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483644;pointer-events:none;display:none;"),
      ensureOverlayRoot().appendChild(gapOverlay),
      gapOverlay)
    );
  }
  function containerGapSegments(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments380: Dynamic[]
  ): Dynamic {
    for (
      var shaft: Dynamic = [],
        tag: Dynamic = fillStyle.getBoundingClientRect(),
        rot: Dynamic = [],
        ref: Dynamic = false,
        top: Dynamic = 0;
      top < fillStyle.children.length;
      top++
    ) {
      var name3: Dynamic = fillStyle.children[top];
      if (
        name3 !== position &&
        !(!name3.getAttribute || name3.getAttribute("data-dc-tpl") == null)
      ) {
        var bottom: Dynamic = getComputedStyle(name3);
        if (bottom.display !== "none") {
          if (isDeckStageWrapper(name3) || isCollapsedDeckWrapper(name3)) {
            ref = true;
            continue;
          }
          if (
            !(bottom.position === "absolute" || bottom.position === "fixed")
          ) {
            if (bottom.display !== "contents") {
              rot.push(name3);
            }
          }
        }
      }
    }
    if (ref) return shaft;
    var left: Dynamic = getComputedStyle(fillStyle);
    var scope: Dynamic =
      left.display.indexOf("flex") !== -1 &&
      left.flexDirection.indexOf("row") === 0;
    var top2: Dynamic = left.display.indexOf("grid") !== -1;
    if (rot.length === 0) {
      if (tag.width === 0 && tag.height === 0) return shaft;
      var adjust: Dynamic = 6;
      shaft.push({
        x1: tag.left + adjust,
        y1: tag.top + adjust,
        x2: tag.right - adjust,
        y2: tag.top + adjust,
        targetTid: innerHTML,
        position: innerHTML == null ? "root-end" : "into",
      });
      return shaft;
    }
    function axis(
      this: Dynamic,
      element?: Dynamic,
      ..._extraArguments381: Dynamic[]
    ): Dynamic {
      return parseInt(element.getAttribute("data-dc-tpl"), 10);
    }
    if (top2) {
      for (var y2: Dynamic = 0; y2 < rot.length; y2++) {
        var pose: Dynamic = rot[y2].getBoundingClientRect();
        shaft.push({
          x1: pose.left - 3,
          y1: pose.top,
          x2: pose.left - 3,
          y2: pose.bottom,
          targetTid: axis(rot[y2]),
          position: "before",
        });
      }
      var lock: Dynamic = rot[rot.length - 1].getBoundingClientRect();
      shaft.push({
        x1: lock.right + 3,
        y1: lock.top,
        x2: lock.right + 3,
        y2: lock.bottom,
        targetTid: axis(rot[rot.length - 1]),
        position: "after",
      });
      return shaft;
    }
    for (var paint: Dynamic = 0; paint <= rot.length; paint++) {
      var lastKey: Dynamic =
        paint > 0 ? rot[paint - 1].getBoundingClientRect() : null;
      var lim: Dynamic =
        paint < rot.length ? rot[paint].getBoundingClientRect() : null;
      var text8: Dynamic;
      if (scope) {
        var value_S: Dynamic =
          lastKey && lim
            ? (lastKey.right + lim.left) / 2
            : lastKey
              ? lastKey.right + 3
              : lim.left - 3;
        var expected: Dynamic = Math.min(
          lastKey ? lastKey.top : lim.top,
          lim ? lim.top : lastKey.top,
        );
        var value_k: Dynamic = Math.max(
          lastKey ? lastKey.bottom : lim.bottom,
          lim ? lim.bottom : lastKey.bottom,
        );
        text8 = {
          x1: value_S,
          y1: expected,
          x2: value_S,
          y2: value_k,
        };
      } else {
        var value_N: Dynamic =
          lastKey && lim
            ? (lastKey.bottom + lim.top) / 2
            : lastKey
              ? lastKey.bottom + 3
              : lim.top - 3;
        var el: Dynamic = Math.min(
          lastKey ? lastKey.left : lim.left,
          lim ? lim.left : lastKey.left,
        );
        var startRect: Dynamic = Math.max(
          lastKey ? lastKey.right : lim.right,
          lim ? lim.right : lastKey.right,
        );
        text8 = {
          x1: el,
          y1: value_N,
          x2: startRect,
          y2: value_N,
        };
      }
      if (paint < rot.length) {
        text8.targetTid = axis(rot[paint]);
        text8.position = "before";
      } else {
        text8.targetTid = axis(rot[rot.length - 1]);
        text8.position = "after";
      }
      shaft.push(text8);
    }
    return shaft;
  }
  function paintContainerGaps(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    ..._extraArguments382: Dynamic[]
  ): Dynamic {
    var rot: Dynamic = ensureGapOverlay();
    if (gapOverlayTarget !== fillStyle) {
      for (
        gapOverlayTarget = fillStyle,
          gapSegments = containerGapSegments(fillStyle, innerHTML, position);
        rot.firstChild;

      )
        rot.removeChild(rot.firstChild);
      var ref: Dynamic = "start";
      try {
        var top: Dynamic = getComputedStyle(fillStyle);
        var name3: Dynamic = top.display || "";
        if (name3.indexOf("flex") !== -1 || name3.indexOf("grid") !== -1) {
          var bottom: Dynamic =
            (name3.indexOf("grid") !== -1 && top.justifyItems) ||
            "" ||
            top.alignItems ||
            "";
          ref =
            bottom.indexOf("end") !== -1
              ? "end"
              : bottom.indexOf("start") !== -1 || bottom === "baseline"
                ? "start"
                : "center";
        }
      } catch {}
      for (var left: Dynamic = 0; left < gapSegments.length; left++) {
        var scope: Dynamic = (document as Dynamic).createElement("div");
        scope.style.cssText =
          "position:fixed;background:#fff;border:1.5px solid " +
          CHROME_STROKE +
          ";border-radius:99px;pointer-events:none;opacity:0;transition:opacity 0.15s ease;box-sizing:border-box;";
        var top2: Dynamic = gapSegments[left];
        if (top2.x1 === top2.x2) {
          var adjust: Dynamic = Math.min(50, Math.max(14, top2.y2 - top2.y1));
          var axis: Dynamic =
            ref === "start"
              ? top2.y1
              : ref === "end"
                ? top2.y2 - adjust
                : (top2.y1 + top2.y2) / 2 - adjust / 2;
          scope.style.left = top2.x1 - 3 + "px";
          scope.style.top = axis + "px";
          scope.style.width = "6px";
          scope.style.height = adjust + "px";
          top2.capX1 = top2.x1 - 3;
          top2.capX2 = top2.x1 + 3;
          top2.capY1 = axis;
          top2.capY2 = axis + adjust;
        } else {
          var y2: Dynamic = Math.min(50, Math.max(14, top2.x2 - top2.x1));
          var pose: Dynamic =
            ref === "start"
              ? top2.x1
              : ref === "end"
                ? top2.x2 - y2
                : (top2.x1 + top2.x2) / 2 - y2 / 2;
          scope.style.left = pose + "px";
          scope.style.top = top2.y1 - 3 + "px";
          scope.style.width = y2 + "px";
          scope.style.height = "6px";
          top2.capX1 = pose;
          top2.capX2 = pose + y2;
          top2.capY1 = top2.y1 - 3;
          top2.capY2 = top2.y1 + 3;
        }
        rot.appendChild(scope);
        top2.node = scope;
      }
      requestAnimationFrame(function (
        this: Dynamic,
        ..._extraArguments383: Dynamic[]
      ): Dynamic {
        if (gapOverlay)
          for (
            var lastKey: Dynamic = 0;
            lastKey < gapOverlay.children.length;
            lastKey++
          )
            gapOverlay.children[lastKey].style.opacity = "1";
      });
    }
    rot.style.display = "block";
    for (
      var lock: Dynamic = nearestGapSegment(shaft, tag), paint: Dynamic = 0;
      paint < gapSegments.length;
      paint++
    ) {
      gapSegments[paint].node.style.background =
        gapSegments[paint] === lock
          ? CHROME_STROKE
          : "color-mix(in srgb," + CHROME_STROKE + " 55%,transparent)";
      gapSegments[paint].node.style.boxShadow =
        gapSegments[paint] === lock
          ? "0 0 0 2px color-mix(in srgb," + CHROME_STROKE + " 25%,transparent)"
          : "none";
    }
  }
  function pointToSegmentDistance(
    this: Dynamic,
    x?: Dynamic,
    y?: Dynamic,
    segment?: Dynamic,
    ..._extraArguments384: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = segment.x2 - segment.x1;
    var tag: Dynamic = segment.y2 - segment.y1;
    var rot: Dynamic = shaft * shaft + tag * tag;
    var ref: Dynamic =
      rot === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((x - segment.x1) * shaft + (y - segment.y1) * tag) / rot,
            ),
          );
    var top: Dynamic = segment.x1 + ref * shaft;
    var name3: Dynamic = segment.y1 + ref * tag;
    return Math.sqrt((x - top) * (x - top) + (y - name3) * (y - name3));
  }
  function nearestGapSegment(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments385: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = null, shaft: Dynamic = 2, tag: Dynamic = 0;
      tag < gapSegments.length;
      tag++
    ) {
      var rot: Dynamic = gapSegments[tag];
      var ref: Dynamic;
      if (rot.capX1 != null) {
        var top: Dynamic = Math.max(
          rot.capX1 - fillStyle,
          0,
          fillStyle - rot.capX2,
        );
        var name3: Dynamic = Math.max(
          rot.capY1 - innerHTML,
          0,
          innerHTML - rot.capY2,
        );
        ref = Math.sqrt(top * top + name3 * name3);
      } else {
        ref = pointToSegmentDistance(fillStyle, innerHTML, rot);
        if (ref > count9) {
          ref = 1 / 0;
        }
      }
      if (ref <= shaft) {
        shaft = ref;
        position = rot;
      }
    }
    return position;
  }
  function appendPenPreviewPath(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments386: Dynamic[]
  ): Dynamic {
    if (!penOverlay) {
      var innerHTML: Dynamic = (document as Dynamic).createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      innerHTML.setAttribute("data-dc-editor-overlay", "");
      innerHTML.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;z-index:2147483646;pointer-events:none;";
      ensureOverlayRoot().appendChild(innerHTML);
      penOverlay = {
        svg: innerHTML,
      };
    }
    var position: Dynamic = (document as Dynamic).createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    position.setAttribute("fill", "none");
    position.style.stroke = CHROME_STROKE;
    position.setAttribute("stroke-width", "2");
    position.setAttribute("stroke-linecap", "round");
    position.setAttribute("stroke-linejoin", "round");
    penOverlay.svg.appendChild(position);
    penGesture = {
      points: [[fillStyle.clientX, fillStyle.clientY]],
      path: position,
      parent: drawingContainerAt(fillStyle.clientX, fillStyle.clientY),
    };
    hidePlacementOverlay();
  }
  function serializePolyline(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments387: Dynamic[]
  ): Dynamic {
    for (
      var tag: Dynamic = shaft || 1, rot: Dynamic = "", ref: Dynamic = 0;
      ref < fillStyle.length;
      ref++
    )
      rot +=
        (ref === 0 ? "M" : "L") +
        Math.round((fillStyle[ref][0] - innerHTML) / tag) +
        " " +
        Math.round((fillStyle[ref][1] - position) / tag) +
        " ";
    return rot.trim();
  }
  var count10: Dynamic = 1.25;
  var value_wt: Dynamic = null;
  var value_Ac: Dynamic =
    /^M ?-?\d+(\.\d+)?[ ,]-?\d+(\.\d+)?( ?([ML] ?-?\d+(\.\d+)?[ ,]-?\d+(\.\d+)?|C ?-?\d+(\.\d+)?([ ,]-?\d+(\.\d+)?){5}))+$/;
  var value_Cu: Dynamic = /^-?\d+(\.\d+)?px$/;
  function editableFreehandPath(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments388: Dynamic[]
  ): Dynamic {
    if (
      !fillStyle ||
      (fillStyle.tagName || "").toLowerCase() !== "svg" ||
      editableSvgGeometry(fillStyle) ||
      fillStyle.getAttribute("preserveAspectRatio") !== "none" ||
      fillStyle.style.position !== "absolute" ||
      !value_Cu.test(fillStyle.style.left) ||
      !value_Cu.test(fillStyle.style.top) ||
      (getComputedStyle(fillStyle).fill || "") !== "none"
    )
      return null;
    for (
      var innerHTML: Dynamic = null, position: Dynamic = 0;
      position < fillStyle.children.length;
      position++
    ) {
      if (
        (fillStyle.children[position].tagName || "").toLowerCase() !== "path" ||
        innerHTML
      )
        return null;
      innerHTML = fillStyle.children[position];
    }
    var shaft: Dynamic = (innerHTML && innerHTML.getAttribute("d")) || "";
    if (shaft.length > count11 || !value_Ac.test(shaft)) return null;
    var tag: Dynamic = (fillStyle.getAttribute("viewBox") || "")
      .split(/[\s,]+/)
      .map(Number);
    if (
      tag.length !== 4 ||
      tag[0] !== 0 ||
      tag[1] !== 0 ||
      !(tag[2] > 0) ||
      !(tag[3] > 0)
    )
      return null;
    var rot: Dynamic = decomposedElementTransform(fillStyle);
    return !rot || !rot.plain || ancestorTransformInfo(fillStyle).rotated
      ? null
      : {
          path: innerHTML,
          d: shaft,
          vbW: tag[2],
          vbH: tag[3],
        };
  }
  function selectedFreehandPath(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments389: Dynamic[]
  ): Dynamic {
    if (!enabled || selectedTemplateIds.length !== 1) return null;
    var innerHTML: Dynamic = findTemplateInstances(
      String(selectedTemplateIds[0]),
      selectedComponentName,
    );
    var position: Dynamic = innerHTML.length
      ? outerSvgElement(firstRenderedInstance(innerHTML) || innerHTML[0])
      : null;
    return position &&
      parseInt(position.getAttribute("data-dc-tpl"), 10) === fillStyle &&
      editableFreehandPath(position)
      ? position
      : null;
  }
  var count11: Dynamic = 24e3;
  function simplifyPenPath(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments390: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = innerHTML;
      position > 0 && isFinite(position) && position <= 16 * innerHTML;
      position *= 2
    ) {
      var shaft: Dynamic = value_Qo(fillStyle, position);
      if (!shaft || shaft.length <= 4) break;
      if (!(shaft.length * 2 > count11)) {
        var tag: Dynamic = value_jo(shaft, 1);
        if (tag.length <= count11) return tag;
      }
    }
    for (
      var rot: Dynamic = serializePolyline(fillStyle, 0, 0), ref: Dynamic = 2;
      rot.length > 95e3;
      ref++
    )
      rot = serializePolyline(
        fillStyle.filter(function (
          this: Dynamic,
          top?: Dynamic,
          name3?: Dynamic,
          ..._extraArguments391: Dynamic[]
        ): Dynamic {
          return name3 % ref === 0 || name3 === fillStyle.length - 1;
        }),
        0,
        0,
      );
    return rot;
  }
  function insertPenDrawing(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments392: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = 1 / 0,
        shaft: Dynamic = 1 / 0,
        tag: Dynamic = -1 / 0,
        rot: Dynamic = -1 / 0,
        ref: Dynamic = 0;
      ref < innerHTML.length;
      ref++
    ) {
      position = Math.min(position, innerHTML[ref][0]);
      tag = Math.max(tag, innerHTML[ref][0]);
      shaft = Math.min(shaft, innerHTML[ref][1]);
      rot = Math.max(rot, innerHTML[ref][1]);
    }
    if (fillStyle.el && !fillStyle.el.isConnected) {
      fillStyle = drawingContainerAt(innerHTML[0][0], innerHTML[0][1]);
    }
    var top: Dynamic = fillStyle.el;
    var name3: Dynamic =
      fillStyle.tid != null && top
        ? parseInt(top.getAttribute("data-dc-tpl"), 10)
        : NaN;
    var bottom: Dynamic = isNaN(name3) ? fillStyle.tid : name3;
    var left: Dynamic =
      bottom != null && top ? top.getBoundingClientRect() : fillStyle.rect;
    var scope: Dynamic = top ? elementViewportScale(top) : panZoomScale || 1;
    var top2: Dynamic = Math.max(2, Math.round((tag - position) / scope));
    var adjust: Dynamic = Math.max(2, Math.round((rot - shaft) / scope));
    emitEditorEvent({
      type: "insert",
      name: fillStyle.name,
      targetTid: bottom,
      position: bottom == null ? "root-end" : "into",
      rect: {
        x: Math.round((position - left.left) / scope),
        y: Math.round((shaft - left.top) / scope),
        w: top2,
        h: adjust,
      },
      path: {
        d: simplifyPenPath(
          innerHTML.map(function (
            this: Dynamic,
            axis?: Dynamic,
            ..._extraArguments393: Dynamic[]
          ): Dynamic {
            return [(axis[0] - position) / scope, (axis[1] - shaft) / scope];
          }),
          count10 / hostScale / scope,
        ),
      },
    });
  }
  function finishPenStroke(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments394: Dynamic[]
  ): Dynamic {
    if (penGesture) {
      var innerHTML: Dynamic = penGesture;
      penGesture = null;
      if (!fillStyle || innerHTML.points.length < 2) {
        innerHTML.path.remove();
        return;
      }
      if (!penOverlay) {
        innerHTML.path.remove();
        return;
      }
      watchPendingInsert(innerHTML.path);
      insertPenDrawing(innerHTML.parent, innerHTML.points);
    }
  }
  function finishPenDrawing(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments395: Dynamic[]
  ): Dynamic {
    if (penGesture) {
      finishPenStroke(fillStyle);
    }
    if (!!penOverlay) {
      var position: Dynamic = penOverlay;
      penOverlay = null;
      if (pendingInserts) {
        watchPendingInsert(position.svg);
      } else {
        position.svg.remove();
      }
      if (fillStyle && innerHTML) {
        emitEditorEvent({
          type: "insert",
          name: null,
          targetTid: null,
          position: "root-end",
          endTool: true,
        });
      }
    }
  }
  function onEditorMouseUp(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments396: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = value_Le;
    value_Le = null;
    gestureKey = null;
    if (innerHTML && event.type === "mouseup" && pendingDrag && !dragGesture) {
      suppressClick = true;
      contextMenuAtElement(
        innerHTML.x,
        innerHTML.y,
        innerHTML.el && innerHTML.el.isConnected
          ? innerHTML.el
          : stampedEventTarget(event),
        innerHTML.was,
      );
      return;
    }
    pendingDrag = null;
    value_St = null;
    pendingMarquee = null;
    svgSelectionAnchor = null;
    if (marqueeGesture) {
      suppressClick = true;
      value_lt = null;
      finishMarquee();
      return;
    }
    if (value_lt) {
      setTimeout(function (
        this: Dynamic,
        ..._extraArguments397: Dynamic[]
      ): Dynamic {
        value_lt = null;
      }, 0);
    }
    if (penGesture) {
      suppressClick = true;
      finishPenStroke(true);
      return;
    }
    if (endpointGesture) {
      suppressClick = true;
      finishEndpointGesture(true);
      return;
    }
    if (transformGesture) {
      suppressClick = true;
      finishTransformGesture(true);
      return;
    }
    if (drawingGesture) {
      suppressClick = true;
      finishShapeDrawing(true);
      return;
    }
    if (dragGesture) {
      suppressClick = true;
      if (dragGesture.exited) {
        dragGesture.droppedOut = true;
        emitEditorEvent({
          type: "dragDrop",
          gestureKey: dragGesture.gestureKey,
          x: event.clientX,
          y: event.clientY,
          alt: !!(dragGesture.alt || event.altKey),
          ctrl: !!event.ctrlKey,
        });
        finishDragGesture(false);
      } else {
        finishDragGesture(true);
      }
    }
  }
  var pan: Dynamic = {
    x: 0,
    y: 0,
  };
  function panZoomRoot(
    this: Dynamic,
    ..._extraArguments398: Dynamic[]
  ): Dynamic {
    return (
      (document as Dynamic).querySelector(".sc-host:not(.sc-host .sc-host)") ||
      (document as Dynamic).body
    );
  }
  var panZoomScale: Dynamic = 1;
  var value_Yr: Dynamic;
  var value__i: Dynamic = false;
  function emitPreviewPresence(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments399: Dynamic[]
  ): Dynamic {
    try {
      parent.postMessage(
        {
          type: fillStyle ? "__dc_present" : "__dc_absent",
        },
        "*",
      );
    } catch {}
  }
  function applyPanZoom(
    this: Dynamic,
    ..._extraArguments400: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = panZoomRoot();
    if (fillStyle) {
      var innerHTML: Dynamic = !pan.x && !pan.y && panZoomScale === 1;
      fillStyle.style.transformOrigin = "0 0";
      fillStyle.style.transform = innerHTML
        ? ""
        : "translate(" +
          pan.x +
          "px," +
          pan.y +
          "px) scale(" +
          panZoomScale +
          ")";
      if (panZoomOnly && value_Yr !== panZoomScale) {
        value_Yr = panZoomScale;
        try {
          parent.postMessage(
            {
              type: "__dc_zoom",
              scale: panZoomScale,
            },
            "*",
          );
        } catch {}
      }
      if (panZoomOnly && !value__i) {
        value__i = true;
        requestAnimationFrame(function (
          this: Dynamic,
          ..._extraArguments401: Dynamic[]
        ): Dynamic {
          value__i = false;
          try {
            parent.postMessage(
              {
                type: "__dc_pan_zoom",
                x: pan.x,
                y: pan.y,
                scale: panZoomScale,
              },
              "*",
            );
          } catch {}
        });
      }
      if (!innerHTML && !panZoomOnly) {
        var position: Dynamic = fillStyle.getBoundingClientRect();
        var shaft: Dynamic =
          Math.max(fillStyle.scrollWidth, fillStyle.offsetWidth) * panZoomScale;
        var tag: Dynamic =
          Math.max(fillStyle.scrollHeight, fillStyle.offsetHeight) *
          panZoomScale;
        var rot: Dynamic = position.left + shaft;
        var ref: Dynamic = position.top + tag;
        var top: Dynamic = (window as Dynamic).innerWidth;
        var name3: Dynamic = (window as Dynamic).innerHeight;
        if (shaft > 0 && tag > 0) {
          var bottom: Dynamic = 0;
          var left: Dynamic = 0;
          if (shaft >= top) {
            if (position.left > 0) {
              bottom = -position.left;
            } else {
              if (rot < top) {
                bottom = top - rot;
              }
            }
          } else {
            if (position.left < 0) {
              bottom = -position.left;
            } else {
              if (rot > top) {
                bottom = top - rot;
              }
            }
          }
          if (tag >= name3) {
            if (position.top > 0) {
              left = -position.top;
            } else {
              if (ref < name3) {
                left = name3 - ref;
              }
            }
          } else {
            if (position.top < 0) {
              left = -position.top;
            } else {
              if (ref > name3) {
                left = name3 - ref;
              }
            }
          }
          if (bottom || left) {
            pan.x += bottom;
            pan.y += left;
            fillStyle.style.transform =
              "translate(" +
              pan.x +
              "px," +
              pan.y +
              "px) scale(" +
              panZoomScale +
              ")";
          }
        }
      }
      if (!innerHTML && panZoomOnly) {
        for (
          var scope: Dynamic = 1 / 0,
            top2: Dynamic = 1 / 0,
            adjust: Dynamic = -1 / 0,
            axis: Dynamic = -1 / 0,
            y2: Dynamic = 0;
          y2 < fillStyle.children.length;
          y2++
        ) {
          var pose: Dynamic = fillStyle.children[y2];
          if (!pose.hasAttribute("data-dc-editor-overlay")) {
            var lock: Dynamic =
              unwrapDisplayContentsHost(pose).getBoundingClientRect();
            if (!(lock.width <= 0 && lock.height <= 0)) {
              if (lock.left < scope) {
                scope = lock.left;
              }
              if (lock.top < top2) {
                top2 = lock.top;
              }
              if (lock.right > adjust) {
                adjust = lock.right;
              }
              if (lock.bottom > axis) {
                axis = lock.bottom;
              }
            }
          }
        }
        if (scope !== 1 / 0) {
          var paint: Dynamic = (window as Dynamic).innerWidth;
          var lastKey: Dynamic = (window as Dynamic).innerHeight;
          var lim: Dynamic = 0;
          var text8: Dynamic = 0;
          if (adjust < -paint) {
            lim = -paint - adjust;
          } else {
            if (scope > 2 * paint) {
              lim = 2 * paint - scope;
            }
          }
          if (axis < -lastKey) {
            text8 = -lastKey - axis;
          } else {
            if (top2 > 2 * lastKey) {
              text8 = 2 * lastKey - top2;
            }
          }
          if (lim || text8) {
            pan.x += lim;
            pan.y += text8;
            fillStyle.style.transform =
              "translate(" +
              pan.x +
              "px," +
              pan.y +
              "px) scale(" +
              panZoomScale +
              ")";
          }
        }
      }
      refreshCanvasScrollbars();
      refreshChrome();
    }
  }
  function rootHorizontalBounds(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments402: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 1 / 0,
        position: Dynamic = -1 / 0,
        shaft: Dynamic = 0;
      shaft < fillStyle.children.length;
      shaft++
    ) {
      var tag: Dynamic = fillStyle.children[shaft];
      if (!(tag.hasAttribute && tag.hasAttribute("data-dc-editor-overlay"))) {
        var rot: Dynamic = unwrapDisplayContentsHost(tag);
        if (!(!rot || !rot.offsetWidth)) {
          if (rot.offsetLeft < innerHTML) {
            innerHTML = rot.offsetLeft;
          }
          if (rot.offsetLeft + rot.offsetWidth > position) {
            position = rot.offsetLeft + rot.offsetWidth;
          }
        }
      }
    }
    return innerHTML === 1 / 0
      ? {
          left: 0,
          width: 0,
        }
      : {
          left: Math.min(innerHTML, 0),
          width: position - Math.min(innerHTML, 0),
        };
  }
  function fitPanZoomWidth(
    this: Dynamic,
    ..._extraArguments403: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = panZoomRoot();
    if (fillStyle) {
      var innerHTML: Dynamic = rootHorizontalBounds(fillStyle);
      if (innerHTML.width) {
        var position: Dynamic = panZoomOnly ? 0.05 : 0.2;
        var shaft: Dynamic = panZoomOnly ? 10 : 4;
        var tag: Dynamic = Math.min(
          shaft,
          Math.max(position, innerWidth / innerHTML.width),
        );
        var rot: Dynamic = -innerHTML.left * tag;
        if (!(tag === panZoomScale && pan.x === rot && !pan.y)) {
          panZoomScale = tag;
          pan.x = rot;
          pan.y = 0;
          applyPanZoom();
        }
      }
    }
  }
  function zoomAroundPoint(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments404: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = panZoomOnly ? 0.05 : 0.2;
    var tag: Dynamic = panZoomOnly ? 10 : 4;
    fillStyle = Math.min(tag, Math.max(shaft, fillStyle));
    var rot: Dynamic = panZoomRoot();
    if (!(!rot || fillStyle === panZoomScale)) {
      var ref: Dynamic = rot.getBoundingClientRect();
      var top: Dynamic = ref.left - pan.x;
      var name3: Dynamic = ref.top - pan.y;
      pan.x =
        innerHTML -
        top -
        (innerHTML - top - pan.x) * (fillStyle / panZoomScale);
      pan.y =
        position -
        name3 -
        (position - name3 - pan.y) * (fillStyle / panZoomScale);
      panZoomScale = fillStyle;
      applyPanZoom();
    }
  }
  function onPreviewMessage(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments405: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = event.data;
    if (innerHTML && innerHTML.type === "__dc_cancel_preview_dbl") {
      pendingDoubleClick = null;
      pendingTextTarget = null;
      return;
    }
    if (panZoomOnly) {
      var position: Dynamic = event.data;
      if (
        position &&
        position.type === "__dc_set_zoom" &&
        position.fit === "width"
      ) {
        fitPanZoomWidth();
      } else {
        if (
          position &&
          position.type === "__dc_set_zoom" &&
          typeof position.scale == "number"
        ) {
          zoomAroundPoint(position.scale, innerWidth / 2, innerHeight / 2);
        } else {
          if (position && position.type === "__dc_probe") {
            emitPreviewPresence(true);
            value_Yr = undefined;
            applyPanZoom();
          }
        }
      }
    }
  }
  var canvasScrollbars: Dynamic = null;
  var scrollbarGesture: Dynamic = null;
  function ensureCanvasScrollbars(
    this: Dynamic,
    ..._extraArguments406: Dynamic[]
  ): Dynamic {
    if (canvasScrollbars && canvasScrollbars.root.isConnected)
      return canvasScrollbars;
    if (!(document as Dynamic).documentElement.hasAttribute("data-dc-canvas"))
      return null;
    var fillStyle: Dynamic = (document as Dynamic).createElement("div");
    fillStyle.setAttribute("data-dc-editor-overlay", "");
    fillStyle.setAttribute("data-dc-edit-transparent", "");
    fillStyle.setAttribute("data-omelette-chrome", "");
    fillStyle.setAttribute("data-omelette-injected", "");
    fillStyle.style.cssText =
      "position:fixed;inset:0;z-index:2147483644;pointer-events:none;";
    function innerHTML(
      this: Dynamic,
      position?: Dynamic,
      ..._extraArguments407: Dynamic[]
    ): Dynamic {
      var shaft: Dynamic = (document as Dynamic).createElement("div");
      shaft.setAttribute("data-dc-pan-thumb", position);
      shaft.style.cssText =
        "position:fixed;border-radius:3px;cursor:default;pointer-events:auto;touch-action:none;background:rgba(120,120,120,0.45);display:none;" +
        (position === "y" ? "right:2px;width:6px;" : "bottom:2px;height:6px;");
      shaft.addEventListener(
        "mouseenter",
        function (this: Dynamic, ..._extraArguments408: Dynamic[]): Dynamic {
          shaft.style.background = "rgba(120,120,120,0.65)";
        },
      );
      shaft.addEventListener(
        "mouseleave",
        function (this: Dynamic, ..._extraArguments409: Dynamic[]): Dynamic {
          shaft.style.background = "rgba(120,120,120,0.45)";
        },
      );
      shaft.addEventListener(
        "pointerdown",
        function (
          this: Dynamic,
          rot?: Dynamic,
          ..._extraArguments410: Dynamic[]
        ): Dynamic {
          if (rot.button === 0) {
            rot.preventDefault();
            rot.stopPropagation();
            try {
              shaft.setPointerCapture(rot.pointerId);
            } catch {}
            var ref: Dynamic = canvasScrollbarGeometry();
            var top: Dynamic =
              position === "y"
                ? {
                    range: ref.ch - ref.vh,
                    track: ref.trackH - ref.thumbH,
                    pan0: pan.y,
                    c0: rot.clientY,
                  }
                : {
                    range: ref.cw - ref.vw,
                    track: ref.trackW - ref.thumbW,
                    pan0: pan.x,
                    c0: rot.clientX,
                  };
            scrollbarGesture = {
              axis: position,
              pan0: top.pan0,
              c0: top.c0,
              ratio: top.track > 0 ? top.range / top.track : 0,
            };
          }
        },
      );
      shaft.addEventListener(
        "pointermove",
        function (
          this: Dynamic,
          rot?: Dynamic,
          ..._extraArguments411: Dynamic[]
        ): Dynamic {
          if (!(!scrollbarGesture || scrollbarGesture.axis !== position)) {
            var ref: Dynamic =
              (position === "y" ? rot.clientY : rot.clientX) -
              scrollbarGesture.c0;
            if (position === "y") {
              pan.y = scrollbarGesture.pan0 - ref * scrollbarGesture.ratio;
            } else {
              pan.x = scrollbarGesture.pan0 - ref * scrollbarGesture.ratio;
            }
            applyPanZoom();
          }
        },
      );
      function tag(this: Dynamic, ..._extraArguments412: Dynamic[]): Dynamic {
        if (!(!scrollbarGesture || scrollbarGesture.axis !== position)) {
          scrollbarGesture = null;
          refreshCanvasScrollbars();
        }
      }
      shaft.addEventListener("pointerup", tag);
      shaft.addEventListener("pointercancel", tag);
      fillStyle.appendChild(shaft);
      return shaft;
    }
    canvasScrollbars = {
      root: fillStyle,
      y: innerHTML("y"),
      x: innerHTML("x"),
    };
    if (
      (document as Dynamic).body.hasAttribute("data-dc-editor-overlay-hidden")
    ) {
      fillStyle.style.display = "none";
    }
    (document as Dynamic).documentElement.appendChild(fillStyle);
    (window as Dynamic).addEventListener("resize", refreshCanvasScrollbars);
    return canvasScrollbars;
  }
  function removeCanvasScrollbars(
    this: Dynamic,
    ..._extraArguments413: Dynamic[]
  ): Dynamic {
    (window as Dynamic).removeEventListener("resize", refreshCanvasScrollbars);
    if (canvasScrollbars) {
      try {
        canvasScrollbars.root.parentNode.removeChild(canvasScrollbars.root);
      } catch {}
      canvasScrollbars = null;
    }
    scrollbarGesture = null;
  }
  function canvasScrollbarGeometry(
    this: Dynamic,
    ..._extraArguments414: Dynamic[]
  ): Dynamic {
    for (
      var fillStyle: Dynamic = panZoomRoot(),
        innerHTML: Dynamic = innerWidth,
        position: Dynamic = innerHeight,
        shaft: Dynamic = 1 / 0,
        tag: Dynamic = 1 / 0,
        rot: Dynamic = -1 / 0,
        ref: Dynamic = -1 / 0,
        top: Dynamic = 0;
      top < fillStyle.children.length;
      top++
    ) {
      var name3: Dynamic = fillStyle.children[top];
      if (!name3.hasAttribute("data-dc-editor-overlay")) {
        var bottom: Dynamic =
          unwrapDisplayContentsHost(name3).getBoundingClientRect();
        if (!(bottom.width <= 0 && bottom.height <= 0)) {
          if (bottom.left < shaft) {
            shaft = bottom.left;
          }
          if (bottom.top < tag) {
            tag = bottom.top;
          }
          if (bottom.right > rot) {
            rot = bottom.right;
          }
          if (bottom.bottom > ref) {
            ref = bottom.bottom;
          }
        }
      }
    }
    if (shaft === 1 / 0) {
      shaft = tag = rot = ref = 0;
    }
    var left: Dynamic = Math.min(shaft, 0);
    var scope: Dynamic = Math.min(tag, 0);
    var top2: Dynamic = Math.max(rot, innerHTML) - left;
    var adjust: Dynamic = Math.max(ref, position) - scope;
    var axis: Dynamic = 20;
    var y2: Dynamic = 2;
    var pose: Dynamic = 6;
    var lock: Dynamic =
      innerHTML - 2 * y2 - (adjust > position + 1 ? pose + y2 : 0);
    var paint: Dynamic =
      position - 2 * y2 - (top2 > innerHTML + 1 ? pose + y2 : 0);
    return {
      vw: innerHTML,
      vh: position,
      cw: top2,
      ch: adjust,
      left: left,
      top: scope,
      inset: y2,
      thumbW: Math.max(axis, lock * Math.min(1, innerHTML / top2)),
      thumbH: Math.max(axis, paint * Math.min(1, position / adjust)),
      trackW: lock,
      trackH: paint,
    };
  }
  function refreshCanvasScrollbars(
    this: Dynamic,
    ..._extraArguments415: Dynamic[]
  ): Dynamic {
    if (canvasScrollbars) {
      var fillStyle: Dynamic = canvasScrollbarGeometry();
      if (fillStyle.cw > fillStyle.vw + 1) {
        var innerHTML: Dynamic = Math.max(
          0,
          Math.min(1, -fillStyle.left / (fillStyle.cw - fillStyle.vw)),
        );
        canvasScrollbars.x.style.display = "block";
        canvasScrollbars.x.style.left =
          fillStyle.inset +
          innerHTML * (fillStyle.trackW - fillStyle.thumbW) +
          "px";
        canvasScrollbars.x.style.width = fillStyle.thumbW + "px";
      } else if (!scrollbarGesture || scrollbarGesture.axis !== "x") {
        canvasScrollbars.x.style.display = "none";
      }
      if (fillStyle.ch > fillStyle.vh + 1) {
        var position: Dynamic = Math.max(
          0,
          Math.min(1, -fillStyle.top / (fillStyle.ch - fillStyle.vh)),
        );
        canvasScrollbars.y.style.display = "block";
        canvasScrollbars.y.style.top =
          fillStyle.inset +
          position * (fillStyle.trackH - fillStyle.thumbH) +
          "px";
        canvasScrollbars.y.style.height = fillStyle.thumbH + "px";
      } else if (!scrollbarGesture || scrollbarGesture.axis !== "y") {
        canvasScrollbars.y.style.display = "none";
      }
    }
  }
  function emitPanZoom(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    tag?: Dynamic,
    rot?: Dynamic,
    ref?: Dynamic,
    ..._extraArguments416: Dynamic[]
  ): Dynamic {
    emitEditorEvent({
      type: "panZoom",
      pinch: !!fillStyle,
      touch: !!ref,
      dx: innerHTML,
      dy: position,
      dz: shaft,
      x: tag,
      y: rot,
    });
  }
  function onEditorWheel(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments417: Dynamic[]
  ): Dynamic {
    if (playbackPanZoom) {
      if (event.ctrlKey || event.metaKey) {
        onPinchWheel(event);
      } else {
        deferPlaybackWheel(event);
      }
      return;
    }
    if (nativeScrollMode) {
      if (event.ctrlKey || event.metaKey || horizontalOverscroll(event)) {
        event.preventDefault();
      }
      return;
    }
    if (!(!enabled && !panZoomOnly && !hostPanZoom)) {
      if (enabled && activeTool === "interact") {
        if (horizontalOverscroll(event)) {
          event.preventDefault();
        }
        return;
      }
      if (gestureActive) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (hostPanZoom) {
        var innerHTML: Dynamic = event.ctrlKey || event.metaKey;
        event.preventDefault();
        event.stopPropagation();
        forwardWheelPanZoom(event, innerHTML);
        return;
      }
      var position: Dynamic = event.ctrlKey || event.metaKey;
      if (position) index2 = 0;
      else {
        var shaft: Dynamic = event.timeStamp;
        if (shaft - index3 > 200) {
          index2 = 0;
        }
        index3 = shaft;
        if (index2 === 0) {
          if (!event.deltaX && !event.deltaY) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          index2 =
            eventMatchesSelector(event, text6) ||
            (eventHitsEditorOverlay(event) &&
              eventHasScrollableTarget(event)) ||
            (!enabled && eventTargetConsumesWheel(event))
              ? 1
              : -1;
        }
        if (index2 === 1) return;
      }
      event.preventDefault();
      event.stopPropagation();
      clearGapOverlay();
      clearFlowOverlay();
      if (position) {
        zoomAroundPoint(
          panZoomScale * Math.exp(-event.deltaY * 0.01),
          event.clientX,
          event.clientY,
        );
        return;
      }
      pan.x -= event.deltaX;
      pan.y -= event.deltaY;
      applyPanZoom();
    }
  }
  function forwardWheelPanZoom(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments418: Dynamic[]
  ): Dynamic {
    var position: Dynamic =
      fillStyle.deltaMode === 1
        ? 16
        : fillStyle.deltaMode === 2
          ? (window as Dynamic).innerHeight
          : 1;
    var shaft: Dynamic =
      fillStyle.deltaMode === 1
        ? 16
        : fillStyle.deltaMode === 2
          ? (window as Dynamic).innerWidth
          : 1;
    if (innerHTML) {
      emitPanZoom(
        true,
        0,
        0,
        Math.max(
          -0.22314,
          Math.min(0.22314, -fillStyle.deltaY * position * 0.01),
        ),
        fillStyle.clientX,
        fillStyle.clientY,
      );
    } else {
      emitPanZoom(
        false,
        fillStyle.deltaX * shaft,
        fillStyle.deltaY * position,
        0,
        fillStyle.clientX,
        fillStyle.clientY,
      );
    }
  }
  function pageCanConsumeWheel(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments419: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = (document as Dynamic).documentElement;
    var position: Dynamic = (document as Dynamic).body;
    var shaft: Dynamic = (document as Dynamic).scrollingElement || innerHTML;
    var tag: Dynamic = getComputedStyle(innerHTML);
    var rot: Dynamic =
      tag.overflowX === "visible" && tag.overflowY === "visible" && !!position;
    var ref: Dynamic = rot ? getComputedStyle(position) : tag;
    var top: Dynamic = Math.abs(fillStyle.deltaY) >= Math.abs(fillStyle.deltaX);
    var name3: Dynamic = function (
      this: Dynamic,
      top2?: Dynamic,
      ..._extraArguments420: Dynamic[]
    ): Dynamic {
      return top
        ? fillStyle.deltaY > 0
          ? top2.scrollTop + top2.clientHeight < top2.scrollHeight - 1
          : top2.scrollTop > 1
        : fillStyle.deltaX > 0
          ? top2.scrollLeft + top2.clientWidth < top2.scrollWidth - 1
          : top2.scrollLeft > 1;
    };
    var bottom: Dynamic = top ? ref.overflowY : ref.overflowX;
    if (bottom !== "hidden" && bottom !== "clip" && name3(shaft)) return true;
    if (rot || !position) return false;
    var left: Dynamic = getComputedStyle(position);
    var scope: Dynamic = top ? left.overflowY : left.overflowX;
    return (scope === "auto" || scope === "scroll") && name3(position);
  }
  function onPinchWheel(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments421: Dynamic[]
  ): Dynamic {
    index2 = 0;
    event.preventDefault();
    event.stopPropagation();
    if (!gestureActive) {
      forwardWheelPanZoom(event, true);
    }
  }
  var value_Ca: Dynamic = null;
  function deferPlaybackWheel(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments422: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle.preventDefault;
    var position: Dynamic = horizontalOverscroll(fillStyle);
    var shaft: Dynamic = fillStyle.defaultPrevented;
    if (position) {
      innerHTML.call(fillStyle);
    }
    fillStyle.preventDefault = function (
      this: Dynamic,
      ..._extraArguments423: Dynamic[]
    ): Dynamic {
      shaft = true;
      innerHTML.call(fillStyle);
    };
    var tag: Dynamic = {
      e: fillStyle,
      canScroll:
        eventTargetConsumesWheel(fillStyle) || pageCanConsumeWheel(fillStyle),
      taken: function (
        this: Dynamic,
        ..._extraArguments424: Dynamic[]
      ): Dynamic {
        return shaft || (!position && fillStyle.defaultPrevented);
      },
    };
    if (value_Ca) {
      value_Ca.push(tag);
      return;
    }
    var rot: Dynamic =
      (index2 === 0 || fillStyle.timeStamp - index3 > 200) &&
      (fillStyle.deltaX || fillStyle.deltaY);
    if (!rot) {
      setTimeout(function (
        this: Dynamic,
        ..._extraArguments425: Dynamic[]
      ): Dynamic {
        settlePlaybackWheel(tag, false);
      }, 0);
      return;
    }
    var ref: Dynamic =
      fillStyle.target && fillStyle.target.nodeType === 1
        ? fillStyle.target
        : null;
    var top: Dynamic = ref && ref.getBoundingClientRect();
    var name3: Dynamic =
      ref && (document as Dynamic).getAnimations
        ? (document as Dynamic).getAnimations()
        : null;
    var bottom: Dynamic = false;
    var left: Dynamic = (value_Ca = []);
    var scope: Dynamic = function (
      this: Dynamic,
      ..._extraArguments426: Dynamic[]
    ): Dynamic {
      if (!bottom) {
        bottom = true;
        for (
          var top2: Dynamic =
              ref && ref.isConnected ? ref.getBoundingClientRect() : null,
            adjust: Dynamic =
              !!top &&
              (!top2 ||
                top2.left !== top.left ||
                top2.top !== top.top ||
                top2.width !== top.width ||
                top2.height !== top.height),
            axis: Dynamic = name3 ? (document as Dynamic).getAnimations() : [],
            y2: Dynamic = 0;
          y2 < axis.length && !adjust;
          y2++
        ) {
          var pose: Dynamic = axis[y2].effect && axis[y2].effect.target;
          adjust =
            name3.indexOf(axis[y2]) === -1 &&
            !!pose &&
            (pose === ref || pose.contains(ref) || ref.contains(pose));
        }
        value_Ca = null;
        settlePlaybackWheel(tag, adjust);
        for (var lock: Dynamic = 0; lock < left.length; lock++)
          settlePlaybackWheel(left[lock], false);
      }
    };
    requestAnimationFrame(function (
      this: Dynamic,
      ..._extraArguments427: Dynamic[]
    ): Dynamic {
      setTimeout(scope, 0);
    });
    setTimeout(scope, 120);
  }
  function settlePlaybackWheel(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments428: Dynamic[]
  ): Dynamic {
    var position: Dynamic = fillStyle.e;
    var shaft: Dynamic = innerHTML || fillStyle.taken();
    if (playbackPanZoom) {
      if (position.timeStamp - index3 > 200) {
        index2 = 0;
      }
      index3 = position.timeStamp;
      if (index2 === 0) {
        if (!position.deltaX && !position.deltaY) return;
        index2 = shaft || fillStyle.canScroll ? 1 : -1;
      }
      if (index2 === -1 && !shaft && !fillStyle.canScroll) {
        forwardWheelPanZoom(position, false);
      }
    }
  }
  var count12: Dynamic = 1;
  var gestureActive: Dynamic = false;
  var count13: Dynamic = 1;
  function onGestureStart(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments429: Dynamic[]
  ): Dynamic {
    if (nativeScrollMode && !playbackPanZoom) {
      event.preventDefault();
      return;
    }
    if (
      !(
        (!enabled && !panZoomOnly && !hostPanZoom && !playbackPanZoom) ||
        (enabled && activeTool === "interact")
      )
    ) {
      event.preventDefault();
      gestureActive = true;
      count12 = panZoomScale;
      count13 = 1;
    }
  }
  function onGestureChange(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments430: Dynamic[]
  ): Dynamic {
    if (gestureActive) {
      event.preventDefault();
      if (hostPanZoom || playbackPanZoom) {
        var innerHTML: Dynamic = event.scale || 1;
        var position: Dynamic = innerHTML / (count13 || 1);
        count13 = innerHTML;
        if (position > 0) {
          var shaft: Dynamic = Math.max(
            -0.22314,
            Math.min(0.22314, Math.log(position)),
          );
          emitPanZoom(true, 0, 0, shaft, event.clientX, event.clientY);
        }
        return;
      }
      clearGapOverlay();
      clearFlowOverlay();
      zoomAroundPoint(
        count12 * (event.scale || 1),
        event.clientX,
        event.clientY,
      );
    }
  }
  function onGestureEnd(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments431: Dynamic[]
  ): Dynamic {
    if (gestureActive) {
      event.preventDefault();
      gestureActive = false;
    }
  }
  function installGestureListeners(
    this: Dynamic,
    ..._extraArguments432: Dynamic[]
  ): Dynamic {
    (document as Dynamic).addEventListener("gesturestart", onGestureStart, {
      capture: true,
      passive: false,
    });
    (document as Dynamic).addEventListener("gesturechange", onGestureChange, {
      capture: true,
      passive: false,
    });
    (document as Dynamic).addEventListener("gestureend", onGestureEnd, {
      capture: true,
      passive: false,
    });
    (document as Dynamic).addEventListener("pointerdown", onTouchPointerDown, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("pointermove", onTouchPointerMove, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("pointerup", onTouchPointerUp, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("pointercancel", onTouchPointerUp, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("pointerdown", onPanPointerDown, {
      capture: true,
    });
    (document as Dynamic).addEventListener("mousedown", onPanMouseDown, {
      capture: true,
    });
    (document as Dynamic).addEventListener("pointermove", onPanPointerMove, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("pointerup", onPanPointerEnd, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("pointercancel", onPanPointerEnd, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("touchmove", onTouchMove, {
      capture: true,
      passive: false,
    });
    (document as Dynamic).addEventListener("touchend", onTouchEnd, {
      capture: true,
      passive: true,
    });
    (document as Dynamic).addEventListener("touchcancel", onTouchEnd, {
      capture: true,
      passive: true,
    });
    updateTouchPolicy();
  }
  function removeGestureListeners(
    this: Dynamic,
    ..._extraArguments433: Dynamic[]
  ): Dynamic {
    gestureActive = false;
    (document as Dynamic).removeEventListener("gesturestart", onGestureStart, {
      capture: true,
    });
    (document as Dynamic).removeEventListener(
      "gesturechange",
      onGestureChange,
      {
        capture: true,
      },
    );
    (document as Dynamic).removeEventListener("gestureend", onGestureEnd, {
      capture: true,
    });
    (document as Dynamic).removeEventListener(
      "pointerdown",
      onTouchPointerDown,
      {
        capture: true,
      },
    );
    (document as Dynamic).removeEventListener(
      "pointermove",
      onTouchPointerMove,
      {
        capture: true,
      },
    );
    (document as Dynamic).removeEventListener("pointerup", onTouchPointerUp, {
      capture: true,
    });
    (document as Dynamic).removeEventListener(
      "pointercancel",
      onTouchPointerUp,
      {
        capture: true,
      },
    );
    (document as Dynamic).removeEventListener("pointerdown", onPanPointerDown, {
      capture: true,
    });
    (document as Dynamic).removeEventListener("mousedown", onPanMouseDown, {
      capture: true,
    });
    (document as Dynamic).removeEventListener("pointermove", onPanPointerMove, {
      capture: true,
    });
    (document as Dynamic).removeEventListener("pointerup", onPanPointerEnd, {
      capture: true,
    });
    (document as Dynamic).removeEventListener(
      "pointercancel",
      onPanPointerEnd,
      {
        capture: true,
      },
    );
    (document as Dynamic).removeEventListener("touchstart", onTouchStart, {
      capture: true,
    });
    (document as Dynamic).removeEventListener("touchmove", onTouchMove, {
      capture: true,
    });
    (document as Dynamic).removeEventListener("touchend", onTouchEnd, {
      capture: true,
    });
    (document as Dynamic).removeEventListener("touchcancel", onTouchEnd, {
      capture: true,
    });
    touchPointers = {};
    touchPointerIds = [];
    value_qr = false;
    guardedTouches = {};
    if (panPointerGesture) {
      if (panPointerGesture.live) {
        (document as Dynamic).documentElement.style.cursor =
          panPointerGesture.cursor;
        if (panPointerGesture.mask === 2) {
          emitEditorEvent({
            type: "panHold",
            on: false,
          });
        }
      }
      panPointerGesture = null;
    }
    (document as Dynamic).documentElement.style.touchAction = "";
    (document as Dynamic).documentElement.style.overscrollBehavior = "";
  }
  function hostTouchPanEnabled(
    this: Dynamic,
    ..._extraArguments434: Dynamic[]
  ): Dynamic {
    return hostPanZoom && !(enabled && activeTool === "interact") && !textEdit;
  }
  function updateTouchPolicy(
    this: Dynamic,
    ..._extraArguments435: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = hostTouchPanEnabled();
    (document as Dynamic).documentElement.style.touchAction = fillStyle
      ? "none"
      : nativeScrollMode
        ? "pan-x pan-y"
        : "";
    (document as Dynamic).documentElement.style.overscrollBehavior =
      hostPanZoom || nativeScrollMode ? "none" : "";
    if (!fillStyle) {
      touchPointers = {};
      touchPointerIds = [];
      value_qr = false;
    }
  }
  var touchPointers: Dynamic = {};
  var touchPointerIds: Dynamic = [];
  var value_qr: Dynamic = false;
  var count14: Dynamic = 6;
  function onTouchPointerDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments436: Dynamic[]
  ): Dynamic {
    if (!(event.pointerType !== "touch" || !hostTouchPanEnabled())) {
      if (touchPointerIds.indexOf(event.pointerId) === -1) {
        touchPointerIds.push(event.pointerId);
      }
      touchPointers[event.pointerId] = {
        x: event.screenX,
        y: event.screenY,
        sx: event.screenX,
        sy: event.screenY,
        ix: event.clientX,
        iy: event.clientY,
      };
      value_qr = false;
    }
  }
  function onTouchPointerMove(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments437: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = touchPointers[event.pointerId];
    if (!(!innerHTML || !hostTouchPanEnabled())) {
      var position: Dynamic = event.screenX;
      var shaft: Dynamic = event.screenY;
      innerHTML.ix = event.clientX;
      innerHTML.iy = event.clientY;
      var tag: Dynamic = touchPointerIds.indexOf(event.pointerId);
      if (tag > 1) {
        innerHTML.x = position;
        innerHTML.y = shaft;
        return;
      }
      if (touchPointerIds.length >= 2) {
        var rot: Dynamic = touchPointerIds[tag === 0 ? 1 : 0];
        var ref: Dynamic = touchPointers[rot];
        if (!ref) return;
        var top: Dynamic = (innerHTML.x + ref.x) / 2;
        var name3: Dynamic = (innerHTML.y + ref.y) / 2;
        var bottom: Dynamic = Math.hypot(
          innerHTML.x - ref.x,
          innerHTML.y - ref.y,
        );
        innerHTML.x = position;
        innerHTML.y = shaft;
        var left: Dynamic = (innerHTML.x + ref.x) / 2;
        var scope: Dynamic = (innerHTML.y + ref.y) / 2;
        var top2: Dynamic = Math.hypot(
          innerHTML.x - ref.x,
          innerHTML.y - ref.y,
        );
        var adjust: Dynamic = 0;
        if (bottom > 0 && top2 > 0) {
          adjust = Math.max(
            -0.22314,
            Math.min(0.22314, Math.log(top2 / bottom)),
          );
        }
        emitPanZoom(
          true,
          top - left,
          name3 - scope,
          adjust,
          (innerHTML.ix + ref.ix) / 2,
          (innerHTML.iy + ref.iy) / 2,
          true,
        );
        return;
      }
      if (!value_qr) {
        if (
          Math.hypot(position - innerHTML.sx, shaft - innerHTML.sy) < count14
        ) {
          innerHTML.x = position;
          innerHTML.y = shaft;
          return;
        }
        value_qr = true;
      }
      var axis: Dynamic = innerHTML.x - position;
      var y: Dynamic = innerHTML.y - shaft;
      innerHTML.x = position;
      innerHTML.y = shaft;
      if (axis !== 0 || y !== 0) {
        emitPanZoom(false, axis, y, 0, event.clientX, event.clientY, true);
      }
    }
  }
  function onTouchPointerUp(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments438: Dynamic[]
  ): Dynamic {
    if (touchPointers[event.pointerId] !== undefined) {
      delete touchPointers[event.pointerId];
      var innerHTML: Dynamic = touchPointerIds.indexOf(event.pointerId);
      if (innerHTML !== -1) {
        touchPointerIds.splice(innerHTML, 1);
      }
      value_qr = false;
    }
  }
  var panPointerGesture: Dynamic = null;
  var index8: Dynamic = 0;
  function isNativeEditableTarget(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments439: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = fillStyle;
      innerHTML && innerHTML.nodeType === 1;
      innerHTML = innerHTML.parentElement
    )
      if (
        innerHTML.tagName === "INPUT" ||
        innerHTML.tagName === "TEXTAREA" ||
        innerHTML.tagName === "SELECT" ||
        innerHTML.isContentEditable === true
      )
        return true;
    return false;
  }
  function canPointerPan(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments440: Dynamic[]
  ): Dynamic {
    return hostTouchPanEnabled() || (playbackPanZoom && fillStyle === 4);
  }
  function onPanPointerDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments441: Dynamic[]
  ): Dynamic {
    index8 = 0;
    if (
      !(
        !canPointerPan(event.button === 1 ? 4 : 2) ||
        (panPointerGesture && panPointerGesture.live)
      )
    ) {
      if (event.button === 1) {
        if (isNativeEditableTarget(event.target)) return;
        event.preventDefault();
      } else if (
        event.button !== 2 ||
        event.buttons !== 2 ||
        !enabled ||
        eventHitsEditorOverlay(event)
      )
        return;
      panPointerGesture = {
        id: event.pointerId,
        mask: event.button === 1 ? 4 : 2,
        x: event.screenX,
        y: event.screenY,
        live: false,
        cursor: "",
        menu: null,
      };
    }
  }
  function onPanMouseDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments442: Dynamic[]
  ): Dynamic {
    if (event.button === 1 && panPointerGesture) {
      event.preventDefault();
    }
  }
  function onPanPointerMove(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments443: Dynamic[]
  ): Dynamic {
    if (!(!panPointerGesture || event.pointerId !== panPointerGesture.id)) {
      if (
        !(event.buttons & panPointerGesture.mask) ||
        !canPointerPan(panPointerGesture.mask)
      ) {
        onPanPointerEnd(event);
        return;
      }
      if (!panPointerGesture.live) {
        if (
          Math.hypot(
            event.screenX - panPointerGesture.x,
            event.screenY - panPointerGesture.y,
          ) < count14
        )
          return;
        panPointerGesture.live = true;
        panPointerGesture.cursor = (
          document as Dynamic
        ).documentElement.style.cursor;
        (document as Dynamic).documentElement.style.cursor = "grabbing";
        try {
          (document as Dynamic).documentElement.setPointerCapture(
            event.pointerId,
          );
        } catch {}
        if (panPointerGesture.mask === 2) {
          emitEditorEvent({
            type: "panHold",
            on: true,
          });
        }
      }
      var innerHTML: Dynamic = panPointerGesture.x - event.screenX;
      var position: Dynamic = panPointerGesture.y - event.screenY;
      panPointerGesture.x = event.screenX;
      panPointerGesture.y = event.screenY;
      if (innerHTML !== 0 || position !== 0) {
        emitPanZoom(
          false,
          innerHTML,
          position,
          0,
          event.clientX,
          event.clientY,
          false,
        );
      }
    }
  }
  function onPanPointerEnd(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments444: Dynamic[]
  ): Dynamic {
    if (!(!panPointerGesture || event.pointerId !== panPointerGesture.id)) {
      var innerHTML: Dynamic = panPointerGesture;
      panPointerGesture = null;
      if (innerHTML.live) {
        (document as Dynamic).documentElement.style.cursor = innerHTML.cursor;
        try {
          (document as Dynamic).documentElement.releasePointerCapture(
            event.pointerId,
          );
        } catch {}
        if (innerHTML.mask === 2) {
          index8 = Date.now();
          emitEditorEvent({
            type: "panHold",
            on: false,
          });
        }
      } else if (
        innerHTML.menu &&
        event.type !== "pointercancel" &&
        hostTouchPanEnabled() &&
        Math.hypot(event.screenX - innerHTML.x, event.screenY - innerHTML.y) <
          count14
      ) {
        contextMenuAtElement(
          innerHTML.menu.x,
          innerHTML.menu.y,
          innerHTML.menu.el && innerHTML.menu.el.isConnected
            ? innerHTML.menu.el
            : stampedEventTarget(event),
        );
      }
    }
  }
  var guardedTouches: Dynamic = {};
  function shouldGuardTouchScroll(
    this: Dynamic,
    ..._extraArguments445: Dynamic[]
  ): Dynamic {
    return hostTouchPanEnabled() || nativeScrollMode;
  }
  function pageHasScrollableOverflow(
    this: Dynamic,
    ..._extraArguments446: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic =
      (document as Dynamic).scrollingElement ||
      (document as Dynamic).documentElement;
    return (
      fillStyle.scrollHeight > fillStyle.clientHeight + 1 ||
      fillStyle.scrollWidth > fillStyle.clientWidth + 1
    );
  }
  function nativeTouchTarget(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments447: Dynamic[]
  ): Dynamic {
    if (nativeScrollMode && pageHasScrollableOverflow()) return true;
    for (
      var innerHTML: Dynamic = fillStyle;
      innerHTML && innerHTML !== (document as Dynamic).documentElement;

    ) {
      if (innerHTML.nodeType === 1) {
        var position: Dynamic = innerHTML.tagName;
        if (
          position === "INPUT" ||
          position === "SELECT" ||
          position === "TEXTAREA" ||
          innerHTML.isContentEditable === true
        )
          return true;
        var shaft: Dynamic = null;
        try {
          shaft = (window as Dynamic).getComputedStyle(innerHTML);
        } catch {
          shaft = null;
        }
        if (
          shaft &&
          (((shaft.overflowY === "auto" || shaft.overflowY === "scroll") &&
            innerHTML.scrollHeight > innerHTML.clientHeight) ||
            ((shaft.overflowX === "auto" || shaft.overflowX === "scroll") &&
              innerHTML.scrollWidth > innerHTML.clientWidth))
        )
          return true;
      }
      innerHTML = innerHTML.parentElement;
    }
    return false;
  }
  function onTouchStart(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments448: Dynamic[]
  ): Dynamic {
    if (shouldGuardTouchScroll())
      for (
        var innerHTML: Dynamic = 0;
        innerHTML < event.changedTouches.length;
        innerHTML++
      ) {
        var position: Dynamic = event.changedTouches[innerHTML];
        guardedTouches[position.identifier] = !nativeTouchTarget(
          position.target,
        );
      }
  }
  function onTouchMove(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments449: Dynamic[]
  ): Dynamic {
    if (!(!shouldGuardTouchScroll() || !event.cancelable)) {
      var innerHTML: Dynamic = event.changedTouches.length;
      if (innerHTML !== 0) {
        for (var position: Dynamic = 0; position < innerHTML; position++)
          if (
            guardedTouches[event.changedTouches[position].identifier] !== true
          )
            return;
        event.preventDefault();
      }
    }
  }
  function onTouchEnd(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments450: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 0;
      innerHTML < event.changedTouches.length;
      innerHTML++
    )
      delete guardedTouches[event.changedTouches[innerHTML].identifier];
  }
  function pointerViewportSnapshot(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments451: Dynamic[]
  ): Dynamic {
    return {
      x: fillStyle.clientX,
      y: fillStyle.clientY,
      sx: (window as Dynamic).scrollX,
      sy: (window as Dynamic).scrollY,
      w: (window as Dynamic).innerWidth,
      h: (window as Dynamic).innerHeight,
    };
  }
  function onEditorDragOver(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments452: Dynamic[]
  ): Dynamic {
    if (enabled && activeTool !== "interact") {
      var innerHTML: Dynamic = event.dataTransfer;
      if (
        !(
          !innerHTML ||
          !innerHTML.types ||
          (Array as Dynamic).prototype.indexOf.call(
            innerHTML.types,
            "Files",
          ) === -1
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        innerHTML.dropEffect =
          readOnly ||
          (eventHitsDeckChrome(event) &&
            !deckRailHitAt(event.clientX, event.clientY))
            ? "none"
            : "copy";
      }
    }
  }
  function isMediaFile(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments453: Dynamic[]
  ): Dynamic {
    fillStyle = fillStyle || "";
    return fillStyle === ""
      ? String(innerHTML || "")
          .slice(-4)
          .toLowerCase() === ".mov"
      : fillStyle.indexOf("image/") === 0 || fillStyle.indexOf("video/") === 0;
  }
  function onEditorDrop(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments454: Dynamic[]
  ): Dynamic {
    if (enabled && activeTool !== "interact") {
      var innerHTML: Dynamic = event.dataTransfer;
      if (
        !(!innerHTML || !innerHTML.files || innerHTML.files.length === 0) &&
        (event.preventDefault(),
        event.stopPropagation(),
        !readOnly &&
          !(
            eventHitsDeckChrome(event) &&
            !deckRailHitAt(event.clientX, event.clientY)
          ))
      ) {
        for (
          var position: Dynamic = [], shaft: Dynamic = 0;
          shaft < innerHTML.files.length;
          shaft++
        )
          if (
            isMediaFile(
              innerHTML.files[shaft].type,
              innerHTML.files[shaft].name,
            )
          ) {
            position.push(innerHTML.files[shaft]);
          }
        if (position.length === 0) {
          emitEditorEvent({
            type: "fileDrop",
            files: [],
            name: null,
            targetTid: null,
            position: "root-end",
          });
          return;
        }
        var tag: Dynamic = deckAwareMediaDropAt(event.clientX, event.clientY);
        if (tag && tag.refuse) {
          emitEditorEvent({
            type: "fileDrop",
            files: [],
            refuse: true,
            name: null,
            targetTid: null,
            position: "root-end",
          });
          return;
        }
        var rot: Dynamic = tag ? tag.el : null;
        emitEditorEvent({
          type: "fileDrop",
          files: position,
          name: rot ? componentScopeName(rot) : null,
          targetTid: rot ? parseInt(rot.getAttribute("data-dc-tpl"), 10) : null,
          position: tag ? tag.position : "root-end",
          slide: rot ? deckSlideAddress(rot) : null,
          point: tag ? tag.point : null,
          at: pointerViewportSnapshot(event),
        });
        if (rot) {
          activateDeckSlide(enclosingDeckSlide(rot));
        }
      }
    }
  }
  var value_Pa: Dynamic = null;
  var index9: Dynamic = 0;
  var clipboardSink: Dynamic = null;
  var clipboardPreviousFocus: Dynamic = null;
  function createClipboardSink(
    this: Dynamic,
    ..._extraArguments455: Dynamic[]
  ): Dynamic {
    removeClipboardSink();
    clipboardPreviousFocus = (document as Dynamic).activeElement;
    clipboardSink = (document as Dynamic).createElement("textarea");
    clipboardSink.setAttribute("data-dc-editor-copy-sink", "");
    clipboardSink.setAttribute("aria-hidden", "true");
    clipboardSink.value = " ";
    clipboardSink.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0";
    ensureOverlayRoot().appendChild(clipboardSink);
    try {
      clipboardSink.focus({
        preventScroll: true,
      });
      clipboardSink.select();
    } catch {}
    setTimeout(removeClipboardSink, 0);
  }
  function removeClipboardSink(
    this: Dynamic,
    ..._extraArguments456: Dynamic[]
  ): Dynamic {
    if (clipboardSink) {
      var fillStyle: Dynamic = clipboardSink;
      var innerHTML: Dynamic = clipboardPreviousFocus;
      clipboardSink = null;
      clipboardPreviousFocus = null;
      fillStyle.remove();
      if (
        innerHTML &&
        innerHTML !== (document as Dynamic).body &&
        innerHTML.isConnected &&
        typeof innerHTML.focus == "function"
      )
        try {
          innerHTML.focus({
            preventScroll: true,
          });
        } catch {}
    }
  }
  var text2: Dynamic = "data-appifact-object";
  var value_Rc: Dynamic = /data-appifact-object="([A-Za-z0-9+\/=]+)"/;
  var value_Dc: Dynamic = 34 * 1024 * 1024;
  function shouldHandleClipboard(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments457: Dynamic[]
  ): Dynamic {
    if (
      !fillStyle.isTrusted ||
      !enabled ||
      activeTool === "interact" ||
      textEdit ||
      dragGesture ||
      drawingGesture ||
      transformGesture ||
      endpointGesture ||
      penGesture ||
      penOverlay ||
      marqueeGesture ||
      pendingMarquee
    )
      return false;
    var innerHTML: Dynamic = fillStyle.target;
    return innerHTML && innerHTML === clipboardSink
      ? true
      : !(
          innerHTML &&
          (innerHTML.tagName === "INPUT" ||
            innerHTML.tagName === "TEXTAREA" ||
            innerHTML.tagName === "SELECT" ||
            innerHTML.isContentEditable)
        );
  }
  function selectionClipboardText(
    this: Dynamic,
    ..._extraArguments458: Dynamic[]
  ): Dynamic {
    for (
      var fillStyle: Dynamic = [], innerHTML: Dynamic = 0;
      innerHTML < selectedTemplateIds.length && fillStyle.length < 200;
      innerHTML++
    )
      for (
        var position: Dynamic = findTemplateInstances(
            selectedTemplateIds[innerHTML],
            selectedComponentName,
          ),
          shaft: Dynamic = 0;
        shaft < position.length;
        shaft++
      ) {
        var tag: Dynamic = position[shaft];
        var rot: Dynamic = (
          tag.innerText ||
          tag.getAttribute("alt") ||
          tag.getAttribute("aria-label") ||
          tag.getAttribute("title") ||
          ""
        ).trim();
        if (rot) {
          fillStyle.push(rot);
        }
      }
    return fillStyle
      .join(
        `
`,
      )
      .slice(0, 2e4);
  }
  function onEditorCopyCut(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments459: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic =
      clipboardSink !== null && event.target === clipboardSink;
    if (
      !shouldHandleClipboard(event) ||
      selectedTemplateIds.length === 0 ||
      (event.type === "cut" && readOnly)
    ) {
      if (innerHTML) {
        event.preventDefault();
      }
      return;
    }
    var position: Dynamic = event.type === "cut" ? "x" : "c";
    var shaft: Dynamic =
      Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    var tag: Dynamic = selectionClipboardText() || " ";
    try {
      var rot: Dynamic = btoa(
        unescape(
          encodeURIComponent(
            JSON.stringify({
              appifact: 1,
              kind: "design-elements",
              data: {
                stamp: shaft,
              },
            }),
          ),
        ),
      );
      event.clipboardData.setData("text/plain", tag);
      event.clipboardData.setData(
        "text/html",
        "<span " +
          text2 +
          '="' +
          rot +
          '">' +
          tag
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;") +
          "</span>",
      );
      event.preventDefault();
      event.stopPropagation();
    } catch {
      shaft = null;
      if (innerHTML) {
        event.preventDefault();
      }
    }
    if (shaft) {
      emitEditorEvent({
        type: "clipboardKey",
        key: position,
        stamp: shaft,
        text: tag,
        mark: Date.now() - index9 < 1e3,
      });
    }
    index9 = 0;
  }
  function decodeEditorClipboard(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments460: Dynamic[]
  ): Dynamic {
    try {
      var innerHTML: Dynamic = fillStyle.getData("text/html") || "";
      var position: Dynamic =
        innerHTML.length > value_Dc ? null : value_Rc.exec(innerHTML);
      if (!position) return null;
      var shaft: Dynamic = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(
            atob(position[1]),
            function (
              this: Dynamic,
              top?: Dynamic,
              ..._extraArguments461: Dynamic[]
            ): Dynamic {
              return top.charCodeAt(0);
            },
          ),
        ),
      );
      if (
        !shaft ||
        shaft.appifact !== 1 ||
        (shaft.kind !== "design-elements" &&
          shaft.kind !== "design-artboards") ||
        !shaft.data
      )
        return null;
      var tag: Dynamic = shaft.data.stamp;
      var rot: Dynamic =
        typeof tag == "string" && tag.length > 0 && tag.length <= 64
          ? tag
          : null;
      var ref: Dynamic =
        shaft.kind === "design-artboards"
          ? Math.min(
              [shaft.data.artboards, shaft.data.annotations].reduce(function (
                this: Dynamic,
                top?: Dynamic,
                name3?: Dynamic,
                ..._extraArguments462: Dynamic[]
              ): Dynamic {
                return (
                  top + ((Array as Dynamic).isArray(name3) ? name3.length : 0)
                );
              }, 0),
              999,
            )
          : 0;
      return rot || ref > 0
        ? {
            stamp: rot,
            foreignArtboards: ref,
          }
        : null;
    } catch {
      return null;
    }
  }
  function onEditorPaste(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments463: Dynamic[]
  ): Dynamic {
    if (shouldHandleClipboard(event) && (clearTimeout(value_Pa), !readOnly)) {
      for (
        var innerHTML: Dynamic = event.clipboardData,
          position: Dynamic = [],
          shaft: Dynamic = 0,
          tag: Dynamic = 0;
        innerHTML && innerHTML.files && tag < innerHTML.files.length;
        tag++
      ) {
        position.push(innerHTML.files[tag]);
        if (isMediaFile(innerHTML.files[tag].type, innerHTML.files[tag].name)) {
          shaft++;
        }
      }
      var rot: Dynamic = innerHTML
        ? String(innerHTML.getData("text/plain") || "")
        : "";
      var ref: Dynamic = innerHTML ? decodeEditorClipboard(innerHTML) : null;
      event.preventDefault();
      event.stopPropagation();
      var top: Dynamic = shaft
        ? {
            type: "filePaste",
            files: position,
            text: rot,
          }
        : {
            type: "clipboardKey",
            key: "v",
            text: rot,
          };
      if (ref && ref.stamp) {
        top.stamp = ref.stamp;
      }
      if (ref && ref.foreignArtboards > 0) {
        top.foreignArtboards = ref.foreignArtboards;
      }
      emitEditorEvent(top);
    }
  }
  var pointerInside: Dynamic = false;
  function notePointerInside(
    this: Dynamic,
    ..._extraArguments464: Dynamic[]
  ): Dynamic {
    if (!pointerInside) {
      pointerInside = true;
      emitEditorEvent({
        type: "pointerPresence",
        inside: true,
      });
    }
  }
  var index10: Dynamic = 0;
  var index11: Dynamic = 0;
  var pendingPointerMessage: Dynamic = null;
  function emitPendingPointer(
    this: Dynamic,
    ..._extraArguments465: Dynamic[]
  ): Dynamic {
    index10 = 0;
    if (pendingPointerMessage) {
      index11 = performance.now();
      emitEditorEvent(pendingPointerMessage);
      pendingPointerMessage = null;
    }
  }
  function onGlobalPointerMove(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments466: Dynamic[]
  ): Dynamic {
    if (
      !(!event.isTrusted || hostDrag || event.pointerType === "touch") &&
      ((pendingPointerMessage = {
        type: "pointerAt",
        x: event.clientX,
        y: event.clientY,
      }),
      !index10)
    ) {
      var innerHTML: Dynamic = 80 - (performance.now() - index11);
      if (innerHTML <= 0) {
        emitPendingPointer();
      } else {
        index10 = setTimeout(emitPendingPointer, innerHTML);
      }
    }
  }
  function clearPendingPointer(
    this: Dynamic,
    ..._extraArguments467: Dynamic[]
  ): Dynamic {
    clearTimeout(index10);
    index10 = 0;
    pendingPointerMessage = null;
  }
  function onEditorMouseOver(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments468: Dynamic[]
  ): Dynamic {
    if (!event.relatedTarget) {
      notePointerInside();
    }
  }
  function onEditorMouseOut(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments469: Dynamic[]
  ): Dynamic {
    if (!event.relatedTarget) {
      pointerInside = false;
      value_Le = null;
      lastPointer = null;
      emitEditorEvent({
        type: "pointerPresence",
        inside: false,
      });
      clearHover();
      hidePlacementOverlay();
    }
  }
  function beginPendingDrag(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments470: Dynamic[]
  ): Dynamic {
    {
      var innerHTML: Dynamic = findTemplateInstances(
        String(pendingDrag.tid),
        pendingDrag.name,
      );
      if (innerHTML && innerHTML.length > 1) {
        emitEditorEvent({
          type: "repeatRefused",
          count: innerHTML.length,
          reason: "self",
        });
        pendingDrag = null;
        return false;
      }
      if (isRepeatedDirectiveElement(pendingDrag.el)) {
        emitEditorEvent({
          type: "repeatRefused",
          count: 1,
          reason: "self",
        });
        pendingDrag = null;
        return false;
      }
    }
    var position: Dynamic = pendingDrag.el;
    var shaft: Dynamic = getComputedStyle(position);
    var tag: Dynamic = authoredPositioning(position, shaft);
    var rot: Dynamic =
      shaft.position === "absolute" || shaft.position === "fixed";
    var ref: Dynamic = position.parentElement
      ? position.parentElement.closest("[data-dc-tpl]")
      : null;
    var top: Dynamic = (!rot && ref && getComputedStyle(ref).display) || "";
    var name3: Dynamic = null;
    if (!rot && ref) {
      for (
        var bottom: Dynamic = ref.firstElementChild,
          left: Dynamic = {},
          scope: Dynamic = false;
        bottom;
        bottom = bottom.nextElementSibling
      )
        if (!(!bottom.hasAttribute || !bottom.hasAttribute("data-dc-tpl"))) {
          var top2: Dynamic = bottom.getAttribute("data-dc-tpl");
          left[top2] = (left[top2] || 0) + 1;
          if (left[top2] > 1) {
            scope = true;
            break;
          }
        }
      if (!scope) {
        for (
          var adjust: Dynamic = componentScopeName(position),
            axis: Dynamic = ref.getBoundingClientRect(),
            y2: Dynamic = parentLayoutScale(position) || 1,
            pose: Dynamic = [],
            lock: Dynamic = ref.firstElementChild;
          lock;
          lock = lock.nextElementSibling
        )
          if (
            !(
              lock === position ||
              !lock.hasAttribute ||
              !lock.hasAttribute("data-dc-tpl")
            ) &&
            componentScopeName(lock) === adjust
          ) {
            var paint: Dynamic = getComputedStyle(lock);
            if (
              !(paint.position === "absolute" || paint.position === "fixed")
            ) {
              var lastKey: Dynamic = lock.getBoundingClientRect();
              pose.push({
                tid: parseInt(lock.getAttribute("data-dc-tpl"), 10),
                left: Math.round((lastKey.left - axis.left) / y2),
                top: Math.round((lastKey.top - axis.top) / y2),
                w: Math.round(lastKey.width / y2),
                h: Math.round(lastKey.height / y2),
                static: paint.position === "static",
              });
            }
          }
        var lim: Dynamic = parseInt(ref.getAttribute("data-dc-tpl"), 10);
        name3 = {
          parentTid: isNaN(lim) ? null : lim,
          parentStatic: getComputedStyle(ref).position === "static",
          w: Math.round(axis.width / y2),
          h: Math.round(axis.height / y2),
          siblings: pose,
        };
      }
    }
    var text8: Dynamic = null;
    if (
      rot &&
      !fillStyle.altKey &&
      !tag.bothX &&
      !tag.bothY &&
      selectedTemplateIds.length > 1 &&
      selectedComponentName === pendingDrag.name &&
      selectedTemplateIds.indexOf(pendingDrag.tid) >= 0
    ) {
      text8 = [];
      for (
        var index21: Dynamic = 0;
        index21 < selectedTemplateIds.length;
        index21++
      )
        if (selectedTemplateIds[index21] !== pendingDrag.tid) {
          var expected: Dynamic = findTemplateInstances(
            String(selectedTemplateIds[index21]),
            pendingDrag.name,
          );
          var value_k: Dynamic = expected[0];
          if (
            !(
              !value_k || !isRenderedElement(unwrapDisplayContentsHost(value_k))
            )
          ) {
            var value_N: Dynamic = value_k ? getComputedStyle(value_k) : null;
            var el: Dynamic =
              expected.length === 1
                ? authoredPositioning(value_k, value_N)
                : null;
            if (
              !el ||
              value_k.parentElement !== position.parentElement ||
              isUneditableElement(value_k) ||
              isDeckManagedElement(value_k) ||
              (value_N.position !== "absolute" &&
                value_N.position !== "fixed") ||
              el.bothX ||
              el.bothY
            ) {
              text8 = null;
              break;
            }
            text8.push({
              el: value_k,
              tid: selectedTemplateIds[index21],
              fixed: value_N.position === "fixed",
              useRight: el.useRight,
              useBottom: el.useBottom,
              startLeft: el.startLeft,
              startTop: el.startTop,
              startRight: el.startRight,
              startBottom: el.startBottom,
              lastPatch: null,
              absStyles: null,
            });
          }
        }
    }
    if (text8 && !text8.length) {
      text8 = null;
    }
    var startRect: Dynamic =
      unwrapDisplayContentsHost(position).getBoundingClientRect();
    var value_O: Dynamic = null;
    if (
      !rot &&
      ref &&
      !fillStyle.altKey &&
      selectedTemplateIds.length > 1 &&
      selectedComponentName === pendingDrag.name &&
      selectedTemplateIds.indexOf(pendingDrag.tid) >= 0
    ) {
      value_O = [];
      for (
        var covered: Dynamic = enclosingDirectiveId(
            pendingDrag.tid,
            pendingDrag.name,
          ),
          index22: Dynamic = 0;
        index22 < selectedTemplateIds.length;
        index22++
      )
        if (selectedTemplateIds[index22] !== pendingDrag.tid) {
          var back: Dynamic = findTemplateInstances(
            String(selectedTemplateIds[index22]),
            pendingDrag.name,
          );
          var x: Dynamic = back[0];
          if (!(!x || !isRenderedElement(unwrapDisplayContentsHost(x)))) {
            var y: Dynamic = getComputedStyle(x);
            if (
              back.length > 1 ||
              x.parentElement !== position.parentElement ||
              enclosingDirectiveId(
                selectedTemplateIds[index22],
                pendingDrag.name,
              ) !== covered ||
              isUneditableElement(x) ||
              isDeckManagedElement(x) ||
              isRepeatedDirectiveElement(x) ||
              y.position === "absolute" ||
              y.position === "fixed"
            ) {
              value_O = null;
              break;
            }
            if (value_O.length < count5) {
              value_O.push(x);
            }
          }
        }
      if (value_O && !value_O.length) {
        value_O = null;
      }
    }
    dragGesture = {
      tid: pendingDrag.tid,
      name: pendingDrag.name,
      alt: text8 || value_O ? false : fillStyle.altKey,
      followers: text8,
      el: position,
      tag: position.tagName,
      fromDrawing: hasSvgAncestor(position),
      mode: rot ? "abs" : "flow",
      flatten: name3,
      startRect: startRect,
      gestureKey: randomGestureKey(),
      scl: parentLayoutScale(position),
      am: ancestorTransformSigns(position),
      startX: fillStyle.clientX,
      startY: fillStyle.clientY,
      grabDx: pendingDrag.x - startRect.left,
      grabDy: pendingDrag.y - startRect.top,
      origParent: position.parentNode,
      origNext: position.nextSibling,
      origParentStamped: ref || findOuterComponentHost(),
      origAncestorEls: dropContainerAncestors(position),
      peerParent:
        top.indexOf("flex") !== -1 || top.indexOf("grid") !== -1 ? ref : null,
      peerTid: ref ? parseInt(ref.getAttribute("data-dc-tpl"), 10) : null,
      origStyle: position.getAttribute("style") || "",
      canBreak: value_Yo(position, shaft),
      startW: value_Ho(shaft),
      startH: value_Wo(position, shaft),
      startLines: {
        gridRowStart: shaft.gridRowStart,
        gridRowEnd: shaft.gridRowEnd,
        gridColumnStart: shaft.gridColumnStart,
        gridColumnEnd: shaft.gridColumnEnd,
      },
      brkFollowers: rot
        ? null
        : selectedDragFollowers(position, pendingDrag.tid, pendingDrag.name),
      freezeStyle: inheritedTextStyle(position),
      useRight: tag.useRight,
      useBottom: tag.useBottom,
      bothX: tag.bothX,
      bothY: tag.bothY,
      fixed: shaft.position === "fixed",
      startLeft: tag.startLeft,
      startTop: tag.startTop,
      startRight: tag.startRight,
      startBottom: tag.startBottom,
      commit: null,
      absStyles: null,
      previewKey: "",
      previewActive: false,
      epoch: 0,
      slotPt: null,
      previewParentEl: null,
      absParent: null,
      maskX: nativeScrollMode && canPageScrollAxis("x"),
      maskY: nativeScrollMode && canPageScrollAxis("y"),
    };
    clearAttributeEverywhere("data-dc-dragging");
    clearAttributeEverywhere("data-dc-drag-parent");
    clearAttributeEverywhere("data-dc-drag-follower");
    clearAttributeEverywhere("data-dc-drag-block");
    dragGesture.group =
      value_O &&
      value_O.map(function (
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments471: Dynamic[]
      ): Dynamic {
        var tid: Dynamic = templateId(input);
        var freezeStyle: Dynamic = inheritedTextStyle(input);
        var value_V: Dynamic = (dragGesture.brkFollowers || []).filter(
          function (
            this: Dynamic,
            input2?: Dynamic,
            ..._extraArguments472: Dynamic[]
          ): Dynamic {
            return input2.tid === tid;
          },
        )[0];
        if (value_V) {
          value_V.freezeStyle = freezeStyle;
        }
        return {
          tid: tid,
          freezeStyle: freezeStyle || undefined,
        };
      });
    if (!rot) {
      dragGesture.proxy = liftableElementBox(position);
    }
    if (dragGesture.proxy && value_O) {
      dragGesture.groupProxies = [];
      for (
        var K: Dynamic = 0, value_Y: Dynamic = Date.now() + count7;
        K < value_O.length;
        K++
      ) {
        var bounds: Dynamic = unwrapDisplayContentsHost(
          value_O[K],
        ).getBoundingClientRect();
        var value_pt: Dynamic = liftableElementBox(value_O[K], value_Y);
        if (value_pt) {
          dragGesture.groupProxies.push({
            p: value_pt,
            tid: templateId(value_O[K]),
            dx: bounds.left - startRect.left,
            dy: bounds.top - startRect.top,
          });
        }
      }
    }
    dragGesture.lift = inferredElementScale(
      unwrapDisplayContentsHost(position),
      dragGesture.startRect,
    );
    clearForeignSelection();
    if (hostDrag) dragGesture.hostKey = hostDrag.key;
    else {
      var value_ut: Dynamic =
        selectedComponentName !== dragGesture.name ||
        selectedTemplateIds.indexOf(dragGesture.tid) < 0;
      if (value_ut) {
        selectedTemplateIds = [dragGesture.tid];
        selectedComponentName = dragGesture.name;
        selectedPart = null;
        repaintSelection();
      }
      emitSelection(
        selectedTemplateIds.length === 1
          ? sourceElementTag(position)
          : undefined,
        undefined,
        !value_ut,
      );
      var value_tt: Dynamic =
        dragGesture.followers || dragGesture.group
          ? {
              gestureKey: dragGesture.gestureKey,
            }
          : dragExitPayload(dragGesture, dragGesture.alt);
      value_tt.type = "dragState";
      value_tt.live = true;
      emitEditorEvent(value_tt);
      capturePointer();
    }
    position.style.setProperty("pointer-events", "none", "important");
    pendingDrag = null;
    value_Le = null;
    value_lt = null;
    (document as Dynamic).body.style.cursor = "grabbing";
    clearHover();
    return true;
  }
  function onEditorMouseMove(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments473: Dynamic[]
  ): Dynamic {
    if (!hostDrag) {
      notePointerInside();
    }
    if (!((!enabled && !hostDrag) || textEdit)) {
      setMeasurementEnabled(event.altKey);
      deepPickingEnabled = isMacPlatform ? !!event.metaKey : !!event.ctrlKey;
      lastPointer = {
        x: event.clientX,
        y: event.clientY,
      };
      if (
        event.buttons === 0 &&
        (pendingDrag ||
          value_St ||
          pendingMarquee ||
          marqueeGesture ||
          penGesture ||
          transformGesture ||
          endpointGesture ||
          drawingGesture ||
          dragGesture)
      ) {
        onEditorMouseUp(event);
      }
      if (penGesture) {
        var innerHTML: Dynamic =
          penGesture.points[penGesture.points.length - 1];
        var position: Dynamic = event.clientX - innerHTML[0];
        var shaft: Dynamic = event.clientY - innerHTML[1];
        if (position * position + shaft * shaft >= 4) {
          penGesture.points.push([event.clientX, event.clientY]);
          var tag: Dynamic = penGesture.long
            ? null
            : value_Qo(penGesture.points, count10 / hostScale);
          var rot: Dynamic =
            tag && tag.length * 2 <= count11 ? value_jo(tag, 1) : null;
          if (tag && !(rot && rot.length <= count11)) {
            penGesture.long = true;
          }
          penGesture.path.setAttribute(
            "d",
            rot && rot.length <= count11
              ? rot
              : serializePolyline(penGesture.points, 0, 0),
          );
        }
        return;
      }
      if (drawingGesture) {
        var ref: Dynamic = event.clientX;
        var top: Dynamic = event.clientY;
        var name3: Dynamic = activeTool === "arrow" || activeTool === "line";
        if (event.shiftKey && name3) {
          var bottom: Dynamic = value_Jo(
            {
              x: drawingGesture.startX,
              y: drawingGesture.startY,
            },
            {
              x: ref,
              y: top,
            },
          );
          ref = bottom.x;
          top = bottom.y;
        }
        drawingGesture.w = Math.abs(ref - drawingGesture.startX);
        drawingGesture.h = Math.abs(top - drawingGesture.startY);
        if (event.shiftKey && !name3) {
          var left: Dynamic = Math.max(drawingGesture.w, drawingGesture.h);
          drawingGesture.w = left;
          drawingGesture.h = left;
          drawingGesture.x =
            ref < drawingGesture.startX
              ? drawingGesture.startX - left
              : drawingGesture.startX;
          drawingGesture.y =
            top < drawingGesture.startY
              ? drawingGesture.startY - left
              : drawingGesture.startY;
        } else {
          drawingGesture.x = Math.min(drawingGesture.startX, ref);
          drawingGesture.y = Math.min(drawingGesture.startY, top);
        }
        drawingGesture.dirX = ref >= drawingGesture.startX ? 1 : -1;
        drawingGesture.dirY = top >= drawingGesture.startY ? 1 : -1;
        drawingGesture.box.style.left = drawingGesture.x + "px";
        drawingGesture.box.style.top = drawingGesture.y + "px";
        drawingGesture.box.style.width = drawingGesture.w + "px";
        drawingGesture.box.style.height = drawingGesture.h + "px";
        if (name3) {
          var scope: Dynamic =
            elementViewportScale(drawingGesture.parentEl) || 1;
          var top2: Dynamic = drawingGesture.w;
          var adjust: Dynamic = drawingGesture.h;
          var axis: Dynamic = Math.max(top2, 8 * scope);
          var y2: Dynamic = Math.max(adjust, 8 * scope);
          var pose: Dynamic = (axis - top2) / 2;
          var lock: Dynamic = (y2 - adjust) / 2;
          drawingGesture.box.style.left = drawingGesture.x - pose + "px";
          drawingGesture.box.style.top = drawingGesture.y - lock + "px";
          drawingGesture.box.style.width = axis + "px";
          drawingGesture.box.style.height = y2 + "px";
          var paint: Dynamic = pose + (drawingGesture.dirX === 1 ? 0 : top2);
          var lastKey: Dynamic =
            lock + (drawingGesture.dirY === 1 ? 0 : adjust);
          var lim: Dynamic = pose + (drawingGesture.dirX === 1 ? top2 : 0);
          var text8: Dynamic = lock + (drawingGesture.dirY === 1 ? adjust : 0);
          if (activeTool === "arrow") {
            var value_S: Dynamic = value_Ad(
              paint,
              lastKey,
              lim,
              text8,
              8 * scope,
            );
            lim = value_S.x;
            text8 = value_S.y;
          }
          var expected: Dynamic =
            "M " + paint + " " + lastKey + " L " + lim + " " + text8;
          var value_k: Dynamic =
            activeTool === "arrow"
              ? '<defs><marker id="dc-draw-head" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible"><path d="M0 0 L4 2 L0 4 Z" stroke="none" style="fill:' +
                CHROME_STROKE +
                '"/></marker></defs>'
              : "";
          drawingGesture.box.innerHTML =
            '<svg width="100%" height="100%" viewBox="0 0 ' +
            axis +
            " " +
            y2 +
            '" style="display:block;overflow:visible">' +
            value_k +
            '<path d="' +
            expected +
            '" fill="none" style="stroke:' +
            CHROME_STROKE +
            '" stroke-width="' +
            4 * scope +
            '" stroke-linecap="round" stroke-linejoin="round"' +
            (activeTool === "arrow" ? ' marker-end="url(#dc-draw-head)"' : "") +
            "/></svg>";
        }
        return;
      }
      if (value_St) {
        var value_N: Dynamic = event.clientX - value_St.x;
        var el: Dynamic = event.clientY - value_St.y;
        if (value_N * value_N + el * el > 16) {
          var startRect: Dynamic = (document as Dynamic).createElement("div");
          startRect.setAttribute("data-dc-editor-overlay", "");
          startRect.style.cssText =
            "position:fixed;z-index:2147483646;pointer-events:none;" +
            (activeTool === "arrow" || activeTool === "line"
              ? "border:none;background:transparent;"
              : "border:1.5px solid " +
                CHROME_STROKE +
                ";background:color-mix(in srgb," +
                CHROME_STROKE +
                " 10%,transparent);") +
            "border-radius:" +
            (activeTool === "oval" ? "50%" : "0") +
            ";";
          ensureOverlayRoot().appendChild(startRect);
          drawingGesture = {
            box: startRect,
            startX: value_St.x,
            startY: value_St.y,
            x: value_St.x,
            y: value_St.y,
            w: 0,
            h: 0,
            dirX: 1,
            dirY: 1,
            parentEl: value_St.parentEl,
            parentTid: value_St.parentTid,
            parentName: value_St.parentName,
            parentRect: value_St.parentRect,
          };
          value_St = null;
          hidePlacementOverlay();
        }
        return;
      }
      if (marqueeGesture) {
        updateMarquee(event);
        return;
      }
      if (pendingMarquee) {
        var value_O: Dynamic = event.clientX - pendingMarquee.x;
        var covered: Dynamic = event.clientY - pendingMarquee.y;
        if (
          value_O * value_O + covered * covered >
          chromePixels(4) * chromePixels(4)
        ) {
          beginMarquee(event);
        }
        return;
      }
      if (activeTool !== "select" && activeTool !== "interact" && !hostDrag) {
        previewShapePlacement(event);
        return;
      }
      if (activeTool !== "interact") {
        if (dragGesture) {
          dragGesture.lastPt = {
            x: event.clientX,
            y: event.clientY,
            shift: event.shiftKey,
          };
          var value_G: Dynamic =
            event.clientX < 0 ||
            event.clientY < 0 ||
            event.clientX > (window as Dynamic).innerWidth ||
            event.clientY > (window as Dynamic).innerHeight;
          var back: Dynamic = !!snapGuides;
          snapGuides = null;
          if (
            value_G &&
            !dragGesture.followers &&
            !dragGesture.group &&
            !dragGesture.hostKey
          ) {
            if (!dragGesture.exited) {
              exitDragGesture(!!event.altKey);
            }
            if (back) {
              refreshChrome();
            }
            if (
              !dragGesture.lastStream ||
              Date.now() - dragGesture.lastStream > 30
            ) {
              dragGesture.lastStream = Date.now();
              emitEditorEvent({
                type: "dragMove",
                gestureKey: dragGesture.gestureKey,
                x: event.clientX,
                y: event.clientY,
                alt: !!event.altKey,
                ctrl: !!event.ctrlKey,
              });
            }
            return;
          }
          if (dragGesture.exited) {
            dragGesture.exited = false;
            emitEditorEvent({
              type: "dragReturn",
              gestureKey: dragGesture.gestureKey,
            });
          }
          var x: Dynamic = dragGesture.alt;
          dragGesture.alt =
            dragGesture.followers || dragGesture.group ? false : event.altKey;
          var y: Dynamic = dragGesture.canBreak && hasControlModifier(event);
          dragGesture.brk = y;
          if (
            y !== (document as Dynamic).body.hasAttribute("data-dc-editor-brk")
          ) {
            if (y) {
              (document as Dynamic).body.setAttribute("data-dc-editor-brk", "");
            } else {
              (document as Dynamic).body.removeAttribute("data-dc-editor-brk");
            }
          }
          var K: Dynamic = y && !!dragGesture.brkFollowers;
          if (K) {
            dragGesture.alt = false;
          }
          if (dragGesture.alt && !x) {
            cancelMovePreview(dragGesture);
          }
          ensureAltClone();
          var value_Y: Dynamic = currentDraggedElement();
          if (!value_Y) {
            if (back) {
              refreshChrome();
            }
            return;
          }
          var value_Z: Dynamic = K
            ? resolveBreakoutFollowers(dragGesture)
            : null;
          var items14: Dynamic = [];
          if (value_Z)
            for (
              var index21: Dynamic = 0;
              index21 < dragGesture.brkFollowers.length;
              index21++
            )
              if (value_Z[dragGesture.brkFollowers[index21].tid]) {
                items14.push(value_Z[dragGesture.brkFollowers[index21].tid]);
              }
          var value_tt: Dynamic =
            dragGesture.group && !y ? currentDragGroup() : null;
          if (value_tt && dragGesture.groupProxies && dragGesture.epoch > 0) {
            for (
              var state32: Dynamic = {}, tid: Dynamic = 0;
              tid < value_tt.length;
              tid++
            )
              state32[value_tt[tid].getAttribute("data-dc-drag-block")] = true;
            for (
              var freezeStyle: Dynamic = 0;
              freezeStyle < dragGesture.groupProxies.length;
              freezeStyle++
            )
              dragGesture.groupProxies[freezeStyle].out =
                !state32[dragGesture.groupProxies[freezeStyle].tid];
          }
          markDraggedElements(value_Y, value_tt || items14);
          var value_V: Dynamic = dragGesture.followers
            ? {
                el: dragGesture.origParentStamped,
                tid: null,
              }
            : resolveDropContainer(
                event.clientX,
                event.clientY,
                dragGesture,
                value_Y,
                value_tt,
              );
          if (
            dragGesture.group &&
            (value_G || (value_tt && value_tt.length && value_V.tid == null))
          ) {
            value_V = {
              el: null,
              tid: null,
              invalid: true,
            };
          }
          if (dragGesture.hostKey && value_G) {
            value_V = {
              el: null,
              tid: null,
              invalid: true,
            };
          }
          if (value_V.invalid) {
            cancelMovePreview(dragGesture);
            clearFlowOverlay();
            hideParentPlacementBounds();
            positionDragProxy(event, true);
            if (placementOverlay) {
              placementOverlay.box.style.display = "none";
            }
            dragGesture.commit = null;
            refreshChrome();
            return;
          }
          var value_ot: Dynamic = value_V.el === dragGesture.origParentStamped;
          if (value_V.tid == null) {
            hideParentPlacementBounds();
          } else {
            showParentPlacementBounds(value_V.el.getBoundingClientRect(), "");
          }
          if (dragGesture.mode === "abs" && value_ot) {
            cancelMovePreview(dragGesture);
            dragGesture.previewParentEl = null;
            clearFlowOverlay();
            hideDragProxy(dragGesture);
            if (placementOverlay) {
              placementOverlay.box.style.display = "none";
            }
            var value_et: Dynamic = dragGesture.hostKey
              ? {
                  x: event.clientX - dragGesture.startX,
                  y: event.clientY - dragGesture.startY,
                }
              : snapAbsoluteDrag(
                  event,
                  value_Y,
                  event.clientX - dragGesture.startX,
                  event.clientY - dragGesture.startY,
                  {
                    x: !dragGesture.bothX,
                    y: !dragGesture.bothY,
                  },
                );
            var value_st: Dynamic =
              (value_et.x * dragGesture.am.x) / dragGesture.scl;
            var value_ae: Dynamic =
              (value_et.y * dragGesture.am.y) / dragGesture.scl;
            var absStyles: Dynamic = {};
            if (!dragGesture.bothX) {
              if (dragGesture.useRight) {
                absStyles.right =
                  Math.round(dragGesture.startRight - value_st) + "px";
              } else {
                absStyles.left =
                  Math.round(dragGesture.startLeft + value_st) + "px";
              }
            }
            if (!dragGesture.bothY) {
              if (dragGesture.useBottom) {
                absStyles.bottom =
                  Math.round(dragGesture.startBottom - value_ae) + "px";
              } else {
                absStyles.top =
                  Math.round(dragGesture.startTop + value_ae) + "px";
              }
            }
            dragGesture.absStyles = absStyles;
            dragGesture.commit =
              dragGesture.bothX && dragGesture.bothY
                ? null
                : {
                    kind: "absSame",
                  };
            if (isRootComponent(dragGesture.name)) {
              var value__t: Dynamic = findTemplateInstances(
                String(dragGesture.tid),
                dragGesture.name,
              );
              if (value__t.indexOf(value_Y) < 0) {
                value__t = [value_Y];
              }
              dragGesture.lastPatch = absStyles;
              patchElementStyles(dragGesture.gestureKey, value__t, absStyles);
            }
            queueStylePreview({
              type: "stylePreview",
              tid: dragGesture.tid,
              name: dragGesture.name,
              gestureKey: dragGesture.gestureKey,
              styles: absStyles,
            });
            if (dragGesture.followers)
              for (
                var index22: Dynamic = 0;
                index22 < dragGesture.followers.length;
                index22++
              ) {
                var value_kt: Dynamic = dragGesture.followers[index22];
                var absStyles2: Dynamic = {};
                if (value_kt.useRight) {
                  absStyles2.right =
                    Math.round(value_kt.startRight - value_st) + "px";
                } else {
                  absStyles2.left =
                    Math.round(value_kt.startLeft + value_st) + "px";
                }
                if (value_kt.useBottom) {
                  absStyles2.bottom =
                    Math.round(value_kt.startBottom - value_ae) + "px";
                } else {
                  absStyles2.top =
                    Math.round(value_kt.startTop + value_ae) + "px";
                }
                value_kt.absStyles = absStyles2;
                if (isRootComponent(dragGesture.name)) {
                  value_kt.lastPatch = absStyles2;
                  patchElementStyles(
                    dragGesture.gestureKey + ":" + value_kt.tid,
                    connectedFollowerInstances(value_kt, dragGesture.name),
                    absStyles2,
                  );
                }
                queueStylePreview({
                  type: "stylePreview",
                  tid: value_kt.tid,
                  name: dragGesture.name,
                  gestureKey: dragGesture.gestureKey,
                  styles: absStyles2,
                  follower: true,
                });
              }
            refreshChrome();
            return;
          }
          if (dragGesture.mode === "abs" || value_V.tid == null || y) {
            clearFlowOverlay();
            hideDragProxy(dragGesture);
            if (
              !dragGesture.absParent ||
              dragGesture.absParent.el !== value_V.el
            ) {
              var value_Jr: Dynamic =
                value_V.tid != null ? getComputedStyle(value_V.el) : null;
              dragGesture.absParent = {
                el: value_V.el,
                display: value_Jr ? value_Jr.display : "",
                needsPositioning: !!value_Jr && value_Jr.position === "static",
              };
            }
            var bounds: Dynamic = value_V.el.getBoundingClientRect();
            var startRect2: Dynamic = dragGesture.startRect;
            var value_jr: Dynamic =
              event.clientX - dragGesture.grabDx - startRect2.left;
            var value_$s: Dynamic =
              event.clientY - dragGesture.grabDy - startRect2.top;
            var value_Wa: Dynamic =
              (dragGesture.alt && dragGesture.mode !== "abs") ||
              dragGesture.hostKey
                ? {
                    x: value_jr,
                    y: value_$s,
                  }
                : snapAbsoluteDrag(event, value_Y, value_jr, value_$s);
            var value_Zs: Dynamic = startRect2.left + value_Wa.x;
            var value_Js: Dynamic = startRect2.top + value_Wa.y;
            var value_Qs: Dynamic =
              value_V.tid != null
                ? value_V.el.clientLeft - value_V.el.scrollLeft
                : 0;
            var value_js: Dynamic =
              value_V.tid != null
                ? value_V.el.clientTop - value_V.el.scrollTop
                : 0;
            dragGesture.absStyles = {
              left:
                Math.round(
                  (value_Zs - bounds.left) / dragGesture.scl - value_Qs,
                ) + "px",
              top:
                Math.round(
                  (value_Js - bounds.top) / dragGesture.scl - value_js,
                ) + "px",
            };
            if (
              y &&
              (restoreResizeDimensions(
                dragGesture.absStyles,
                dragGesture,
                dragGesture.absParent.display,
              ),
              K)
            )
              for (
                var index23: Dynamic = 0;
                index23 < dragGesture.brkFollowers.length;
                index23++
              ) {
                var value_Re: Dynamic = dragGesture.brkFollowers[index23];
                var value_za: Dynamic = value_Z[value_Re.tid] || null;
                value_Re.skip = !!value_za && value_za.contains(value_V.el);
                if (!value_Re.skip) {
                  if (value_Re.freezeStyle === undefined) {
                    value_Re.freezeStyle = value_za
                      ? inheritedTextStyle(value_za)
                      : undefined;
                  }
                  value_Re.absStyles = {
                    left:
                      Math.round(
                        (value_Re.startRect.left + value_Wa.x - bounds.left) /
                          dragGesture.scl -
                          value_Qs,
                      ) + "px",
                    top:
                      Math.round(
                        (value_Re.startRect.top + value_Wa.y - bounds.top) /
                          dragGesture.scl -
                          value_js,
                      ) + "px",
                  };
                  restoreResizeDimensions(
                    value_Re.absStyles,
                    value_Re,
                    dragGesture.absParent.display,
                  );
                }
              }
            var followers: Dynamic = K
              ? dragGesture.brkFollowers
                  .filter(function (
                    this: Dynamic,
                    input?: Dynamic,
                    ..._extraArguments474: Dynamic[]
                  ): Dynamic {
                    return !input.skip;
                  })
                  .map(function (
                    this: Dynamic,
                    input?: Dynamic,
                    ..._extraArguments475: Dynamic[]
                  ): Dynamic {
                    return {
                      tid: input.tid,
                      absStyles: input.absStyles,
                      freezeStyle: input.freezeStyle || undefined,
                    };
                  })
              : undefined;
            dragGesture.commit = {
              kind: "abs",
              tid: value_V.tid,
              epoch: dragGesture.epoch,
              brk: y,
              followers: followers,
              needsPositioning: dragGesture.absParent.needsPositioning,
            };
            if (dragGesture.alt || dragGesture.hostKey) {
              cancelMovePreview(dragGesture);
              dragGesture.previewParentEl = null;
              var startRect3: Dynamic = dragGesture.startRect;
              var value_tn: Dynamic = ensurePlacementOverlay();
              value_tn.box.style.display = "block";
              value_tn.box.style.left = value_Zs + "px";
              value_tn.box.style.top = value_Js + "px";
              value_tn.box.style.width = startRect3.width + "px";
              value_tn.box.style.height = startRect3.height + "px";
              value_tn.label.style.display = "none";
              refreshChrome();
              return;
            }
            if (placementOverlay) {
              placementOverlay.box.style.display = "none";
            }
            var previewKey: Dynamic = y ? "abs|brk" : "abs";
            if (
              !dragGesture.previewActive ||
              dragGesture.previewParentEl !== value_V.el ||
              dragGesture.previewKey !== previewKey
            ) {
              dragGesture.previewParentEl = value_V.el;
              dragGesture.previewKey = previewKey;
              dragGesture.previewActive = true;
              pendingStyleEvents = {};
              emitEditorEvent({
                type: "movePreview",
                tid: dragGesture.tid,
                name: dragGesture.name,
                gestureKey: dragGesture.gestureKey,
                targetTid: value_V.tid,
                position: value_V.tid == null ? "root-end" : "into",
                epoch: dragGesture.epoch,
                absolute: true,
                absStyles: dragGesture.absStyles,
                parentNeedsPositioning: dragGesture.absParent.needsPositioning,
                flatten:
                  (!dragGesture.alt && !y && dragGesture.flatten) || undefined,
                freezeStyle: dragGesture.freezeStyle || undefined,
                followers: followers,
                group: dragGesture.group || undefined,
              });
            } else if (
              (isRootComponent(dragGesture.name) &&
                ((dragGesture.lastPatch = dragGesture.absStyles),
                patchElementStyles(
                  dragGesture.gestureKey,
                  [value_Y],
                  dragGesture.absStyles,
                )),
              queueStylePreview({
                type: "stylePreview",
                tid: dragGesture.tid,
                name: dragGesture.name,
                gestureKey: dragGesture.gestureKey,
                styles: dragGesture.absStyles,
              }),
              K)
            )
              for (
                var index24: Dynamic = 0;
                index24 < dragGesture.brkFollowers.length;
                index24++
              ) {
                var value_en: Dynamic = dragGesture.brkFollowers[index24];
                var value_nd: Dynamic = value_Z[value_en.tid];
                if (!(value_en.skip || !value_nd)) {
                  if (isRootComponent(dragGesture.name)) {
                    patchElementStyles(
                      dragGesture.gestureKey + ":" + value_en.tid,
                      [value_nd],
                      value_en.absStyles,
                    );
                  }
                  queueStylePreview({
                    type: "stylePreview",
                    tid: value_en.tid,
                    name: dragGesture.name,
                    gestureKey: dragGesture.gestureKey,
                    styles: value_en.absStyles,
                    follower: true,
                  });
                }
              }
            refreshChrome();
            return;
          }
          if (placementOverlay) {
            placementOverlay.box.style.display = "none";
          }
          dragGesture.previewParentEl = null;
          if (dragGesture.commit && dragGesture.commit.kind === "abs") {
            pendingStyleEvents = {};
            dragGesture.lastPatch = null;
          }
          var value_qa: Dynamic =
            dragGesture.commit &&
            dragGesture.commit.kind === "flow" &&
            dragGesture.flowBox === value_V.el
              ? dragGesture.commit.slot
              : null;
          var value_gp: Dynamic = !!(
            value_qa &&
            dragGesture.slotPt &&
            Math.abs(event.clientX - dragGesture.slotPt.x) < chromePixels(4) &&
            Math.abs(event.clientY - dragGesture.slotPt.y) < chromePixels(4)
          );
          var slot: Dynamic = flowInsertionPlan(
            value_V.el,
            value_V.tid,
            value_Y,
            event.clientX,
            event.clientY,
            value_qa,
            value_gp,
            value_tt,
          );
          slot.epoch = dragGesture.epoch;
          if (!value_qa || slot.n !== value_qa.n) {
            dragGesture.slotPt = {
              x: event.clientX,
              y: event.clientY,
            };
          }
          dragGesture.flowBox = value_V.el;
          positionDragProxy(event);
          paintFlowInsertion(value_V.el, value_Y, slot, value_tt);
          dragGesture.commit = {
            kind: "flow",
            slot: slot,
            clearPositioning: false,
          };
          if (!dragGesture.alt) {
            emitMovePreview(slot, false);
          }
          refreshChrome();
          return;
        }
        if (pendingDrag) {
          var value_ad: Dynamic = event.clientX - pendingDrag.x;
          var value_od: Dynamic = event.clientY - pendingDrag.y;
          if (
            value_ad * value_ad + value_od * value_od >
            (value_Le
              ? chromePixels(8) * chromePixels(8)
              : chromePixels(4) * chromePixels(4))
          ) {
            beginPendingDrag(event);
            return;
          }
        }
        if (activeTool !== "select") {
          clearHover();
          return;
        }
        hoverHitElement(event);
      }
    }
  }
  function selectionIsUnderlined(
    this: Dynamic,
    ..._extraArguments476: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = getSelection();
    var innerHTML: Dynamic = fillStyle && fillStyle.anchorNode;
    var position: Dynamic =
      innerHTML &&
      (innerHTML.nodeType === 1 ? innerHTML : innerHTML.parentElement);
    var shaft: Dynamic =
      position && position.closest ? position.closest("a") : null;
    return shaft && textEdit && textEdit.el.contains(shaft)
      ? (getComputedStyle(shaft).textDecorationLine || "").indexOf(
          "underline",
        ) !== -1
      : (document as Dynamic).queryCommandState("underline");
  }
  function selectionInsideLink(
    this: Dynamic,
    ..._extraArguments477: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = getSelection();
    var innerHTML: Dynamic = fillStyle && fillStyle.anchorNode;
    var position: Dynamic =
      innerHTML &&
      (innerHTML.nodeType === 1 ? innerHTML : innerHTML.parentElement);
    var shaft: Dynamic =
      position && position.closest ? position.closest("a") : null;
    return !!(shaft && textEdit && textEdit.el.contains(shaft));
  }
  var state31: Dynamic = {
    bold: function (this: Dynamic, ..._extraArguments478: Dynamic[]): Dynamic {
      (document as Dynamic).execCommand("bold");
    },
    italic: function (
      this: Dynamic,
      ..._extraArguments479: Dynamic[]
    ): Dynamic {
      (document as Dynamic).execCommand("italic");
    },
    underline: function (
      this: Dynamic,
      ..._extraArguments480: Dynamic[]
    ): Dynamic {
      try {
        var fillStyle: Dynamic = getSelection();
        var innerHTML: Dynamic =
          fillStyle && fillStyle.rangeCount > 0
            ? fillStyle.getRangeAt(0)
            : null;
        var position: Dynamic = [];
        if (innerHTML && textEdit) {
          if ((textEdit.el.tagName || "").toLowerCase() === "a") {
            position.push(textEdit.el);
          }
          for (
            var shaft: Dynamic = textEdit.el.querySelectorAll("a"),
              tag: Dynamic = 0;
            tag < shaft.length;
            tag++
          )
            if (innerHTML.intersectsNode(shaft[tag])) {
              position.push(shaft[tag]);
            }
        }
        var rot: Dynamic = innerHTML && innerHTML.commonAncestorContainer;
        var ref: Dynamic =
          rot && (rot.nodeType === 1 ? rot : rot.parentElement);
        var top: Dynamic =
          ref && ref.closest && textEdit ? ref.closest("a") : null;
        if (top && !textEdit.el.contains(top)) {
          top = null;
        }
        var name3: Dynamic = top
          ? (getComputedStyle(top).textDecorationLine || "").indexOf(
              "underline",
            ) === -1
          : !(document as Dynamic).queryCommandState("underline");
        (document as Dynamic).execCommand("underline");
        if ((document as Dynamic).queryCommandState("underline") !== name3) {
          (document as Dynamic).execCommand("underline");
        }
        for (var bottom: Dynamic = 0; bottom < position.length; bottom++) {
          var left: Dynamic = position[bottom];
          var scope: Dynamic = (getComputedStyle(left).textDecorationLine || "")
            .split(/\s+/)
            .filter(function (
              this: Dynamic,
              adjust?: Dynamic,
              ..._extraArguments481: Dynamic[]
            ): Dynamic {
              return adjust && adjust !== "none";
            });
          var top2: Dynamic = scope.indexOf("underline") !== -1;
          if (name3 && !top2) {
            scope.push("underline");
          }
          if (!name3 && top2) {
            scope.splice(scope.indexOf("underline"), 1);
          }
          left.style.textDecorationLine = scope.length
            ? scope.join(" ")
            : "none";
        }
      } catch {}
    },
    ul: function (this: Dynamic, ..._extraArguments482: Dynamic[]): Dynamic {
      (document as Dynamic).execCommand("insertUnorderedList");
    },
    ol: function (this: Dynamic, ..._extraArguments483: Dynamic[]): Dynamic {
      (document as Dynamic).execCommand("insertOrderedList");
    },
    link: function (this: Dynamic, ..._extraArguments484: Dynamic[]): Dynamic {
      var fillStyle: Dynamic = "";
      var innerHTML: Dynamic = true;
      var position: Dynamic = null;
      try {
        var shaft: Dynamic = getSelection();
        var tag: Dynamic = shaft.anchorNode;
        var rot: Dynamic =
          tag && (tag.nodeType === 1 ? tag : tag.parentElement);
        var ref: Dynamic = rot && rot.closest ? rot.closest("a") : null;
        if (ref && textEdit && ref === textEdit.el && !textEdit.foreign) {
          value_bt = null;
          var top: Dynamic = ref.getBoundingClientRect();
          emitEditorEvent({
            type: "linkEdit",
            href: ref.getAttribute("href") || "",
            collapsed: false,
            rect: {
              x: top.left,
              y: top.top,
              w: top.width,
              h: top.height,
            },
            hostTid: textEdit.tid,
            hostName: textEdit.name,
            isElementLink: true,
          });
          return;
        }
        if (
          ref &&
          textEdit &&
          !textEdit.foreign &&
          !textEdit.el.contains(ref) &&
          ref.contains(textEdit.el)
        ) {
          var name3: Dynamic = templateId(ref);
          if (!isNaN(name3)) {
            value_bt = null;
            var bottom: Dynamic = ref.getBoundingClientRect();
            emitEditorEvent({
              type: "linkEdit",
              href: ref.getAttribute("href") || "",
              collapsed: false,
              rect: {
                x: bottom.left,
                y: bottom.top,
                w: bottom.width,
                h: bottom.height,
              },
              hostTid: name3,
              hostName: nearestComponentName(ref),
              isElementLink: true,
            });
            return;
          }
        }
        fillStyle = (ref && ref.getAttribute("href")) || "";
        if (shaft.rangeCount > 0) {
          var left: Dynamic = shaft.getRangeAt(0);
          value_bt = left.cloneRange();
          innerHTML = left.collapsed;
          position = left.getBoundingClientRect();
        }
        if ((!position || (!position.width && !position.height)) && ref) {
          position = ref.getBoundingClientRect();
        }
        if ((!position || (!position.width && !position.height)) && textEdit) {
          position = unwrapDisplayContentsHost(
            textEdit.el,
          ).getBoundingClientRect();
        }
      } catch {}
      emitEditorEvent({
        type: "linkEdit",
        href: fillStyle,
        collapsed: innerHTML,
        rect: position
          ? {
              x: position.left,
              y: position.top,
              w: position.width,
              h: position.height,
            }
          : {
              x: 0,
              y: 0,
              w: 0,
              h: 0,
            },
      });
    },
  };
  var textStateTimer: Dynamic = null;
  function editedTemplateId(
    this: Dynamic,
    ..._extraArguments485: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic =
      textEdit && (textEdit.mount || textEdit.svg || textEdit.el);
    var innerHTML: Dynamic = fillStyle
      ? parseInt(fillStyle.getAttribute("data-dc-tpl"), 10)
      : NaN;
    return isNaN(innerHTML) ? (textEdit ? textEdit.tid : undefined) : innerHTML;
  }
  function emitTextEditState(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments486: Dynamic[]
  ): Dynamic {
    updateTouchPolicy();
    if (textStateTimer) {
      clearTimeout(textStateTimer);
      textStateTimer = null;
    }
    if (!fillStyle || !textEdit) {
      emitEditorEvent({
        type: "textEditState",
        active: false,
      });
      return;
    }
    if (
      textEdit.scriptTarget ||
      textEdit.propTarget ||
      textEdit.importTarget ||
      textEdit.svg
    ) {
      emitEditorEvent({
        type: "textEditState",
        active: true,
        plain: true,
        tid: editedTemplateId(),
      });
      return;
    }
    var innerHTML: Dynamic = {
      bold: false,
      italic: false,
      underline: false,
      ul: false,
      ol: false,
      link: false,
    };
    try {
      innerHTML.bold = !!(document as Dynamic).queryCommandState("bold");
    } catch {}
    try {
      innerHTML.italic = !!(document as Dynamic).queryCommandState("italic");
    } catch {}
    try {
      innerHTML.underline = !!selectionIsUnderlined();
    } catch {}
    try {
      innerHTML.ul = !!(document as Dynamic).queryCommandState(
        "insertUnorderedList",
      );
    } catch {}
    try {
      innerHTML.ol = !!(document as Dynamic).queryCommandState(
        "insertOrderedList",
      );
    } catch {}
    try {
      innerHTML.link = !!selectionInsideLink();
    } catch {}
    emitEditorEvent({
      type: "textEditState",
      active: true,
      formats: innerHTML,
      tid: editedTemplateId(),
    });
  }
  function scheduleTextEditState(
    this: Dynamic,
    ..._extraArguments487: Dynamic[]
  ): Dynamic {
    if (textEdit && textEdit.svg) {
      repaintSvgTextSelection();
    }
    if (!(!textEdit || textStateTimer)) {
      textStateTimer = setTimeout(function (
        this: Dynamic,
        ..._extraArguments488: Dynamic[]
      ): Dynamic {
        textStateTimer = null;
        if (textEdit) {
          emitTextEditState(true);
        }
      }, 120);
    }
  }
  function onTextEditInput(
    this: Dynamic,
    ..._extraArguments489: Dynamic[]
  ): Dynamic {
    if (!finishDetachedSvgEdit()) {
      if (textEdit && textEdit.svg) {
        if (textEdit.svgText.parentNode !== textEdit.svg) {
          textEdit.svg.textContent = "";
          textEdit.svg.appendChild(textEdit.svgText);
        }
        textEdit.svgText.nodeValue = textEdit.el.textContent;
      }
      if (textEdit && !textEdit.svg) {
        restoreDescendantAccessibility(textEdit.el);
      }
      scheduleTextEditState();
    }
  }
  function onTextEditPaste(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments490: Dynamic[]
  ): Dynamic {
    try {
      if (!textEdit) return;
      var innerHTML: Dynamic =
        (event.clipboardData && event.clipboardData.getData("text/plain")) ||
        "";
      var position: Dynamic = innerHTML.trim();
      if (textEdit.svg || textEdit.importTarget) {
        event.preventDefault();
        event.stopPropagation();
        (document as Dynamic).execCommand(
          "insertText",
          false,
          innerHTML.replace(/[ \t]*[\r\n]+[ \t]*/g, " "),
        );
        return;
      }
      if (
        textEdit.scriptTarget ||
        textEdit.propTarget ||
        !/^https?:\/\/\S+$/i.test(position)
      )
        return;
      var shaft: Dynamic = getSelection();
      if (!shaft || shaft.rangeCount === 0 || shaft.isCollapsed) return;
      var tag: Dynamic = shaft.getRangeAt(0);
      if (!textEdit.el.contains(tag.commonAncestorContainer)) return;
      event.preventDefault();
      event.stopPropagation();
      var rot: Dynamic = (document as Dynamic).createElement("a");
      rot.setAttribute("href", position);
      try {
        tag.surroundContents(rot);
      } catch {
        var ref: Dynamic = tag.extractContents();
        rot.appendChild(ref);
        tag.insertNode(rot);
      }
      shaft.removeAllRanges();
      var top: Dynamic = (document as Dynamic).createRange();
      top.setStartAfter(rot);
      top.collapse(true);
      shaft.addRange(top);
      onTextEditInput();
    } catch {}
  }
  function findEditableSvgText(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments491: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic =
          (fillStyle.tagName || "").toLowerCase() === "svg"
            ? fillStyle
            : fillStyle.ownerSVGElement,
        shaft: Dynamic = position
          ? position.querySelectorAll(
              "text[data-dc-tpl], tspan[data-dc-tpl], textPath[data-dc-tpl]",
            )
          : [],
        tag: Dynamic = null,
        rot: Dynamic = 1,
        ref: Dynamic = (document as Dynamic).createRange(),
        top: Dynamic = 0;
      top < shaft.length;
      top++
    ) {
      var name3: Dynamic = shaft[top];
      if (
        !(
          componentScopeName(name3) !== componentScopeName(fillStyle) ||
          !textEditableTemplates[
            templateKey(
              parseInt(name3.getAttribute("data-dc-tpl"), 10),
              nearestComponentName(name3),
            )
          ]
        )
      )
        for (
          var bottom: Dynamic =
              (parseFloat(getComputedStyle(name3).fontSize) || 16) *
              svgTextViewportScale(name3),
            left: Dynamic = name3.getBoundingClientRect(),
            scope: Dynamic = (document as Dynamic).createTreeWalker(
              name3,
              NodeFilter.SHOW_TEXT,
            ),
            top2: Dynamic;
          (top2 = scope.nextNode());

        )
          for (
            var adjust: Dynamic = 0;
            adjust < top2.nodeValue.length;
            adjust++
          ) {
            ref.setStart(top2, adjust);
            ref.setEnd(top2, adjust + 1);
            var axis: Dynamic = ref.getBoundingClientRect();
            var y2: Dynamic = axis.left + axis.width / 2;
            var pose: Dynamic = axis.top + axis.height / 2;
            if (
              !(
                !(axis.width > 0) ||
                y2 < left.left - bottom ||
                y2 > left.right + bottom ||
                pose < left.top - bottom ||
                pose > left.bottom + bottom
              )
            ) {
              var lock: Dynamic = y2 - innerHTML.clientX;
              var paint: Dynamic = pose - innerHTML.clientY;
              var lastKey: Dynamic =
                Math.sqrt(lock * lock + paint * paint) / bottom;
              if (lastKey < rot) {
                rot = lastKey;
                tag = name3;
              }
            }
          }
    }
    return tag;
  }
  function svgTextViewportScale(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments492: Dynamic[]
  ): Dynamic {
    try {
      var innerHTML: Dynamic = fillStyle.getScreenCTM();
      var position: Dynamic =
        (innerHTML &&
          Math.sqrt(innerHTML.a * innerHTML.a + innerHTML.b * innerHTML.b)) ||
        1;
      if (innerHTML && (innerHTML.b || innerHTML.c)) return position;
      var shaft: Dynamic =
        (fillStyle.closest && fillStyle.closest("text")) || fillStyle;
      var tag: Dynamic = shaft.getBBox();
      var rot: Dynamic = shaft.getBoundingClientRect();
      return tag.width > 0 && rot.width > 0 ? rot.width / tag.width : position;
    } catch {
      return 1;
    }
  }
  function normalizedSvgText(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments493: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = (fillStyle.textContent || "").replace(
      /[ \t\r\n\f]+/g,
      " ",
    );
    var position: Dynamic = -1;
    try {
      position = fillStyle.getNumberOfChars();
    } catch {}
    if (innerHTML.length === position) return innerHTML;
    if (
      innerHTML.length > 1 &&
      innerHTML.charAt(0) === " " &&
      innerHTML.charAt(innerHTML.length - 1) === " " &&
      innerHTML.length - 1 === position
    ) {
      var shaft: Dynamic = fillStyle.closest && fillStyle.closest("text");
      var tag: Dynamic = "";
      if (shaft && shaft !== fillStyle) {
        var rot: Dynamic = (document as Dynamic).createRange();
        rot.setStart(shaft, 0);
        rot.setEndBefore(fillStyle);
        tag = rot.toString();
      }
      return /\S/.test(tag) ? innerHTML.slice(0, -1) : innerHTML.slice(1);
    }
    return innerHTML.replace(/^ | $/g, "");
  }
  function finishDetachedSvgEdit(
    this: Dynamic,
    ..._extraArguments494: Dynamic[]
  ): Dynamic {
    return !textEdit || !textEdit.svg || textEdit.svg.isConnected
      ? false
      : (finishTextEdit(false), true);
  }
  function svgPointToViewport(
    this: Dynamic,
    element?: Dynamic,
    x?: Dynamic,
    y?: Dynamic,
    ..._extraArguments495: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = element.getScreenCTM();
    if (shaft && (shaft.b || shaft.c)) {
      var tag: Dynamic = new DOMPoint(x, y).matrixTransform(shaft);
      return {
        x: tag.x,
        y: tag.y,
      };
    }
    var rot: Dynamic = (element.closest && element.closest("text")) || element;
    var ref: Dynamic = rot.getBBox();
    var top: Dynamic = rot.getBoundingClientRect();
    var name3: Dynamic =
      ref.width > 0 && top.width > 0 ? top.width / ref.width : 1;
    return {
      x: top.left + (x - ref.x) * name3,
      y: top.top + (y - ref.y) * name3,
    };
  }
  function svgCharacterPositions(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments496: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = [];
    var position: Dynamic = [];
    var shaft: Dynamic = 0;
    var tag: Dynamic;
    var rot: Dynamic = -1;
    var ref: Dynamic = -1;
    try {
      shaft = fillStyle.getNumberOfChars();
    } catch {}
    for (tag = 0; tag < shaft; tag++) {
      var top: Dynamic = null;
      try {
        if (fillStyle.getExtentOfChar(tag).width > 0) {
          var name3: Dynamic = fillStyle.getStartPositionOfChar(tag);
          var bottom: Dynamic = fillStyle.getEndPositionOfChar(tag);
          var left: Dynamic = svgPointToViewport(fillStyle, name3.x, name3.y);
          var scope: Dynamic = svgPointToViewport(
            fillStyle,
            bottom.x,
            bottom.y,
          );
          top = {
            x: left.x,
            y: left.y,
            ex: scope.x,
            ey: scope.y,
            ang: Math.atan2(scope.y - left.y, scope.x - left.x),
            w: Math.sqrt(
              (scope.x - left.x) * (scope.x - left.x) +
                (scope.y - left.y) * (scope.y - left.y),
            ),
            drawn: true,
          };
          if (rot < 0) {
            rot = tag;
          }
          ref = tag;
        }
      } catch {}
      innerHTML.push(top);
    }
    if (rot < 0) return position;
    var top2: Dynamic = {
      x: innerHTML[ref].ex,
      y: innerHTML[ref].ey,
      ang: innerHTML[ref].ang,
      w: 0,
      drawn: true,
    };
    for (tag = 0; tag <= shaft; tag++)
      if (tag < shaft && innerHTML[tag]) position.push(innerHTML[tag]);
      else if (tag > ref)
        position.push(
          tag === ref + 1
            ? top2
            : {
                x: top2.x,
                y: top2.y,
                ang: top2.ang,
                w: 0,
                drawn: false,
              },
        );
      else {
        for (var adjust: Dynamic = tag; !innerHTML[adjust]; ) adjust++;
        position.push({
          x: innerHTML[adjust].x,
          y: innerHTML[adjust].y,
          ang: innerHTML[adjust].ang,
          w: 0,
          drawn: false,
        });
      }
    return position;
  }
  function svgCaretAtPointer(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments497: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = svgCharacterPositions(fillStyle),
        shaft: Dynamic = 0,
        tag: Dynamic = 1 / 0,
        rot: Dynamic = 0;
      rot < position.length;
      rot++
    )
      if (position[rot].drawn) {
        var ref: Dynamic =
          (position[rot].x - innerHTML.clientX) *
            (position[rot].x - innerHTML.clientX) +
          (position[rot].y - innerHTML.clientY) *
            (position[rot].y - innerHTML.clientY);
        if (ref < tag) {
          tag = ref;
          shaft = rot;
        }
      }
    return shaft;
  }
  function textEditSelectionOffsets(
    this: Dynamic,
    ..._extraArguments498: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = textEdit.el;
    var innerHTML: Dynamic = getSelection();
    var position: Dynamic = (fillStyle.textContent || "").length;
    function shaft(
      this: Dynamic,
      tag?: Dynamic,
      rot?: Dynamic,
      ..._extraArguments499: Dynamic[]
    ): Dynamic {
      if (!tag || !fillStyle.contains(tag)) return position;
      if (tag === fillStyle) {
        for (
          var ref: Dynamic = 0, top: Dynamic = 0;
          top < rot && top < fillStyle.childNodes.length;
          top++
        )
          ref += (fillStyle.childNodes[top].textContent || "").length;
        return ref;
      }
      for (
        var name3: Dynamic = (document as Dynamic).createTreeWalker(
            fillStyle,
            NodeFilter.SHOW_TEXT,
          ),
          bottom: Dynamic,
          left: Dynamic = 0;
        (bottom = name3.nextNode());

      ) {
        if (bottom === tag) return left + rot;
        left += bottom.nodeValue.length;
      }
      return position;
    }
    return !innerHTML ||
      !innerHTML.rangeCount ||
      !fillStyle.contains(innerHTML.anchorNode)
      ? [position, position]
      : [
          shaft(innerHTML.anchorNode, innerHTML.anchorOffset),
          shaft(innerHTML.focusNode, innerHTML.focusOffset),
        ];
  }
  function setTextEditSelection(
    this: Dynamic,
    anchorOffset?: Dynamic,
    focusOffset?: Dynamic,
    ..._extraArguments500: Dynamic[]
  ): Dynamic {
    var position: Dynamic = textEdit.el;
    var shaft: Dynamic = getSelection();
    function tag(
      this: Dynamic,
      top?: Dynamic,
      ..._extraArguments501: Dynamic[]
    ): Dynamic {
      var name3: Dynamic = (document as Dynamic).createTreeWalker(
        position,
        NodeFilter.SHOW_TEXT,
      );
      var bottom: Dynamic;
      var left: Dynamic = null;
      for (top = Math.max(0, top); (bottom = name3.nextNode()); ) {
        if (top <= bottom.nodeValue.length) return [bottom, top];
        top -= bottom.nodeValue.length;
        left = bottom;
      }
      return left ? [left, left.nodeValue.length] : [position, 0];
    }
    var rot: Dynamic = tag(anchorOffset);
    var ref: Dynamic = tag(focusOffset);
    position.focus();
    shaft.setBaseAndExtent(rot[0], rot[1], ref[0], ref[1]);
    repaintSvgTextSelection();
  }
  var svgTextMarks: Dynamic = [];
  var svgTextMarkCount: Dynamic = 0;
  function clearSvgTextMarks(
    this: Dynamic,
    ..._extraArguments502: Dynamic[]
  ): Dynamic {
    for (
      var fillStyle: Dynamic = 0;
      fillStyle < svgTextMarks.length;
      fillStyle++
    )
      svgTextMarks[fillStyle].remove();
    svgTextMarks = [];
    svgTextMarkCount = 0;
  }
  function hideUnusedSvgTextMarks(
    this: Dynamic,
    ..._extraArguments503: Dynamic[]
  ): Dynamic {
    for (
      var fillStyle: Dynamic = svgTextMarkCount;
      fillStyle < svgTextMarks.length;
      fillStyle++
    )
      svgTextMarks[fillStyle].style.display = "none";
  }
  function appendSvgTextMark(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments504: Dynamic[]
  ): Dynamic {
    var tag: Dynamic = svgTextMarks[svgTextMarkCount++];
    if (!tag) {
      tag = (document as Dynamic).createElement("div");
      tag.setAttribute("data-dc-editor-overlay", "");
      ensureOverlayRoot().appendChild(tag);
      svgTextMarks.push(tag);
    }
    tag.setAttribute("data-dc-editor-svg-mark", shaft ? "caret" : "sel");
    tag.style.cssText =
      "position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;transform-origin:0 0;width:" +
      (shaft ? chromePixels(1.5) : innerHTML) +
      "px;height:" +
      position * 1.05 +
      "px;background:" +
      (shaft
        ? CHROME_STROKE
        : "color-mix(in srgb," + CHROME_STROKE + " 32%,transparent)") +
      ";transform:translate(" +
      fillStyle.x +
      "px," +
      fillStyle.y +
      "px) rotate(" +
      fillStyle.ang +
      "rad) translate(0," +
      -position * 0.88 +
      "px);";
    var rot: Dynamic = tag.getAnimations ? tag.getAnimations() : [];
    if (shaft && !rot.length && tag.animate) {
      tag.animate(
        [
          {
            opacity: 1,
          },
          {
            opacity: 1,
            offset: 0.5,
          },
          {
            opacity: 0,
            offset: 0.5,
          },
          {
            opacity: 0,
          },
        ],
        {
          duration: 1e3,
          iterations: 1 / 0,
        },
      );
    }
    for (var ref: Dynamic = 0; ref < rot.length; ref++)
      if (shaft) {
        rot[ref].currentTime = 0;
      } else {
        rot[ref].cancel();
      }
  }
  function repaintSvgTextSelection(
    this: Dynamic,
    ..._extraArguments505: Dynamic[]
  ): Dynamic {
    svgTextMarkCount = 0;
    if (!textEdit || !textEdit.svg || !textEdit.svg.isConnected) {
      hideUnusedSvgTextMarks();
      return;
    }
    var fillStyle: Dynamic = textEdit.svg;
    var innerHTML: Dynamic = svgCharacterPositions(fillStyle);
    var position: Dynamic =
      (parseFloat(getComputedStyle(fillStyle).fontSize) || 16) *
      svgTextViewportScale(fillStyle);
    var shaft: Dynamic = textEditSelectionOffsets();
    var tag: Dynamic = Math.min(shaft[0], shaft[1]);
    var rot: Dynamic = Math.max(shaft[0], shaft[1]);
    var ref: Dynamic = innerHTML.length - 1;
    if (ref < 0) {
      if (textEdit.lastStop) {
        appendSvgTextMark(textEdit.lastStop, 0, position, true);
      }
    } else if (tag === rot || rot > ref + 1) {
      textEdit.lastStop = innerHTML[Math.min(tag, ref)];
      appendSvgTextMark(textEdit.lastStop, 0, position, true);
    } else {
      for (var top: Dynamic = tag; top < rot && top < ref; top++)
        if (
          innerHTML[top].w > 0 &&
          !(
            top > tag &&
            innerHTML[top].x === innerHTML[top - 1].x &&
            innerHTML[top].y === innerHTML[top - 1].y
          )
        ) {
          appendSvgTextMark(innerHTML[top], innerHTML[top].w, position, false);
        }
      textEdit.lastStop = innerHTML[Math.min(rot, ref)];
    }
    hideUnusedSvgTextMarks();
  }
  var svgSelectionAnchor: Dynamic = null;
  var svgClickState: Dynamic = null;
  function onSvgTextMouseDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments506: Dynamic[]
  ): Dynamic {
    if (event.button === 0) {
      if (event.detail >= 3) {
        svgSelectionAnchor = null;
        setTextEditSelection(0, (textEdit.el.textContent || "").length);
        return;
      }
      var innerHTML: Dynamic = svgCaretAtPointer(textEdit.svg, event);
      var position: Dynamic = textEditSelectionOffsets();
      svgClickState = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
      svgSelectionAnchor = event.shiftKey ? position[0] : innerHTML;
      setTextEditSelection(svgSelectionAnchor, innerHTML);
    }
  }
  function onSvgTextMouseMove(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments507: Dynamic[]
  ): Dynamic {
    if (svgSelectionAnchor == null || !textEdit || !textEdit.svg) {
      svgSelectionAnchor = null;
      return;
    }
    if (!(event.buttons & 1)) {
      svgSelectionAnchor = null;
      return;
    }
    if (
      svgClickState &&
      Math.abs(event.clientX - svgClickState.x) +
        Math.abs(event.clientY - svgClickState.y) >
        4
    ) {
      svgClickState.moved = true;
    }
    setTextEditSelection(
      svgSelectionAnchor,
      svgCaretAtPointer(textEdit.svg, event),
    );
  }
  function onSvgTextDoubleClick(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments508: Dynamic[]
  ): Dynamic {
    if (!(svgClickState && svgClickState.moved)) {
      for (
        var innerHTML: Dynamic = textEdit.el.textContent || "",
          position: Dynamic = svgCaretAtPointer(textEdit.svg, event),
          shaft: Dynamic = position,
          tag: Dynamic = position;
        shaft > 0 && /\S/.test(innerHTML.charAt(shaft - 1));

      )
        shaft--;
      for (; tag < innerHTML.length && /\S/.test(innerHTML.charAt(tag)); )
        tag++;
      setTextEditSelection(shaft, tag);
    }
  }
  function positionSvgTextEditor(
    this: Dynamic,
    ..._extraArguments509: Dynamic[]
  ): Dynamic {
    if (!(!textEdit || !textEdit.svg || finishDetachedSvgEdit())) {
      var fillStyle: Dynamic = textEdit.svg.getBoundingClientRect();
      var innerHTML: Dynamic = textEdit.el;
      if (fillStyle.width > 0) {
        innerHTML.style.left = fillStyle.left + "px";
        innerHTML.style.top = fillStyle.top + "px";
        innerHTML.style.width = fillStyle.width + "px";
        innerHTML.style.height = Math.max(fillStyle.height, 1) + "px";
      }
      repaintSvgTextSelection();
    }
  }
  function createSvgTextEditor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments510: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = getComputedStyle(fillStyle);
    var position: Dynamic = (document as Dynamic).createElement("div");
    textEdit.svgPre = /^(pre|pre-wrap|break-spaces)$/.test(
      innerHTML.whiteSpace,
    );
    textEdit.startText = textEdit.svgPre
      ? fillStyle.textContent
      : normalizedSvgText(fillStyle);
    textEdit.svgWs = fillStyle.style.getPropertyValue("white-space");
    fillStyle.style.setProperty("white-space", "pre");
    fillStyle.setAttribute("data-dc-editor-svg-editing", "");
    position.setAttribute("data-dc-editor-overlay", "");
    position.setAttribute("data-dc-editor-svg-text", "");
    position.setAttribute("role", "textbox");
    position.setAttribute("aria-label", "Edit text");
    position.style.cssText =
      "position:fixed;left:0;top:0;z-index:2147483646;opacity:0;pointer-events:none;overflow:hidden;white-space:pre;outline:none;font-size:" +
      innerHTML.fontSize +
      ";";
    fillStyle.textContent = "";
    textEdit.svgText = fillStyle.appendChild(
      (document as Dynamic).createTextNode(textEdit.startText),
    );
    position.textContent = textEdit.startText;
    ensureOverlayRoot().appendChild(position);
    return position;
  }
  function selectTextRange(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments511: Dynamic[]
  ): Dynamic {
    var position: Dynamic = /^[ \t\n\r\f]*$/;
    var shaft: Dynamic = /[ \t\n\r\f]+$/;
    try {
      var tag: Dynamic = getSelection();
      tag.removeAllRanges();
      var rot: Dynamic = (document as Dynamic).createRange();
      if (innerHTML !== "end") {
        rot.selectNodeContents(fillStyle);
        tag.addRange(rot);
        return;
      }
      for (
        var ref: Dynamic = fillStyle, top: Dynamic, name3: Dynamic = false;
        (top = ref.lastChild);

      ) {
        name3 = false;
        try {
          name3 = /^pre|^break-spaces/.test(
            getComputedStyle(ref).whiteSpace || "",
          );
        } catch {}
        for (
          ;
          !name3 &&
          top.previousSibling &&
          top.nodeType === 3 &&
          position.test(top.data);

        )
          top = top.previousSibling;
        ref = top;
        if (top.nodeType !== 1 || top.nodeName.toUpperCase() === "A") break;
      }
      if (ref.nodeType === 3) {
        rot.setStart(
          ref,
          name3 ? ref.data.length : ref.data.replace(shaft, "").length,
        );
      } else {
        if (ref !== fillStyle) {
          rot.setStartAfter(ref);
        } else {
          rot.setStart(fillStyle, 0);
        }
      }
      rot.collapse(true);
      tag.addRange(rot);
    } catch {}
  }
  function focusTextEditor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments512: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = textEdit.el;
    var position: Dynamic = false;
    try {
      var shaft: Dynamic = getSelection();
      position =
        shaft.rangeCount > 0 &&
        innerHTML.contains(shaft.getRangeAt(0).startContainer);
    } catch {}
    try {
      innerHTML.focus();
    } catch {}
    if (!position) {
      selectTextRange(innerHTML, fillStyle);
    }
    emitTextEditState(true);
    if (textEdit.svg) {
      positionSvgTextEditor();
    }
  }
  function beginTemplateTextEdit(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments513: Dynamic[]
  ): Dynamic {
    if (!readOnly) {
      var tag: Dynamic = leftTextCopy;
      var rot: Dynamic = parseInt(fillStyle.getAttribute("data-dc-tpl"), 10);
      var ref: Dynamic = nearestComponentName(fillStyle);
      var top: Dynamic = !!textEditableTemplates[templateKey(rot, ref)];
      var name3: Dynamic = textEdit ? finishTextEdit(undefined, top) : null;
      if (top) {
        var bottom: Dynamic = state4[templateKey(rot, ref)];
        var left: Dynamic = null;
        var scope: Dynamic = null;
        var top2: Dynamic = false;
        var adjust: Dynamic = null;
        if (bottom != null) {
          var axis: Dynamic = fillStyle.textContent || "";
          var y2: Dynamic = /^\s*\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}\s*$/.exec(
            bottom,
          );
          if (
            y2 &&
            (Object as Dynamic).prototype.hasOwnProperty.call(state5, y2[1]) &&
            state5[y2[1]] === axis
          ) {
            if (
              name3 &&
              name3.propTarget &&
              name3.propTarget.prop === y2[1] &&
              name3.propTarget.value === axis &&
              name3.text.length <= 16384
            ) {
              axis = name3.text;
            }
            scope = {
              prop: y2[1],
              value: axis,
            };
          } else {
            for (
              var pose: Dynamic = null,
                lock: Dynamic = false,
                paint: Dynamic = 0;
              paint < items.length;
              paint++
            )
              if (items[paint].value === axis) {
                if (pose) {
                  lock = true;
                  break;
                }
                pose = items[paint];
              }
            if (!pose || lock) top2 = true;
            else {
              left = {
                start: pose.start,
                end: pose.end,
                quote: pose.quote,
                value: axis,
              };
              var lastKey: Dynamic = name3 && name3.scriptTarget;
              if (lastKey) {
                adjust = {
                  start: lastKey.start,
                  end: lastKey.end,
                  text: name3.text,
                  from: axis,
                };
                if (
                  pose.start === lastKey.start &&
                  pose.end === lastKey.end &&
                  lastKey.value === axis
                ) {
                  adjust.from = axis = name3.text;
                }
              }
            }
          }
        }
        clearHover();
        textEdit = {
          el: fillStyle,
          tid: rot,
          name: ref,
          scriptTarget: left,
          propTarget: scope,
          reopen: adjust,
        };
        var lim: Dynamic = (Array as Dynamic).prototype.slice.call(
          fillStyle.childNodes,
        );
        var text8: Dynamic = leftTextCopy !== tag;
        textEdit.origNodes = restoreOriginalTextNodes(fillStyle, lim);
        var value_S: Dynamic;
        var expected: Dynamic;
        if (left || scope) fillStyle.textContent = axis;
        else if (top2) fillStyle.innerHTML = bottom;
        else {
          var items14: Dynamic = [];
          for (value_S = 0; value_S < lim.length; value_S++)
            items14.push(lim[value_S].cloneNode(true));
          for (
            fillStyle.innerHTML = "", value_S = 0;
            value_S < items14.length;
            value_S++
          ) {
            if (items14[value_S].nodeType === 1) {
              items14[value_S].removeAttribute("data-dc-tpl");
              var value_N: Dynamic =
                items14[value_S].querySelectorAll("[data-dc-tpl]");
              for (expected = 0; expected < value_N.length; expected++)
                value_N[expected].removeAttribute("data-dc-tpl");
            }
            fillStyle.appendChild(items14[value_S]);
          }
        }
        textEdit.startHtml =
          left || scope || top2 || text8
            ? fillStyle.innerHTML
            : serializeOriginalTextNodes(fillStyle, textEdit.origNodes, lim);
        if (fillStyle instanceof SVGElement) {
          var el: Dynamic = createSvgTextEditor(fillStyle);
          textEdit.svg = fillStyle;
          fillStyle = textEdit.el = el;
          (document as Dynamic).addEventListener(
            "scroll",
            positionSvgTextEditor,
            true,
          );
          (document as Dynamic).addEventListener(
            "mousemove",
            onSvgTextMouseMove,
            true,
          );
        }
        fillStyle.setAttribute("contenteditable", "true");
        fillStyle.setAttribute("data-dc-editor-editing", "");
        setEditorAccessibility(fillStyle);
        fillStyle.addEventListener("input", onTextEditInput);
        fillStyle.addEventListener("paste", onTextEditPaste);
        (document as Dynamic).addEventListener(
          "selectionchange",
          scheduleTextEditState,
        );
        fillStyle.focus();
        selectTextRange(fillStyle, shaft);
        emitTextEditState(true);
        if (textEdit.svg) {
          positionSvgTextEditor();
        }
      }
    }
  }
  function beginForeignTextEdit(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments514: Dynamic[]
  ): Dynamic {
    if (textEdit) {
      finishTextEdit();
    }
    clearHover();
    textEdit = {
      el: fillStyle,
      foreign: true,
      tag: fillStyle.tagName.toLowerCase(),
      startText: fillStyle.innerText || "",
      startHtml: fillStyle.innerHTML,
      origCE: fillStyle.getAttribute("contenteditable"),
    };
    fillStyle.setAttribute("contenteditable", "true");
    fillStyle.setAttribute("data-dc-editor-editing", "");
    setEditorAccessibility(fillStyle);
    fillStyle.addEventListener("input", onTextEditInput);
    fillStyle.addEventListener("paste", onTextEditPaste);
    (document as Dynamic).addEventListener(
      "selectionchange",
      scheduleTextEditState,
    );
    fillStyle.focus();
    try {
      var innerHTML: Dynamic = getSelection();
      innerHTML.removeAllRanges();
      var position: Dynamic = (document as Dynamic).createRange();
      position.selectNodeContents(fillStyle);
      innerHTML.addRange(position);
    } catch {}
    emitTextEditState(true);
  }
  var value_je: Dynamic = false;
  var items11: Dynamic = [
    "keydown",
    "keyup",
    "keypress",
    "mousedown",
    "mouseup",
    "pointerdown",
    "pointerup",
    "dblclick",
  ];
  function onImportedTextEvent(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments515: Dynamic[]
  ): Dynamic {
    if (
      textEdit &&
      textEdit.importTarget &&
      textEdit.el.contains(event.target)
    ) {
      event.stopPropagation();
    }
  }
  function caretNodeAtPointer(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments516: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = null;
    if ((document as Dynamic).caretRangeFromPoint) {
      var position: Dynamic = (document as Dynamic).caretRangeFromPoint(
        fillStyle.clientX,
        fillStyle.clientY,
      );
      innerHTML = position ? position.startContainer : null;
    } else if ((document as Dynamic).caretPositionFromPoint) {
      var shaft: Dynamic = (document as Dynamic).caretPositionFromPoint(
        fillStyle.clientX,
        fillStyle.clientY,
      );
      innerHTML = shaft ? shaft.offsetNode : null;
    }
    if (
      !innerHTML ||
      innerHTML.nodeType !== 3 ||
      (innerHTML.nodeValue || "").trim() === ""
    )
      return null;
    var tag: Dynamic = (document as Dynamic).createRange();
    tag.selectNodeContents(innerHTML);
    for (
      var rot: Dynamic = tag.getClientRects(), ref: Dynamic = 0;
      ref < rot.length;
      ref++
    )
      if (
        fillStyle.clientX >= rot[ref].left - 1 &&
        fillStyle.clientX <= rot[ref].right + 1 &&
        fillStyle.clientY >= rot[ref].top - 1 &&
        fillStyle.clientY <= rot[ref].bottom + 1
      )
        return innerHTML;
    return null;
  }
  function isVisibleTextNode(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments517: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = fillStyle.parentElement;
    var tag: Dynamic = (document as Dynamic).createRange();
    tag.selectNodeContents(fillStyle);
    var rot: Dynamic = tag.getClientRects();
    if (
      !rot.length ||
      rot[0].height / elementViewportScale(shaft) < 2 ||
      getComputedStyle(shaft).visibility !== "visible"
    )
      return false;
    for (var ref: Dynamic = shaft; ref; ref = ref.parentElement) {
      var top: Dynamic = getComputedStyle(ref);
      var name3: Dynamic =
        top.overflowX !== "visible" || top.overflowY !== "visible";
      if (
        parseFloat(top.opacity) === 0 ||
        (ref !== innerHTML &&
          innerHTML.contains(ref) &&
          name3 &&
          (ref.offsetWidth < 2 || ref.offsetHeight < 2))
      )
        return false;
    }
    if (position) return true;
    for (
      var bottom: Dynamic = (document as Dynamic).elementsFromPoint(
          rot[0].left + rot[0].width / 2,
          rot[0].top + rot[0].height / 2,
        ),
        left: Dynamic = 0;
      left < bottom.length;
      left++
    )
      if (
        !bottom[left].closest(
          "[data-dc-editor-overlay],[data-dc-editor-overlay-root],[data-omelette-chrome],[data-omelette-injected]",
        )
      )
        return innerHTML.contains(bottom[left]);
    return false;
  }
  function finishDetachedTextEdit(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments518: Dynamic[]
  ): Dynamic {
    if (!(textEdit !== fillStyle || fillStyle.el.isConnected)) {
      fillStyle.lost = true;
      value_je = (document as Dynamic).hasFocus();
      if (value_je) {
        selectedTemplateIds = [];
        selectedComponentName = null;
        selectedPart = null;
        clearForeignSelection();
        repaintSelection();
        emitSelection();
      }
      finishTextEdit();
    }
  }
  function beginScriptTargetEdit(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments519: Dynamic[]
  ): Dynamic {
    if (textEdit) {
      finishTextEdit();
    }
    var shaft: Dynamic = nearestComponentName(fillStyle);
    var tag: Dynamic = state6[templateKey(innerHTML, shaft)];
    if (
      !tag ||
      findTemplateInstances(innerHTML, componentScopeName(fillStyle)).length !==
        1
    )
      return false;
    var rot: Dynamic = caretNodeAtPointer(position);
    var ref: Dynamic = value_pd(fillStyle, tag, rot);
    if (!ref || !isVisibleTextNode(ref.node, fillStyle, ref.node === rot))
      return false;
    clearHover();
    var top: Dynamic = (document as Dynamic).createElement("dc-edit-field");
    top.textContent = (ref.node.nodeValue || "").replace(/[ \t\n\r\f]+/g, " ");
    top.style.cssText =
      "user-select:text!important;-webkit-user-select:text!important;";
    textEdit = {
      el: top,
      tid: innerHTML,
      name: shaft,
      mount: fillStyle,
      importNode: ref.node,
      importText: ref.node.nodeValue,
      importTarget: {
        key: ref.key,
        words: ref.words,
      },
      startText: top.textContent,
    };
    ref.node.parentNode.insertBefore(top, ref.node.nextSibling);
    ref.node.nodeValue = "";
    var name3: Dynamic = textEdit;
    name3.watch = new MutationObserver(function (
      this: Dynamic,
      ..._extraArguments520: Dynamic[]
    ): Dynamic {
      if (textEdit !== name3) {
        name3.watch.disconnect();
      } else {
        if (!top.isConnected) {
          finishDetachedTextEdit(name3);
        }
      }
    });
    name3.watch.observe((document as Dynamic).documentElement, {
      childList: true,
      subtree: true,
    });
    for (var bottom: Dynamic = 0; bottom < items11.length; bottom++)
      (document as Dynamic).addEventListener(
        items11[bottom],
        onImportedTextEvent,
        true,
      );
    top.setAttribute("contenteditable", "true");
    top.setAttribute("data-dc-editor-editing", "import");
    setEditorAccessibility(top, true);
    top.addEventListener("input", onTextEditInput);
    top.addEventListener("paste", onTextEditPaste);
    (document as Dynamic).addEventListener(
      "selectionchange",
      scheduleTextEditState,
    );
    top.focus();
    selectTextRange(top);
    emitTextEditState(true);
    return true;
  }
  function detachTextEditor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments521: Dynamic[]
  ): Dynamic {
    if (!textEdit) return null;
    value_bt = null;
    var innerHTML: Dynamic = textEdit;
    textEdit = null;
    emitTextEditState(false);
    innerHTML.el.removeEventListener("input", onTextEditInput);
    innerHTML.el.removeEventListener("paste", onTextEditPaste);
    (document as Dynamic).removeEventListener(
      "selectionchange",
      scheduleTextEditState,
    );
    if (innerHTML.origCE != null) {
      innerHTML.el.setAttribute("contenteditable", innerHTML.origCE);
    } else {
      innerHTML.el.removeAttribute("contenteditable");
    }
    innerHTML.el.removeAttribute("data-dc-editor-editing");
    restoreEditorAccessibility(innerHTML.el);
    var position: Dynamic =
      (innerHTML.importTarget && innerHTML.el.textContent) || "";
    var shaft: Dynamic =
      !!innerHTML.importTarget &&
      innerHTML.mount.isConnected &&
      innerHTML.el.isConnected;
    innerHTML.el.blur();
    if (innerHTML.importTarget) {
      for (var tag: Dynamic = 0; tag < items11.length; tag++)
        (document as Dynamic).removeEventListener(
          items11[tag],
          onImportedTextEvent,
          true,
        );
      innerHTML.watch.disconnect();
      if (innerHTML.el.parentNode) {
        innerHTML.el.parentNode.removeChild(innerHTML.el);
      }
      if (innerHTML.importNode.nodeValue === "") {
        innerHTML.importNode.nodeValue = innerHTML.importText;
      }
      if (!shaft || !position.trim() || position === innerHTML.startText)
        return null;
      var rot: Dynamic = parseInt(
        innerHTML.mount.getAttribute("data-dc-tpl"),
        10,
      );
      return {
        tid: isNaN(rot) ? innerHTML.tid : rot,
        name: innerHTML.name,
        html: "",
        text: position,
        importTarget: innerHTML.importTarget,
      };
    }
    if (innerHTML.svg) {
      (document as Dynamic).removeEventListener(
        "scroll",
        positionSvgTextEditor,
        true,
      );
      (document as Dynamic).removeEventListener(
        "mousemove",
        onSvgTextMouseMove,
        true,
      );
      clearSvgTextMarks();
      svgSelectionAnchor = null;
      innerHTML.el.remove();
      innerHTML.el = innerHTML.svg;
      innerHTML.svg.removeAttribute("data-dc-editor-svg-editing");
      if (innerHTML.svgWs) {
        innerHTML.svg.style.setProperty("white-space", innerHTML.svgWs);
      } else {
        innerHTML.svg.style.removeProperty("white-space");
      }
      if (!innerHTML.svg.getAttribute("style")) {
        innerHTML.svg.removeAttribute("style");
      }
      if (!innerHTML.svgPre) {
        innerHTML.svg.textContent = normalizedSvgText(innerHTML.svg);
      }
    }
    restoreDescendantAccessibility(innerHTML.el);
    var ref: Dynamic = innerHTML.el.innerHTML;
    var top: Dynamic =
      innerHTML.scriptTarget || innerHTML.propTarget
        ? (function lim(
            this: Dynamic,
            text8?: Dynamic,
            options?: Dynamic,
            ..._extraArguments522: Dynamic[]
          ): Dynamic {
            for (
              var expected: Dynamic = text8.firstChild;
              expected;
              expected = expected.nextSibling
            )
              if (expected.nodeType === 3) options.push(expected.nodeValue);
              else if (expected.nodeType === 1) {
                var tagName: Dynamic = expected.tagName;
                if (tagName === "BR") {
                  options.push(
                    expected.nextSibling || expected.previousSibling
                      ? `
`
                      : "",
                  );
                } else {
                  if (
                    options.length &&
                    (tagName === "DIV" || tagName === "P")
                  ) {
                    options.push(`
`);
                  }
                  lim(expected, options);
                }
              }
            return options;
          })(innerHTML.el, []).join("")
        : innerHTML.svg
          ? innerHTML.el.textContent
          : innerHTML.el.innerText;
    if (
      innerHTML.svg &&
      (top === innerHTML.startText || !top.trim() || !innerHTML.svg.isConnected)
    ) {
      ref = innerHTML.startHtml;
    }
    if (innerHTML.foreign)
      return ref === innerHTML.startHtml
        ? null
        : {
            foreign: true,
            tag: innerHTML.tag,
            before: innerHTML.startText,
            after: top,
          };
    var name3: Dynamic = innerHTML.reopen;
    if (name3) {
      for (
        var bottom: Dynamic = function (
            this: Dynamic,
            lim?: Dynamic,
            ..._extraArguments523: Dynamic[]
          ): Dynamic {
            for (var text8: Dynamic = 0; text8 < items.length; text8++)
              if (items[text8].start === lim) return items[text8];
            return null;
          },
          left: Dynamic = bottom(name3.start),
          scope: Dynamic = innerHTML.scriptTarget.start,
          top2: Dynamic =
            !left || left.value !== name3.text
              ? null
              : scope === name3.start
                ? left
                : scope >= name3.end
                  ? bottom(scope + left.end - name3.end)
                  : null,
          adjust: Dynamic = 0;
        top2 && adjust < items.length;
        adjust++
      )
        if (
          items[adjust] !== top2 &&
          items[adjust].value === innerHTML.scriptTarget.value
        ) {
          top2 = null;
        }
      if (top2 && top2.value === name3.from) {
        innerHTML.scriptTarget = {
          start: top2.start,
          end: top2.end,
          quote: top2.quote,
          value: top2.value,
        };
      }
    }
    var axis: Dynamic =
      fillStyle !== false &&
      !innerHTML.scriptTarget &&
      !innerHTML.propTarget &&
      !!(window as Dynamic).__dcContentKeyed &&
      value_Ko(ref) !== value_Ko(innerHTML.startHtml);
    if (!axis) {
      innerHTML.el.innerHTML = "";
      for (var y2: Dynamic = 0; y2 < innerHTML.origNodes.length; y2++)
        innerHTML.el.appendChild(innerHTML.origNodes[y2]);
    }
    if (ref === innerHTML.startHtml) return null;
    if (axis) {
      value_Ke = {
        name: innerHTML.name,
        s: {},
      };
      for (
        var pose: Dynamic = innerHTML.el;
        pose && pose.hasAttribute && pose.hasAttribute("data-dc-tpl");
        pose = pose.parentElement
      )
        if (pose.scrollTop || pose.scrollLeft) {
          value_Ke.s[pose.getAttribute("data-dc-tpl")] = {
            t: pose.scrollTop,
            l: pose.scrollLeft,
          };
        }
      clearTimeout(value_Ja);
      value_Ja = setTimeout(function (
        this: Dynamic,
        ..._extraArguments524: Dynamic[]
      ): Dynamic {
        value_Ke = null;
      }, 400);
    }
    var lock: Dynamic = parseInt(innerHTML.el.getAttribute("data-dc-tpl"), 10);
    if (axis && (window as Dynamic).__dcAnnotatedTemplate) {
      var paint: Dynamic = isNaN(lock) ? innerHTML.tid : lock;
      var lastKey: Dynamic = null;
      try {
        lastKey = value_Oo(
          (window as Dynamic).__dcAnnotatedTemplate(innerHTML.name),
          paint,
        );
      } catch {}
      if (lastKey !== null) {
        leftTextCopy = {
          el: innerHTML.el,
          origNodes: innerHTML.origNodes,
          name: innerHTML.name,
          tid: paint,
          content: lastKey,
        };
      }
    }
    return {
      tid: isNaN(lock) ? innerHTML.tid : lock,
      name: innerHTML.name,
      html: ref,
      text: top,
      scriptTarget: innerHTML.scriptTarget || undefined,
      propTarget: innerHTML.propTarget || undefined,
    };
  }
  var items12: Dynamic = [
    ["role", "textbox"],
    ["aria-label", "Edit text"],
    ["aria-multiline", "true"],
  ];
  function editorAccessibilityValue(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments525: Dynamic[]
  ): Dynamic {
    return fillStyle && items12[innerHTML][0] === "aria-multiline"
      ? "false"
      : items12[innerHTML][1];
  }
  function setEditorAccessibility(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments526: Dynamic[]
  ): Dynamic {
    if (
      !(
        fillStyle.hasAttribute("role") ||
        fillStyle.hasAttribute("aria-label") ||
        fillStyle.hasAttribute("aria-labelledby") ||
        fillStyle.hasAttribute("aria-multiline")
      )
    ) {
      for (var position: Dynamic = 0; position < items12.length; position++)
        fillStyle.setAttribute(
          items12[position][0],
          editorAccessibilityValue(innerHTML, position),
        );
      fillStyle.setAttribute(
        "data-dc-editor-named",
        innerHTML ? "one-line" : "",
      );
    }
  }
  function restoreEditorAccessibility(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments527: Dynamic[]
  ): Dynamic {
    if (fillStyle.hasAttribute("data-dc-editor-named")) {
      for (
        var innerHTML: Dynamic =
            fillStyle.getAttribute("data-dc-editor-named") === "one-line",
          position: Dynamic = 0;
        position < items12.length;
        position++
      )
        if (
          fillStyle.getAttribute(items12[position][0]) ===
          editorAccessibilityValue(innerHTML, position)
        ) {
          fillStyle.removeAttribute(items12[position][0]);
        }
      fillStyle.removeAttribute("data-dc-editor-named");
    }
  }
  function restoreDescendantAccessibility(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments528: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = fillStyle.querySelectorAll(
          "[data-dc-editor-named]",
        ),
        position: Dynamic = 0;
      position < innerHTML.length;
      position++
    )
      restoreEditorAccessibility(innerHTML[position]);
  }
  function finishTextEdit(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments529: Dynamic[]
  ): Dynamic {
    if (textEdit) {
      var position: Dynamic = textEdit.lost === true;
      var shaft: Dynamic = detachTextEditor(fillStyle);
      if (shaft && shaft.foreign) {
        emitEditorEvent({
          type: "foreignTextEdit",
          tag: shaft.tag,
          before: shaft.before,
          after: shaft.after,
        });
      } else {
        emitEditorEvent(
          shaft
            ? {
                type: "textEdit",
                tid: shaft.tid,
                name: shaft.name,
                html: shaft.html,
                text: shaft.text,
                scriptTarget: shaft.scriptTarget || undefined,
                propTarget: shaft.propTarget || undefined,
                importTarget: shaft.importTarget || undefined,
                restarted: innerHTML || undefined,
              }
            : {
                type: "textEditEnd",
                lost: position || undefined,
                restarted: innerHTML || undefined,
              },
        );
      }
      return shaft;
    }
  }
  function hasDirectTextContent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments530: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = 0;
      innerHTML < fillStyle.childNodes.length;
      innerHTML++
    ) {
      var position: Dynamic = fillStyle.childNodes[innerHTML];
      if (
        (position.nodeType === 3 && (position.nodeValue || "").trim() !== "") ||
        (position.nodeType === 1 &&
          !position.hasAttribute("data-dc-tpl") &&
          /\bsc-interp\b/.test(position.className || ""))
      )
        return true;
    }
    return false;
  }
  function textNodeAtPointer(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments531: Dynamic[]
  ): Dynamic {
    var position: Dynamic = null;
    if ((document as Dynamic).caretRangeFromPoint) {
      var shaft: Dynamic = (document as Dynamic).caretRangeFromPoint(
        innerHTML.clientX,
        innerHTML.clientY,
      );
      position = shaft ? shaft.startContainer : null;
    } else if ((document as Dynamic).caretPositionFromPoint) {
      var tag: Dynamic = (document as Dynamic).caretPositionFromPoint(
        innerHTML.clientX,
        innerHTML.clientY,
      );
      position = tag ? tag.offsetNode : null;
    }
    return (
      !!position &&
      position.nodeType === 3 &&
      position.parentNode === fillStyle &&
      (position.nodeValue || "").trim() !== ""
    );
  }
  function hasOnlyInterpolatedText(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments532: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = false, position: Dynamic = 0;
      position < fillStyle.childNodes.length;
      position++
    ) {
      var shaft: Dynamic = fillStyle.childNodes[position];
      if (shaft.nodeType === 3 && (shaft.nodeValue || "").trim() !== "")
        return false;
      if (
        shaft.nodeType === 1 &&
        !shaft.hasAttribute("data-dc-tpl") &&
        /\bsc-interp\b/.test(shaft.className || "")
      ) {
        innerHTML = true;
      }
    }
    return innerHTML;
  }
  function isForeignEditableElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments533: Dynamic[]
  ): Dynamic {
    return (
      !!fillStyle &&
      fillStyle.nodeType === 1 &&
      fillStyle !== (document as Dynamic).body &&
      fillStyle !== (document as Dynamic).documentElement &&
      !(innerHTML && fillStyle.contains(innerHTML)) &&
      !!(innerHTML || (document as Dynamic).querySelector("[data-dc-tpl]")) &&
      !fillStyle.closest(
        "[data-dc-tpl],[data-dc-editor-overlay],.sc-placeholder",
      ) &&
      !fillStyle.querySelector("[data-dc-tpl]") &&
      hasDirectTextContent(fillStyle)
    );
  }
  function resolveEditableTextElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments534: Dynamic[]
  ): Dynamic {
    var tag: Dynamic = fillStyle.classList.contains("sc-host-x");
    if (!hasDirectTextContent(fillStyle)) {
      var rot: Dynamic =
        !tag &&
        innerHTML !== fillStyle &&
        innerHTML.closest("[data-dc-tpl]") === fillStyle &&
        hasDirectTextContent(innerHTML) &&
        !innerHTML.closest(".sc-placeholder") &&
        !/\bsc-interp\b/.test(innerHTML.className || "");
      return rot
        ? {
            type: "textEditDenied",
            tid: -1,
            name: null,
            foreign: true,
          }
        : null;
    }
    var ref: Dynamic = findOuterComponentHost();
    if (
      !tag &&
      ref &&
      !ref.contains(fillStyle) &&
      nearestComponentName(fillStyle) == null
    )
      return {
        type: "textEditDenied",
        tid: position,
        name: null,
        portaled: true,
      };
    var top: Dynamic = "";
    try {
      top = getComputedStyle(fillStyle).display || "";
    } catch {
      top = "";
    }
    return {
      type: "textEditDenied",
      tid: position,
      name: nearestComponentName(fillStyle),
      x: shaft.clientX,
      y: shaft.clientY,
      items: /flex|grid/.test(top),
      bound:
        fillStyle.hasAttribute("data-sc-name") &&
        hasOnlyInterpolatedText(fillStyle),
    };
  }
  function onEditorDoubleClick(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments535: Dynamic[]
  ): Dynamic {
    value_un = null;
    if (
      !!enabled &&
      !suppressStalePointerEvent(event) &&
      activeTool !== "interact" &&
      !eventHitsEditorOverlay(event)
    ) {
      if (readOnly) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        !(
          textEdit &&
          (textEdit.el === event.target || textEdit.el.contains(event.target))
        )
      ) {
        if (
          textEdit &&
          value_Vn &&
          event.target.contains &&
          event.target.contains(textEdit.el)
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (eventInsideSvgTextEditor(event)) {
          event.preventDefault();
          event.stopPropagation();
          onSvgTextDoubleClick(event);
          return;
        }
        if (event.type === "dblclick" && (event.detail || 0) > 2) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        var innerHTML: Dynamic = stampedEventTarget(event);
        if (!innerHTML) {
          var position: Dynamic = findOuterComponentHost();
          var shaft: Dynamic = event.target;
          var tag: Dynamic =
            position &&
            shaft &&
            (shaft === position
              ? textNodeAtPointer(position, event)
              : shaft.parentElement === position &&
                /\bsc-interp\b/.test(shaft.className || ""));
          if (tag) {
            event.preventDefault();
            event.stopPropagation();
            emitEditorEvent({
              type: "textEditDenied",
              tid: -1,
              name: position.getAttribute("data-sc-name"),
              rootText: true,
              bound: hasOnlyInterpolatedText(position),
            });
          } else {
            if (isForeignEditableElement(shaft, position)) {
              event.preventDefault();
              event.stopPropagation();
              emitEditorEvent({
                type: "textEditDenied",
                tid: -1,
                name: null,
                foreign: true,
              });
            }
          }
          return;
        }
        var rot: Dynamic = parseInt(innerHTML.getAttribute("data-dc-tpl"), 10);
        var ref: Dynamic =
          activeTool === "select"
            ? lastFreehandAncestor(
                stampedAncestorChain(normalizePickElement(innerHTML)),
              )
            : null;
        if (ref) {
          event.preventDefault();
          event.stopPropagation();
          if (!freehandMode) {
            freehandMode = true;
            refreshChrome();
          }
          if (
            selectedTemplateIds.length !== 1 ||
            selectedTemplateIds[0] !==
              parseInt(ref.getAttribute("data-dc-tpl"), 10) ||
            selectedComponentName !== componentScopeName(ref)
          ) {
            selectElement(ref, false);
          }
          emitEditorEvent({
            type: "penDblClick",
          });
          return;
        }
        var top: Dynamic = normalizeComponentHit(innerHTML);
        var name3: Dynamic = resolveSelectionAncestor(
          normalizePickElement(innerHTML),
          "plain",
          selectedTemplateIds,
          selectedComponentName,
        );
        var bottom: Dynamic = name3
          ? parseInt(name3.getAttribute("data-dc-tpl"), 10)
          : NaN;
        var left: Dynamic =
          name3 != null &&
          selectedComponentName === componentScopeName(name3) &&
          selectedTemplateIds.indexOf(bottom) >= 0;
        if (name3 && !left) {
          event.preventDefault();
          event.stopPropagation();
          clearForeignSelection();
          selectedTemplateIds = [bottom];
          selectedPart = null;
          selectedComponentName = componentScopeName(name3);
          repaintSelection();
          emitSelection(sourceElementTag(name3));
          return;
        }
        var scope: Dynamic = name3
          ? resolveSelectionAncestor(
              normalizePickElement(innerHTML),
              "deeper",
              selectedTemplateIds,
              selectedComponentName,
            )
          : null;
        if (
          name3 &&
          scope &&
          scope !== name3 &&
          !textEditableTemplates[
            templateKey(bottom, nearestComponentName(name3))
          ]
        ) {
          event.preventDefault();
          event.stopPropagation();
          clearForeignSelection();
          selectedTemplateIds = [
            parseInt(scope.getAttribute("data-dc-tpl"), 10),
          ];
          selectedPart = null;
          selectedComponentName = componentScopeName(scope);
          repaintSelection();
          emitSelection(sourceElementTag(scope));
          return;
        }
        if (name3 && name3 !== top && name3 !== innerHTML) {
          innerHTML = name3;
          rot = bottom;
          top = name3;
        }
        if (top !== innerHTML) {
          value_nn = top;
          event.preventDefault();
          event.stopPropagation();
          selectedTemplateIds = [rot];
          selectedPart = null;
          selectedComponentName = componentScopeName(innerHTML);
          repaintSelection();
          emitSelection(innerHTML.tagName.toLowerCase());
          return;
        }
        if (
          !textEditableTemplates[
            templateKey(rot, nearestComponentName(innerHTML))
          ] &&
          innerHTML instanceof SVGElement &&
          !hasDirectTextContent(innerHTML)
        ) {
          var top2: Dynamic = findEditableSvgText(innerHTML, event);
          if (top2) {
            innerHTML = top2;
            rot = parseInt(innerHTML.getAttribute("data-dc-tpl"), 10);
          }
        }
        if (
          !textEditableTemplates[
            templateKey(rot, nearestComponentName(innerHTML))
          ]
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (
            /^(img|video)$/i.test(innerHTML.tagName) &&
            selectedTemplateIds.length === 1 &&
            selectedTemplateIds[0] === rot &&
            isRootComponent(selectedComponentName)
          ) {
            emitEditorEvent({
              type: "cropRequest",
              tid: rot,
            });
            return;
          }
          var adjust: Dynamic =
            event.target !== innerHTML &&
            textNodeAtPointer(event.target, event);
          if (
            innerHTML.classList.contains("sc-host-x") &&
            (adjust || !innerHTML.querySelector("[data-dc-tpl]")) &&
            !isDeckStageWrapper(innerHTML) &&
            !isImageSlotWrapper(innerHTML)
          ) {
            if (beginScriptTargetEdit(innerHTML, rot, event)) return;
            emitEditorEvent({
              type: "textEditDenied",
              tid: rot,
              name: nearestComponentName(innerHTML),
              imported: true,
            });
            return;
          }
          var axis: Dynamic = resolveEditableTextElement(
            innerHTML,
            event.target,
            rot,
            event,
          );
          if (axis) {
            emitEditorEvent(axis);
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        beginTemplateTextEdit(innerHTML, event.clientX, event.clientY);
      }
    }
  }
  var text3: Dynamic =
    'a[href], area[href], button, input, select, textarea, summary, label, video[controls], audio[controls], [role="button"], [onclick], [ondblclick], [contenteditable]:not([contenteditable="false" i]), image-slot';
  function onPreviewClick(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments536: Dynamic[]
  ): Dynamic {
    if (!(!event.isTrusted || enabled || eventMatchesSelector(event, text3))) {
      if (playbackPanZoom) {
        togglePreviewVideo(event);
      }
      emitEditorEvent({
        type: "previewClick",
        shift: !!event.shiftKey,
        meta: !!(event.metaKey || event.ctrlKey),
      });
    }
  }
  function onPreviewDoubleClick(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments537: Dynamic[]
  ): Dynamic {
    if (
      !(
        !event.isTrusted ||
        enabled ||
        readOnly ||
        event.timeStamp < index18 ||
        value_Mr
      ) &&
      !eventMatchesSelector(event, text3)
    ) {
      var innerHTML: Dynamic = stampedEventTarget(event);
      if (innerHTML) {
        pendingDoubleClick = innerHTML;
        var position: Dynamic = ++index4;
        setTimeout(function (
          this: Dynamic,
          ..._extraArguments538: Dynamic[]
        ): Dynamic {
          if (index4 === position) {
            pendingDoubleClick = null;
          }
        }, 2e3);
      }
    }
  }
  function replayPendingDoubleClick(
    this: Dynamic,
    ..._extraArguments539: Dynamic[]
  ): Dynamic {
    if (readOnly) {
      pendingDoubleClick = null;
    }
    if (!(!pendingDoubleClick || !enabled)) {
      var fillStyle: Dynamic = pendingDoubleClick;
      if (
        !fillStyle.isConnected ||
        fillStyle.getAttribute("data-dc-tpl") == null
      ) {
        pendingDoubleClick = null;
        return;
      }
      var innerHTML: Dynamic = normalizeComponentHit(fillStyle);
      var position: Dynamic = parseInt(
        innerHTML.getAttribute("data-dc-tpl"),
        10,
      );
      var shaft: Dynamic = componentScopeName(innerHTML);
      if (
        selectedTemplateIds.length !== 1 ||
        selectedTemplateIds[0] !== position ||
        selectedComponentName !== shaft
      ) {
        clearForeignSelection();
        selectedTemplateIds = [position];
        selectedPart = null;
        selectedComponentName = shaft;
        repaintSelection();
        emitSelection(
          innerHTML.hasAttribute("data-sc-name")
            ? "dc-import"
            : innerHTML.tagName.toLowerCase(),
        );
      }
      if (textMapReady) {
        pendingDoubleClick = null;
        if (
          textEditableTemplates[
            templateKey(position, nearestComponentName(innerHTML))
          ]
        ) {
          beginTemplateTextEdit(innerHTML);
        }
      }
    }
  }
  var insertedTextWatch: Dynamic = null;
  var value_$r: Dynamic = null;
  var heldTextElement: Dynamic = null;
  var index13: Dynamic = 0;
  function cancelInsertedTextWatch(
    this: Dynamic,
    ..._extraArguments540: Dynamic[]
  ): Dynamic {
    if (insertedTextWatch) {
      insertedTextWatch.obs.disconnect();
      clearTimeout(insertedTextWatch.timer);
    }
    insertedTextWatch = null;
  }
  function watchInsertedText(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments541: Dynamic[]
  ): Dynamic {
    cancelInsertedTextWatch();
    var tag: Dynamic =
      value_$r && Date.now() - value_$r.at < 5e3
        ? value_$r
        : {
            n: stampedElementCount(),
            seen: null,
          };
    var rot: Dynamic = (insertedTextWatch = {
      tid: fillStyle,
      name: innerHTML || null,
      typed: typeof position == "string" ? position : "",
      until: typeof shaft == "number" ? shaft : Date.now() + 2e3,
      base: tag.n,
      seen: tag.seen,
      mapped: false,
      obs: new MutationObserver(reconcileInsertedText),
      timer: 0,
    });
    value_$r = null;
    heldTextElement = null;
    rot.obs.observe((document as Dynamic).body, {
      childList: true,
      subtree: true,
    });
    rot.timer = setTimeout(
      reconcileInsertedText,
      Math.max(0, rot.until - Date.now()) + 1,
    );
  }
  function reconcileInsertedText(
    this: Dynamic,
    ..._extraArguments542: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = insertedTextWatch;
    if (fillStyle) {
      if (readOnly || !enabled || textEdit || Date.now() > fillStyle.until) {
        cancelInsertedTextWatch();
        return;
      }
      var innerHTML: Dynamic = stampedElementCount();
      if (innerHTML < fillStyle.base) {
        fillStyle.base = innerHTML;
      }
      if (!(!fillStyle.mapped || innerHTML <= fillStyle.base)) {
        var position: Dynamic = findTemplateInstances(
          String(fillStyle.tid),
          fillStyle.name,
        )[0];
        if (
          !(
            !position ||
            (fillStyle.seen && fillStyle.seen.has(position)) ||
            !textEditableTemplates[
              templateKey(fillStyle.tid, nearestComponentName(position))
            ]
          )
        ) {
          cancelInsertedTextWatch();
          beginTemplateTextEdit(position);
          heldTextElement = textEdit ? textEdit.el : null;
          index13 = 0;
          if (heldTextElement && fillStyle.typed) {
            insertHeldText(fillStyle.typed);
          }
        }
      }
    }
  }
  function textNodeAtOffset(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments543: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = (document as Dynamic).createTreeWalker(
          textEdit.el,
          NodeFilter.SHOW_TEXT,
        ),
        position: Dynamic,
        shaft: Dynamic = null;
      (position = innerHTML.nextNode());

    ) {
      shaft = position;
      if (fillStyle <= position.data.length) return [position, fillStyle];
      fillStyle -= position.data.length;
    }
    return shaft ? [shaft, shaft.data.length] : [textEdit.el, 0];
  }
  function insertHeldText(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments544: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = (document as Dynamic).getSelection();
    var position: Dynamic =
      innerHTML && innerHTML.rangeCount ? innerHTML.getRangeAt(0) : null;
    var shaft: Dynamic = null;
    var tag: Dynamic;
    if (
      position &&
      position.collapsed &&
      textEdit.el.contains(position.startContainer)
    ) {
      tag = textNodeAtOffset(index13);
      if (
        position.startContainer !== tag[0] ||
        position.startOffset !== tag[1]
      ) {
        shaft = position.cloneRange();
      }
      innerHTML.collapse(tag[0], tag[1]);
    }
    var rot: Dynamic =
      fillStyle !== "" ? fillStyle.length : index13 > 0 ? -1 : 0;
    if (fillStyle !== "") {
      (document as Dynamic).execCommand("insertText", false, fillStyle);
    } else {
      if (rot) {
        (document as Dynamic).execCommand("delete", false);
      }
    }
    if (shaft) {
      innerHTML.removeAllRanges();
      innerHTML.addRange(shaft);
    }
    index13 += rot;
  }
  function heldTextKey(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments545: Dynamic[]
  ): Dynamic {
    if (!(typeof fillStyle != "string" || fillStyle.length > 1)) {
      var innerHTML: Dynamic = insertedTextWatch;
      if (innerHTML) {
        innerHTML.typed = fillStyle
          ? innerHTML.typed + fillStyle
          : innerHTML.typed.slice(0, -1);
      } else {
        if (textEdit && textEdit.el === heldTextElement) {
          insertHeldText(fillStyle);
        } else {
          heldTextElement = null;
        }
      }
    }
  }
  function onSlideChange(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments546: Dynamic[]
  ): Dynamic {
    if (
      !(!enabled || (selectedTemplateIds.length === 0 && !foreignSelection)) &&
      !(
        textEdit ||
        dragGesture ||
        marqueeGesture ||
        transformGesture ||
        endpointGesture ||
        penGesture ||
        drawingGesture ||
        penOverlay
      )
    ) {
      var innerHTML: Dynamic = event.detail || {};
      if (
        !(
          innerHTML.reason === "init" ||
          innerHTML.index === innerHTML.previousIndex
        ) &&
        !(!innerHTML.slide || typeof innerHTML.slide.contains != "function")
      ) {
        var position: Dynamic = event.target;
        if (!(!position || !position.contains)) {
          for (
            var shaft: Dynamic =
                foreignSelection && foreignSelection.isConnected
                  ? [foreignSelection]
                  : [],
              tag: Dynamic = 0;
            tag < selectedTemplateIds.length + (shaft.length ? 1 : 0);
            tag++
          )
            for (
              var rot: Dynamic =
                  tag < selectedTemplateIds.length
                    ? templateOrDirectiveInstances(
                        selectedTemplateIds[tag],
                        selectedComponentName,
                      )
                    : shaft,
                ref: Dynamic = 0;
              ref < rot.length;
              ref++
            )
              if (
                rot[ref] === position ||
                !position.contains(rot[ref]) ||
                innerHTML.slide.contains(rot[ref])
              )
                return;
          selectedTemplateIds = [];
          selectedComponentName = null;
          selectedPart = null;
          clearForeignSelection();
          repaintSelection();
          emitSelection("slidechange");
        }
      }
    }
  }
  var text4: Dynamic =
    'input[type="file" i], [ondrop], [ondragover], image-slot';
  function isPreviewFileDrag(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments547: Dynamic[]
  ): Dynamic {
    if (enabled || !fillStyle.isTrusted) return false;
    var innerHTML: Dynamic = fillStyle.dataTransfer;
    return !(
      !innerHTML ||
      !innerHTML.types ||
      (Array as Dynamic).prototype.indexOf.call(innerHTML.types, "Files") ===
        -1 ||
      !(document as Dynamic).querySelector("[data-dc-tpl]")
    );
  }
  function transferContainsMedia(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments548: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle.items;
    if (!innerHTML || innerHTML.length === 0) return null;
    for (
      var position: Dynamic = false, shaft: Dynamic = 0;
      shaft < innerHTML.length;
      shaft++
    )
      if (
        innerHTML[shaft].kind === "file" &&
        ((position = true), isMediaFile(innerHTML[shaft].type))
      )
        return true;
    return position ? false : null;
  }
  var value_so: Dynamic = false;
  var index14: Dynamic = 0;
  function clearPreviewDropHighlight(
    this: Dynamic,
    ..._extraArguments549: Dynamic[]
  ): Dynamic {
    index14++;
    if (value_so) {
      value_so = false;
      hideParentPlacementBounds();
    }
  }
  function expirePreviewDropHighlight(
    this: Dynamic,
    ..._extraArguments550: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = ++index14;
    setTimeout(function (
      this: Dynamic,
      ..._extraArguments551: Dynamic[]
    ): Dynamic {
      if (index14 === fillStyle) {
        value_Ne = false;
        index15 = 0;
        clearPreviewDropHighlight();
      }
    }, 900);
  }
  function showPreviewDropHighlight(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments552: Dynamic[]
  ): Dynamic {
    showParentPlacementBounds(fillStyle, "");
    value_so = true;
    expirePreviewDropHighlight();
  }
  function highlightPreviewDropElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments553: Dynamic[]
  ): Dynamic {
    showPreviewDropHighlight(
      unwrapDisplayContentsHost(fillStyle).getBoundingClientRect(),
    );
  }
  var index15: Dynamic = 0;
  var value_Ne: Dynamic = false;
  function onPreviewDragStart(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments554: Dynamic[]
  ): Dynamic {
    if (event.isTrusted) {
      value_Ne = true;
      setTimeout(function (
        this: Dynamic,
        ..._extraArguments555: Dynamic[]
      ): Dynamic {
        if (event.defaultPrevented) {
          value_Ne = false;
        }
      }, 0);
      expirePreviewDropHighlight();
    }
  }
  function onPreviewDragEnter(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments556: Dynamic[]
  ): Dynamic {
    if (isPreviewFileDrag(event)) {
      index15++;
    }
  }
  function onPreviewDragLeave(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments557: Dynamic[]
  ): Dynamic {
    if (isPreviewFileDrag(event)) {
      index15 = Math.max(0, index15 - 1);
      if (index15 === 0) {
        clearPreviewDropHighlight();
      }
    }
  }
  function onPreviewDragEnd(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments558: Dynamic[]
  ): Dynamic {
    if (event.isTrusted) {
      value_Ne = false;
      index15 = 0;
      clearPreviewDropHighlight();
    }
  }
  function enclosingDeckSlide(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments559: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = fillStyle;
      innerHTML &&
      !(innerHTML.parentElement && isDeckStage(innerHTML.parentElement));

    )
      innerHTML = innerHTML.parentElement;
    return innerHTML;
  }
  function authoredDeckChildren(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments560: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = [],
        position: Dynamic = fillStyle.firstElementChild;
      position;
      position = position.nextElementSibling
    ) {
      var shaft: Dynamic = (position.tagName || "").toUpperCase();
      if (!(shaft === "TEMPLATE" || shaft === "SCRIPT" || shaft === "STYLE")) {
        innerHTML.push(position);
      }
    }
    return innerHTML;
  }
  function deckSlideAddress(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments561: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = enclosingDeckSlide(fillStyle);
    if (!innerHTML) return null;
    var position: Dynamic = innerHTML.parentElement;
    var shaft: Dynamic = (document as Dynamic).querySelectorAll("deck-stage");
    var tag: Dynamic = (Array as Dynamic).prototype.indexOf.call(
      shaft,
      position,
    );
    if (tag === -1) return null;
    var rot: Dynamic = authoredDeckChildren(position);
    var ref: Dynamic = rot.indexOf(innerHTML);
    return ref === -1
      ? null
      : {
          deck: tag,
          index: ref,
          count: rot.length,
          label: innerHTML.getAttribute("data-label"),
        };
  }
  function resolveDeckSlideAddress(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments562: Dynamic[]
  ): Dynamic {
    if (!fillStyle) return null;
    var innerHTML: Dynamic = (document as Dynamic).querySelectorAll(
      "deck-stage",
    );
    var position: Dynamic = innerHTML[fillStyle.deck];
    if (!position) return null;
    var shaft: Dynamic = authoredDeckChildren(position);
    if (fillStyle.label != null) {
      var tag: Dynamic = shaft.filter(function (
        this: Dynamic,
        rot?: Dynamic,
        ..._extraArguments563: Dynamic[]
      ): Dynamic {
        return rot.getAttribute("data-label") === fillStyle.label;
      });
      if (tag.length === 1) return tag[0];
    }
    return shaft[fillStyle.index] || null;
  }
  function activateDeckSlide(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments564: Dynamic[]
  ): Dynamic {
    if (!(!fillStyle || fillStyle.hasAttribute("data-deck-active"))) {
      var innerHTML: Dynamic = fillStyle.parentElement;
      if (!(!innerHTML || typeof innerHTML.goTo != "function")) {
        var position: Dynamic = parseInt(
          fillStyle.getAttribute("data-deck-slide"),
          10,
        );
        var shaft: Dynamic = isNaN(position)
          ? authoredDeckChildren(innerHTML).indexOf(fillStyle)
          : position;
        if (shaft >= 0) {
          innerHTML.goTo(shaft);
        }
      }
    }
  }
  function previewMediaDropAt(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments565: Dynamic[]
  ): Dynamic {
    var position: Dynamic = (document as Dynamic).elementFromPoint(
      fillStyle,
      innerHTML,
    );
    position =
      position && position.closest ? position.closest("[data-dc-tpl]") : null;
    if (position) {
      position = normalizeComponentHit(position);
    }
    if (!position) return null;
    var shaft: Dynamic =
      isDeckStage(position) ||
      isDeckStageWrapper(position) ||
      isCollapsedDeckWrapper(position);
    var tag: Dynamic = position.getBoundingClientRect();
    var rot: Dynamic =
      tag.height > 0 ? (innerHTML - tag.top) / tag.height : 0.5;
    var ref: Dynamic = rot < 0.3 ? "before" : rot > 0.7 ? "after" : "into";
    for (
      ref !== "into" &&
      position.parentElement &&
      isDeckStage(position.parentElement) &&
      (ref = "into");
      position &&
      (isDeckStage(position) ||
        isDeckStageWrapper(position) ||
        isCollapsedDeckWrapper(position) ||
        (ref === "into" && !canContainElements(position)));

    ) {
      shaft =
        shaft ||
        isDeckStage(position) ||
        isDeckStageWrapper(position) ||
        isCollapsedDeckWrapper(position);
      ref = "into";
      position =
        position.parentElement && position.parentElement.closest
          ? position.parentElement.closest("[data-dc-tpl]")
          : null;
    }
    return position
      ? {
          el: position,
          position: ref,
        }
      : shaft
        ? {
            refuse: true,
          }
        : null;
  }
  function resolvePreviewMediaDrop(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments566: Dynamic[]
  ): Dynamic {
    var position: Dynamic = (document as Dynamic).elementFromPoint(
      fillStyle,
      innerHTML,
    );
    position =
      position && position.closest ? position.closest("[data-dc-tpl]") : null;
    var shaft: Dynamic = previewMediaDropAt(fillStyle, innerHTML);
    if (!shaft || shaft.refuse) return shaft;
    var tag: Dynamic = value_sd(shaft.el, shaft.position, fillStyle, innerHTML);
    var rot: Dynamic = enclosingDeckSlide(position);
    var ref: Dynamic = false;
    if (rot && rot.getAttribute("data-dc-tpl") != null) {
      ref = tag.slotless === true || value_dd(position, rot);
    }
    if (ref) {
      var top: Dynamic = rot.getBoundingClientRect();
      var name3: Dynamic = elementViewportScale(rot) || 1;
      return {
        el: rot,
        position: "into",
        point: {
          x: (fillStyle - top.left) / name3,
          y: (innerHTML - top.top) / name3,
          needsPositioning: getComputedStyle(rot).position === "static",
        },
      };
    }
    return {
      el: tag.el,
      position: tag.position,
      point: null,
    };
  }
  function activeDeckSlides(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments567: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = [],
        shaft: Dynamic = (document as Dynamic).querySelectorAll("deck-stage"),
        tag: Dynamic = 0;
      tag < shaft.length;
      tag++
    )
      for (
        var rot: Dynamic = shaft[tag].firstElementChild;
        rot;
        rot = rot.nextElementSibling
      )
        if (!(!rot.hasAttribute || !rot.hasAttribute("data-deck-active"))) {
          if (rot.getAttribute("data-dc-tpl") != null) {
            position.push(rot.getBoundingClientRect());
          }
        }
    return value_fd(fillStyle, innerHTML, position);
  }
  function deckRailHitAt(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments568: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = (document as Dynamic).querySelectorAll(
          "deck-stage",
        ),
        shaft: Dynamic = 0;
      shaft < position.length;
      shaft++
    ) {
      var tag: Dynamic = position[shaft].shadowRoot;
      var rot: Dynamic = tag ? tag.querySelector(".rail") : null;
      if (!(!rot || rot.inert)) {
        var ref: Dynamic = rot.getBoundingClientRect();
        if (
          !(
            fillStyle < ref.left ||
            fillStyle > ref.right ||
            innerHTML < ref.top ||
            innerHTML > ref.bottom
          )
        ) {
          for (
            var top: Dynamic = authoredDeckChildren(position[shaft]),
              name3: Dynamic = 0;
            name3 < rot.children.length;
            name3++
          ) {
            var bottom: Dynamic = rot.children[name3].getBoundingClientRect();
            if (
              !(
                fillStyle < bottom.left ||
                fillStyle > bottom.right ||
                innerHTML < bottom.top ||
                innerHTML > bottom.bottom
              )
            ) {
              var left: Dynamic = top[name3];
              if (!left || left.getAttribute("data-dc-tpl") == null)
                return null;
              var scope: Dynamic = rot.children[name3].querySelector(".frame");
              return {
                slide: left,
                frameRect: (
                  scope || rot.children[name3]
                ).getBoundingClientRect(),
              };
            }
          }
          return null;
        }
      }
    }
    return null;
  }
  function withVisibleDeckSlide(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments569: Dynamic[]
  ): Dynamic {
    var tag: Dynamic = fillStyle.getAttribute("style");
    fillStyle.style.visibility = "visible";
    fillStyle.style.pointerEvents = "auto";
    fillStyle.style.zIndex = "2147483647";
    var rot: Dynamic;
    try {
      rot = innerHTML(position, shaft);
    } finally {
      if (tag == null) {
        fillStyle.removeAttribute("style");
      } else {
        fillStyle.setAttribute("style", tag);
      }
    }
    if (rot && !rot.refuse && enclosingDeckSlide(rot.el) === fillStyle)
      return rot;
    var ref: Dynamic = fillStyle.getBoundingClientRect();
    var top: Dynamic = elementViewportScale(fillStyle) || 1;
    return {
      el: fillStyle,
      position: "into",
      point: {
        x: (position - ref.left) / top,
        y: (shaft - ref.top) / top,
        needsPositioning: getComputedStyle(fillStyle).position === "static",
      },
    };
  }
  function resolveDeckAwareDrop(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments570: Dynamic[]
  ): Dynamic {
    var shaft: Dynamic = fillStyle(innerHTML, position);
    if (shaft && !shaft.refuse && enclosingDeckSlide(shaft.el)) return shaft;
    var tag: Dynamic = deckRailHitAt(innerHTML, position);
    if (tag) {
      var rot: Dynamic = value_Fo(
        innerHTML,
        position,
        tag.frameRect,
        tag.slide.getBoundingClientRect(),
      );
      var ref: Dynamic = rot
        ? withVisibleDeckSlide(tag.slide, fillStyle, rot.x, rot.y)
        : null;
      return ref && !ref.refuse && enclosingDeckSlide(ref.el) ? ref : shaft;
    }
    var top: Dynamic = activeDeckSlides(innerHTML, position);
    if (top) {
      var name3: Dynamic = fillStyle(top.x, top.y);
      if (name3 && !name3.refuse && enclosingDeckSlide(name3.el)) return name3;
    }
    return shaft;
  }
  function deckAwareMediaDropAt(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments571: Dynamic[]
  ): Dynamic {
    return resolveDeckAwareDrop(resolvePreviewMediaDrop, fillStyle, innerHTML);
  }
  function onPreviewDragOver(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments572: Dynamic[]
  ): Dynamic {
    if (isPreviewFileDrag(event)) {
      if (eventMatchesSelector(event, text4)) {
        clearPreviewDropHighlight();
        return;
      }
      event.preventDefault();
      if (value_Ne) {
        clearPreviewDropHighlight();
        expirePreviewDropHighlight();
        return;
      }
      var innerHTML: Dynamic = deckRailHitAt(event.clientX, event.clientY);
      if (eventHitsEditorOverlay(event) && !innerHTML) {
        event.dataTransfer.dropEffect = "none";
        clearPreviewDropHighlight();
        return;
      }
      event.dataTransfer.dropEffect = "copy";
      var position: Dynamic = transferContainsMedia(event.dataTransfer);
      if (position !== true) {
        clearPreviewDropHighlight();
        return;
      }
      if (innerHTML) {
        if (
          value_Fo(
            event.clientX,
            event.clientY,
            innerHTML.frameRect,
            innerHTML.slide.getBoundingClientRect(),
          )
        ) {
          showPreviewDropHighlight(innerHTML.frameRect);
        } else {
          clearPreviewDropHighlight();
        }
        return;
      }
      var shaft: Dynamic = resolveDeckAwareDrop(
        previewMediaDropAt,
        event.clientX,
        event.clientY,
      );
      if (shaft && !shaft.refuse) {
        highlightPreviewDropElement(shaft.el);
      } else {
        clearPreviewDropHighlight();
      }
    }
  }
  function onPreviewDrop(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments573: Dynamic[]
  ): Dynamic {
    if (isPreviewFileDrag(event)) {
      var innerHTML: Dynamic = value_Ne;
      value_Ne = false;
      index15 = 0;
      clearPreviewDropHighlight();
      if (!eventMatchesSelector(event, text4)) {
        var position: Dynamic = event.dataTransfer;
        if (
          !(!position.files || position.files.length === 0) &&
          (event.preventDefault(),
          !innerHTML &&
            !(
              eventHitsEditorOverlay(event) &&
              !deckRailHitAt(event.clientX, event.clientY)
            ))
        ) {
          for (
            var shaft: Dynamic = [], tag: Dynamic = 0;
            tag < position.files.length;
            tag++
          )
            if (
              isMediaFile(position.files[tag].type, position.files[tag].name)
            ) {
              shaft.push(position.files[tag]);
            }
          if (shaft.length !== 0) {
            var rot: Dynamic = deckAwareMediaDropAt(
              event.clientX,
              event.clientY,
            );
            if (!(rot && rot.refuse)) {
              pendingTextTarget = {
                files: shaft,
                el: rot ? rot.el : null,
                position: rot ? rot.position : "root-end",
                point: rot ? rot.point : null,
                at: pointerViewportSnapshot(event),
                slide: rot ? deckSlideAddress(rot.el) : null,
              };
              var ref: Dynamic = ++index5;
              setTimeout(function (
                this: Dynamic,
                ..._extraArguments574: Dynamic[]
              ): Dynamic {
                if (index5 === ref) {
                  pendingTextTarget = null;
                }
              }, 8e3);
              for (
                var top: Dynamic = true, name3: Dynamic = 0;
                name3 < shaft.length;
                name3++
              )
                if ((shaft[name3].type || "").indexOf("image/") === 0) {
                  top = false;
                }
              emitEditorEvent({
                type: "__dc_preview_drop_notice",
                video: top,
              });
            }
          }
        }
      }
    }
  }
  function replayPendingTextTarget(
    this: Dynamic,
    ..._extraArguments575: Dynamic[]
  ): Dynamic {
    if (!(!pendingTextTarget || !enabled)) {
      if (!textMapReady) {
        index5++;
        return;
      }
      var fillStyle: Dynamic = pendingTextTarget;
      pendingTextTarget = null;
      var innerHTML: Dynamic = fillStyle.el;
      var position: Dynamic = fillStyle.position;
      if (
        innerHTML &&
        (!innerHTML.isConnected ||
          innerHTML.getAttribute("data-dc-tpl") == null)
      ) {
        innerHTML = null;
      }
      if (innerHTML && !fillStyle.point) {
        innerHTML = normalizeComponentHit(innerHTML);
      }
      if (!innerHTML && fillStyle.slide) {
        var shaft: Dynamic = resolveDeckSlideAddress(fillStyle.slide);
        if (shaft && shaft.getAttribute("data-dc-tpl") != null) {
          innerHTML = shaft;
          position = "into";
        }
      }
      emitEditorEvent({
        type: "fileDrop",
        files: fillStyle.files,
        name: innerHTML ? componentScopeName(innerHTML) : null,
        targetTid: innerHTML
          ? parseInt(innerHTML.getAttribute("data-dc-tpl"), 10)
          : null,
        position: innerHTML ? position : "root-end",
        slide: fillStyle.slide || null,
        point: (innerHTML && fillStyle.point) || null,
        at: fillStyle.at,
      });
      activateDeckSlide(innerHTML ? enclosingDeckSlide(innerHTML) : null);
    }
  }
  function onEditorKeyUp(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments576: Dynamic[]
  ): Dynamic {
    if (event.key === "Alt") {
      setMeasurementEnabled(false);
    }
    if (event.key === (isMacPlatform ? "Meta" : "Control")) {
      setDeepPickingEnabled(false);
      if (enabled) {
        emitEditorEvent({
          type: "modifierKey",
          key: "deep",
          on: false,
        });
      }
    }
    if (event.key === "Control" || event.key === "Alt") {
      updateDragModifiers(event.altKey, event.ctrlKey, event.metaKey);
    }
  }
  function syntheticDragEvent(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments577: Dynamic[]
  ): Dynamic {
    return {
      type: "mousemove",
      clientX: Number(fillStyle) || 0,
      clientY: Number(innerHTML) || 0,
      buttons: 1,
      button: 0,
      altKey: !!(position && position.alt),
      ctrlKey: !!(position && position.ctrl),
      metaKey: !!(position && position.meta),
      shiftKey: !!(position && position.shift),
      target: null,
      isTrusted: false,
      pointerType: "mouse",
      preventDefault: function (
        this: Dynamic,
        ..._extraArguments578: Dynamic[]
      ): Dynamic {},
      stopPropagation: function (
        this: Dynamic,
        ..._extraArguments579: Dynamic[]
      ): Dynamic {},
      stopImmediatePropagation: function (
        this: Dynamic,
        ..._extraArguments580: Dynamic[]
      ): Dynamic {},
    };
  }
  function refreshHostDragWatchdog(
    this: Dynamic,
    ..._extraArguments581: Dynamic[]
  ): Dynamic {
    if (hostDrag) {
      if (hostDrag.watchdog) {
        clearTimeout(hostDrag.watchdog);
      }
      hostDrag.watchdog = setTimeout(function (
        this: Dynamic,
        ..._extraArguments582: Dynamic[]
      ): Dynamic {
        finishHostDrag(false);
      }, 6e4);
    }
  }
  function cancelHostDragFromPointer(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments583: Dynamic[]
  ): Dynamic {
    if (hostDrag && fillStyle.isTrusted) {
      finishHostDrag(false);
    }
  }
  var items13: Dynamic = [
    "animationstart",
    "animationiteration",
    "animationend",
    "animationcancel",
  ];
  function suppressHostDragEvent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments584: Dynamic[]
  ): Dynamic {
    if (hostDrag) {
      fillStyle.stopImmediatePropagation();
    }
  }
  function beginHostDrag(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments585: Dynamic[]
  ): Dynamic {
    hostDrag = {
      key: fillStyle,
      plan: null,
      watchdog: null,
      placeholder: null,
    };
    (document as Dynamic).body.setAttribute("data-dc-editor-move", "");
    (window as Dynamic).addEventListener(
      "mousedown",
      cancelHostDragFromPointer,
      true,
    );
    (window as Dynamic).addEventListener(
      "pointerdown",
      cancelHostDragFromPointer,
      true,
    );
    for (var innerHTML: Dynamic = 0; innerHTML < items13.length; innerHTML++)
      (window as Dynamic).addEventListener(
        items13[innerHTML],
        suppressHostDragEvent,
        true,
      );
  }
  function finishHostDrag(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments586: Dynamic[]
  ): Dynamic {
    if (!hostDrag) return null;
    var innerHTML: Dynamic = hostDrag;
    if (innerHTML.watchdog) {
      clearTimeout(innerHTML.watchdog);
    }
    removeDropPlaceholder();
    try {
      if (dragGesture && dragGesture.hostKey === innerHTML.key) {
        finishDragGesture(fillStyle);
      } else {
        clearFlowOverlay();
        hideParentPlacementBounds();
      }
      if (!fillStyle || !innerHTML.plan) {
        clearStylePatches();
        refreshChrome();
      }
    } finally {
      hostDrag = null;
      (document as Dynamic).body.removeAttribute("data-dc-editor-move");
      (window as Dynamic).removeEventListener(
        "mousedown",
        cancelHostDragFromPointer,
        true,
      );
      (window as Dynamic).removeEventListener(
        "pointerdown",
        cancelHostDragFromPointer,
        true,
      );
      for (var position: Dynamic = 0; position < items13.length; position++)
        (window as Dynamic).removeEventListener(
          items13[position],
          suppressHostDragEvent,
          true,
        );
      pendingDrag = null;
    }
    return innerHTML.plan || null;
  }
  function parkHostDrag(
    this: Dynamic,
    ..._extraArguments587: Dynamic[]
  ): Dynamic {
    if (!(!dragGesture || !dragGesture.hostKey || dragGesture.hostParked)) {
      dragGesture.hostParked = true;
      pendingStyleEvents = {};
      cancelMovePreview(dragGesture);
      clearFlowOverlay();
      hideParentPlacementBounds();
      hideDragProxy(dragGesture);
      if (dragGesture.altClone) {
        dragGesture.altClone.style.display = "none";
      }
      clearStylePatches();
      refreshChrome();
    }
  }
  function unparkHostDrag(
    this: Dynamic,
    ..._extraArguments588: Dynamic[]
  ): Dynamic {
    if (!(!dragGesture || !dragGesture.hostKey || !dragGesture.hostParked)) {
      dragGesture.hostParked = false;
      if (dragGesture.altClone) {
        dragGesture.altClone.style.display = "";
      }
    }
  }
  function updateDragModifiers(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments589: Dynamic[]
  ): Dynamic {
    if (
      !(
        !dragGesture ||
        dragGesture.exited ||
        dragGesture.hostParked ||
        !dragGesture.lastPt
      )
    ) {
      var shaft: Dynamic = dragGesture.lastPt;
      onEditorMouseMove({
        clientX: shaft.x,
        clientY: shaft.y,
        buttons: 1,
        altKey: !!fillStyle,
        ctrlKey: !!innerHTML,
        metaKey: !!position,
        shiftKey: shaft.shift,
        target: null,
      });
    }
  }
  function onEditorBlur(
    this: Dynamic,
    ..._extraArguments590: Dynamic[]
  ): Dynamic {
    value_je = false;
    setMeasurementEnabled(false);
    setDeepPickingEnabled(false);
    if (enabled) {
      emitEditorEvent({
        type: "modifierKey",
        key: "deep",
        on: false,
        blur: true,
      });
    }
    value_Le = null;
    if (textEdit && Date.now() - index16 > 500) {
      emitEditorEvent({
        type: "textEditBlur",
      });
    }
  }
  function onEditorKeyDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments591: Dynamic[]
  ): Dynamic {
    if (enabled) {
      if (event.key === "Alt") {
        setMeasurementEnabled(true);
      }
      if (event.key === (isMacPlatform ? "Meta" : "Control")) {
        setDeepPickingEnabled(true);
        if (!event.repeat) {
          emitEditorEvent({
            type: "modifierKey",
            key: "deep",
            on: true,
          });
        }
      }
      if ((event.key === "Control" || event.key === "Alt") && !event.repeat) {
        updateDragModifiers(event.altKey, event.ctrlKey, event.metaKey);
      }
      if (textEdit && textEdit.importTarget && !textEdit.el.isConnected) {
        finishDetachedTextEdit(textEdit);
      }
      if (value_je) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Enter") {
          value_je = false;
        }
        return;
      }
      if (activeTool !== "interact") {
        if (
          !readOnly &&
          (event.key === "d" || event.key === "D") &&
          !event.shiftKey &&
          !event.altKey &&
          (isMacPlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey)
        ) {
          event.preventDefault();
        }
        if (event.key === "Escape" && dragGesture) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick = true;
          finishDragGesture(false);
          return;
        }
        if (event.key === "Escape" && marqueeGesture) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick = true;
          finishMarquee(true);
          return;
        }
        if (
          event.key === "Escape" &&
          (drawingGesture || transformGesture || endpointGesture || penGesture)
        ) {
          event.preventDefault();
          event.stopPropagation();
          finishShapeDrawing(false);
          finishTransformGesture(false);
          finishEndpointGesture(false);
          finishPenStroke(false);
          return;
        }
        if (event.key === "Escape" && penOverlay) {
          event.preventDefault();
          event.stopPropagation();
          finishPenDrawing(true, true);
          return;
        }
        if (
          event.key === "Escape" &&
          selectedPart === "text" &&
          !textEdit &&
          selectedTemplateIds.length === 1
        ) {
          event.preventDefault();
          event.stopPropagation();
          selectedPart = null;
          repaintSelection();
          var innerHTML: Dynamic = findTemplateInstances(
            selectedTemplateIds[0],
            selectedComponentName,
          );
          emitSelection(
            innerHTML.length ? sourceElementTag(innerHTML[0]) : undefined,
            undefined,
            true,
          );
          return;
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.shiftKey &&
          (event.key === "\\" || event.code === "Backslash")
        ) {
          event.preventDefault();
          event.stopPropagation();
          var position: Dynamic =
            (typeof event.composedPath == "function" &&
              event.composedPath()[0]) ||
            event.target;
          var shaft: Dynamic =
            !!textEdit ||
            !!(
              position &&
              (position.tagName === "INPUT" ||
                position.tagName === "TEXTAREA" ||
                position.tagName === "SELECT" ||
                position.isContentEditable)
            );
          if (!event.repeat) {
            emitEditorEvent({
              type: "clipboardKey",
              key: "\\",
              typing: shaft,
            });
          }
          return;
        }
        if (event.key === "F6" && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            emitEditorEvent({
              type: "clipboardKey",
              key: "F6",
              shift: event.shiftKey,
            });
          }
          return;
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          (event.key === "0" ||
            event.key === "=" ||
            event.key === "+" ||
            event.key === "-") &&
          !textEdit
        ) {
          var tag: Dynamic = event.target;
          if (
            tag &&
            (tag.tagName === "INPUT" ||
              tag.tagName === "TEXTAREA" ||
              tag.tagName === "SELECT" ||
              tag.isContentEditable)
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          emitEditorEvent({
            type: "clipboardKey",
            key: event.key === "0" ? "0" : event.key === "-" ? "-" : "+",
          });
          return;
        }
        if (
          (event.key === "c" || event.key === "C") &&
          value_ud &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.shiftKey &&
          !event.isComposing &&
          !event.defaultPrevented &&
          !textEdit &&
          !dragGesture &&
          !marqueeGesture &&
          !pendingMarquee &&
          !drawingGesture &&
          !transformGesture &&
          !endpointGesture &&
          !penGesture &&
          !penOverlay
        ) {
          var rot: Dynamic = event.target;
          if (
            rot &&
            (rot.tagName === "INPUT" ||
              rot.tagName === "TEXTAREA" ||
              rot.tagName === "SELECT" ||
              rot.isContentEditable)
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            emitEditorEvent({
              type: "clipboardKey",
              key: "comment",
            });
          }
          return;
        }
        if (
          (event.key === "ContextMenu" ||
            (event.key === "F10" && event.shiftKey)) &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !textEdit &&
          !dragGesture &&
          !marqueeGesture &&
          !pendingMarquee &&
          !drawingGesture &&
          !transformGesture &&
          !endpointGesture &&
          !penGesture &&
          !penOverlay &&
          !value_wt
        ) {
          var ref: Dynamic = event.target;
          if (
            (ref &&
              (ref.tagName === "INPUT" ||
                ref.tagName === "TEXTAREA" ||
                ref.tagName === "SELECT" ||
                ref.isContentEditable)) ||
            selectedTemplateIds.length === 0
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            contextMenuForSelection();
          }
          return;
        }
        if (readOnly) {
          var top: Dynamic = event.target;
          var name3: Dynamic =
            top &&
            (top.tagName === "INPUT" ||
              top.tagName === "TEXTAREA" ||
              top.tagName === "SELECT" ||
              top.isContentEditable);
          if (
            (event.metaKey || event.ctrlKey) &&
            !event.altKey &&
            !event.shiftKey &&
            (event.key || "").toLowerCase() === "c" &&
            selectedTemplateIds.length > 0 &&
            !name3
          ) {
            event.stopPropagation();
            if (event.repeat) return;
            index9 = Date.now();
            createClipboardSink();
            emitEditorEvent({
              type: "clipboardKey",
              key: "c",
            });
          }
          return;
        }
        if (
          (event.key || "").toLowerCase() === "a" &&
          event.shiftKey &&
          !event.altKey &&
          !textEdit &&
          !dragGesture &&
          !marqueeGesture &&
          !pendingMarquee &&
          !drawingGesture &&
          !transformGesture &&
          !endpointGesture &&
          !penGesture &&
          !penOverlay
        ) {
          var bottom: Dynamic = event.target;
          if (
            (bottom &&
              (bottom.tagName === "INPUT" ||
                bottom.tagName === "TEXTAREA" ||
                bottom.tagName === "SELECT" ||
                bottom.isContentEditable)) ||
            selectedTemplateIds.length === 0
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          emitEditorEvent({
            type: "clipboardKey",
            key: "a",
            shift: true,
          });
          return;
        }
        var left: Dynamic = (event.key || "").toLowerCase();
        if (
          (left === "h" || left === "v") &&
          event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !textEdit &&
          !dragGesture &&
          !marqueeGesture &&
          !pendingMarquee &&
          !drawingGesture &&
          !transformGesture &&
          !endpointGesture &&
          !penGesture &&
          !penOverlay &&
          !value_wt
        ) {
          var scope: Dynamic = event.target;
          if (
            (scope &&
              (scope.tagName === "INPUT" ||
                scope.tagName === "TEXTAREA" ||
                scope.tagName === "SELECT" ||
                scope.isContentEditable)) ||
            selectedTemplateIds.length === 0
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            emitEditorEvent({
              type: "clipboardKey",
              key: left === "h" ? "flip-horizontal" : "flip-vertical",
            });
          }
          return;
        }
        if (
          (event.key || "").toLowerCase() === "g" &&
          event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !textEdit
        ) {
          var top2: Dynamic = event.target;
          if (
            top2 &&
            (top2.tagName === "INPUT" ||
              top2.tagName === "TEXTAREA" ||
              top2.tagName === "SELECT" ||
              top2.isContentEditable)
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) {
            emitEditorEvent({
              type: "clipboardKey",
              key: "guides",
            });
          }
          return;
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          !event.metaKey &&
          !event.ctrlKey &&
          !textEdit &&
          selectedTemplateIds.length > 0 &&
          !dragGesture &&
          !marqueeGesture &&
          !pendingMarquee &&
          !drawingGesture &&
          !transformGesture &&
          !endpointGesture &&
          !penGesture &&
          !penOverlay
        ) {
          var adjust: Dynamic = event.target;
          if (
            adjust &&
            (adjust.tagName === "INPUT" ||
              adjust.tagName === "TEXTAREA" ||
              adjust.tagName === "SELECT" ||
              adjust.isContentEditable)
          )
            return;
          for (
            var axis: Dynamic = false, y2: Dynamic = 0;
            y2 < selectedTemplateIds.length && !axis;
            y2++
          )
            axis = !!firstRenderedInstance(
              templateOrDirectiveInstances(
                selectedTemplateIds[y2],
                selectedComponentName,
              ),
            );
          if (!axis) return;
          event.preventDefault();
          event.stopPropagation();
          emitEditorEvent({
            type: "deleteSelection",
          });
          return;
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !textEdit &&
          !dragGesture &&
          !marqueeGesture &&
          !pendingMarquee &&
          !drawingGesture &&
          !transformGesture &&
          !endpointGesture &&
          !penGesture &&
          (!penOverlay || (event.key || "").toLowerCase() === "z")
        ) {
          var pose: Dynamic = (event.key || "").toLowerCase();
          var lock: Dynamic = event.target;
          if (
            (pose === "z" || pose === "g") &&
            lock &&
            (lock.tagName === "INPUT" ||
              lock.tagName === "TEXTAREA" ||
              lock.tagName === "SELECT" ||
              lock.isContentEditable)
          )
            return;
          if (pose === "z") {
            event.preventDefault();
            event.stopPropagation();
            emitEditorEvent({
              type: "clipboardKey",
              key: "z",
              shift: !!event.shiftKey,
            });
            return;
          }
          if (pose === "g") {
            if (selectedTemplateIds.length === 0) return;
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) {
              emitEditorEvent({
                type: "clipboardKey",
                key: "g",
                shift: !!event.shiftKey,
              });
            }
            return;
          }
          if (event.shiftKey) {
            if (
              pose === "v" &&
              !(
                lock &&
                (lock.tagName === "INPUT" ||
                  lock.tagName === "TEXTAREA" ||
                  lock.tagName === "SELECT" ||
                  lock.isContentEditable)
              )
            ) {
              event.preventDefault();
            }
            return;
          }
          if (pose === "a") {
            if (
              (lock &&
                (lock.tagName === "INPUT" ||
                  lock.tagName === "TEXTAREA" ||
                  lock.tagName === "SELECT" ||
                  lock.isContentEditable)) ||
              selectedTemplateIds.length === 0
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            emitEditorEvent({
              type: "clipboardKey",
              key: "a",
            });
            return;
          }
          if (pose === "c" || pose === "x" || pose === "v" || pose === "d") {
            var paint: Dynamic = event.target;
            if (
              paint &&
              (paint.tagName === "INPUT" ||
                paint.tagName === "TEXTAREA" ||
                paint.tagName === "SELECT" ||
                paint.isContentEditable)
            )
              return;
            if (pose !== "v" && selectedTemplateIds.length === 0) {
              if (pose === "d" && !readOnly) {
                event.preventDefault();
              }
              return;
            }
            event.stopPropagation();
            if (pose === "v") {
              clearTimeout(value_Pa);
              value_Pa = setTimeout(function (
                this: Dynamic,
                ..._extraArguments592: Dynamic[]
              ): Dynamic {
                emitEditorEvent({
                  type: "clipboardKey",
                  key: "v",
                });
              }, 100);
              return;
            }
            if (pose === "d") event.preventDefault();
            else {
              if (event.repeat) return;
              index9 = Date.now();
              createClipboardSink();
            }
            emitEditorEvent({
              type: "clipboardKey",
              key: pose,
            });
            return;
          }
        }
        if (!(!textEdit || finishDetachedSvgEdit())) {
          if (
            event.key === " " &&
            !event.isComposing &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            textEdit.el.contains(event.target) &&
            textEdit.el.closest("button, summary")
          ) {
            event.preventDefault();
            event.stopPropagation();
            (document as Dynamic).execCommand("insertText", false, " ");
            return;
          }
          if (
            (document as Dynamic).activeElement !== textEdit.el &&
            !textEdit.el.contains((document as Dynamic).activeElement)
          ) {
            textEdit.el.focus();
          }
          if (
            (textEdit.svg || textEdit.importTarget) &&
            event.key === "Enter"
          ) {
            if (event.isComposing || event.keyCode === 229) return;
            event.preventDefault();
            event.stopPropagation();
            finishTextEdit();
            return;
          }
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing &&
            !event.ctrlKey &&
            !event.metaKey
          ) {
            var lastKey: Dynamic = getSelection && getSelection();
            var lim: Dynamic = lastKey && lastKey.anchorNode;
            var text8: Dynamic =
              lim && lim.nodeType
                ? lim.nodeType === 1
                  ? lim
                  : lim.parentElement
                : null;
            text8 = text8 && text8.closest ? text8.closest("li") : null;
            if (
              !(text8 && text8 !== textEdit.el && textEdit.el.contains(text8))
            ) {
              event.preventDefault();
              event.stopPropagation();
              if (!(document as Dynamic).execCommand("insertLineBreak")) {
                (document as Dynamic).execCommand("insertHTML", false, "<br>");
              }
              return;
            }
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            finishTextEdit();
          }
          if (
            event.key === "Tab" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault();
            event.stopPropagation();
            finishTextEdit();
          }
        }
      }
    }
  }
  var index16: Dynamic = 0;
  var index17: Dynamic = 0;
  function contextMenuForSelection(
    this: Dynamic,
    ..._extraArguments593: Dynamic[]
  ): Dynamic {
    var fillStyle: Dynamic = selectedTemplateIds.length
      ? findTemplateInstances(selectedTemplateIds[0], selectedComponentName)
      : [];
    if (fillStyle.length) {
      index17 = Date.now();
      var innerHTML: Dynamic = fillStyle[0].getBoundingClientRect();
      emitEditorEvent({
        type: "contextMenu",
        key: true,
        x: innerHTML.left + Math.min(40, innerHTML.width / 2),
        y: innerHTML.top + Math.min(24, innerHTML.height / 2),
      });
    }
  }
  var value_Le: Dynamic = null;
  function onEditorContextMenu(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments594: Dynamic[]
  ): Dynamic {
    if (Date.now() - index8 < 500 || Date.now() - index17 < 500) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!(!enabled || activeTool === "interact")) {
      if (textEdit) {
        index16 = Date.now();
        return;
      }
      if (!eventHitsEditorOverlay(event)) {
        event.preventDefault();
        event.stopPropagation();
        if (panPointerGesture && panPointerGesture.mask === 2) {
          panPointerGesture.menu = {
            x: event.clientX,
            y: event.clientY,
            el: stampedEventTarget(event),
          };
          return;
        }
        var innerHTML: Dynamic =
          isMacPlatform && event.ctrlKey && event.button !== 2;
        var position: Dynamic = innerHTML && value_lt ? value_lt.was : null;
        if (
          position &&
          (position.x !== event.clientX || position.y !== event.clientY)
        ) {
          position = null;
        }
        if (
          innerHTML &&
          pendingDrag &&
          pendingDrag.x === event.clientX &&
          pendingDrag.y === event.clientY
        ) {
          value_Le = {
            x: event.clientX,
            y: event.clientY,
            el: stampedEventTarget(event),
            was: position,
          };
          return;
        }
        contextMenuAtElement(
          event.clientX,
          event.clientY,
          stampedEventTarget(event),
          position,
        );
      }
    }
  }
  function nestedImportAncestor(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments595: Dynamic[]
  ): Dynamic {
    for (
      var position: Dynamic = stampedAncestorChain(fillStyle),
        shaft: Dynamic = position.length - 1;
      shaft >= 0 && position[shaft] !== innerHTML;
      shaft--
    )
      if (isNestedComponentImport(position[shaft])) return position[shaft];
    return innerHTML;
  }
  function elementIsSelected(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    ..._extraArguments596: Dynamic[]
  ): Dynamic {
    return (
      position === componentScopeName(fillStyle) &&
      innerHTML.indexOf(parseInt(fillStyle.getAttribute("data-dc-tpl"), 10)) !==
        -1
    );
  }
  function contextMenuAtElement(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    position?: Dynamic,
    shaft?: Dynamic,
    ..._extraArguments597: Dynamic[]
  ): Dynamic {
    if (dragGesture) {
      finishDragGesture(false);
    }
    finishShapeDrawing(false);
    finishTransformGesture(false);
    finishEndpointGesture(false);
    finishPenStroke(false);
    pendingDrag = null;
    value_St = null;
    pendingMarquee = null;
    value_lt = null;
    finishMarquee(true);
    if (position) {
      var tag: Dynamic = normalizePickElement(position);
      var rot: Dynamic = shaft || {
        tids: selectedTemplateIds,
        name: selectedComponentName,
      };
      position =
        resolveSelectionAncestor(tag, "plain", rot.tids, rot.name) || tag;
      if (!elementIsSelected(position, rot.tids, rot.name)) {
        position = nestedImportAncestor(tag, position);
      }
      if (
        !elementIsSelected(position, selectedTemplateIds, selectedComponentName)
      ) {
        clearForeignSelection();
        selectedTemplateIds = [
          parseInt(position.getAttribute("data-dc-tpl"), 10),
        ];
        selectedPart = null;
        selectedComponentName = componentScopeName(position);
        repaintSelection();
        emitSelection(
          position.hasAttribute("data-sc-name")
            ? "dc-import"
            : position.tagName.toLowerCase(),
        );
      }
    }
    emitEditorEvent({
      type: "contextMenu",
      x: fillStyle,
      y: innerHTML,
    });
  }
  function eventInsideTextEditor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments598: Dynamic[]
  ): Dynamic {
    if (!textEdit) return false;
    var innerHTML: Dynamic = fillStyle.target;
    return (
      textEdit.el.contains(innerHTML) || eventInsideSvgTextEditor(fillStyle)
    );
  }
  function eventInsideSvgTextEditor(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments599: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle && fillStyle.target;
    return !textEdit || !textEdit.svg || !innerHTML || !innerHTML.closest
      ? false
      : textEdit.svg.contains(innerHTML)
        ? true
        : !(innerHTML instanceof SVGElement) ||
            (innerHTML.ownerSVGElement || innerHTML) !==
              textEdit.svg.ownerSVGElement ||
            hasDirectTextContent(innerHTML) ||
            fillStyle.clientX == null
          ? false
          : findEditableSvgText(innerHTML, fillStyle) === textEdit.svg;
  }
  var text5: Dynamic =
    "[data-dc-edit-transparent],[data-omelette-chrome],[data-noncommentable],.twk-panel";
  var text6: Dynamic = "[data-dc-wheel-passthru]";
  function eventMatchesSelector(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments600: Dynamic[]
  ): Dynamic {
    var position: Dynamic = fillStyle;
    if (fillStyle && typeof fillStyle.composedPath == "function") {
      for (
        var shaft: Dynamic = fillStyle.composedPath(), tag: Dynamic = 0;
        tag < shaft.length;
        tag++
      ) {
        var rot: Dynamic = shaft[tag];
        if (rot && rot.nodeType === 1 && rot.matches && rot.matches(innerHTML))
          return true;
      }
      position = fillStyle.target;
    }
    return !!(position && position.closest && position.closest(innerHTML));
  }
  function eventHitsEditorOverlay(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments601: Dynamic[]
  ): Dynamic {
    return eventMatchesSelector(fillStyle, text5);
  }
  function eventHasScrollableTarget(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments602: Dynamic[]
  ): Dynamic {
    if (!fillStyle || typeof fillStyle.composedPath != "function") return false;
    for (
      var innerHTML: Dynamic = fillStyle.composedPath(), position: Dynamic = 0;
      position < innerHTML.length;
      position++
    ) {
      var shaft: Dynamic = innerHTML[position];
      if (!(!shaft || shaft.nodeType !== 1)) {
        var tag: Dynamic;
        try {
          tag = getComputedStyle(shaft);
        } catch {
          continue;
        }
        var rot: Dynamic =
          (tag.overflowY === "auto" || tag.overflowY === "scroll") &&
          shaft.scrollHeight > shaft.clientHeight;
        var ref: Dynamic =
          (tag.overflowX === "auto" || tag.overflowX === "scroll") &&
          shaft.scrollWidth > shaft.clientWidth;
        if ((rot && fillStyle.deltaY) || (ref && fillStyle.deltaX)) {
          for (var top: Dynamic = position; top < innerHTML.length; top++) {
            var name3: Dynamic = innerHTML[top];
            if (
              name3 &&
              name3.nodeType === 1 &&
              name3.matches &&
              name3.matches(text5)
            )
              return true;
          }
          return false;
        }
      }
    }
    return false;
  }
  function eventTargetConsumesWheel(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments603: Dynamic[]
  ): Dynamic {
    if (!fillStyle || typeof fillStyle.composedPath != "function") return false;
    for (
      var innerHTML: Dynamic = fillStyle.composedPath(),
        position: Dynamic = panZoomRoot(),
        shaft: Dynamic = Math.abs(fillStyle.deltaY),
        tag: Dynamic = Math.abs(fillStyle.deltaX),
        rot: Dynamic = 0;
      rot < innerHTML.length;
      rot++
    ) {
      var ref: Dynamic = innerHTML[rot];
      if (
        ref === position ||
        ref === (document as Dynamic).body ||
        ref === (document as Dynamic).documentElement
      )
        break;
      if (!(!ref || ref.nodeType !== 1)) {
        var top: Dynamic;
        try {
          top = getComputedStyle(ref);
        } catch {
          continue;
        }
        var name3: Dynamic = top.overflowY;
        var bottom: Dynamic = top.overflowX;
        var left: Dynamic =
          shaft >= tag &&
          (name3 === "auto" || name3 === "scroll") &&
          (fillStyle.deltaY > 0
            ? ref.scrollTop + ref.clientHeight < ref.scrollHeight - 1
            : fillStyle.deltaY < 0 && ref.scrollTop > 1);
        var scope: Dynamic =
          tag > shaft &&
          (bottom === "auto" || bottom === "scroll") &&
          (fillStyle.deltaX > 0
            ? ref.scrollLeft + ref.clientWidth < ref.scrollWidth - 1
            : fillStyle.deltaX < 0 && ref.scrollLeft > 1);
        if (left || scope) return true;
      }
    }
    return false;
  }
  function horizontalOverscroll(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments604: Dynamic[]
  ): Dynamic {
    if (fillStyle.ctrlKey || fillStyle.metaKey) return false;
    if (!fillStyle.deltaX && !fillStyle.deltaY) return true;
    if (Math.abs(fillStyle.deltaX) <= Math.abs(fillStyle.deltaY)) return false;
    var innerHTML: Dynamic = fillStyle.deltaX > 0;
    var position: Dynamic = fillStyle.deltaY > 0;
    var shaft: Dynamic = function (
      this: Dynamic,
      lock?: Dynamic,
      paint?: Dynamic,
      ..._extraArguments605: Dynamic[]
    ): Dynamic {
      var lastKey: Dynamic =
        lock.scrollLeft < 0 ||
        paint.direction === "rtl" ||
        /-rl$/.test(paint.writingMode || "");
      var lim: Dynamic = lastKey ? lock.clientWidth - lock.scrollWidth : 0;
      var text8: Dynamic = lastKey ? 0 : lock.scrollWidth - lock.clientWidth;
      return innerHTML
        ? lock.scrollLeft < text8 - 1
        : lock.scrollLeft > lim + 1;
    };
    var tag: Dynamic = function (
      this: Dynamic,
      lock?: Dynamic,
      ..._extraArguments606: Dynamic[]
    ): Dynamic {
      return (
        !!fillStyle.deltaY &&
        (position
          ? lock.scrollTop + lock.clientHeight < lock.scrollHeight - 1
          : lock.scrollTop > 1)
      );
    };
    var rot: Dynamic = function (
      this: Dynamic,
      lock?: Dynamic,
      ..._extraArguments607: Dynamic[]
    ): Dynamic {
      return lock !== "hidden" && lock !== "clip";
    };
    var ref: Dynamic = function (
      this: Dynamic,
      lock?: Dynamic,
      ..._extraArguments608: Dynamic[]
    ): Dynamic {
      return lock === "auto" || lock === "scroll";
    };
    var top: Dynamic = function (
      this: Dynamic,
      lock?: Dynamic,
      ..._extraArguments609: Dynamic[]
    ): Dynamic {
      return lock.localName === "input" || lock.localName === "textarea";
    };
    var name3: Dynamic = (document as Dynamic).documentElement;
    var bottom: Dynamic = (document as Dynamic).scrollingElement || name3;
    var left: Dynamic = getComputedStyle(name3);
    var scope: Dynamic =
      left.overflowX === "visible" &&
      left.overflowY === "visible" &&
      !!(document as Dynamic).body;
    var top2: Dynamic = scope
      ? getComputedStyle((document as Dynamic).body)
      : left;
    if (
      (rot(top2.overflowX) && shaft(bottom, top2)) ||
      (rot(top2.overflowY) && tag(bottom)) ||
      typeof fillStyle.composedPath != "function"
    )
      return false;
    for (
      var adjust: Dynamic = fillStyle.composedPath(), axis: Dynamic = 0;
      axis < adjust.length;
      axis++
    ) {
      var y: Dynamic = adjust[axis];
      if (
        !(
          !y ||
          y.nodeType !== 1 ||
          y === name3 ||
          (scope && y === (document as Dynamic).body)
        )
      ) {
        var pose: Dynamic;
        try {
          pose = getComputedStyle(y);
        } catch {
          continue;
        }
        if (
          ((ref(pose.overflowX) || top(y)) && shaft(y, pose)) ||
          (ref(pose.overflowY) && tag(y))
        )
          return false;
      }
    }
    return true;
  }
  var index18: Dynamic = 0;
  var value_Mr: Dynamic = false;
  function suppressStalePointerEvent(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments610: Dynamic[]
  ): Dynamic {
    return !fillStyle.isTrusted ||
      fillStyle.button !== 0 ||
      (fillStyle.type === "mousedown" &&
        (value_Mr = fillStyle.timeStamp < index18),
      !(fillStyle.timeStamp < index18) && !(value_Mr && fillStyle.detail > 0))
      ? false
      : (fillStyle.preventDefault(), fillStyle.stopPropagation(), true);
  }
  function onGlobalPointerCancel(
    this: Dynamic,
    ..._extraArguments611: Dynamic[]
  ): Dynamic {
    value_Mr = false;
  }
  (document as Dynamic).addEventListener(
    "pointercancel",
    onGlobalPointerCancel,
    true,
  );
  function onPreviewMouseDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments612: Dynamic[]
  ): Dynamic {
    if (!(enabled || !event.isTrusted || event.button !== 0)) {
      value_Mr = event.timeStamp < index18;
      if (value_Mr) {
        event.preventDefault();
      }
    }
  }
  (document as Dynamic).addEventListener("mousedown", onPreviewMouseDown, true);
  function onEditorMouseDown(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments613: Dynamic[]
  ): Dynamic {
    if (
      enabled &&
      !suppressStalePointerEvent(event) &&
      (event.type === "mousedown" &&
        ((suppressClick = false),
        (value_Le = null),
        event.button === 0 && (value_Vn = eventInsideTextEditor(event))),
      event.type === "mousedown" &&
        event.isTrusted &&
        ((pendingDoubleClick = null), (pendingTextTarget = null)),
      activeTool !== "interact")
    ) {
      if (eventInsideSvgTextEditor(event)) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = true;
        onSvgTextMouseDown(event);
        return;
      }
      if (
        !eventInsideTextEditor(event) &&
        !eventHitsEditorOverlay(event) &&
        (event.type === "mousedown" &&
          event.isTrusted &&
          ((gestureKey = event.button === 0 ? randomGestureKey() : null),
          emitEditorEvent(
            gestureKey
              ? {
                  type: "canvasPointerDown",
                  gestureKey: gestureKey,
                }
              : {
                  type: "canvasPointerDown",
                },
          )),
        event.preventDefault(),
        event.stopPropagation(),
        !readOnly)
      ) {
        if (
          event.type === "mousedown" &&
          event.button === 0 &&
          !textEdit &&
          activeTool !== "select"
        ) {
          if (activeTool === "draw") {
            appendPenPreviewPath(event);
            return;
          }
          var innerHTML: Dynamic = drawingContainerAt(
            event.clientX,
            event.clientY,
          );
          value_St = {
            x: event.clientX,
            y: event.clientY,
            parentEl: innerHTML.el,
            parentTid: innerHTML.tid,
            parentName: innerHTML.name,
            parentRect: innerHTML.rect,
          };
          return;
        }
        if (
          event.type === "mousedown" &&
          event.button === 0 &&
          !textEdit &&
          activeTool === "select"
        ) {
          value_lt = null;
          var position: Dynamic =
            event.target &&
            event.target.closest &&
            event.target.closest("[data-dc-editor-overlay]");
          if (position) return;
          var shaft: Dynamic = isMacPlatform ? event.metaKey : event.ctrlKey;
          var tag: Dynamic = event.shiftKey;
          var rot: Dynamic = editorRootName();
          var ref: Dynamic = rot
            ? resolveHitTarget(
                event,
                shaft ? "deep" : "plain",
                selectedTemplateIds,
                selectedComponentName,
              )
            : null;
          var top: Dynamic = ref && ref.ruled ? ref.el : null;
          if (event.altKey && !tag && !shaft) {
            value_lt = {
              release: "artboard",
              target: null,
            };
          }
          if (!top) {
            if (ref === "empty" && (!event.altKey || (!tag && !shaft))) {
              emitArtboardSelection(tag);
              value_lt = {
                release: "none",
                target: null,
              };
              return;
            }
            var name3: Dynamic = singleRootStampedElement();
            if (rot) {
              armMarquee(
                event,
                name3 && isSelectableContainer(name3) ? name3 : null,
                shaft ? "deep" : "plain",
                tag,
              );
            }
            if (!value_lt) {
              value_lt = {
                release: "background",
                target: null,
              };
            }
            return;
          }
          var bottom: Dynamic = parseInt(top.getAttribute("data-dc-tpl"), 10);
          var left: Dynamic =
            selectedComponentName === componentScopeName(top) &&
            selectedTemplateIds.indexOf(bottom) >= 0;
          var scope: Dynamic = {
            tids: selectedTemplateIds.slice(),
            name: selectedComponentName,
          };
          var top2: Dynamic = singleRootStampedElement();
          if (
            top === top2 &&
            !left &&
            !shaft &&
            !event.altKey &&
            !(
              event.target.closest &&
              event.target.closest("[data-drags-parent]")
            ) &&
            isSelectableContainer(top2)
          ) {
            armMarquee(event, top2, "plain", tag);
            value_lt = {
              release: tag ? "keep" : ref.page ? "background" : "root",
              target: top,
            };
            return;
          }
          var adjust: Dynamic =
            !tag && !shaft && !left && !isTextEditable(top)
              ? editableDescendantAncestor(top, ref.hit)
              : null;
          if (!value_lt) {
            if (tag && left) {
              value_lt = {
                release: "remove",
                target: top,
              };
            } else {
              if (tag) {
                selectElement(top, true);
                value_lt = {
                  release: "none",
                  target: top,
                };
              } else {
                if (left) {
                  value_lt = {
                    release:
                      selectedTemplateIds.length > 1
                        ? "narrow"
                        : shaft
                          ? "none"
                          : "text-part",
                    target: top,
                  };
                } else {
                  if (adjust) {
                    value_lt = {
                      release: "text",
                      target: adjust,
                    };
                  } else {
                    selectElement(top, false);
                    value_lt = {
                      release: "none",
                      target: top,
                      was:
                        isMacPlatform && event.ctrlKey && !shaft
                          ? {
                              tids: scope.tids,
                              name: scope.name,
                              x: event.clientX,
                              y: event.clientY,
                            }
                          : null,
                    };
                  }
                }
              }
            }
          }
          if (shaft && isMacPlatform) {
            armMarquee(event, null, "deep", tag, scope);
            return;
          }
          var axis: Dynamic = declaredDragParent(
            event.target,
            outerSvgElement(top),
          );
          if (!left) {
            axis = normalizeInlineDragTarget(axis);
          }
          if (!isUneditableElement(axis) && !isDeckManagedElement(axis)) {
            pendingDrag = {
              el: axis,
              tid: parseInt(axis.getAttribute("data-dc-tpl"), 10),
              name: componentScopeName(axis),
              x: event.clientX,
              y: event.clientY,
            };
          }
        }
      }
    }
  }
  var state16: Dynamic = {
    img: 1,
    svg: 1,
    video: 1,
    canvas: 1,
    iframe: 1,
    picture: 1,
    object: 1,
    embed: 1,
    audio: 1,
  };
  function normalizeInlineDragTarget(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments614: Dynamic[]
  ): Dynamic {
    for (
      var innerHTML: Dynamic = nearestComponentName(fillStyle);
      fillStyle &&
      getComputedStyle(fillStyle).display === "inline" &&
      !state16[(fillStyle.tagName || "").toLowerCase()];

    ) {
      var position: Dynamic = fillStyle.parentElement;
      if (
        !position ||
        !position.getAttribute ||
        position.getAttribute("data-dc-tpl") == null ||
        nearestComponentName(position) !== innerHTML
      )
        break;
      fillStyle = position;
    }
    return fillStyle;
  }
  function declaredDragParent(
    this: Dynamic,
    fillStyle?: Dynamic,
    innerHTML?: Dynamic,
    ..._extraArguments615: Dynamic[]
  ): Dynamic {
    var position: Dynamic =
      fillStyle &&
      fillStyle.closest &&
      fillStyle.closest("[data-drags-parent]");
    if (!position) return innerHTML;
    var shaft: Dynamic = parseInt(
      position.getAttribute("data-drags-parent"),
      10,
    );
    if (!(shaft > 0)) return innerHTML;
    for (
      var tag: Dynamic = componentScopeName(position),
        rot: Dynamic = position,
        ref: Dynamic = 0;
      ref < shaft;
      ref++
    ) {
      var top: Dynamic = rot.parentElement;
      if (
        !top ||
        !top.getAttribute ||
        top.getAttribute("data-dc-tpl") == null ||
        componentScopeName(top) !== tag
      )
        break;
      rot = top;
    }
    return rot.getAttribute && rot.getAttribute("data-dc-tpl") != null
      ? rot
      : innerHTML;
  }
  function clearForeignSelection(
    this: Dynamic,
    ..._extraArguments616: Dynamic[]
  ): Dynamic {
    if (foreignSelection) {
      try {
        foreignSelection.removeAttribute("data-dc-editor-selected");
      } catch {}
      foreignSelection = null;
    }
  }
  function onEditorAuxClick(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments617: Dynamic[]
  ): Dynamic {
    if (
      !(
        !enabled ||
        activeTool === "interact" ||
        eventHitsEditorOverlay(event) ||
        eventInsideTextEditor(event)
      )
    ) {
      event.preventDefault();
    }
  }
  function togglePreviewVideo(
    this: Dynamic,
    fillStyle?: Dynamic,
    ..._extraArguments618: Dynamic[]
  ): Dynamic {
    var innerHTML: Dynamic = fillStyle.target;
    if (
      !(
        !fillStyle.isTrusted ||
        !innerHTML ||
        innerHTML.tagName !== "VIDEO" ||
        innerHTML.controls ||
        (fillStyle.detail || 0) > 1
      ) &&
      !eventMatchesSelector(fillStyle, text3)
    ) {
      var position: Dynamic = innerHTML.paused;
      setTimeout(function (
        this: Dynamic,
        ..._extraArguments619: Dynamic[]
      ): Dynamic {
        if (!(innerHTML.paused !== position || !innerHTML.isConnected))
          if (position) {
            var shaft: Dynamic = innerHTML.play();
            if (shaft && shaft.catch) {
              shaft.catch(function (
                this: Dynamic,
                ..._extraArguments620: Dynamic[]
              ): Dynamic {});
            }
          } else innerHTML.pause();
      }, 0);
    }
  }
  function onEditorClick(
    this: Dynamic,
    event?: Dynamic,
    ..._extraArguments621: Dynamic[]
  ): Dynamic {
    (window as Dynamic).__dcEditorDebug = {
      clicks: (((window as Dynamic).__dcEditorDebug || {}).clicks || 0) + 1,
      enabled: enabled,
      tool: activeTool,
      suppressClick: suppressClick,
      editing: !!textEdit,
    };
    if (!!enabled && !suppressStalePointerEvent(event)) {
      if (activeTool === "interact") {
        togglePreviewVideo(event);
        return;
      }
      if (!eventHitsEditorOverlay(event)) {
        if (suppressClick) {
          suppressClick = false;
          value_lt = null;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (
          value_un &&
          !textEdit &&
          activeTool === "select" &&
          event.detail === 1
        ) {
          var innerHTML: Dynamic = value_un;
          value_un = null;
          if (
            Date.now() - innerHTML.t < 500 &&
            Math.hypot(
              event.clientX - innerHTML.x,
              event.clientY - innerHTML.y,
            ) <= chromePixels(5)
          ) {
            value_lt = null;
            onEditorDoubleClick(event);
            return;
          }
        }
        if (textEdit) {
          if (eventInsideTextEditor(event)) {
            if (textEdit.el.contains(event.target)) {
              event.stopPropagation();
            }
            if (textEdit.importTarget) {
              event.preventDefault();
            }
            return;
          }
          var position: Dynamic = !!(
            event.target &&
            event.target.contains &&
            event.target.contains(textEdit.el)
          );
          if (value_Vn && event.detail > 0 && position) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (event.detail === 0 && position) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          finishTextEdit();
          return;
        }
        if (activeTool === "draw") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (activeTool !== "select") {
          event.preventDefault();
          event.stopPropagation();
          if (activeTool === "text") {
            index18 = event.timeStamp + 500;
          }
          var shaft: Dynamic = drawingContainerAt(event.clientX, event.clientY);
          hidePlacementOverlay();
          var tag: Dynamic =
            state26[activeTool] ||
            (activeTool === "arrow" || activeTool === "line"
              ? [160, 0]
              : [120, 120]);
          var rot: Dynamic = shaft.el
            ? elementViewportScale(shaft.el)
            : panZoomScale || 1;
          emitEditorEvent({
            type: "insert",
            name: shaft.name,
            targetTid: shaft.tid,
            position: shaft.tid == null ? "root-end" : "into",
            rect: {
              x: Math.round((event.clientX - shaft.rect.left) / rot),
              y: Math.round((event.clientY - shaft.rect.top) / rot),
              w: activeTool === "text" ? 0 : tag[0],
              h: activeTool === "text" ? 0 : tag[1],
            },
          });
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        var ref: Dynamic = value_lt;
        value_lt = null;
        var top: Dynamic = event.shiftKey;
        var name3: Dynamic = resolveHitTarget(
          event,
          "plain",
          selectedTemplateIds,
          selectedComponentName,
        );
        if (
          (event.detail || 0) >= 3 &&
          !top &&
          !event.altKey &&
          !(isMacPlatform ? event.metaKey : event.ctrlKey) &&
          name3 &&
          name3.el &&
          selectedTemplateIds.length === 1 &&
          selectedComponentName === componentScopeName(name3.el) &&
          selectedTemplateIds[0] ===
            parseInt(name3.el.getAttribute("data-dc-tpl"), 10)
        ) {
          onEditorDoubleClick(event);
          return;
        }
        if (ref) {
          var bottom: Dynamic = ref.target;
          var left: Dynamic = bottom
            ? parseInt(bottom.getAttribute("data-dc-tpl"), 10)
            : NaN;
          switch (ref.release) {
            case "none":
            case "keep":
              return;
            case "artboard":
              emitArtboardSelection();
              return;
            case "root":
              selectElement(bottom, false);
              return;
            case "remove": {
              var scope: Dynamic = selectedTemplateIds.indexOf(left);
              if (scope >= 0) {
                selectedTemplateIds.splice(scope, 1);
                if (selectedTemplateIds.length === 0) {
                  selectedComponentName = null;
                }
                selectedPart = null;
                repaintSelection();
                emitSelection(undefined, undefined, true);
              }
              return;
            }
            case "narrow":
              selectElement(bottom, false);
              return;
            case "text":
              selectElement(bottom, false);
              return;
            case "text-part": {
              if (
                (event.detail || 0) < 2 &&
                name3 &&
                name3.hit &&
                !isTextEditable(bottom)
              ) {
                var top2: Dynamic = editableDescendantAncestor(
                  bottom,
                  name3.hit,
                );
                if (top2) {
                  selectElement(top2, false);
                  return;
                }
              }
              if (
                (event.detail || 0) < 2 &&
                selectedTemplateIds.length === 1 &&
                selectedTemplateIds[0] === left &&
                isTextElement(bottom, left) &&
                elementPaintInfo(bottom) &&
                pointHitsText(bottom, event.clientX, event.clientY)
              ) {
                selectedPart = "text";
                repaintSelection();
                emitSelection(sourceElementTag(bottom), undefined, true);
              } else if (
                selectedTemplateIds.length === 1 &&
                selectedTemplateIds[0] === left &&
                (emitSelection(sourceElementTag(bottom)),
                (event.detail || 0) < 2 && bottom.tagName === "VIDEO")
              )
                if (bottom.paused) {
                  var adjust: Dynamic = bottom.play();
                  if (adjust && adjust.catch) {
                    adjust.catch(function (
                      this: Dynamic,
                      ..._extraArguments622: Dynamic[]
                    ): Dynamic {});
                  }
                } else bottom.pause();
              return;
            }
            case "background":
              break;
          }
        }
        if (
          name3 &&
          name3.page &&
          !(isMacPlatform ? event.metaKey : event.ctrlKey)
        ) {
          if (!top) {
            emitArtboardSelection();
          }
          return;
        }
        if (!name3 || !name3.el) {
          var axis: Dynamic = event.target;
          if (name3 !== "unstamped" || classifyForeignHit(axis) !== "foreign") {
            emitArtboardSelection(top);
            return;
          }
          if (!top) {
            selectedTemplateIds = [];
            selectedComponentName = null;
            selectedPart = null;
          }
          clearForeignSelection();
          repaintSelection();
          {
            foreignSelection = axis;
            var y2: Dynamic = axis.outerHTML;
            axis.setAttribute("data-dc-editor-selected", "");
            index6++;
            emitEditorEvent({
              type: "select",
              tids: null,
              foreign: {
                tag: axis.tagName.toLowerCase(),
                html: y2,
                text: "",
              },
              additive: top,
              s: index6,
            });
          }
          return;
        }
        clearForeignSelection();
        var pose: Dynamic = top
          ? null
          : resolveHitTarget(
              event,
              "click",
              selectedTemplateIds,
              selectedComponentName,
            );
        var lock: Dynamic = pose && pose.el ? pose.el : name3.el;
        var paint: Dynamic = parseInt(lock.getAttribute("data-dc-tpl"), 10);
        var lastKey: Dynamic = componentScopeName(lock);
        var lim: Dynamic =
          !top &&
          (event.detail || 0) < 2 &&
          selectedTemplateIds.length === 1 &&
          selectedTemplateIds[0] === paint &&
          selectedComponentName === lastKey &&
          isTextElement(lock, paint) &&
          elementPaintInfo(lock) &&
          pointHitsText(lock, event.clientX, event.clientY);
        selectedPart = lim ? "text" : null;
        if (
          top &&
          selectedComponentName === lastKey &&
          selectedTemplateIds.length > 0
        ) {
          var text8: Dynamic = selectedTemplateIds.indexOf(paint);
          if (text8 >= 0) {
            selectedTemplateIds.splice(text8, 1);
          } else {
            selectedTemplateIds.push(paint);
          }
        } else {
          selectedTemplateIds = [paint];
          selectedComponentName = lastKey;
        }
        if (selectedTemplateIds.length === 0) {
          selectedComponentName = null;
        }
        repaintSelection();
        emitSelection(
          lock.hasAttribute("data-sc-name")
            ? "dc-import"
            : lock.tagName.toLowerCase(),
          undefined,
          top,
        );
      }
    }
  }
  var __dcEditorPicker: EditorPickerApi = {
    setHostPanZoom: function (
      this: Dynamic,
      mode?: Dynamic,
      ..._extraArguments623: Dynamic[]
    ): Dynamic {
      if (nativeScrollMode && mode !== "scroll" && mode !== "play") {
        (window as Dynamic).scrollTo(0, 0);
      }
      hostPanZoom = mode === true;
      playbackPanZoom = mode === "play";
      nativeScrollMode = mode === "scroll" || playbackPanZoom;
      updateTouchPolicy();
    },
    enable: function (
      this: Dynamic,
      ..._extraArguments624: Dynamic[]
    ): Dynamic {
      if (!enabled) {
        if (ringsOnlyEnabled) {
          __dcEditorPicker.disableRingsOnly();
        }
        enabled = true;
        refreshEditorBackdrop();
        (document as Dynamic).head.appendChild(editorStylesheet);
        (document as Dynamic).body.setAttribute("data-dc-editor-on", "");
        (document as Dynamic).addEventListener(
          "mousemove",
          onEditorMouseMove,
          true,
        );
        (document as Dynamic).addEventListener(
          "mouseover",
          onEditorMouseOver,
          true,
        );
        (document as Dynamic).addEventListener(
          "mouseout",
          onEditorMouseOut,
          true,
        );
        (document as Dynamic).addEventListener(
          "pointerdown",
          onEditorPointerDown,
          true,
        );
        (document as Dynamic).addEventListener(
          "pointermove",
          onEditorPointerMove,
          {
            capture: true,
            passive: true,
          },
        );
        (document as Dynamic).addEventListener(
          "mousedown",
          onEditorMouseDown,
          true,
        );
        (document as Dynamic).addEventListener(
          "mouseup",
          onEditorMouseUp,
          true,
        );
        (document as Dynamic).addEventListener("click", onEditorClick, true);
        (document as Dynamic).addEventListener(
          "auxclick",
          onEditorAuxClick,
          true,
        );
        (document as Dynamic).addEventListener(
          "contextmenu",
          onEditorContextMenu,
          true,
        );
        (document as Dynamic).addEventListener(
          "dblclick",
          onEditorDoubleClick,
          true,
        );
        (document as Dynamic).addEventListener(
          "keydown",
          onEditorKeyDown,
          true,
        );
        (document as Dynamic).addEventListener("keyup", onEditorKeyUp, true);
        (window as Dynamic).addEventListener("blur", onEditorBlur);
        (document as Dynamic).addEventListener("wheel", onEditorWheel, {
          capture: true,
          passive: false,
        });
        installGestureListeners();
        (document as Dynamic).addEventListener(
          "dragover",
          onEditorDragOver,
          true,
        );
        (document as Dynamic).addEventListener("drop", onEditorDrop, true);
        (window as Dynamic).addEventListener("paste", onEditorPaste, true);
        (window as Dynamic).addEventListener("copy", onEditorCopyCut, true);
        (window as Dynamic).addEventListener("cut", onEditorCopyCut, true);
        (document as Dynamic).addEventListener("scroll", refreshChrome, true);
        (document as Dynamic).addEventListener(
          "slidechange",
          onSlideChange,
          true,
        );
        (window as Dynamic).addEventListener("resize", refreshChrome);
        contentObserver = new MutationObserver(onContentMutation);
        contentObserver.observe((document as Dynamic).body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        chromeResizeObserver =
          typeof ResizeObserver == "function"
            ? new ResizeObserver(onContentMutation)
            : null;
        stylesheetObserver = new MutationObserver(onStylesheetMutation);
        if ((document as Dynamic).head) {
          stylesheetObserver.observe((document as Dynamic).head, {
            subtree: true,
            childList: true,
            characterData: true,
          });
        }
        ensureCanvasScrollbars();
        refreshCanvasScrollbars();
        value_$n = setInterval(function (
          this: Dynamic,
          ..._extraArguments625: Dynamic[]
        ): Dynamic {
          refreshChrome();
          refreshCanvasScrollbars();
        }, 400);
        replayPendingDoubleClick();
        replayPendingTextTarget();
        value_Ne = false;
        index15 = 0;
        clearPreviewDropHighlight();
      }
    },
    disable: function (
      this: Dynamic,
      keepPreview?: Dynamic,
      ..._extraArguments626: Dynamic[]
    ): Dynamic {
      if (!keepPreview) {
        if (panZoomOnly) {
          emitPreviewPresence(false);
        }
        panZoomOnly = false;
      }
      if (hostDrag) {
        finishHostDrag(false);
      }
      if (!enabled) {
        selectedTemplateIds = [];
        selectedComponentName = null;
        selectedPart = null;
        pendingDoubleClick = null;
        pendingTextTarget = null;
        cancelInsertedTextWatch();
        value_Ne = false;
        index15 = 0;
        clearPreviewDropHighlight();
        textMapReady = false;
        if (!keepPreview) {
          pan = {
            x: 0,
            y: 0,
          };
          panZoomScale = 1;
          value_Yr = undefined;
          var innerHTML: Dynamic = panZoomRoot();
          if (innerHTML) {
            innerHTML.style.transform = "";
          }
          editorStylesheet.remove();
          removeCanvasScrollbars();
          (document as Dynamic).removeEventListener("wheel", onEditorWheel, {
            capture: true,
          });
          removeGestureListeners();
          (document as Dynamic).removeEventListener(
            "dblclick",
            onPreviewDoubleClick,
            true,
          );
          (document as Dynamic).removeEventListener(
            "click",
            onPreviewClick,
            true,
          );
          (document as Dynamic).removeEventListener(
            "dragover",
            onPreviewDragOver,
            true,
          );
          (document as Dynamic).removeEventListener(
            "drop",
            onPreviewDrop,
            true,
          );
          (document as Dynamic).removeEventListener(
            "dragstart",
            onPreviewDragStart,
            true,
          );
          (document as Dynamic).removeEventListener(
            "dragenter",
            onPreviewDragEnter,
            true,
          );
          (document as Dynamic).removeEventListener(
            "dragleave",
            onPreviewDragLeave,
            true,
          );
          (document as Dynamic).removeEventListener(
            "dragend",
            onPreviewDragEnd,
            true,
          );
          (window as Dynamic).removeEventListener("message", onPreviewMessage);
        }
        return;
      }
      if (textEdit) {
        finishTextEdit(false);
      }
      if (dragGesture) {
        finishDragGesture(false);
      }
      finishShapeDrawing(false);
      finishTransformGesture(false);
      finishEndpointGesture(false);
      finishPenStroke(false);
      finishPenDrawing(false, false);
      cancelPendingInserts();
      value_St = null;
      pendingMarquee = null;
      finishMarquee(true);
      hidePlacementOverlay();
      clearGapOverlay();
      clearFlowOverlay();
      clearForeignSelection();
      if (!keepPreview || !panZoomOnly) {
        pan = {
          x: 0,
          y: 0,
        };
        panZoomScale = 1;
        value_Yr = undefined;
        var position: Dynamic = panZoomRoot();
        if (position) {
          position.style.transform = "";
        }
      }
      if (value_$n) {
        clearInterval(value_$n);
        value_$n = null;
      }
      (document as Dynamic).removeEventListener("scroll", refreshChrome, true);
      (document as Dynamic).removeEventListener(
        "slidechange",
        onSlideChange,
        true,
      );
      (window as Dynamic).removeEventListener("resize", refreshChrome);
      if (contentObserver) {
        contentObserver.disconnect();
        contentObserver = null;
      }
      if (stylesheetObserver) {
        stylesheetObserver.disconnect();
        stylesheetObserver = null;
      }
      if (chromeResizeObserver) {
        chromeResizeObserver.disconnect();
        chromeResizeObserver = null;
        items3 = [];
      }
      clearStylePatches();
      pendingDrag = null;
      value_Le = null;
      value_lt = null;
      enabled = false;
      if (value_wt) {
        value_wt.path.setAttribute("d", value_wt.origD);
        value_wt = null;
      }
      freehandMode = false;
      emitChrome([], null);
      clearTimeout(value_Pa);
      selectedTemplateIds = [];
      selectedComponentName = null;
      selectedPart = null;
      pendingDoubleClick = null;
      pendingTextTarget = null;
      cancelInsertedTextWatch();
      value_Ne = false;
      index15 = 0;
      clearPreviewDropHighlight();
      textMapReady = false;
      clearHover();
      clearAttributeEverywhere("data-dc-editor-selected");
      (document as Dynamic).body.removeAttribute("data-dc-editor-on");
      (document as Dynamic).body.removeAttribute("data-dc-editor-tool");
      (document as Dynamic).body.style.cursor = "";
      (document as Dynamic).documentElement.style.removeProperty(
        "--dc-editor-host-bg",
      );
      (document as Dynamic).documentElement.style.removeProperty(
        "--dc-editor-host-vpad",
      );
      if (!keepPreview) {
        editorStylesheet.remove();
        removeCanvasScrollbars();
      }
      (document as Dynamic).removeEventListener(
        "mousemove",
        onEditorMouseMove,
        true,
      );
      (document as Dynamic).removeEventListener(
        "mouseover",
        onEditorMouseOver,
        true,
      );
      (document as Dynamic).removeEventListener(
        "mouseout",
        onEditorMouseOut,
        true,
      );
      (document as Dynamic).removeEventListener(
        "pointerdown",
        onEditorPointerDown,
        true,
      );
      (document as Dynamic).removeEventListener(
        "pointermove",
        onEditorPointerMove,
        {
          capture: true,
        },
      );
      (document as Dynamic).removeEventListener(
        "mousedown",
        onEditorMouseDown,
        true,
      );
      (document as Dynamic).removeEventListener(
        "mouseup",
        onEditorMouseUp,
        true,
      );
      (document as Dynamic).removeEventListener("click", onEditorClick, true);
      (document as Dynamic).removeEventListener(
        "auxclick",
        onEditorAuxClick,
        true,
      );
      (document as Dynamic).removeEventListener(
        "contextmenu",
        onEditorContextMenu,
        true,
      );
      (document as Dynamic).removeEventListener(
        "dblclick",
        onEditorDoubleClick,
        true,
      );
      (document as Dynamic).removeEventListener(
        "keydown",
        onEditorKeyDown,
        true,
      );
      (document as Dynamic).removeEventListener("keyup", onEditorKeyUp, true);
      (window as Dynamic).removeEventListener("blur", onEditorBlur);
      measurementEnabled = false;
      value_je = false;
      deepPickingEnabled = false;
      lastPointer = null;
      if (!keepPreview) {
        (document as Dynamic).removeEventListener("wheel", onEditorWheel, {
          capture: true,
        });
        removeGestureListeners();
        (document as Dynamic).removeEventListener(
          "dblclick",
          onPreviewDoubleClick,
          true,
        );
        (document as Dynamic).removeEventListener(
          "click",
          onPreviewClick,
          true,
        );
        (document as Dynamic).removeEventListener(
          "dragover",
          onPreviewDragOver,
          true,
        );
        (document as Dynamic).removeEventListener("drop", onPreviewDrop, true);
        (document as Dynamic).removeEventListener(
          "dragstart",
          onPreviewDragStart,
          true,
        );
        (document as Dynamic).removeEventListener(
          "dragenter",
          onPreviewDragEnter,
          true,
        );
        (document as Dynamic).removeEventListener(
          "dragleave",
          onPreviewDragLeave,
          true,
        );
        (document as Dynamic).removeEventListener(
          "dragend",
          onPreviewDragEnd,
          true,
        );
        (window as Dynamic).removeEventListener("message", onPreviewMessage);
      }
      (document as Dynamic).removeEventListener(
        "dragover",
        onEditorDragOver,
        true,
      );
      (document as Dynamic).removeEventListener("drop", onEditorDrop, true);
      (window as Dynamic).removeEventListener("paste", onEditorPaste, true);
      (window as Dynamic).removeEventListener("copy", onEditorCopyCut, true);
      (window as Dynamic).removeEventListener("cut", onEditorCopyCut, true);
      try {
        var shaft: Dynamic =
          (window as Dynamic).__dcRootName &&
          (window as Dynamic).__dcRootName();
        var tag: Dynamic =
          shaft &&
          (window as Dynamic).__dcTemplateSource &&
          (window as Dynamic).__dcTemplateSource(shaft);
        if (tag != null) {
          (window as Dynamic).__dcUpdate(shaft, "html", tag, false);
        }
      } catch {}
      updateTouchPolicy();
      if (resumeRingsOnly) {
        resumeRingsOnly = false;
        __dcEditorPicker.enableRingsOnly();
      }
    },
    enablePanZoomOnly: function (
      this: Dynamic,
      ..._extraArguments627: Dynamic[]
    ): Dynamic {
      (document as Dynamic).addEventListener(
        "dblclick",
        onPreviewDoubleClick,
        true,
      );
      (document as Dynamic).addEventListener("click", onPreviewClick, true);
      (document as Dynamic).addEventListener(
        "dragover",
        onPreviewDragOver,
        true,
      );
      (document as Dynamic).addEventListener("drop", onPreviewDrop, true);
      (document as Dynamic).addEventListener(
        "dragstart",
        onPreviewDragStart,
        true,
      );
      (document as Dynamic).addEventListener(
        "dragenter",
        onPreviewDragEnter,
        true,
      );
      (document as Dynamic).addEventListener(
        "dragleave",
        onPreviewDragLeave,
        true,
      );
      (document as Dynamic).addEventListener("dragend", onPreviewDragEnd, true);
      (window as Dynamic).addEventListener("message", onPreviewMessage);
      if (enabled) {
        __dcEditorPicker.disable(true);
        return;
      }
      (document as Dynamic).head.appendChild(editorStylesheet);
      (document as Dynamic).addEventListener("wheel", onEditorWheel, {
        capture: true,
        passive: false,
      });
      installGestureListeners();
      (window as Dynamic).addEventListener("message", onPreviewMessage);
      ensureCanvasScrollbars();
      refreshCanvasScrollbars();
    },
    setPanZoomArmed: function (
      this: Dynamic,
      armed?: Dynamic,
      ..._extraArguments628: Dynamic[]
    ): Dynamic {
      if (!!armed !== panZoomOnly) {
        panZoomOnly = !!armed;
        emitPreviewPresence(armed);
        if (armed) {
          (window as Dynamic).addEventListener("message", onPreviewMessage);
          ensureCanvasScrollbars();
          refreshCanvasScrollbars();
          if (
            !value_Do &&
            (document as Dynamic).querySelector(
              'meta[name="design_doc_mode"][content="canvas"]',
            )
          ) {
            value_Do = true;
            var innerHTML: Dynamic = 0;
            var position: Dynamic = 0;
            var shaft: Dynamic = function (
              this: Dynamic,
              ..._extraArguments629: Dynamic[]
            ): Dynamic {
              if (
                !(panZoomScale !== 1 && panZoomScale !== innerHTML) &&
                !((pan.x !== 0 && pan.x !== position) || pan.y !== 0)
              ) {
                var rot: Dynamic = panZoomRoot();
                if (rot) {
                  var ref: Dynamic = rootHorizontalBounds(rot).width;
                  if (ref > innerWidth * 1.05) {
                    fitPanZoomWidth();
                    innerHTML = panZoomScale;
                    position = pan.x;
                  }
                }
              }
            };
            shaft();
            requestAnimationFrame(shaft);
            setTimeout(shaft, 250);
          }
        } else if ((removeCanvasScrollbars(), !enabled)) {
          pan = {
            x: 0,
            y: 0,
          };
          panZoomScale = 1;
          value_Yr = undefined;
          var tag: Dynamic = panZoomRoot();
          if (tag) {
            tag.style.transform = "";
          }
        }
      }
    },
    setAppTheme: function (
      this: Dynamic,
      theme?: Dynamic,
      ..._extraArguments630: Dynamic[]
    ): Dynamic {
      var innerHTML: Dynamic = (document as Dynamic).documentElement;
      if (theme === "dark") {
        innerHTML.style.setProperty("--dc-editor-backdrop", "#171717");
        innerHTML.style.setProperty(
          "--dc-editor-hatch-ink",
          "rgba(250,249,245,.07)",
        );
      } else {
        innerHTML.style.removeProperty("--dc-editor-backdrop");
        innerHTML.style.removeProperty("--dc-editor-hatch-ink");
      }
    },
    setBusyDrops: function (
      this: Dynamic,
      busy?: Dynamic,
      ..._extraArguments631: Dynamic[]
    ): Dynamic {
      state2 = {};
      index = 0;
      for (
        var innerHTML: Dynamic = 0;
        busy && innerHTML < busy.length && innerHTML < 32;
        innerHTML++
      )
        if (
          typeof busy[innerHTML] == "string" &&
          /^[a-z0-9-]{1,48}$/.test(busy[innerHTML]) &&
          state2[busy[innerHTML]] !== 1
        ) {
          state2[busy[innerHTML]] = 1;
          index++;
        }
      refreshChrome();
    },
    enableRingsOnly: function (
      this: Dynamic,
      ..._extraArguments632: Dynamic[]
    ): Dynamic {
      if (enabled) {
        resumeRingsOnly = true;
        return;
      }
      if (!ringsOnlyEnabled) {
        ringsOnlyEnabled = true;
        contentObserver = new MutationObserver(onContentMutation);
        contentObserver.observe((document as Dynamic).body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        chromeResizeObserver =
          typeof ResizeObserver == "function"
            ? new ResizeObserver(onContentMutation)
            : null;
        (document as Dynamic).addEventListener("scroll", refreshChrome, true);
        (window as Dynamic).addEventListener("resize", refreshChrome);
        refreshChrome();
      }
    },
    disableRingsOnly: function (
      this: Dynamic,
      ..._extraArguments633: Dynamic[]
    ): Dynamic {
      resumeRingsOnly = false;
      if (ringsOnlyEnabled) {
        ringsOnlyEnabled = false;
        if (contentObserver) {
          contentObserver.disconnect();
          contentObserver = null;
        }
        if (chromeResizeObserver) {
          chromeResizeObserver.disconnect();
          chromeResizeObserver = null;
        }
        (document as Dynamic).removeEventListener(
          "scroll",
          refreshChrome,
          true,
        );
        (window as Dynamic).removeEventListener("resize", refreshChrome);
        clearHover();
        refreshChrome();
      }
    },
    pickAt: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      mode?: Dynamic,
      selectedIds?: Dynamic,
      textIds?: Dynamic,
      ..._extraArguments634: Dynamic[]
    ): Dynamic {
      var rot: Dynamic = Number(x);
      var ref: Dynamic = Number(y);
      if (!isFinite(rot) || !isFinite(ref)) return null;
      var top: Dynamic = mode === "deep" || mode === "deeper" ? mode : "plain";
      var name3: Dynamic = (Array as Dynamic).isArray(selectedIds)
        ? selectedIds.filter(function (
            this: Dynamic,
            bottom?: Dynamic,
            ..._extraArguments635: Dynamic[]
          ): Dynamic {
            return typeof bottom == "number" && isFinite(bottom);
          })
        : [];
      return new Promise(function (
        this: Dynamic,
        bottom?: Dynamic,
        ..._extraArguments636: Dynamic[]
      ): Dynamic {
        requestAnimationFrame(function (
          this: Dynamic,
          ..._extraArguments637: Dynamic[]
        ): Dynamic {
          requestAnimationFrame(function (
            this: Dynamic,
            ..._extraArguments638: Dynamic[]
          ): Dynamic {
            if (isUnselectedEmptyArtboard(name3)) {
              bottom({
                empty: true,
              });
              return;
            }
            var left: Dynamic = resolvePickTarget(
              (document as Dynamic).elementFromPoint(rot, ref),
              top,
              name3,
            );
            if (!left) {
              bottom(null);
              return;
            }
            var scope: Dynamic = left.el;
            var top2: Dynamic =
              left.hit === scope && scope === singleRootStampedElement();
            var adjust: Dynamic = parseInt(
              scope.getAttribute("data-dc-tpl") || "-1",
              10,
            );
            if (adjust < 0 || !isFinite(adjust)) {
              bottom(null);
              return;
            }
            var axis: Dynamic = pickElementBounds(scope);
            var y: Dynamic =
              top === "plain"
                ? resolveTextPickTarget(scope, left.hit, textIds)
                : null;
            var pose: Dynamic = y ? pickElementBounds(y) : null;
            bottom({
              tid: adjust,
              tag: editorElementTag(scope),
              rect: {
                x: axis.left,
                y: axis.top,
                w: axis.width,
                h: axis.height,
              },
              root: top2,
              page: left.page,
              text: y
                ? {
                    tid: parseInt(y.getAttribute("data-dc-tpl"), 10),
                    tag: editorElementTag(y),
                    rect: {
                      x: pose.left,
                      y: pose.top,
                      w: pose.width,
                      h: pose.height,
                    },
                  }
                : null,
            });
          });
        });
      });
    },
    pickIn: function (
      this: Dynamic,
      requestedLeft?: Dynamic,
      requestedTop?: Dynamic,
      right?: Dynamic,
      requestedBottom?: Dynamic,
      mode?: Dynamic,
      ..._extraArguments639: Dynamic[]
    ): Dynamic {
      requestedLeft = Number(requestedLeft);
      requestedTop = Number(requestedTop);
      right = Number(right);
      requestedBottom = Number(requestedBottom);
      if (
        !(
          isFinite(requestedLeft) &&
          isFinite(requestedTop) &&
          isFinite(right) &&
          isFinite(requestedBottom)
        ) ||
        right < requestedLeft ||
        requestedBottom < requestedTop
      )
        return [];
      var rot: Dynamic = editorRootName();
      if (!rot || isEmptyArtboard()) return [];
      for (
        var ref: Dynamic = mode === "deep",
          top: Dynamic = ref ? null : singleRootStampedElement(),
          name3: Dynamic = selectableDescendants(
            top && isSelectableContainer(top) ? top : null,
            rot,
            ref ? "deep" : "plain",
          ),
          bottom: Dynamic = [],
          left: Dynamic = 0;
        left < name3.length;
        left++
      ) {
        var scope: Dynamic = unwrapDisplayContentsHost(name3[left]);
        var top2: Dynamic = scope.getBoundingClientRect();
        if (!(top2.width === 0 && top2.height === 0)) {
          var adjust: Dynamic = ref
            ? requestedLeft <= top2.left &&
              top2.right <= right &&
              requestedTop <= top2.top &&
              top2.bottom <= requestedBottom
            : requestedLeft <= top2.right &&
              top2.left <= right &&
              requestedTop <= top2.bottom &&
              top2.top <= requestedBottom;
          if (adjust && isRenderedElement(scope)) {
            bottom.push(name3[left]);
          }
        }
      }
      if (ref) {
        bottom = removeAncestorSelections(bottom);
      }
      for (
        var axis: Dynamic = [], y: Dynamic = 0;
        y < bottom.length && axis.length < 512;
        y++
      ) {
        var pose: Dynamic = parseInt(
          bottom[y].getAttribute("data-dc-tpl") || "-1",
          10,
        );
        if (!(pose < 0 || !isFinite(pose))) {
          axis.push({
            tid: pose,
            tag: editorElementTag(bottom[y]),
          });
        }
      }
      return axis;
    },
    commentAt: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      ..._extraArguments640: Dynamic[]
    ): Dynamic {
      var position: Dynamic = Number(x);
      var shaft: Dynamic = Number(y);
      return !isFinite(position) || !isFinite(shaft)
        ? null
        : commentAnchorForElement(
            (document as Dynamic).elementFromPoint(position, shaft),
            position,
            shaft,
          );
    },
    commentFor: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      ..._extraArguments641: Dynamic[]
    ): Dynamic {
      var position: Dynamic = findTemplateInstances(
        String(requestedTemplateId),
        componentName || null,
      )[0];
      return position ? commentAnchorForElement(position, null, null) : null;
    },
    commentIn: function (
      this: Dynamic,
      requestedLeft?: Dynamic,
      requestedTop?: Dynamic,
      right?: Dynamic,
      requestedBottom?: Dynamic,
      ..._extraArguments642: Dynamic[]
    ): Dynamic {
      requestedLeft = Number(requestedLeft);
      requestedTop = Number(requestedTop);
      right = Number(right);
      requestedBottom = Number(requestedBottom);
      if (
        !(
          isFinite(requestedLeft) &&
          isFinite(requestedTop) &&
          isFinite(right) &&
          isFinite(requestedBottom)
        ) ||
        right <= requestedLeft ||
        requestedBottom <= requestedTop
      )
        return null;
      for (
        var tag: Dynamic = findOuterComponentHost(),
          rot: Dynamic = tag ? tag.getAttribute("data-sc-name") : null,
          ref: Dynamic =
            (right - requestedLeft) * (requestedBottom - requestedTop),
          top: Dynamic = function (
            this: Dynamic,
            K?: Dynamic,
            ..._extraArguments643: Dynamic[]
          ): Dynamic {
            var value_Y: Dynamic =
              Math.min(right, K.right) - Math.max(requestedLeft, K.left);
            var value_Z: Dynamic =
              Math.min(requestedBottom, K.bottom) -
              Math.max(requestedTop, K.top);
            return value_Y > 0 && value_Z > 0 ? value_Y * value_Z : 0;
          },
          name3: Dynamic = function (
            this: Dynamic,
            K?: Dynamic,
            ..._extraArguments644: Dynamic[]
          ): Dynamic {
            return !!K.closest(
              "[data-dc-editor-overlay],[data-dc-editor-overlay-root],[data-omelette-chrome],[data-omelette-injected]",
            );
          },
          bottom: Dynamic = rot
            ? (document as Dynamic).querySelectorAll("[data-dc-tpl]")
            : [],
          left: Dynamic = [],
          scope: Dynamic = [],
          top2: Dynamic = 0;
        top2 < bottom.length;
        top2++
      ) {
        var adjust: Dynamic = bottom[top2];
        if (!(componentScopeName(adjust) !== rot || name3(adjust))) {
          var axis: Dynamic = adjust.getBoundingClientRect();
          var y2: Dynamic = axis.width * axis.height;
          if (y2 > 0) {
            var pose: Dynamic = top(axis);
            if (pose >= 0.85 * ref) {
              left.push({
                el: adjust,
                a: y2,
              });
            }
            if (pose >= 0.7 * y2) {
              scope.push(adjust);
            }
          }
        }
      }
      left.sort(function (
        this: Dynamic,
        K?: Dynamic,
        options?: Dynamic,
        ..._extraArguments645: Dynamic[]
      ): Dynamic {
        return K.a - options.a;
      });
      for (
        var lock: Dynamic = null, paint: Dynamic = 0;
        paint < left.length && !lock;
        paint++
      ) {
        for (
          var lastKey: Dynamic = left[paint].el,
            lim: Dynamic = true,
            text8: Dynamic = 0;
          text8 < scope.length && lim;
          text8++
        )
          if (
            scope[text8] !== lastKey &&
            !lastKey.contains(scope[text8]) &&
            !scope[text8].contains(lastKey)
          ) {
            lim = false;
          }
        if (lim) {
          lock = lastKey;
        }
      }
      for (
        var items14: Dynamic = [], expected: Dynamic = 0;
        expected < scope.length;
        expected++
      )
        if (
          !lock ||
          (scope[expected] !== lock && lock.contains(scope[expected]))
        ) {
          items14.push(scope[expected]);
        }
      if (items14.length === 0 && lock && scope.indexOf(lock) >= 0) {
        items14.push(lock);
      }
      for (
        var items15: Dynamic = [], index21: Dynamic = 0;
        index21 < items14.length;
        index21++
      ) {
        for (
          var el: Dynamic = items14[index21],
            startRect: Dynamic = false,
            parentElement: Dynamic = el.parentElement;
          parentElement && parentElement !== lock && !startRect;
          parentElement = parentElement.parentElement
        )
          if (items14.indexOf(parentElement) >= 0) {
            startRect = true;
          }
        if (!startRect) {
          items15.push(el);
        }
      }
      for (
        var covered: Dynamic = [], index22: Dynamic = 0;
        index22 < items15.length && covered.length < 16;
        index22++
      ) {
        var back: Dynamic = items15[index22];
        var x: Dynamic = back.getBoundingClientRect();
        var y: Dynamic = parseInt(back.getAttribute("data-dc-tpl") || "-1", 10);
        if (isFinite(y) && y >= 0) {
          covered.push({
            tid: y,
            tag: back.tagName.toLowerCase(),
            rect: {
              x: x.left,
              y: x.top,
              w: x.width,
              h: x.height,
            },
          });
        }
      }
      return {
        enclosing: lock
          ? commentAnchorForElement(
              lock,
              (requestedLeft + right) / 2,
              (requestedTop + requestedBottom) / 2,
            )
          : null,
        covered: covered,
        total: items15.length,
      };
    },
    commentRects: function (
      this: Dynamic,
      anchors?: Dynamic,
      ..._extraArguments646: Dynamic[]
    ): Dynamic {
      var innerHTML: Dynamic = [];
      if (!(Array as Dynamic).isArray(anchors)) return innerHTML;
      for (
        var position: Dynamic = findOuterComponentHost(),
          shaft: Dynamic = position
            ? position.getAttribute("data-sc-name")
            : null,
          tag: Dynamic = 0;
        tag < anchors.length && tag < 256;
        tag++
      ) {
        var rot: Dynamic = anchors[tag] || {};
        var ref: Dynamic = null;
        if (rot.page === true) {
          innerHTML.push(viewportRect());
          continue;
        }
        try {
          ref = (document as Dynamic).querySelector(String(rot.path));
        } catch {
          ref = null;
        }
        if (rot.tid != null && shaft) {
          var top: Dynamic = findTemplateInstances(String(rot.tid), shaft);
          if (!(ref && top.indexOf(ref) >= 0) && top.length === 1) {
            var name3: Dynamic =
              ref &&
              rot.fp &&
              normalizedTextContent(ref) === rot.fp &&
              normalizedTextContent(top[0]) !== rot.fp;
            if (!name3) {
              ref = top[0];
            }
          }
        }
        if (!ref) {
          innerHTML.push(null);
          continue;
        }
        var bottom: Dynamic = visibleContentBounds(ref);
        innerHTML.push({
          x: bottom.left,
          y: bottom.top,
          w: bottom.width,
          h: bottom.height,
        });
      }
      return innerHTML;
    },
    peerRects: function (
      this: Dynamic,
      peers?: Dynamic,
      componentName?: Dynamic,
      ..._extraArguments647: Dynamic[]
    ): Dynamic {
      var position: Dynamic = [];
      if (!(Array as Dynamic).isArray(peers)) return position;
      var shaft: Dynamic = (componentName && (window as Dynamic).scrollX) || 0;
      var tag: Dynamic = (componentName && (window as Dynamic).scrollY) || 0;
      var rot: Dynamic = findOuterComponentHost();
      var ref: Dynamic = rot ? rot.getAttribute("data-sc-name") : null;
      if (!ref) return position;
      for (var top: Dynamic = 0; top < peers.length && top < 64; top++) {
        var name3: Dynamic = Number(peers[top]);
        if (isFinite(name3) && name3 >= 0 && Math.floor(name3) === name3)
          for (
            var bottom: Dynamic = templateOrDirectiveInstances(
                String(name3),
                ref,
              ),
              left: Dynamic = 0;
            left < bottom.length && position.length < 256;
            left++
          ) {
            var scope: Dynamic = unwrapDisplayContentsHost(bottom[left]);
            var top2: Dynamic = outerSvgElement(scope);
            var adjust: Dynamic = value_$o(scope, top2, value_Uo);
            var axis: Dynamic = expandedSvgBounds(adjust);
            if (
              adjust !== top2 &&
              (!(axis.width > 0) ||
                !(axis.height > 0) ||
                !isRenderedElement(adjust))
            ) {
              adjust = top2;
              axis = expandedSvgBounds(adjust);
            }
            if (
              !(
                !(axis.width > 0) ||
                !(axis.height > 0) ||
                !isRenderedElement(adjust)
              )
            ) {
              position.push({
                i: top,
                x: axis.left + shaft,
                y: axis.top + tag,
                w: axis.width,
                h: axis.height,
              });
            }
          }
      }
      return position;
    },
    getPanZoom: function (
      this: Dynamic,
      ..._extraArguments648: Dynamic[]
    ): Dynamic {
      return {
        x: pan.x,
        y: pan.y,
        z: panZoomScale,
      };
    },
    setPanZoom: function (
      this: Dynamic,
      scale?: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      ..._extraArguments649: Dynamic[]
    ): Dynamic {
      pan = {
        x: scale,
        y: x,
      };
      panZoomScale = y;
      applyPanZoom();
    },
    repostChrome: function (
      this: Dynamic,
      ..._extraArguments650: Dynamic[]
    ): Dynamic {
      lastChromeJson = null;
      refreshChrome();
    },
    cancelDrag: function (
      this: Dynamic,
      ..._extraArguments651: Dynamic[]
    ): Dynamic {
      if (dragGesture) {
        suppressClick = true;
        finishDragGesture(false);
      }
    },
    cancelBox: function (
      this: Dynamic,
      restore?: Dynamic,
      ..._extraArguments652: Dynamic[]
    ): Dynamic {
      if (marqueeGesture && marqueeGesture.gestureKey === restore) {
        suppressClick = true;
        value_lt = null;
        pendingDrag = null;
        finishMarquee(true);
      }
    },
    armedByClick: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      ..._extraArguments653: Dynamic[]
    ): Dynamic {
      var position: Dynamic = Number(x);
      var shaft: Dynamic = Number(y);
      if (!(!isFinite(position) || !isFinite(shaft))) {
        value_un = {
          x: position,
          y: shaft,
          t: Date.now(),
        };
      }
    },
    dragModifiers: function (
      this: Dynamic,
      alt?: Dynamic,
      ctrl?: Dynamic,
      meta?: Dynamic,
      ..._extraArguments654: Dynamic[]
    ): Dynamic {
      updateDragModifiers(alt, ctrl, meta);
    },
    moveStart: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      options?: Dynamic,
      modifiers?: Dynamic,
      ..._extraArguments655: Dynamic[]
    ): Dynamic {
      if (
        !/^[0-9a-f]{16}$/.test(String(requestedGestureKey)) ||
        textEdit ||
        (enabled && activeTool !== "select")
      )
        return null;
      if (hostDrag) {
        finishHostDrag(false);
      }
      if (dragGesture) {
        finishDragGesture(false);
      }
      var rot: Dynamic = parseInt(x, 10);
      if (!isFinite(rot) || rot < 0) return null;
      var ref: Dynamic =
        (window as Dynamic).__dcRootName && (window as Dynamic).__dcRootName();
      if (!ref) return null;
      var top: Dynamic = findTemplateInstances(String(rot), ref);
      var name3: Dynamic = top[0];
      if (
        !name3 ||
        top.length > 1 ||
        ((name3 = declaredDragParent(name3, outerSvgElement(name3))),
        componentScopeName(name3) !== ref ||
          isUneditableElement(name3) ||
          isDeckManagedElement(name3))
      )
        return null;
      var bottom: Dynamic =
        unwrapDisplayContentsHost(name3).getBoundingClientRect();
      var left: Dynamic =
        y == null ? bottom.left + bottom.width / 2 : Number(y);
      var scope: Dynamic =
        options == null ? bottom.top + bottom.height / 2 : Number(options);
      if (!isFinite(left) || !isFinite(scope)) return null;
      beginHostDrag(String(requestedGestureKey));
      refreshHostDragWatchdog();
      pendingDrag = {
        el: name3,
        tid: templateId(name3),
        name: componentScopeName(name3),
        x: left,
        y: scope,
      };
      value_Le = null;
      value_lt = null;
      var top2: Dynamic = false;
      try {
        top2 = beginPendingDrag(syntheticDragEvent(left, scope, modifiers));
      } catch {
        top2 = false;
      }
      if (!top2 || !dragGesture || dragGesture.hostKey !== hostDrag.key) {
        finishHostDrag(false);
        return null;
      }
      var adjust: Dynamic = [dragGesture.tid];
      var axis: Dynamic = {};
      axis[dragGesture.tid] = true;
      var y2: Dynamic = function (
        this: Dynamic,
        el?: Dynamic,
        ..._extraArguments656: Dynamic[]
      ): Dynamic {
        if (isFinite(el) && !axis[el]) {
          axis[el] = true;
          adjust.push(el);
        }
      };
      if (dragGesture.followers)
        for (var pose: Dynamic = 0; pose < dragGesture.followers.length; pose++)
          y2(dragGesture.followers[pose].tid);
      if (dragGesture.group)
        for (var lock: Dynamic = 0; lock < dragGesture.group.length; lock++)
          y2(dragGesture.group[lock].tid);
      if (dragGesture.brkFollowers && modifiers && modifiers.ctrl)
        for (
          var paint: Dynamic = 0;
          paint < dragGesture.brkFollowers.length;
          paint++
        )
          y2(dragGesture.brkFollowers[paint].tid);
      for (
        var lastKey: Dynamic = dragGesture.startRect,
          lim: Dynamic = [],
          text8: Dynamic = ref,
          index21: Dynamic = 0;
        index21 < adjust.length;
        index21++
      ) {
        var expected: Dynamic = findTemplateInstances(
          String(adjust[index21]),
          text8,
        );
        var value_k: Dynamic = expected[0];
        if (!(!value_k || expected.length > 1)) {
          var bounds: Dynamic =
            unwrapDisplayContentsHost(value_k).getBoundingClientRect();
          lim.push({
            tid: adjust[index21],
            tag: editorElementTag(value_k),
            rect: {
              x: bounds.left,
              y: bounds.top,
              w: bounds.width,
              h: bounds.height,
            },
          });
        }
      }
      return {
        tids: adjust,
        tag: editorElementTag(dragGesture.el),
        rect: {
          x: lastKey.left,
          y: lastKey.top,
          w: lastKey.width,
          h: lastKey.height,
        },
        mode: dragGesture.mode,
        members: lim,
      };
    },
    moveMove: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      modifiers?: Dynamic,
      ..._extraArguments657: Dynamic[]
    ): Dynamic {
      if (
        !(
          !hostDrag ||
          hostDrag.key !== requestedGestureKey ||
          !dragGesture ||
          !isFinite(Number(x)) ||
          !isFinite(Number(y)) ||
          x == null ||
          y == null
        )
      ) {
        refreshHostDragWatchdog();
        if (!dragGesture.hostParked) {
          onEditorMouseMove(syntheticDragEvent(x, y, modifiers));
        }
      }
    },
    moveEnd: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      modifiers?: Dynamic,
      ..._extraArguments658: Dynamic[]
    ): Dynamic {
      if (!hostDrag || hostDrag.key !== requestedGestureKey) return null;
      if (dragGesture && dragGesture.hostParked) {
        finishHostDrag(false);
        return {
          plan: null,
          tids: [],
        };
      }
      if (dragGesture) {
        onEditorMouseMove(syntheticDragEvent(x, y, modifiers));
      }
      var tag: Dynamic = dragGesture ? [dragGesture.tid] : [];
      var rot: Dynamic = finishHostDrag(true);
      return rot
        ? (delete rot.type,
          delete rot.name,
          delete rot.gestureKey,
          delete rot.epoch,
          {
            plan: rot,
            tids: tag,
          })
        : {
            plan: null,
            tids: tag,
          };
    },
    moveCancel: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      ..._extraArguments659: Dynamic[]
    ): Dynamic {
      if (hostDrag && hostDrag.key === requestedGestureKey) {
        finishHostDrag(false);
      }
    },
    moveHost: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      options?: Dynamic,
      ..._extraArguments660: Dynamic[]
    ): Dynamic {
      return /^[0-9a-f]{16}$/.test(String(requestedGestureKey))
        ? options === "close"
          ? (hostDrag &&
              hostDrag.key === requestedGestureKey &&
              !dragGesture &&
              finishHostDrag(false),
            true)
          : options !== "open" ||
              textEdit ||
              (enabled && activeTool !== "select")
            ? false
            : hostDrag && hostDrag.key === requestedGestureKey
              ? (refreshHostDragWatchdog(), true)
              : (hostDrag && finishHostDrag(false),
                dragGesture && finishDragGesture(false),
                beginHostDrag(String(requestedGestureKey)),
                refreshHostDragWatchdog(),
                true)
        : false;
    },
    moveExit: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      ..._extraArguments661: Dynamic[]
    ): Dynamic {
      if (
        hostDrag &&
        hostDrag.key === requestedGestureKey &&
        dragGesture &&
        dragGesture.hostKey === requestedGestureKey
      ) {
        refreshHostDragWatchdog();
        parkHostDrag();
      }
    },
    moveReturn: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      ..._extraArguments662: Dynamic[]
    ): Dynamic {
      if (
        hostDrag &&
        hostDrag.key === requestedGestureKey &&
        dragGesture &&
        dragGesture.hostKey === requestedGestureKey
      ) {
        refreshHostDragWatchdog();
        unparkHostDrag();
      }
    },
    moveTouch: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      ..._extraArguments663: Dynamic[]
    ): Dynamic {
      if (hostDrag && hostDrag.key === requestedGestureKey) {
        refreshHostDragWatchdog();
      }
    },
    dropPlanAt: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      requestedX?: Dynamic,
      requestedY?: Dynamic,
      members?: Dynamic,
      options?: Dynamic,
      ..._extraArguments664: Dynamic[]
    ): Dynamic {
      if (
        !hostDrag ||
        hostDrag.key !== requestedGestureKey ||
        textEdit ||
        (refreshHostDragWatchdog(),
        (requestedX = Number(requestedX)),
        (requestedY = Number(requestedY)),
        !isFinite(requestedX) ||
          !isFinite(requestedY) ||
          !(Array as Dynamic).isArray(members) ||
          members.length === 0 ||
          members.length > 500)
      )
        return null;
      var rot: Dynamic =
        (window as Dynamic).__dcRootName && (window as Dynamic).__dcRootName();
      if (!rot) return null;
      var ref: Dynamic = [];
      if (dragGesture && dragGesture.hostKey === requestedGestureKey) {
        var top: Dynamic = currentDraggedElement();
        if (top) {
          ref.push(top);
        }
        if (dragGesture.brkFollowers) {
          var name3: Dynamic = resolveBreakoutFollowers(dragGesture);
          if (name3)
            for (var bottom in name3)
              if (name3[bottom]) {
                ref.push(name3[bottom]);
              }
        }
        if (dragGesture.followers)
          for (
            var left: Dynamic = 0;
            left < dragGesture.followers.length;
            left++
          )
            for (
              var scope: Dynamic = connectedFollowerInstances(
                  dragGesture.followers[left],
                  dragGesture.name,
                ),
                top2: Dynamic = 0;
              top2 < scope.length;
              top2++
            )
              ref.push(scope[top2]);
        if (dragGesture.group)
          for (
            var adjust: Dynamic = 0;
            adjust < dragGesture.group.length;
            adjust++
          ) {
            var axis: Dynamic = findTemplateInstances(
              String(dragGesture.group[adjust].tid),
              rot,
            )[0];
            if (axis) {
              ref.push(axis);
            }
          }
      }
      for (
        var y2: Dynamic = null, pose: Dynamic = members[0], lock: Dynamic = 0;
        lock < members.length;
        lock++
      ) {
        var paint: Dynamic = members[lock];
        if (
          !paint ||
          typeof paint.tag != "string" ||
          !isFinite(Number(paint.w)) ||
          !isFinite(Number(paint.h)) ||
          !isFinite(Number(paint.dx)) ||
          !isFinite(Number(paint.dy))
        )
          return null;
        if (!y2 || Number(paint.w) * Number(paint.h) > y2.width * y2.height) {
          y2 = {
            left: requestedX - Number(paint.w) / 2,
            top: requestedY - Number(paint.h) / 2,
            width: Number(paint.w),
            height: Number(paint.h),
          };
        }
      }
      y2.right = y2.left + y2.width;
      y2.bottom = y2.top + y2.height;
      var lastKey: Dynamic = options === "keep";
      var lim: Dynamic = {
        tag: String(pose.tag).toUpperCase(),
        origAncestorEls: [],
        startRect: y2,
        peerParent: null,
        brk: lastKey,
        followers: null,
        group: null,
        mode: lastKey ? "abs" : "flow",
        hostKey: requestedGestureKey,
      };
      var text8: Dynamic = hostDrag.placeholder;
      var value_S: Dynamic =
        text8 &&
        text8.el.isConnected &&
        text8.cel.isConnected &&
        !pointInsideRect(
          text8.cel.getBoundingClientRect(),
          requestedX,
          requestedY,
        ) &&
        (pointInsideRect(text8.rect, requestedX, requestedY) ||
          (Math.abs(requestedX - text8.at.x) <= count3 &&
            Math.abs(requestedY - text8.at.y) <= count3))
          ? text8.cel
          : null;
      var expected: Dynamic = value_S
        ? {
            el: value_S,
            tid: templateId(value_S),
          }
        : resolveDropContainer(requestedX, requestedY, lim, null, ref);
      var value_k: Dynamic =
        text8 && expected && expected.el === text8.cel
          ? text8.rect
          : expected && expected.el
            ? expected.el.getBoundingClientRect()
            : null;
      if (!expected || expected.invalid) {
        removeDropPlaceholder();
        clearFlowOverlay();
        hideParentPlacementBounds();
        return {
          container: null,
          members: [],
        };
      }
      var el: Dynamic = expected.el;
      if (
        expected.tid != null &&
        (isUneditableElement(el) ||
          isRepeatedDirectiveElement(el) ||
          el.namespaceURI === "http://www.w3.org/2000/svg")
      ) {
        removeDropPlaceholder();
        clearFlowOverlay();
        hideParentPlacementBounds();
        return {
          container: null,
          members: [],
        };
      }
      var el2: Dynamic = el.tagName;
      var startRect: Dynamic = [];
      var value_O: Dynamic =
        text8 && text8.cel === el
          ? {
              n: text8.n,
            }
          : null;
      var covered: Dynamic =
        lastKey || expected.tid == null
          ? null
          : flowInsertionPlan(
              el,
              expected.tid,
              null,
              requestedX,
              requestedY,
              value_O,
              false,
              ref,
            );
      if (
        covered &&
        expected.tid != null &&
        permitsElementNesting(el2, String(pose.tag).toUpperCase())
      ) {
        ensureDropPlaceholder(
          el,
          expected.tid,
          covered.n,
          flowChildren(el, null, ref),
          Number(pose.w),
          Number(pose.h),
          value_S
            ? text8.at
            : {
                x: requestedX,
                y: requestedY,
              },
          value_k,
        );
      } else {
        removeDropPlaceholder();
      }
      for (
        var bounds: Dynamic = el.getBoundingClientRect(),
          back: Dynamic =
            expected.tid != null ? el.clientLeft - el.scrollLeft : 0,
          x: Dynamic = expected.tid != null ? el.clientTop - el.scrollTop : 0,
          y: Dynamic =
            expected.tid != null && getComputedStyle(el).position === "static",
          K: Dynamic = 0;
        K < members.length;
        K++
      ) {
        var value_Y: Dynamic = members[K];
        if (!permitsElementNesting(el2, String(value_Y.tag).toUpperCase())) {
          startRect.push({
            tid: value_Y.tid,
            refused: "nest",
          });
          continue;
        }
        if (lastKey || expected.tid == null) {
          startRect.push({
            tid: value_Y.tid,
            targetTid: expected.tid,
            position: expected.tid == null ? "root-end" : "into",
            absolute: true,
            absStyles: {
              left:
                Math.round(
                  requestedX + Number(value_Y.dx) - bounds.left - back,
                ) + "px",
              top:
                Math.round(requestedY + Number(value_Y.dy) - bounds.top - x) +
                "px",
              width: Math.round(Number(value_Y.w)) + "px",
              height: Math.round(Number(value_Y.h)) + "px",
            },
            parentNeedsPositioning: y,
          });
        } else {
          startRect.push({
            tid: value_Y.tid,
            targetTid: covered.targetTid,
            position: covered.position,
            absolute: false,
            parentNeedsPositioning: false,
          });
        }
      }
      if (covered) {
        paintFlowInsertion(
          el,
          null,
          covered,
          ref,
          hostDrag.placeholder ? hostDrag.placeholder.n : null,
        );
      } else {
        clearFlowOverlay();
      }
      showParentPlacementBounds(
        bounds,
        expected.tid == null ? "page" : el2.toLowerCase(),
      );
      return {
        container: expected.tid,
        members: startRect,
      };
    },
    dropPlanClear: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      retainPlaceholder?: Dynamic,
      ..._extraArguments665: Dynamic[]
    ): Dynamic {
      if (!(!hostDrag || hostDrag.key !== requestedGestureKey)) {
        if (retainPlaceholder) {
          expireDropPlaceholder();
        } else {
          removeDropPlaceholder();
        }
        if (!dragGesture) {
          clearFlowOverlay();
          hideParentPlacementBounds();
        }
      }
    },
    moveSettle: function (
      this: Dynamic,
      ..._extraArguments666: Dynamic[]
    ): Dynamic {
      if (!(hostDrag && hostDrag.placeholder && hostDrag.placeholder.cap)) {
        removeDropPlaceholder();
      }
      if (!dragGesture) {
        clearStylePatches();
        for (var fillStyle: Dynamic = 0; fillStyle < items4.length; fillStyle++)
          if (items4[fillStyle].el.isConnected) {
            restoreSvgGeometry(items4[fillStyle]);
          }
        items4 = [];
        refreshChrome();
      }
    },
    exitDrag: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      copy?: Dynamic,
      ..._extraArguments667: Dynamic[]
    ): Dynamic {
      if (dragGesture && dragGesture.gestureKey === requestedGestureKey) {
        exitDragGesture(!!copy);
      }
    },
    finishExitedDrag: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      ..._extraArguments668: Dynamic[]
    ): Dynamic {
      if (
        dragGesture &&
        dragGesture.gestureKey === requestedGestureKey &&
        dragGesture.exited
      ) {
        dragGesture.droppedOut = true;
        finishDragGesture(false);
      }
    },
    abortDrag: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      ..._extraArguments669: Dynamic[]
    ): Dynamic {
      if (dragGesture && dragGesture.gestureKey === requestedGestureKey) {
        finishDragGesture(false);
      }
    },
    contextMenuAt: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      ..._extraArguments670: Dynamic[]
    ): Dynamic {
      if (!(!enabled || activeTool === "interact" || textEdit)) {
        finishTransformGesture(false);
        finishEndpointGesture(false);
        emitEditorEvent({
          type: "contextMenu",
          x: +x || 0,
          y: +y || 0,
        });
      }
    },
    contextMenuBySelection: function (
      this: Dynamic,
      ..._extraArguments671: Dynamic[]
    ): Dynamic {
      if (
        !(
          !enabled ||
          activeTool === "interact" ||
          textEdit ||
          dragGesture ||
          marqueeGesture ||
          pendingMarquee ||
          drawingGesture ||
          transformGesture ||
          endpointGesture ||
          penGesture ||
          penOverlay ||
          value_wt
        )
      ) {
        contextMenuForSelection();
      }
    },
    resizeStart: function (
      this: Dynamic,
      direction?: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      ..._extraArguments672: Dynamic[]
    ): Dynamic {
      beginResize(String(direction), +x, +y);
    },
    resizeMove: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      preserveRatio?: Dynamic,
      ..._extraArguments673: Dynamic[]
    ): Dynamic {
      updateResize(+x, +y, !!preserveRatio);
    },
    resizeWith: function (
      this: Dynamic,
      options?: Dynamic,
      ..._extraArguments674: Dynamic[]
    ): Dynamic {
      if (
        !(
          !transformGesture ||
          transformGesture.rotate ||
          transformGesture.group ||
          !options ||
          typeof options != "object"
        )
      ) {
        var innerHTML: Dynamic = {};
        ["object-fit", "object-position", "object-view-box"].forEach(function (
          this: Dynamic,
          position?: Dynamic,
          ..._extraArguments675: Dynamic[]
        ): Dynamic {
          if (
            typeof options[position] == "string" &&
            options[position].length < 120
          ) {
            innerHTML[position] = options[position];
          }
        });
        transformGesture.extra = innerHTML;
      }
    },
    resizeEnd: function (
      this: Dynamic,
      commit?: Dynamic,
      ..._extraArguments676: Dynamic[]
    ): Dynamic {
      finishTransformGesture(!!commit);
    },
    rotateStart: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      options?: Dynamic,
      ..._extraArguments677: Dynamic[]
    ): Dynamic {
      beginRotation(+y, +options);
    },
    rotateMove: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      snap?: Dynamic,
      ..._extraArguments678: Dynamic[]
    ): Dynamic {
      updateRotation(+x, +y, !!snap);
    },
    rotateEnd: function (
      this: Dynamic,
      commit?: Dynamic,
      ..._extraArguments679: Dynamic[]
    ): Dynamic {
      finishTransformGesture(!!commit);
    },
    endpointStart: function (
      this: Dynamic,
      which?: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      ..._extraArguments680: Dynamic[]
    ): Dynamic {
      beginEndpointGesture(+which == 1 ? 1 : 0, +x, +y);
    },
    endpointMove: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      snap?: Dynamic,
      ..._extraArguments681: Dynamic[]
    ): Dynamic {
      updateEndpointGesture(+x, +y, !!snap);
    },
    endpointEnd: function (
      this: Dynamic,
      commit?: Dynamic,
      ..._extraArguments682: Dynamic[]
    ): Dynamic {
      finishEndpointGesture(!!commit);
    },
    penPreview: function (
      this: Dynamic,
      points?: Dynamic,
      options?: Dynamic,
      ..._extraArguments683: Dynamic[]
    ): Dynamic {
      var position: Dynamic =
        options == null ? null : selectedFreehandPath(points);
      if (value_wt && value_wt.el !== position) {
        value_wt.path.setAttribute("d", value_wt.origD);
        value_wt = null;
      }
      if (
        !(
          !position ||
          typeof options != "string" ||
          !/^[MLC\d\s.,-]+$/.test(options) ||
          options.length > 1e5
        )
      ) {
        var shaft: Dynamic = editableFreehandPath(position);
        if (!value_wt) {
          value_wt = {
            el: position,
            path: shaft.path,
            origD: shaft.d,
          };
        }
        shaft.path.setAttribute("d", options);
      }
    },
    penCommit: function (
      this: Dynamic,
      parentId?: Dynamic,
      points?: Dynamic,
      width?: Dynamic,
      height?: Dynamic,
      styles?: Dynamic,
      options?: Dynamic,
      ..._extraArguments684: Dynamic[]
    ): Dynamic {
      var ref: Dynamic = selectedFreehandPath(parentId);
      if (value_wt) {
        value_wt.path.setAttribute("d", value_wt.origD);
        value_wt = null;
      }
      if (
        !(
          !ref ||
          typeof options != "string" ||
          !/^[MLC\d\s.,-]+$/.test(options) ||
          options.length > 1e5 ||
          ![points, width, height, styles].every(function (
            this: Dynamic,
            scope?: Dynamic,
            ..._extraArguments685: Dynamic[]
          ): Dynamic {
            return typeof scope == "number" && isFinite(scope);
          })
        )
      ) {
        var top: Dynamic = ref.getBoundingClientRect();
        var name3: Dynamic = elementLayoutDimensions(ref).w / top.width || 1;
        var bottom: Dynamic =
          Math.round(
            ((parseFloat(ref.style.left) || 0) + (points - top.left) * name3) *
              10,
          ) / 10;
        var left: Dynamic =
          Math.round(
            ((parseFloat(ref.style.top) || 0) + (width - top.top) * name3) * 10,
          ) / 10;
        height = Math.max(1, Math.round(height));
        styles = Math.max(1, Math.round(styles));
        ref.style.left = bottom + "px";
        ref.style.top = left + "px";
        ref.style.width = height + "px";
        ref.style.height = styles + "px";
        ref.setAttribute("width", String(height));
        ref.setAttribute("height", String(styles));
        ref.setAttribute("viewBox", "0 0 " + height + " " + styles);
        editableFreehandPath(ref).path.setAttribute("d", options);
        emitEditorEvent({
          type: "strokeEndpoint",
          tid: parentId,
          name: componentScopeName(ref),
          gestureKey: "g" + Date.now(),
          left: bottom,
          top: left,
          width: height,
          height: styles,
          d: options,
          isArrow: false,
        });
        refreshChrome();
      }
    },
    setHostScale: function (
      this: Dynamic,
      scale?: Dynamic,
      ..._extraArguments686: Dynamic[]
    ): Dynamic {
      var innerHTML: Dynamic = Number(scale);
      var position: Dynamic =
        isFinite(innerHTML) && innerHTML > 0 ? innerHTML : 1;
      if (position !== hostScale) {
        hostScale = position;
        (document as Dynamic).documentElement.style.setProperty(
          "--dc-chrome-unit",
          1 / hostScale + "px",
        );
      }
    },
    setTextEditable: function (
      this: Dynamic,
      templates?: Dynamic,
      componentName?: Dynamic,
      imports?: Dynamic,
      metadata?: Dynamic,
      scriptTargets?: Dynamic,
      ..._extraArguments687: Dynamic[]
    ): Dynamic {
      textEditableTemplates = {};
      state4 = {};
      items = imports || [];
      state5 = metadata || {};
      state6 = {};
      (scriptTargets || []).forEach(function (
        this: Dynamic,
        rot?: Dynamic,
        ..._extraArguments688: Dynamic[]
      ): Dynamic {
        state6[templateKey(rot.tid, componentName)] = rot.targets;
      });
      textMapReady = true;
      (templates || []).forEach(function (
        this: Dynamic,
        rot?: Dynamic,
        ..._extraArguments689: Dynamic[]
      ): Dynamic {
        var ref: Dynamic = typeof rot == "number" ? rot : rot.tid;
        textEditableTemplates[templateKey(ref, componentName)] = true;
        if (rot && rot.seed != null) {
          state4[templateKey(ref, componentName)] = rot.seed;
        }
      });
      replayPendingDoubleClick();
      replayPendingTextTarget();
      if (insertedTextWatch) {
        insertedTextWatch.mapped = true;
        reconcileInsertedText();
      }
    },
    setDirectiveMap: function (
      this: Dynamic,
      directives?: Dynamic,
      componentName?: Dynamic,
      ..._extraArguments690: Dynamic[]
    ): Dynamic {
      directiveMap = directives || null;
      directiveComponentName = componentName || null;
      emitDirectiveState(true);
      repaintSelection();
    },
    setMeasure: function (
      this: Dynamic,
      requestedEnabled?: Dynamic,
      ..._extraArguments691: Dynamic[]
    ): Dynamic {
      if (enabled) {
        setMeasurementEnabled(requestedEnabled);
      }
    },
    setDeep: function (
      this: Dynamic,
      requestedEnabled?: Dynamic,
      ..._extraArguments692: Dynamic[]
    ): Dynamic {
      if (enabled) {
        setDeepPickingEnabled(requestedEnabled);
      }
    },
    setReadOnly: function (
      this: Dynamic,
      requestedReadOnly?: Dynamic,
      ..._extraArguments693: Dynamic[]
    ): Dynamic {
      readOnly = !!requestedReadOnly;
      if (readOnly) {
        if (activeTool !== "select") {
          __dcEditorPicker.setTool("select");
        }
        pendingDoubleClick = null;
        pendingTextTarget = null;
        cancelInsertedTextWatch();
        if (textEdit) {
          finishTextEdit(false);
        }
        if (hostDrag) {
          finishHostDrag(false);
        }
        if (dragGesture) {
          finishDragGesture(false);
        }
        finishShapeDrawing(false);
        finishTransformGesture(false);
        finishEndpointGesture(false);
        finishPenStroke(false);
        finishPenDrawing(false, false);
        cancelPendingInserts();
        value_St = null;
        pendingMarquee = null;
        finishMarquee(true);
        hidePlacementOverlay();
      }
    },
    setTool: function (
      this: Dynamic,
      tool?: Dynamic,
      freehand?: Dynamic,
      ..._extraArguments694: Dynamic[]
    ): Dynamic {
      var position: Dynamic = readOnly ? "select" : tool || "select";
      if (activeTool === "draw" && position !== "draw") {
        finishPenDrawing(true, false);
      }
      if (freehand !== undefined && !!freehand !== freehandMode) {
        freehandMode = !!freehand;
        __dcEditorPicker.penPreview(null);
        refreshChrome();
      }
      activeTool = position;
      if (activeTool === "select") {
        (document as Dynamic).body.removeAttribute("data-dc-editor-tool");
      } else {
        (document as Dynamic).body.setAttribute(
          "data-dc-editor-tool",
          activeTool,
        );
      }
      (document as Dynamic).body.style.cursor = TOOL_CURSORS[activeTool] || "";
      if (
        activeTool !== "rect" &&
        activeTool !== "oval" &&
        activeTool !== "frame" &&
        activeTool !== "grid" &&
        activeTool !== "text"
      ) {
        hidePlacementOverlay();
        clearGapOverlay();
      }
      if (activeTool !== "select") {
        clearHover();
      }
      updateTouchPolicy();
    },
    patchStyle: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      styles?: Dynamic,
      key?: Dynamic,
      ..._extraArguments695: Dynamic[]
    ): Dynamic {
      if (
        !(
          !styles ||
          typeof styles != "object" ||
          !(Array as Dynamic).isArray(componentName) ||
          !isRootComponent(requestedTemplateId)
        )
      ) {
        var tag: Dynamic =
          heldStyle &&
          heldStyle.name === requestedTemplateId &&
          heldStyle.tids.join(",") === componentName.join(",");
        heldStyle = {
          name: requestedTemplateId,
          tids: componentName,
          styles: (Object as Dynamic).assign(
            tag ? heldStyle.styles : {},
            styles,
          ),
          token: key || null,
        };
        reapplyHeldStyles();
        refreshChrome();
      }
    },
    holdStyle: function (
      this: Dynamic,
      templateIds?: Dynamic,
      componentName?: Dynamic,
      styles?: Dynamic,
      key?: Dynamic,
      ..._extraArguments696: Dynamic[]
    ): Dynamic {
      if (
        !(
          !styles ||
          typeof styles != "object" ||
          !(Array as Dynamic).isArray(componentName) ||
          !isRootComponent(templateIds)
        )
      ) {
        var tag: Dynamic = {};
        ["object-fit", "object-position", "object-view-box"].forEach(function (
          this: Dynamic,
          left?: Dynamic,
          ..._extraArguments697: Dynamic[]
        ): Dynamic {
          if (typeof styles[left] == "string" && styles[left].length < 120) {
            tag[left] = styles[left];
          }
        });
        heldStyle = {
          name: templateIds,
          tids: componentName,
          styles: tag,
          token: key || null,
        };
        for (var rot: Dynamic = 0; rot < componentName.length; rot++)
          for (
            var ref: Dynamic =
                stylePatches[templateIds + "|" + componentName[rot]],
              top: Dynamic = findTemplateInstances(
                String(componentName[rot]),
                templateIds,
              ),
              name3: Dynamic = 0;
            name3 < top.length;
            name3++
          ) {
            var bottom: Dynamic = top[name3].getAttribute(
              "data-dc-editor-patch",
            );
            if (bottom && !(ref && ref.id === bottom) && hasStylePatch(bottom))
              return;
          }
        reapplyHeldStyles();
        refreshChrome();
      }
    },
    unpatchStyle: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      key?: Dynamic,
      ..._extraArguments698: Dynamic[]
    ): Dynamic {
      if (
        !(
          !(Array as Dynamic).isArray(componentName) ||
          (heldStyle && heldStyle.token !== key)
        )
      ) {
        for (var shaft: Dynamic = 0; shaft < componentName.length; shaft++) {
          var tag: Dynamic =
            stylePatches[requestedTemplateId + "|" + componentName[shaft]];
          if (tag) {
            tag.style.cssText = "";
          }
        }
        heldStyle = null;
        refreshChrome();
      }
    },
    setScrubbing: function (
      this: Dynamic,
      scrubbing?: Dynamic,
      ..._extraArguments699: Dynamic[]
    ): Dynamic {
      value_Vl = !!scrubbing;
      if (!scrubbing) {
        heldStyle = null;
      }
    },
    afterPush: afterPush,
    dropLeftCopy: dropLeftCopy,
    setOverlayHidden: function (
      this: Dynamic,
      hidden?: Dynamic,
      ..._extraArguments700: Dynamic[]
    ): Dynamic {
      if (hidden) {
        (document as Dynamic).body.setAttribute(
          "data-dc-editor-overlay-hidden",
          "",
        );
      } else {
        (document as Dynamic).body.removeAttribute(
          "data-dc-editor-overlay-hidden",
        );
      }
      if (canvasScrollbars) {
        canvasScrollbars.root.style.display = hidden ? "none" : "";
      }
      refreshChrome();
    },
    startTextEdit: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      caret?: Dynamic,
      ..._extraArguments701: Dynamic[]
    ): Dynamic {
      var shaft: Dynamic = findTemplateInstances(
        String(requestedTemplateId),
        componentName || null,
      );
      if (textEdit && shaft.indexOf(textEdit.svg || textEdit.el) >= 0) {
        focusTextEditor(caret);
        return;
      }
      if (shaft.length > 0) {
        beginTemplateTextEdit(shaft[0], null, null, caret);
      }
    },
    textPlacing: function (
      this: Dynamic,
      ..._extraArguments702: Dynamic[]
    ): Dynamic {
      index18 = performance.now() + 500;
    },
    noteTextInsert: function (
      this: Dynamic,
      ..._extraArguments703: Dynamic[]
    ): Dynamic {
      for (
        var fillStyle: Dynamic = (document as Dynamic).querySelectorAll(
            "[data-dc-tpl]",
          ),
          innerHTML: Dynamic = new WeakSet(),
          position: Dynamic = 0;
        position < fillStyle.length;
        position++
      )
        innerHTML.add(fillStyle[position]);
      value_$r = {
        n: fillStyle.length,
        at: Date.now(),
        seen: innerHTML,
      };
    },
    startInsertedTextEdit: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      typed?: Dynamic,
      deadline?: Dynamic,
      ..._extraArguments704: Dynamic[]
    ): Dynamic {
      watchInsertedText(requestedTemplateId, componentName, typed, deadline);
    },
    heldTextKey: heldTextKey,
    dropInsertedTextEdit: function (
      this: Dynamic,
      requestedGestureKey?: Dynamic,
      ..._extraArguments705: Dynamic[]
    ): Dynamic {
      value_$r = null;
      if (
        requestedGestureKey &&
        insertedTextWatch &&
        Date.now() <= insertedTextWatch.until
      ) {
        insertedTextWatch.typed = "";
      } else {
        cancelInsertedTextWatch();
      }
    },
    startTextEditAt: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      mode?: Dynamic,
      selectedIds?: Dynamic,
      ..._extraArguments706: Dynamic[]
    ): Dynamic {
      var tag: Dynamic = (document as Dynamic).elementFromPoint(x, y);
      var rot: Dynamic =
        tag && tag.closest ? tag.closest("[data-dc-tpl]") : null;
      var ref: Dynamic =
        rot &&
        normalizeComponentHit(rot) === rot &&
        textEditableTemplates[
          templateKey(
            parseInt(rot.getAttribute("data-dc-tpl"), 10),
            nearestComponentName(rot),
          )
        ];
      if (!ref && mode != null) {
        rot =
          findTemplateInstances(String(mode), selectedIds || null)[0] || null;
      }
      if (!(!rot || normalizeComponentHit(rot) !== rot)) {
        var top: Dynamic = parseInt(rot.getAttribute("data-dc-tpl"), 10);
        if (
          textEditableTemplates[templateKey(top, nearestComponentName(rot))]
        ) {
          clearForeignSelection();
          selectedTemplateIds = [top];
          selectedPart = null;
          selectedComponentName = componentScopeName(rot);
          repaintSelection();
          emitSelection(rot.tagName.toLowerCase());
          beginTemplateTextEdit(rot, x, y);
        }
      }
    },
    clearPart: function (
      this: Dynamic,
      ..._extraArguments707: Dynamic[]
    ): Dynamic {
      selectedPart = null;
      repaintSelection();
      var fillStyle: Dynamic =
        selectedTemplateIds.length === 1
          ? findTemplateInstances(selectedTemplateIds[0], selectedComponentName)
          : [];
      emitSelection(
        fillStyle.length ? sourceElementTag(fillStyle[0]) : undefined,
      );
    },
    repaintSelected: function (
      this: Dynamic,
      ..._extraArguments708: Dynamic[]
    ): Dynamic {
      repaintSelection();
      if (foreignSelection && foreignSelection.isConnected) {
        foreignSelection.setAttribute("data-dc-editor-selected", "");
        refreshChrome();
      }
    },
    select: function (
      this: Dynamic,
      templateIds?: Dynamic,
      componentName?: Dynamic,
      reason?: Dynamic,
      sequence?: Dynamic,
      ..._extraArguments709: Dynamic[]
    ): Dynamic {
      if (
        !marqueeGesture &&
        !(typeof sequence == "number" && sequence < index6)
      ) {
        if (
          (templateIds == null ||
            ((Array as Dynamic).isArray(templateIds) &&
              templateIds.length === 0)) &&
          pendingDrag &&
          !dragGesture
        ) {
          pendingDrag = null;
          value_lt = null;
        }
        clearForeignSelection();
        var tag: Dynamic = (Array as Dynamic).isArray(templateIds)
          ? templateIds.slice()
          : templateIds == null
            ? []
            : [templateIds];
        var rot: Dynamic = (tag.length && componentName) || null;
        var ref: Dynamic =
          tag.length === selectedTemplateIds.length &&
          rot === selectedComponentName &&
          tag.every(function (
            this: Dynamic,
            bottom?: Dynamic,
            left?: Dynamic,
            ..._extraArguments710: Dynamic[]
          ): Dynamic {
            return bottom === selectedTemplateIds[left];
          });
        if (!ref) {
          value_je = false;
        }
        selectedTemplateIds = tag;
        if (!ref) {
          selectedPart = null;
        }
        selectedComponentName = rot;
        repaintSelection();
        if (!ref) {
          emitSelection(
            undefined,
            typeof reason == "string" ? reason : undefined,
            false,
            true,
          );
        }
        if (value_Ke) {
          clearTimeout(value_Ja);
          for (var top in value_Ke.s) {
            var name3: Dynamic = findTemplateInstances(top, value_Ke.name)[0];
            if (name3) {
              name3.scrollTop = value_Ke.s[top].t;
              name3.scrollLeft = value_Ke.s[top].l;
            }
          }
          value_Ke = null;
        }
      }
    },
    hover: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      ..._extraArguments711: Dynamic[]
    ): Dynamic {
      setHoveredTemplate(requestedTemplateId, componentName);
    },
    hoverAt: function (
      this: Dynamic,
      x?: Dynamic,
      y?: Dynamic,
      selectedIds?: Dynamic,
      deep?: Dynamic,
      textIds?: Dynamic,
      ..._extraArguments712: Dynamic[]
    ): Dynamic {
      if (!(!ringsOnlyEnabled && !enabled)) {
        var rot: Dynamic = Number(x);
        var ref: Dynamic = Number(y);
        if (isFinite(rot) && isFinite(ref)) {
          lastPointer = {
            x: rot,
            y: ref,
          };
        }
        var top: Dynamic =
          isFinite(rot) && isFinite(ref)
            ? (document as Dynamic).elementFromPoint(rot, ref)
            : null;
        var name3: Dynamic = (Array as Dynamic).isArray(selectedIds)
          ? selectedIds.filter(function (
              this: Dynamic,
              scope?: Dynamic,
              ..._extraArguments713: Dynamic[]
            ): Dynamic {
              return typeof scope == "number" && isFinite(scope);
            })
          : [];
        var bottom: Dynamic = resolvePickTarget(
          top,
          deep ? "deep" : "plain",
          name3,
        );
        if (!bottom) {
          hoverArtboard(!!top && (!!deep || isUnselectedEmptyArtboard(name3)));
          return;
        }
        if (bottom.page) {
          hoverArtboard(true);
          return;
        }
        var left: Dynamic =
          (!deep && resolveTextPickTarget(bottom.el, bottom.hit, textIds)) ||
          bottom.el;
        setHoveredTemplate(
          left.getAttribute("data-dc-tpl"),
          componentScopeName(left),
        );
      }
    },
    finishEdit: function (
      this: Dynamic,
      ..._extraArguments714: Dynamic[]
    ): Dynamic {
      return detachTextEditor();
    },
    repostTextEditState: function (
      this: Dynamic,
      ..._extraArguments715: Dynamic[]
    ): Dynamic {
      emitTextEditState(true);
    },
    format: function (
      this: Dynamic,
      command?: Dynamic,
      value?: Dynamic,
      ..._extraArguments716: Dynamic[]
    ): Dynamic {
      if (
        !(
          !textEdit ||
          textEdit.scriptTarget ||
          textEdit.propTarget ||
          textEdit.importTarget ||
          textEdit.svg
        ) &&
        !(value != null && editedTemplateId() !== value)
      ) {
        var position: Dynamic = state31[command];
        if (position) {
          try {
            textEdit.el.focus();
          } catch {}
          position();
          emitTextEditState(true);
        }
      }
    },
    applyLink: function (
      this: Dynamic,
      href?: Dynamic,
      ..._extraArguments717: Dynamic[]
    ): Dynamic {
      if (textEdit) {
        if (!value_bt) {
          __dcEditorPicker.cancelLinkEdit();
          return;
        }
        var innerHTML: Dynamic = null;
        try {
          textEdit.el.focus();
          var position: Dynamic = getSelection();
          var shaft: Dynamic = value_bt.commonAncestorContainer;
          var tag: Dynamic =
            shaft && (shaft.nodeType === 1 ? shaft : shaft.parentElement);
          var rot: Dynamic = tag && tag.closest ? tag.closest("a") : null;
          var ref: Dynamic =
            rot && textEdit.el !== rot && textEdit.el.contains(rot)
              ? rot
              : null;
          var top: Dynamic = rot && !ref ? rot : null;
          if (href == null || href === "") {
            var name3: Dynamic = value_bt.collapsed;
            var bottom: Dynamic = null;
            var left: Dynamic = null;
            if (!name3) {
              left = (document as Dynamic).createTextNode("");
              var scope: Dynamic = value_bt.cloneRange();
              scope.collapse(false);
              scope.insertNode(left);
              bottom = (document as Dynamic).createTextNode("");
              var top2: Dynamic = value_bt.cloneRange();
              top2.collapse(true);
              top2.insertNode(bottom);
            }
            var adjust: Dynamic = [];
            if (ref) {
              adjust.push(ref);
            }
            for (
              var axis: Dynamic = textEdit.el.querySelectorAll("a"),
                y2: Dynamic = 0;
              y2 < axis.length;
              y2++
            )
              if (
                adjust.indexOf(axis[y2]) === -1 &&
                value_bt.intersectsNode(axis[y2])
              ) {
                adjust.push(axis[y2]);
              }
            for (var pose: Dynamic = 0; pose < adjust.length; pose++) {
              var lock: Dynamic = adjust[pose];
              if (!(lock === textEdit.el || !textEdit.el.contains(lock))) {
                value_Io(lock, bottom, left);
              }
            }
            if (bottom && bottom.parentNode) {
              bottom.parentNode.removeChild(bottom);
            }
            if (left && left.parentNode) {
              left.parentNode.removeChild(left);
            }
          } else if (ref) {
            ref.setAttribute("href", href);
            if (!textEdit.foreign) {
              innerHTML = ref;
            }
          } else if (!value_bt.collapsed && !top) {
            var paint: Dynamic = (document as Dynamic).createTextNode("");
            var lastKey: Dynamic = value_bt.cloneRange();
            lastKey.collapse(false);
            lastKey.insertNode(paint);
            var lim: Dynamic = (document as Dynamic).createTextNode("");
            var text8: Dynamic = value_bt.cloneRange();
            text8.collapse(true);
            text8.insertNode(lim);
            for (
              var value_S: Dynamic = textEdit.el.querySelectorAll("a"),
                expected: Dynamic = 0;
              expected < value_S.length;
              expected++
            ) {
              var value_k: Dynamic = value_S[expected];
              if (
                !(value_k === textEdit.el || !textEdit.el.contains(value_k))
              ) {
                if (value_bt.intersectsNode(value_k)) {
                  value_Io(value_k, lim, paint);
                }
              }
            }
            value_bt.setStartAfter(lim);
            value_bt.setEndBefore(paint);
            var value_N: Dynamic = (document as Dynamic).createElement("a");
            value_N.setAttribute("href", href);
            try {
              value_bt.surroundContents(value_N);
            } catch {
              var el: Dynamic = value_bt.extractContents();
              value_N.appendChild(el);
              value_bt.insertNode(value_N);
            }
            try {
              position.removeAllRanges();
              var startRect: Dynamic = (document as Dynamic).createRange();
              startRect.setStartAfter(value_N);
              startRect.collapse(true);
              position.addRange(startRect);
            } catch {}
            if (lim.parentNode) {
              lim.parentNode.removeChild(lim);
            }
            if (paint.parentNode) {
              paint.parentNode.removeChild(paint);
            }
            if (!textEdit.foreign) {
              innerHTML = value_N;
            }
          }
        } catch {}
        value_bt = null;
        if (innerHTML) {
          try {
            innerHTML.setAttribute("data-dc-link-new", "");
          } catch {}
          finishTextEdit();
          return;
        }
        emitTextEditState(true);
      }
    },
    cancelLinkEdit: function (
      this: Dynamic,
      ..._extraArguments718: Dynamic[]
    ): Dynamic {
      value_bt = null;
      if (!!textEdit) {
        try {
          textEdit.el.focus();
        } catch {}
        emitTextEditState(true);
      }
    },
    deleteForeign: function (
      this: Dynamic,
      ..._extraArguments719: Dynamic[]
    ): Dynamic {
      if (!foreignSelection || !foreignSelection.parentElement) return null;
      if (
        textEdit &&
        (textEdit.el === foreignSelection ||
          foreignSelection.contains(textEdit.el))
      ) {
        value_bt = null;
        textEdit.el.removeEventListener("input", onTextEditInput);
        textEdit.el.removeEventListener("paste", onTextEditPaste);
        (document as Dynamic).removeEventListener(
          "selectionchange",
          scheduleTextEditState,
        );
        if (textEdit.origCE != null) {
          textEdit.el.setAttribute("contenteditable", textEdit.origCE);
        } else {
          textEdit.el.removeAttribute("contenteditable");
        }
        textEdit.el.removeAttribute("data-dc-editor-editing");
        restoreEditorAccessibility(textEdit.el);
        textEdit.el.innerHTML = textEdit.startHtml;
        textEdit = null;
        emitTextEditState(false);
      }
      foreignSelection.removeAttribute("data-dc-editor-selected");
      foreignSelection.removeAttribute("data-dc-editor-hover");
      foreignSelection.removeAttribute("data-dc-editor-hover-stroke");
      var fillStyle: Dynamic = {
        tag: foreignSelection.tagName.toLowerCase(),
        html: foreignSelection.outerHTML.slice(0, 4e3),
        text: (foreignSelection.innerText || "").slice(0, 4e3),
      };
      foreignSelection.parentElement.removeChild(foreignSelection);
      foreignSelection = null;
      return fillStyle;
    },
    stampLive: function (
      this: Dynamic,
      payload?: Dynamic,
      ..._extraArguments720: Dynamic[]
    ): Dynamic {
      var innerHTML: Dynamic = 0;
      function position(
        this: Dynamic,
        top?: Dynamic,
        ..._extraArguments721: Dynamic[]
      ): Dynamic {
        if (top.nodeType === 1) {
          if (top.hasAttribute("data-dc-editor-overlay")) return;
          top.setAttribute("data-dc-tpl", String(innerHTML));
          innerHTML++;
        }
        for (var name3: Dynamic = 0; name3 < top.childNodes.length; name3++)
          position(top.childNodes[name3]);
      }
      for (
        var shaft: Dynamic = 0;
        shaft < (document as Dynamic).body.childNodes.length;
        shaft++
      )
        position((document as Dynamic).body.childNodes[shaft]);
      (document as Dynamic).body.setAttribute("data-sc-name", payload);
      for (
        var tag: Dynamic = (document as Dynamic).body.cloneNode(true),
          rot: Dynamic = tag.querySelectorAll("[data-dc-editor-overlay]"),
          ref: Dynamic = 0;
        ref < rot.length;
        ref++
      )
        rot[ref].parentNode.removeChild(rot[ref]);
      return tag.innerHTML;
    },
    applyBody: function (
      this: Dynamic,
      html?: Dynamic,
      keepScroll?: Dynamic,
      ..._extraArguments722: Dynamic[]
    ): Dynamic {
      var position: Dynamic =
        (document as Dynamic).scrollingElement ||
        (document as Dynamic).documentElement;
      var shaft: Dynamic = position ? position.scrollLeft : 0;
      var tag: Dynamic = position ? position.scrollTop : 0;
      if (textEdit) {
        finishTextEdit();
      }
      (document as Dynamic).body.innerHTML = html;
      __dcEditorPicker.stampLive(keepScroll);
      repaintSelection();
      refreshChrome();
      if (position) {
        position.scrollLeft = shaft;
        position.scrollTop = tag;
      }
    },
    bodySnapshot: function (
      this: Dynamic,
      ..._extraArguments723: Dynamic[]
    ): Dynamic {
      var fillStyle: Dynamic = {
        SCRIPT: 1,
        STYLE: 1,
        NOSCRIPT: 1,
      };
      function innerHTML(
        this: Dynamic,
        shaft?: Dynamic,
        tag?: Dynamic,
        rot?: Dynamic,
        ..._extraArguments724: Dynamic[]
      ): Dynamic {
        if (
          !(
            shaft.hasAttribute &&
            (shaft.hasAttribute("data-dc-editor-overlay-root") ||
              shaft.hasAttribute("data-dc-editor-overlay") ||
              shaft.hasAttribute("data-dc-editor-style"))
          )
        ) {
          for (
            var ref: Dynamic = "  ".repeat(tag),
              top: Dynamic = shaft.tagName.toLowerCase(),
              name3: Dynamic = ref + "<" + top,
              bottom: Dynamic = 0;
            bottom < shaft.attributes.length;
            bottom++
          ) {
            var left: Dynamic = shaft.attributes[bottom];
            if (
              left.name.indexOf("data-dc-editor-") !== 0 &&
              left.name !== "contenteditable"
            ) {
              if (
                !(
                  left.name === "data-dc-tpl" ||
                  left.name === "data-sc-name" ||
                  (left.name === "style" && shaft === panZoomRoot()) ||
                  ((left.name === "role" ||
                    left.name === "aria-label" ||
                    left.name === "aria-multiline") &&
                    authoredAccessibilityAttribute(shaft, left.name) == null)
                )
              ) {
                name3 +=
                  " " +
                  left.name +
                  '="' +
                  left.value.replace(/"/g, "&quot;").replace(/\n/g, " ") +
                  '"';
              }
            }
          }
          rot.push(name3 + ">");
          if (fillStyle[shaft.tagName]) rot.push(ref + "  \u2026");
          else
            for (
              var scope: Dynamic = 0;
              scope < shaft.childNodes.length;
              scope++
            ) {
              var top2: Dynamic = shaft.childNodes[scope];
              if (top2.nodeType === 1) innerHTML(top2, tag + 1, rot);
              else if (top2.nodeType === 3) {
                var adjust: Dynamic = top2.textContent
                  .replace(/\s+/g, " ")
                  .trim();
                if (adjust) {
                  rot.push(ref + "  " + adjust);
                }
              }
            }
          rot.push(ref + "</" + top + ">");
        }
      }
      var position: Dynamic = [];
      innerHTML((document as Dynamic).body, 0, position);
      return position.join(`
`);
    },
    firstTextFont: function (
      this: Dynamic,
      ..._extraArguments725: Dynamic[]
    ): Dynamic {
      try {
        for (
          var fillStyle: Dynamic = (document as Dynamic).querySelectorAll(
              "p, label, a",
            ),
            innerHTML: Dynamic = 0;
          innerHTML < fillStyle.length;
          innerHTML++
        ) {
          var position: Dynamic = fillStyle[innerHTML];
          if (
            !position.closest(
              "[data-dc-editor-overlay],[data-dc-editor-overlay-root]",
            )
          ) {
            var shaft: Dynamic = position.getBoundingClientRect();
            if (
              !(shaft.width <= 0 || shaft.height <= 0) &&
              !(
                shaft.bottom < 0 ||
                shaft.top > innerHeight ||
                shaft.right < 0 ||
                shaft.left > innerWidth
              )
            )
              return getComputedStyle(position).fontFamily || null;
          }
        }
      } catch {}
      return null;
    },
    inspect: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      properties?: Dynamic,
      normalizeColors?: Dynamic,
      inherited?: Dynamic,
      ground?: Dynamic,
      requestedPose?: Dynamic,
      ..._extraArguments726: Dynamic[]
    ): Dynamic {
      var top: Dynamic = findTemplateInstances(
        String(requestedTemplateId),
        componentName || null,
      );
      if (top.length === 0)
        return requestedPose
          ? {
              tag: "",
              instances: 0,
              computed: {},
              parent: null,
              rendered: false,
              missing: true,
            }
          : null;
      var name3: Dynamic = top[0];
      var bottom: Dynamic = getComputedStyle(name3);
      var left: Dynamic = null;
      if (inherited) {
        var scope: Dynamic = function (
          this: Dynamic,
          lastKey?: Dynamic,
          lim?: Dynamic,
          ..._extraArguments727: Dynamic[]
        ): Dynamic {
          for (
            var text8: Dynamic = {}, index21: Dynamic = 0;
            index21 < properties.length;
            index21++
          ) {
            var expected: Dynamic = properties[index21];
            var value_k: Dynamic = lastKey.style.getPropertyValue(expected);
            var value_N: Dynamic = lastKey.style.getPropertyPriority(expected);
            if (!value_k) return null;
            lastKey.style.removeProperty(expected);
            text8[expected] = lim.getPropertyValue(expected);
            lastKey.style.setProperty(expected, value_k, value_N);
          }
          return text8;
        };
        left = withTemporaryClone(name3, scope);
        if (left === undefined) {
          left = scope(name3, bottom);
        }
        if (!left) return null;
      }
      for (
        var top2: Dynamic = {}, adjust: Dynamic = 0;
        adjust < properties.length;
        adjust++
      ) {
        var axis: Dynamic = properties[adjust];
        top2[axis] = left
          ? left[axis]
          : axis.indexOf("-") >= 0
            ? bottom.getPropertyValue(axis)
            : bottom[axis];
        if (normalizeColors && /color|fill|stroke/i.test(axis)) {
          top2[axis] = normalizeColor(top2[axis]);
        }
      }
      var y2: Dynamic = null;
      if (name3.parentElement) {
        var pose: Dynamic = getComputedStyle(name3.parentElement);
        y2 = {
          display: pose.display,
          flexDirection: pose.flexDirection,
        };
      }
      var lock: Dynamic =
        typeof name3.checkVisibility == "function"
          ? name3.checkVisibility({
              visibilityProperty: true,
              checkVisibilityCSS: true,
            })
          : name3.getClientRects().length > 0 && bottom.visibility !== "hidden";
      var paint: Dynamic = {
        tag: name3.tagName.toLowerCase(),
        instances: top.length,
        computed: top2,
        parent: y2,
        rendered: lock,
      };
      if (ground) {
        paint.ground = textGroundColors(name3, bottom);
      }
      if (requestedPose) {
        paint.pose =
          bottom.display === "contents"
            ? {
                boxless: true,
              }
            : lock
              ? computedBoxDimensions(
                  paint.tag,
                  name3.offsetWidth,
                  name3.offsetHeight,
                  bottom,
                )
              : null;
      }
      return paint;
    },
    verify: function (
      this: Dynamic,
      requestedTemplateId?: Dynamic,
      componentName?: Dynamic,
      styles?: Dynamic,
      ..._extraArguments728: Dynamic[]
    ): Dynamic {
      var shaft: Dynamic = {
        parentMismatches: [],
        unknownTids: [],
        missingTids: [],
        orderMismatches: [],
      };
      var tag: Dynamic = {};
      var rot: Dynamic = (document as Dynamic).querySelectorAll(
        "[data-dc-tpl]",
      );
      function ref(
        this: Dynamic,
        input?: Dynamic,
        ..._extraArguments729: Dynamic[]
      ): Dynamic {
        for (var el: Dynamic = input.parentElement; el; ) {
          if (el.hasAttribute("data-sc-name")) return null;
          if (
            el.hasAttribute("data-dc-tpl") &&
            nearestComponentName(el) === requestedTemplateId
          )
            return parseInt(el.getAttribute("data-dc-tpl"), 10);
          el = el.parentElement;
        }
        return null;
      }
      for (var top: Dynamic = 0; top < rot.length; top++) {
        var name3: Dynamic = rot[top];
        if (!name3.closest("[data-dc-editor-overlay]")) {
          var bottom: Dynamic = name3.hasAttribute("data-sc-name")
            ? name3.parentElement
              ? nearestComponentName(name3.parentElement)
              : null
            : nearestComponentName(name3);
          if (bottom === requestedTemplateId) {
            var left: Dynamic = parseInt(name3.getAttribute("data-dc-tpl"), 10);
            tag[left] = true;
            if (!(left in componentName)) {
              if (shaft.unknownTids.indexOf(left) === -1) {
                shaft.unknownTids.push(left);
              }
              continue;
            }
            var scope: Dynamic = ref(name3);
            var top2: Dynamic = componentName[left];
            if (scope !== top2) {
              shaft.parentMismatches.push({
                tid: left,
                tag: name3.tagName.toLowerCase(),
                expectedParent: top2,
                actualParent: scope,
              });
            }
          }
        }
      }
      for (var adjust in componentName)
        if (!tag[adjust]) {
          shaft.missingTids.push(parseInt(adjust, 10));
        }
      for (
        var axis: Dynamic = (document as Dynamic).querySelectorAll(
            "[data-dc-tpl]",
          ),
          y2: Dynamic = 0;
        y2 < axis.length;
        y2++
      ) {
        var pose: Dynamic = axis[y2];
        if (
          !(
            nearestComponentName(pose) !== requestedTemplateId ||
            pose.closest("[data-dc-editor-overlay]")
          )
        ) {
          var lock: Dynamic = parseInt(pose.getAttribute("data-dc-tpl"), 10);
          var paint: Dynamic = styles[lock];
          if (paint) {
            for (
              var lastKey: Dynamic = [], lim: Dynamic = 0;
              lim < pose.children.length;
              lim++
            ) {
              var text8: Dynamic = pose.children[lim];
              if (
                !(
                  !text8.hasAttribute("data-dc-tpl") ||
                  text8.closest("[data-dc-editor-overlay]")
                )
              ) {
                lastKey.push(parseInt(text8.getAttribute("data-dc-tpl"), 10));
              }
            }
            var value_S: Dynamic = lastKey.length === new Set(lastKey).size;
            if (value_S) {
              for (
                var expected: Dynamic = [], index21: Dynamic = 0;
                index21 < paint.length;
                index21++
              )
                if (lastKey.indexOf(paint[index21]) !== -1) {
                  expected.push(paint[index21]);
                }
              if (expected.join(",") !== lastKey.join(",")) {
                shaft.orderMismatches.push({
                  parent: lock,
                  expected: expected,
                  actual: lastKey,
                });
              }
              if (shaft.orderMismatches.length > 5) break;
            }
          }
        }
      }
      return shaft;
    },
  };
  if (
    (document as Dynamic).documentElement.hasAttribute("data-dc-frameless") &&
    typeof ResizeObserver == "function"
  ) {
    var index19: Dynamic = 0;
    var text7: Dynamic = "";
    var value_Gs: Dynamic = (document as Dynamic).readyState === "complete";
    var index20: Dynamic = 0;
    var value_To: Dynamic = false;
    var value_Mo: Dynamic = false;
    var value_pp: Dynamic =
      /^(STYLE|SCRIPT|LINK|META|TITLE|TEMPLATE|NOSCRIPT)$/;
    var value_Po: Dynamic = function (
      this: Dynamic,
      ..._extraArguments730: Dynamic[]
    ): Dynamic {
      for (
        var fillStyle: Dynamic = (document as Dynamic).querySelectorAll(
            "[data-dc-tpl]",
          ),
          innerHTML: Dynamic = [],
          position: Dynamic = 0;
        position < fillStyle.length;
        position++
      )
        if (
          !value_pp.test(fillStyle[position].tagName) &&
          !fillStyle[position].closest("[data-dc-editor-overlay]")
        ) {
          innerHTML.push(fillStyle[position]);
        }
      return innerHTML;
    };
    var value_Vs: Dynamic = function (
      this: Dynamic,
      fillStyle?: Dynamic,
      ..._extraArguments731: Dynamic[]
    ): Dynamic {
      for (
        var innerHTML: Dynamic = 0, position: Dynamic = 0, shaft: Dynamic = 0;
        shaft < fillStyle.length;
        shaft++
      ) {
        var tag: Dynamic = fillStyle[shaft].getBoundingClientRect();
        if (!(tag.width <= 0 && tag.height <= 0)) {
          innerHTML = Math.max(
            innerHTML,
            tag.right + (window as Dynamic).scrollX,
          );
          position = Math.max(
            position,
            tag.bottom + (window as Dynamic).scrollY,
          );
        }
      }
      return {
        w: Math.ceil(innerHTML),
        h: Math.ceil(position),
      };
    };
    var value_vp: Dynamic = function (
      this: Dynamic,
      ..._extraArguments732: Dynamic[]
    ): Dynamic {
      index19 = 0;
      if (!(panZoomScale !== 1 || pan.x !== 0 || pan.y !== 0)) {
        var fillStyle: Dynamic = value_Vs(value_Po());
        if (fillStyle.w <= 0 || fillStyle.h <= 0) {
          if (value_Gs && !index20) {
            index20 = setTimeout(function (
              this: Dynamic,
              ..._extraArguments733: Dynamic[]
            ): Dynamic {
              index20 = 0;
              var shaft: Dynamic = value_Vs(value_Po());
              if ((shaft.w <= 0 || shaft.h <= 0) && text7 !== "empty") {
                text7 = "empty";
                emitEditorEvent({
                  type: "contentHull",
                  empty: true,
                });
              }
            }, 300);
          }
          return;
        }
        if (index20) {
          clearTimeout(index20);
          index20 = 0;
        }
        var innerHTML: Dynamic = fillStyle.w + "x" + fillStyle.h;
        var position: Dynamic = value_To && !value_Mo;
        value_To = false;
        value_Mo = false;
        if (position) {
          text7 = innerHTML;
          return;
        }
        if (innerHTML !== text7) {
          text7 = innerHTML;
          emitEditorEvent({
            type: "contentHull",
            w: fillStyle.w,
            h: fillStyle.h,
          });
        }
      }
    };
    var value_Ha: Dynamic = function (
      this: Dynamic,
      ..._extraArguments734: Dynamic[]
    ): Dynamic {
      if (!index19) {
        index19 = requestAnimationFrame(value_vp);
      }
    };
    var value_Us: Dynamic = new ResizeObserver(value_Ha);
    var value_ko: Dynamic = function (
      this: Dynamic,
      ..._extraArguments735: Dynamic[]
    ): Dynamic {
      value_Us.disconnect();
      for (
        var fillStyle: Dynamic = value_Po(), innerHTML: Dynamic = 0;
        innerHTML < fillStyle.length;
        innerHTML++
      )
        value_Us.observe(fillStyle[innerHTML]);
      value_Ha();
    };
    (window as Dynamic).addEventListener(
      "resize",
      function (this: Dynamic, ..._extraArguments736: Dynamic[]): Dynamic {
        value_To = true;
        value_Ha();
      },
    );
    new MutationObserver(function (
      this: Dynamic,
      fillStyle?: Dynamic,
      ..._extraArguments737: Dynamic[]
    ): Dynamic {
      for (
        var innerHTML: Dynamic = 0;
        innerHTML < fillStyle.length;
        innerHTML++
      ) {
        var position: Dynamic = fillStyle[innerHTML].target;
        if (
          !(
            position.nodeType === 1
              ? position
              : position.parentElement || (document as Dynamic).body
          ).closest("[data-dc-editor-overlay]")
        ) {
          value_Mo = true;
          value_ko();
          return;
        }
      }
    }).observe((document as Dynamic).documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    var value_hp: Dynamic =
      (document as Dynamic).fonts && (document as Dynamic).fonts.ready
        ? (document as Dynamic).fonts.ready
        : Promise.resolve();
    (window as Dynamic).addEventListener(
      "load",
      function (this: Dynamic, ..._extraArguments738: Dynamic[]): Dynamic {
        value_Gs = true;
        value_Ha();
      },
    );
    value_hp.then(value_ko, value_ko);
  }
  (document as Dynamic).addEventListener("pointermove", onGlobalPointerMove, {
    capture: true,
    passive: true,
  });
  (document as Dynamic).addEventListener(
    "pointerover",
    function (
      this: Dynamic,
      fillStyle?: Dynamic,
      ..._extraArguments739: Dynamic[]
    ): Dynamic {
      if (!fillStyle.relatedTarget) {
        onGlobalPointerMove(fillStyle);
      }
    },
    {
      capture: true,
      passive: true,
    },
  );
  (document as Dynamic).addEventListener(
    "pointerout",
    function (
      this: Dynamic,
      fillStyle?: Dynamic,
      ..._extraArguments740: Dynamic[]
    ): Dynamic {
      if (!fillStyle.relatedTarget) {
        clearPendingPointer();
      }
    },
    {
      capture: true,
      passive: true,
    },
  );
  (window as Dynamic).__dcEditorPicker = __dcEditorPicker;
})();
