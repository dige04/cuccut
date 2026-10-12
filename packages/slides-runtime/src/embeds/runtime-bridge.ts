/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** State the host pushes into an embed on every update. */
export interface EmbedState {
  t: number;
  playing: boolean;
  selected: boolean;
  props: object;
  /** Present only while the host renders a frame for export. */
  exporting?: boolean;
  pixelWidth?: number;
  pixelHeight?: number;
}
/** A pointer gesture the host forwards to the embed. */
export interface EmbedGesture {
  kind: string;
  x: number;
  y: number;
  id: number;
}
/** What an embed's canvas renderer receives when the host exports a frame. */
export interface EmbedRenderRequest {
  ctx: CanvasRenderingContext2D;
  t: number;
  props: object;
  width: number;
  height: number;
}
export type EmbedUpdateHandler = (state: EmbedState) => void;
export type EmbedGestureHandler = (gesture: EmbedGesture) => void;
export type EmbedSelectHandler = (selected: boolean) => void;
export type EmbedRenderHandler = (request: EmbedRenderRequest) => void;
export type EmbedLoadHandler = (saved: unknown) => void;
/** The API embed scripts reach through `window.appifactEmbed`. */
export interface AppifactEmbed {
  version: number;
  onUpdate(handler: EmbedUpdateHandler): void;
  onGesture(handler: EmbedGestureHandler): void;
  onSelect(handler: EmbedSelectHandler): void;
  onRender(handler: EmbedRenderHandler): void;
  registerCanvas(canvas: CanvasImageSource): void;
  props(): object;
  time(): number;
  load(): unknown;
  save(state: unknown): boolean;
  onLoad(handler: EmbedLoadHandler): void;
}
/** The embed document's window, with the globals the bridge installs or consumes. */
interface EmbedWindow extends Window {
  /** Installed by the sandbox isolation script; resolves closed shadow roots. */
  __appifactShadowRootOf?: (element: Element) => ShadowRoot | null | undefined;
  appifactEmbed?: AppifactEmbed;
}
/** Style properties copied from a canvas onto the image that replaces it in a snapshot. */
type EmbedSnapshotStyleProperty =
  | "position"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "display"
  | "margin"
  | "transform"
  | "transformOrigin"
  | "zIndex"
  | "opacity"
  | "borderRadius"
  | "boxSizing"
  | "verticalAlign";
/** An untrusted message posted by the host; every field is validated before use. */
interface EmbedHostMessage {
  type?: unknown;
  t?: unknown;
  playing?: unknown;
  selected?: unknown;
  props?: unknown;
  gesture?: Record<string, unknown> | string | number | boolean | null;
  state?: unknown;
  seq?: unknown;
  width?: unknown;
  height?: unknown;
}
/** Serialized into the embed document, so it must stay self-contained. */
export type EmbedRuntimeBridge = (
  interactive?: boolean,
  saved?: unknown,
  keepsSaves?: boolean,
) => void;

declare module "../bindings" {
  interface RuntimeBindings {
    embedRuntimeBridge: EmbedRuntimeBridge;
    embedRuntimeBootstrapScript: (
      interactive?: boolean,
      saved?: unknown,
      keepsSaves?: boolean,
    ) => string;
    defaultEmbedRuntimeScript: string;
    interactiveEmbedRuntimeScript: string;
    initializeEmbedRuntimeScript: () => void;
  }
}

export function installEmbedsRuntimeBridge(
  runtime: RuntimeBindings,
): () => void {
  var defaultEmbedRuntimeScript: RuntimeBindings["defaultEmbedRuntimeScript"];
  var interactiveEmbedRuntimeScript: RuntimeBindings["interactiveEmbedRuntimeScript"];
  var initializeEmbedRuntimeScript: RuntimeBindings["initializeEmbedRuntimeScript"];
  function embedRuntimeBridge(
    interactive?: boolean,
    saved?: unknown,
    keepsSaves?: boolean,
  ): void {
    var count: number = 1,
      parent: Window = window.parent,
      items: EmbedUpdateHandler[] = [],
      items2: EmbedGestureHandler[] = [],
      items3: EmbedSelectHandler[] = [],
      value: EmbedRenderHandler | null = null,
      value2: CanvasImageSource | null = null,
      state: EmbedState = {
        t: 0,
        playing: false,
        selected: false,
        props: {},
      },
      value3: unknown = null;
    try {
      if (typeof saved === "string") {
        value3 = JSON.parse(saved);
      }
    } catch {
      value3 = null;
    }
    var items4: EmbedLoadHandler[] = [],
      index: number = 0;
    function value4(input: unknown, options?: Transferable[]): void {
      try {
        parent.postMessage(input, "*", options ?? []);
      } catch {}
    }
    if (interactive === true) {
      var value5: MessageChannel = new MessageChannel(),
        value6: (message: unknown) => void = value5.port1.postMessage.bind(
          value5.port1,
        );
      value4(
        {
          type: "appifact-embed:port",
        },
        [value5.port2],
      );
      var value7: EmbedWindow = window,
        __appifactShadowRootOf = value7.__appifactShadowRootOf;
      delete value7.__appifactShadowRootOf;
      var value8: (handler: () => void, timeout?: number) => number =
          window.setTimeout.bind(window),
        apply = Reflect.apply,
        callback = function <T extends object, K extends keyof T>(
          input: T,
          options: K,
        ): ((this: T) => T[K]) {
          var value26: PropertyDescriptor | undefined =
            Object.getOwnPropertyDescriptor(input, options);
          if (value26 && value26.get) {
            return value26.get;
          } else {
            return function (this: T): T[K] {
              return this[options];
            };
          }
        },
        value9 = callback(KeyboardEvent.prototype, "key"),
        value10 = callback(KeyboardEvent.prototype, "repeat"),
        value11 = callback(KeyboardEvent.prototype, "isComposing"),
        value12 = callback(Event.prototype, "defaultPrevented"),
        value13 = callback(MouseEvent.prototype, "ctrlKey"),
        value14 = callback(MouseEvent.prototype, "metaKey"),
        value15 = callback(MouseEvent.prototype, "clientX"),
        value16 = callback(MouseEvent.prototype, "clientY"),
        value17 = callback(WheelEvent.prototype, "deltaX"),
        value18 = callback(WheelEvent.prototype, "deltaY"),
        value19 = callback(WheelEvent.prototype, "deltaMode"),
        value20 = callback(Element.prototype, "shadowRoot"),
        value21 = callback(
          typeof ShadowRoot === "undefined" ? ({} as ShadowRoot) : ShadowRoot.prototype,
          "activeElement",
        ),
        callback2: () => boolean = function (): boolean {
          var activeElement: Element | null = document.activeElement,
            value26: ShadowRoot | null | undefined =
              activeElement &&
              (apply(value20, activeElement, []) ||
                (__appifactShadowRootOf &&
                  __appifactShadowRootOf(activeElement)));
          while (value26 && apply(value21, value26, [])) {
            activeElement = apply(value21, value26, []);
            value26 =
              apply(value20, activeElement!, []) ||
              (__appifactShadowRootOf && __appifactShadowRootOf(activeElement!));
          }
          if (!activeElement) {
            return false;
          }
          if (
            document.designMode === "on" ||
            /^(textbox|searchbox|combobox|spinbutton)$/.test(
              activeElement.getAttribute("role") || "",
            )
          ) {
            return true;
          }
          if (
            activeElement.tagName === "TEXTAREA" ||
            activeElement.tagName === "SELECT"
          ) {
            return true;
          }
          if (activeElement.tagName === "INPUT") {
            var type: string = (activeElement as HTMLInputElement).type;
            return !/^(button|checkbox|radio|range|submit|reset|color|file|image)$/.test(
              type,
            );
          }
          return (activeElement as HTMLElement).isContentEditable === true;
        },
        callback3: (input: WheelEvent) => boolean = function (
          input: WheelEvent,
        ): boolean {
          var value26: number = apply(value17, input, []),
            value27: number = apply(value18, input, []),
            value28: boolean = Math.abs(value27) >= Math.abs(value26),
            value29: EventTarget[] = input.composedPath
              ? input.composedPath()
              : [];
          for (var index4: number = 0; index4 < value29.length; index4++) {
            var value30: Element = value29[index4] as Element;
            if (!value30 || value30.nodeType !== 1) {
              continue;
            }
            var value31: CSSStyleDeclaration = getComputedStyle(value30),
              value32: string = value28 ? value31.overflowY : value31.overflowX;
            if (value32 !== "auto" && value32 !== "scroll") {
              continue;
            }
            var value33: number = value28 ? value27 : value26,
              value34: number = value28 ? value30.scrollTop : value30.scrollLeft,
              value35: number = value28
                ? value30.scrollHeight - value30.clientHeight
                : value30.scrollWidth - value30.clientWidth;
            if (value33 > 0 ? value34 < value35 - 1 : value34 > 1) {
              return true;
            }
          }
          return false;
        },
        callback4: (input: WheelEvent, options: boolean) => void = function (
          input: WheelEvent,
          options: boolean,
        ): void {
          var value26: number = apply(value19, input, []),
            value27: number =
              value26 === 1 ? 16 : value26 === 2 ? window.innerHeight : 1;
          value6({
            kind: "wheel",
            dx: apply(value17, input, []) * value27,
            dy: apply(value18, input, []) * value27,
            pinch: options,
            x: Number(apply(value15, input, [])) || 0,
            y: Number(apply(value16, input, [])) || 0,
          });
        },
        callback5: (input: Event) => void = function (input: Event): void {
          value8(function (): void {
            if (apply(value12, input, []) === true) {
              value6({
                kind: "press",
                cancelled: true,
              });
            }
          }, 0);
        };
      window.addEventListener(
        "pointerdown",
        function (input: PointerEvent): void {
          if (!input.isTrusted) {
            return;
          }
          value6({
            kind: "press",
          });
          callback5(input);
        },
        true,
      );
      window.addEventListener(
        "mousedown",
        function (input: MouseEvent): void {
          if (input.isTrusted) {
            callback5(input);
          }
        },
        true,
      );
      window.addEventListener(
        "keydown",
        function (input: KeyboardEvent): void {
          if (
            !input.isTrusted ||
            apply(value10, input, []) === true ||
            apply(value11, input, []) === true
          ) {
            return;
          }
          var value26: string = apply(value9, input, []);
          if (value26 === "Escape") {
            value6({
              kind: "key",
              key: "Escape",
            });
          } else if (
            (value26 === "Delete" || value26 === "Backspace") &&
            !callback2()
          ) {
            value8(function (): void {
              if (apply(value12, input, []) !== true) {
                value6({
                  kind: "key",
                  key: "Delete",
                });
              }
            }, 0);
          }
        },
        true,
      );
      var value22 = callback(Event.prototype, "timeStamp"),
        index2: number = 0,
        value23: number = -1 / 0,
        flag: boolean = false,
        index3: number = 0;
      window.addEventListener(
        "wheel",
        function (event: WheelEvent): void {
          if (!event.isTrusted) {
            return;
          }
          var value26: number = apply(value22, event, []);
          if (value26 - value23 > 200) {
            index2 = 0;
          }
          value23 = value26;
          if (
            apply(value13, event, []) === true ||
            apply(value14, event, []) === true
          ) {
            index2 = 0;
            flag = false;
            event.preventDefault();
            event.stopPropagation();
            callback4(event, true);
            return;
          }
          var value27: boolean = index2 === 0;
          if (value27) {
            if (
              apply(value17, event, []) === 0 &&
              apply(value18, event, []) === 0
            ) {
              return;
            }
            index2 = callback3(event) ? 1 : 2;
            index3 += 1;
            flag = index2 === 2;
          }
          if (index2 !== 2) {
            return;
          }
          if (!value27 && !flag && callback3(event)) {
            event.preventDefault();
            callback4(event, false);
            return;
          }
          var value28: number = index3;
          value8(function (): void {
            var value29: boolean = apply(value12, event, []) === true;
            if (value27 && value28 === index3) {
              flag = false;
              if (value29) {
                index2 = 1;
              }
            }
            if (!value29) {
              callback4(event, false);
            }
          }, 0);
        },
        {
          capture: true,
          passive: false,
        },
      );
      var callback6: (event: MouseEvent) => void = function (
        event: MouseEvent,
      ): void {
        var value26: EventTarget[] = event.composedPath
          ? event.composedPath()
          : [];
        for (var index4: number = 0; index4 < value26.length; index4++) {
          var value27: Element = value26[index4] as Element,
            value28: string =
              value27 && value27.nodeType === 1 ? value27.localName : "";
          if (
            (value28 !== "a" && value28 !== "area") ||
            !(
              value27.hasAttribute("href") || value27.hasAttribute("xlink:href")
            )
          ) {
            continue;
          }
          event.preventDefault();
          var value29: string = value27.getAttribute("href") || "",
            value30: HTMLElement | null =
              value29.charAt(0) === "#" && value29.length > 1
                ? document.getElementById(value29.slice(1))
                : null;
          if (value30) {
            value30.scrollIntoView();
          }
          return;
        }
      };
      window.addEventListener("click", callback6, true);
      window.addEventListener("auxclick", callback6, true);
    }
    var callback7: () => void = function (): void {
      value4({
        type: "appifact-embed:navigating",
      });
    };
    window.addEventListener("beforeunload", callback7, true);
    window.addEventListener(
      "pagehide",
      function (input: PageTransitionEvent): void {
        if (input && input.persisted === true) {
          return;
        }
        callback7();
      },
      true,
    );
    function value24(input: number, options: number): Promise<HTMLCanvasElement> {
      return new Promise<HTMLCanvasElement>(function (
        input2: (value: HTMLCanvasElement) => void,
        options2: (reason?: unknown) => void,
      ): void {
        var value26: HTMLElement = document.documentElement.cloneNode(
            true,
          ) as HTMLElement,
          value27: NodeListOf<HTMLScriptElement> =
            value26.querySelectorAll("script");
        for (var index4: number = 0; index4 < value27.length; index4++) {
          var value28: HTMLScriptElement | undefined = value27[index4];
          if (value28 && value28.parentNode) {
            value28.parentNode.removeChild(value28);
          }
        }
        var value29: NodeListOf<HTMLCanvasElement> =
            document.querySelectorAll("canvas"),
          value30: NodeListOf<HTMLCanvasElement> =
            value26.querySelectorAll("canvas"),
          items5: EmbedSnapshotStyleProperty[] = [
            "position",
            "top",
            "right",
            "bottom",
            "left",
            "display",
            "margin",
            "transform",
            "transformOrigin",
            "zIndex",
            "opacity",
            "borderRadius",
            "boxSizing",
            "verticalAlign",
          ];
        for (var index5: number = 0; index5 < value30.length; index5++) {
          var value31: HTMLCanvasElement | undefined = value29[index5],
            value32: HTMLCanvasElement | undefined = value30[index5];
          if (!value31 || !value32 || !value32.parentNode) {
            continue;
          }
          if (value31.width === 0 || value31.height === 0) {
            continue;
          }
          try {
            var value33: HTMLImageElement = document.createElement("img");
            value33.src = value31.toDataURL("image/png");
            value33.className = value32.className;
            if (value32.id) {
              value33.id = value32.id;
            }
            var attribute: string | null = value32.getAttribute("style");
            if (attribute) {
              value33.setAttribute("style", attribute);
            }
            var value34: CSSStyleDeclaration = getComputedStyle(value31);
            for (var index6: number = 0; index6 < items5.length; index6++) {
              var value35: EmbedSnapshotStyleProperty = items5[
                index6
              ] as EmbedSnapshotStyleProperty;
              value33.style[value35] = value34.getPropertyValue(
                value35.replace(/[A-Z]/g, function (input3: string): string {
                  return "-" + input3.toLowerCase();
                }),
              );
            }
            value33.style.width = value31.offsetWidth + "px";
            value33.style.height = value31.offsetHeight + "px";
            value32.parentNode.replaceChild(value33, value32);
          } catch {}
        }
        var value36: number = Math.max(
            1,
            document.documentElement.clientWidth || input,
          ),
          value37: number = Math.max(
            1,
            document.documentElement.clientHeight || options,
          );
        value26.style.width = value36 + "px";
        value26.style.height = value37 + "px";
        var element: HTMLBodyElement | null = value26.querySelector("body");
        if (element instanceof HTMLElement) {
          element.style.width = value36 + "px";
          element.style.height = value37 + "px";
        }
        var value38: string = new XMLSerializer().serializeToString(value26),
          value39: string =
            '<svg xmlns="http://www.w3.org/2000/svg" width="' +
            value36 +
            '" height="' +
            value37 +
            '"><foreignObject width="100%" height="100%">' +
            value38 +
            "</foreignObject></svg>",
          value40: HTMLImageElement = new Image();
        value40.onload = function (): void {
          var value41: HTMLCanvasElement = document.createElement("canvas");
          value41.width = input;
          value41.height = options;
          var value42: CanvasRenderingContext2D | null =
            value41.getContext("2d");
          if (value42 === null) {
            options2(Error("no 2d context"));
            return;
          }
          value42.drawImage(value40, 0, 0, input, options);
          input2(value41);
        };
        value40.onerror = function (): void {
          options2(Error("snapshot decode failed"));
        };
        value40.src =
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(value39);
      });
    }
    function value25(
      input: number,
      options: number,
      context: object,
      value26: number,
      extra: number,
    ): void {
      var callback9: (input2: HTMLCanvasElement) => void = function (
          input2: HTMLCanvasElement,
        ): void {
          try {
            var value32: CanvasRenderingContext2D | null =
              input2.getContext("2d");
            if (value32 === null) {
              throw Error("no 2d context");
            }
            var value33: ImageData = value32.getImageData(
                0,
                0,
                value26,
                extra,
              ),
              buffer: ArrayBuffer = value33.data.buffer;
            value4(
              {
                type: "appifact-embed:frame",
                seq: input,
                width: value26,
                height: extra,
                pixels: buffer,
              },
              [buffer],
            );
          } catch (value34: unknown) {
            callback10(String(value34).slice(0, 200));
          }
        },
        callback10: (input2: string) => void = function (
          input2: string,
        ): void {
          value4({
            type: "appifact-embed:frame-error",
            seq: input,
            reason: input2,
          });
        };
      try {
        var state2: EmbedState = {
          t: options,
          playing: false,
          selected: state.selected,
          props: context,
          exporting: true,
          pixelWidth: value26,
          pixelHeight: extra,
        };
        for (var index4: number = 0; index4 < items.length; index4++)
          try {
            var value27: EmbedUpdateHandler | undefined = items[index4];
            if (value27) {
              value27(state2);
            }
          } catch {}
        if (value !== null) {
          var value28: HTMLCanvasElement = document.createElement("canvas");
          value28.width = value26;
          value28.height = extra;
          var value29: CanvasRenderingContext2D | null =
            value28.getContext("2d");
          if (value29 === null) {
            callback10("no 2d context");
            return;
          }
          value({
            ctx: value29,
            t: options,
            props: context,
            width: value26,
            height: extra,
          });
          callback9(value28);
        } else if (value2 !== null) {
          var value30: HTMLCanvasElement = document.createElement("canvas");
          value30.width = value26;
          value30.height = extra;
          var value31: CanvasRenderingContext2D | null =
            value30.getContext("2d");
          if (value31 === null) {
            callback10("no 2d context");
            return;
          }
          value31.drawImage(value2, 0, 0, value26, extra);
          callback9(value30);
        } else {
          value24(value26, extra).then(callback9, function (
            input2: unknown,
          ): void {
            callback10(String(input2).slice(0, 200));
          });
        }
      } catch (value32: unknown) {
        callback10(String(value32).slice(0, 200));
      }
    }
    window.addEventListener("message", function (dataset: MessageEvent): void {
      if (dataset.source !== parent) {
        return;
      }
      var data: EmbedHostMessage | string | number | boolean | null | undefined =
        dataset.data;
      if (typeof data !== "object" || data === null) {
        return;
      }
      if (data.type === "appifact-embed:update") {
        var selected: boolean = state.selected,
          state2: EmbedState = {
            t: typeof data.t === "number" ? data.t : 0,
            playing: data.playing === true,
            selected: data.selected === true,
            props:
              typeof data.props === "object" && data.props !== null
                ? data.props
                : {},
          };
        state = state2;
        for (var index4: number = 0; index4 < items.length; index4++)
          try {
            var value26: EmbedUpdateHandler | undefined = items[index4];
            if (value26) {
              value26(state2);
            }
          } catch {}
        if (state2.selected !== selected) {
          for (var index5: number = 0; index5 < items3.length; index5++)
            try {
              var value27: EmbedSelectHandler | undefined = items3[index5];
              if (value27) {
                value27(state2.selected);
              }
            } catch {}
        }
      } else if (data.type === "appifact-embed:selected") {
        var value28: boolean = data.selected === true;
        state.selected = value28;
        for (var index6: number = 0; index6 < items3.length; index6++)
          try {
            var value29: EmbedSelectHandler | undefined = items3[index6];
            if (value29) {
              value29(value28);
            }
          } catch {}
      } else if (data.type === "appifact-embed:gesture") {
        var gesture: Record<string, unknown> | string | number | boolean | null | undefined =
          data.gesture;
        if (typeof gesture !== "object" || gesture === null) {
          return;
        }
        var state3: EmbedGesture = {
          kind: typeof gesture.kind === "string" ? gesture.kind : "",
          x: typeof gesture.x === "number" ? gesture.x : 0,
          y: typeof gesture.y === "number" ? gesture.y : 0,
          id: typeof gesture.id === "number" ? gesture.id : 0,
        };
        for (var index7: number = 0; index7 < items2.length; index7++)
          try {
            var value30: EmbedGestureHandler | undefined = items2[index7];
            if (value30) {
              value30(state3);
            }
          } catch {}
      } else if (data.type === "appifact-embed:state") {
        if (typeof data.state !== "string") {
          return;
        }
        index += 1;
        try {
          value3 = JSON.parse(data.state);
        } catch {
          return;
        }
        for (var index8: number = 0; index8 < items4.length; index8++)
          try {
            var value31: EmbedLoadHandler | undefined = items4[index8];
            if (value31) {
              value31(value3);
            }
          } catch {}
      } else if (data.type === "appifact-embed:render") {
        var value32: number = typeof data.seq === "number" ? data.seq : -1,
          value33: number =
            typeof data.width === "number" ? Math.floor(data.width) : 0,
          value34: number =
            typeof data.height === "number" ? Math.floor(data.height) : 0;
        if (
          value32 < 0 ||
          value33 < 1 ||
          value34 < 1 ||
          value33 > 8192 ||
          value34 > 8192
        ) {
          return;
        }
        value25(
          value32,
          typeof data.t === "number" ? data.t : 0,
          typeof data.props === "object" && data.props !== null
            ? data.props
            : {},
          value33,
          value34,
        );
      }
    });
    (window as EmbedWindow).appifactEmbed = {
      version: count,
      onUpdate: function (input: EmbedUpdateHandler): void {
        items.push(input);
        try {
          input(state);
        } catch {}
      },
      onGesture: function (input: EmbedGestureHandler): void {
        items2.push(input);
      },
      onSelect: function (input: EmbedSelectHandler): void {
        items3.push(input);
      },
      onRender: function (input: EmbedRenderHandler): void {
        value = input;
      },
      registerCanvas: function (input: CanvasImageSource): void {
        value2 = input;
      },
      props: function (): object {
        return state.props;
      },
      time: function (): number {
        return state.t;
      },
      load: function (): unknown {
        return value3;
      },
      save: function (input: unknown): boolean {
        var value26: string | undefined;
        if (keepsSaves !== true) {
          return false;
        }
        try {
          value26 = JSON.stringify(input);
          if (typeof value26 !== "string" || value26.length > 16384) {
            return false;
          }
          value3 = JSON.parse(value26);
        } catch {
          return false;
        }
        value4({
          type: "appifact-embed:save",
          state: value26,
          applied: index,
        });
        return true;
      },
      onLoad: function (input: EmbedLoadHandler): void {
        items4.push(input);
      },
    };
    var callback8: () => void = function (): void {
      value4({
        type: "appifact-embed:ready",
        version: count,
      });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback8);
    } else {
      callback8();
    }
  }
  function embedRuntimeBootstrapScript(
    interactive?: boolean,
    saved?: unknown,
    keepsSaves?: boolean,
  ): string {
    let value: string =
      saved === undefined
        ? "undefined"
        : JSON.stringify(saved)
            .replace(/</g, "\\u003c")
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029");
    return (
      "(" +
      embedRuntimeBridge.toString() +
      ")(" +
      String(interactive) +
      "," +
      value +
      "," +
      String(keepsSaves) +
      ");"
    );
  }
  bindRuntimeValue(runtime, "embedRuntimeBridge", () => embedRuntimeBridge);
  bindRuntimeValue(
    runtime,
    "embedRuntimeBootstrapScript",
    () => embedRuntimeBootstrapScript,
  );
  bindRuntimeValue(
    runtime,
    "defaultEmbedRuntimeScript",
    () => defaultEmbedRuntimeScript,
    (value) => {
      defaultEmbedRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "interactiveEmbedRuntimeScript",
    () => interactiveEmbedRuntimeScript,
    (value) => {
      interactiveEmbedRuntimeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEmbedRuntimeScript",
    () => initializeEmbedRuntimeScript,
    (value) => {
      initializeEmbedRuntimeScript = value;
    },
  );
  return () => {
    initializeEmbedRuntimeScript = (0, runtime.initializeOnce)((): void => {
      defaultEmbedRuntimeScript =
        "(" + embedRuntimeBridge.toString() + ")();";
      interactiveEmbedRuntimeScript =
        "(" + embedRuntimeBridge.toString() + ")(true);";
    });
  };
}
