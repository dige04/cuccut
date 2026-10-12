/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { EmbedGesture } from "./runtime-bridge";

/** What the host knows about recent user activity attributed to a frame. */
export interface EmbedAttribution {
  active: boolean;
  msSince: number;
  pressMsSince: number;
  touchEntry?: boolean;
  consumeTouchEntry?: () => void;
  consume: () => void;
}
/** An attribution after the guard normalized it (hooks always callable). */
interface EmbedEvidence {
  active: boolean;
  msSince: number;
  pressMsSince: number;
  touchEntry: boolean;
  consumeTouchEntry: () => void;
  consume: () => void;
}
/** Configuration the focus guard and the embed frames share. */
export interface EmbedGuardConfig {
  /** Attribute that marks the iframes this guard manages. */
  markerAttr: string;
  /** Name of the window event dispatched when embeds get disabled. */
  disabledEvent: string;
  /** Reports recent user activity attributed to a frame. */
  attribution?: (frame: Element) => EmbedAttribution;
  /** Flushes press evidence for a frame; true means the press was handled. */
  pressFlush?: (frame: Element, token: number) => boolean;
}
export type EmbedDisabledConfig = Pick<EmbedGuardConfig, "disabledEvent">;
/** Who holds focus after a focus change. */
type EmbedFocusSource = "host" | "marked" | "other-frame";
type EmbedFocusVerdict = "ignore" | "kill" | "pend";
interface EmbedFocusDecision {
  verdict: EmbedFocusVerdict;
  markRecipient: boolean;
  spendRecipient: boolean;
}
interface EmbedFocusEvidence {
  alreadyDisabled: boolean;
  framesPresent: boolean;
  otherFrameLegit: boolean;
  recipientLegit: boolean;
  msSinceGesture: number;
  pressFresh: boolean;
  active: boolean;
}
interface EmbedBlurInput extends EmbedFocusEvidence {
  hasFocusAfterBlur: boolean;
  recipient: "stale" | "marked" | "other-frame";
  selfEvictionSinceDispatch: boolean;
}
interface EmbedFocusInInput extends EmbedFocusEvidence {
  focusIn: EmbedFocusSource;
}
interface EmbedPriorSessionInput {
  markPresent: boolean;
  markStaleOrDeparted: boolean;
}
/** The frame currently granted focus, kept in a window slot shared by every guard instance. */
interface EmbedLedgerEntry {
  el: Element;
  seq: number;
  grantAt: number;
}
/** A frame whose focus grab is still being judged. */
interface EmbedPendingState {
  el: Element | null;
  seq: number;
  hard: boolean;
  installAt: number;
  installMoveSeq: number;
  evidenceless: boolean;
  counted: boolean;
}
/** Hook another guard instance in this window may call. */
type EmbedGuardHook = (...args: never[]) => unknown;
type EmbedGuardSlot =
  | boolean
  | number
  | EmbedLedgerEntry
  | EmbedGuardHook
  | null
  | undefined;
/** The window, with the slots the guard shares between its instances. */
type EmbedGuardWindow = Window &
  typeof globalThis &
  Record<string, EmbedGuardSlot>;

/** Props the host may pass to an embed; only a few finite numbers survive. */
export type EmbedPropsInput = Record<string, unknown> | null;
/** Wheel input accumulated until the next animation frame. */
export interface EmbedWheel {
  dx: number;
  dy: number;
  pinch: boolean;
  x: number;
  y: number;
}
/** Handlers for input the embed forwards to the host. */
export interface EmbedHostInput {
  onPress(cancelled: boolean): void;
  onKey(key: "Delete" | "Escape"): void;
  onWheel(wheel: EmbedWheel): void;
}
/** State pushed into a running embed. */
export interface EmbedHostUpdate {
  t: number;
  playing?: boolean;
  selected?: boolean;
  props?: EmbedPropsInput;
}
/** Raw RGBA pixels the embed rendered for an export. */
export interface EmbedRenderedPixels {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}
/** Constructor options for the host side of an embed frame. */
export interface EmbedFrameHostOptions {
  frame: HTMLIFrameElement;
  hostWindow?: Window;
  renderTimeoutMs?: number;
  onNavigating?: () => void;
  input?: EmbedHostInput;
  onSave?: (state: string) => void;
}
/** The host side of one embed frame: it talks to the sandboxed document. */
export interface EmbedFrameHostHandle {
  readonly ready: boolean;
  /** The window that announced readiness, once it did. */
  readonly readyWindow: MessageEventSource | null;
  update(update: EmbedHostUpdate): void;
  /** Sends saved embed state (a JSON string) once the embed is ready. */
  state(state: string): void;
  setSelected(selected: boolean): void;
  gesture(gesture: EmbedGesture): void;
  render(
    t: number,
    props: EmbedPropsInput | undefined,
    width: number,
    height: number,
  ): Promise<EmbedRenderedPixels | null>;
  dispose(): void;
}
export interface EmbedFrameHostConstructor {
  new (options: EmbedFrameHostOptions): EmbedFrameHostHandle;
}
/** Options for creating a sandboxed embed iframe. */
export interface EmbedFrameOptions {
  html: string;
  allowScripts?: boolean;
  markerAttr: string;
  title: string;
  onNavigated: () => void;
  /** Document that owns the iframe; defaults to the current document. */
  doc?: Document;
  /** Present when the embed forwards input to the host. */
  interactive?: EmbedHostInput;
  /** Saved embed state (a JSON string). */
  state?: string;
  onSave?: (state: string) => void;
  /** Called when the frame's content window changed identity unexpectedly. */
  onRelocated?: () => void;
  renderTimeoutMs?: number;
}
/** An embed frame together with its host-side controller. */
export interface EmbedFrameMount {
  iframe: HTMLIFrameElement;
  host: EmbedFrameHostHandle;
  /** True when the guard refused to run the frame. */
  refused: boolean;
  dispose(): void;
}
/** An untrusted message from the embed document; every field is validated before use. */
interface EmbedFrameMessage {
  type?: unknown;
  applied?: unknown;
  state?: unknown;
  version?: unknown;
  seq?: unknown;
  width?: unknown;
  height?: unknown;
  pixels?: unknown;
}
/** An untrusted input message from the embed's message port. */
interface EmbedInputMessage {
  kind?: unknown;
  cancelled?: unknown;
  key?: unknown;
  pinch?: unknown;
  dx?: unknown;
  dy?: unknown;
  x?: unknown;
  y?: unknown;
}
/** A render request waiting for its frame. */
interface PendingEmbedRender {
  resolve: (frame: EmbedRenderedPixels | null) => void;
  width: number;
  height: number;
  timer: ReturnType<typeof setTimeout>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    EmbedFrameHost: EmbedFrameHostConstructor;
    normalizeEmbedProps: (props?: EmbedPropsInput) => Record<string, number>;
    scheduleEmbedAnimationFrame: (callback: () => void) => void;
    clampEmbedNumber: (value: unknown, min: number, max: number) => number;
    embedsDisabled: (config: EmbedDisabledConfig) => boolean;
    subscribeEmbedsDisabled: (
      config: EmbedDisabledConfig,
      listener: () => void,
    ) => () => void;
    installEmbedRuntimeGuard: (config: EmbedGuardConfig) => void;
    createEmbedFrame: (options: EmbedFrameOptions) => EmbedFrameMount;
    initializeEmbedFrameHost: () => void;
  }
}

export function installEmbedsFrameHost(runtime: RuntimeBindings): () => void {
  var EmbedFrameHost: RuntimeBindings["EmbedFrameHost"];
  var scheduleEmbedAnimationFrame: RuntimeBindings["scheduleEmbedAnimationFrame"];
  var clampEmbedNumber: RuntimeBindings["clampEmbedNumber"];
  var initializeEmbedFrameHost: RuntimeBindings["initializeEmbedFrameHost"];
  function normalizeEmbedProps(props?: EmbedPropsInput): Record<string, number> {
    let result: Record<string, number> = {};
    if (typeof props !== "object" || props === null) {
      return result;
    }
    for (let value of Object.keys(props).slice(0, 16)) {
      let value2: unknown = props[value];
      if (typeof value2 === "number" && Number.isFinite(value2)) {
        result[value.slice(0, 40)] = value2;
      }
    }
    return result;
  }
  function embedsDisabled(config: EmbedDisabledConfig): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      (window as EmbedGuardWindow)["__embedsDisabled:" + config.disabledEvent] ===
      true
    );
  }
  function subscribeEmbedsDisabled(
    config: EmbedDisabledConfig,
    listener: () => void,
  ): () => void {
    window.addEventListener(config.disabledEvent, listener);
    return (): void =>
      window.removeEventListener(config.disabledEvent, listener);
  }
  function installEmbedRuntimeGuard(config: EmbedGuardConfig): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    let value: Window & typeof globalThis = window,
      value2: Document = document,
      count: number = 1500,
      count2: number = 250,
      count3: number = 1048576,
      count4: number = 4,
      count5: number = 4000,
      count6: number = 400;
    if (!/^[A-Za-z][\w-]*$/.test(config.markerAttr)) {
      throw Error("embed focus guard: invalid markerAttr " + config.markerAttr);
    }
    let value3: EmbedGuardWindow = value as EmbedGuardWindow,
      value4: string = "__embedFocusGuard:" + config.disabledEvent,
      value5: string = "__embedsDisabled:" + config.disabledEvent,
      value6: string = "__embedLegitFrame:" + config.disabledEvent,
      value7: string = "__embedSamplerBoost:" + config.disabledEvent;
    if (value3[value4] === true) {
      return;
    }
    value3[value4] = true;
    let callback = (input: EmbedPriorSessionInput): {
        endPriorSession: boolean;
      } => {
        return {
          endPriorSession: input.markPresent && input.markStaleOrDeparted,
        };
      },
      callback2 = (input: EmbedBlurInput): EmbedFocusDecision => {
        let state4 = {
          markRecipient: false,
          spendRecipient: false,
        };
        if (!input.hasFocusAfterBlur) {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (input.alreadyDisabled) {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (!input.framesPresent) {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (input.recipient === "other-frame") {
          return {
            verdict: input.otherFrameLegit ? "ignore" : "kill",
            ...state4,
          };
        }
        if (input.recipient === "stale") {
          return {
            verdict: input.selfEvictionSinceDispatch ? "ignore" : "kill",
            ...state4,
          };
        }
        if (input.recipientLegit) {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (
          input.pressFresh &&
          (input.msSinceGesture <= count || input.active)
        ) {
          return {
            verdict: "ignore",
            markRecipient: true,
            spendRecipient: true,
          };
        }
        return {
          verdict: "pend",
          ...state4,
        };
      },
      callback3 = (input: EmbedFocusInInput): EmbedFocusDecision => {
        let state4 = {
          markRecipient: false,
          spendRecipient: false,
        };
        if (input.alreadyDisabled) {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (!input.framesPresent) {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (input.focusIn === "host") {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (input.focusIn === "other-frame") {
          return {
            verdict: input.otherFrameLegit ? "ignore" : "kill",
            ...state4,
          };
        }
        if (input.recipientLegit) {
          return {
            verdict: "ignore",
            ...state4,
          };
        }
        if (
          input.pressFresh &&
          (input.msSinceGesture <= count || input.active)
        ) {
          return {
            verdict: "ignore",
            markRecipient: true,
            spendRecipient: true,
          };
        }
        return {
          verdict: "pend",
          ...state4,
        };
      },
      value8: Element | null = null,
      index: number = 0,
      value9: Element | null = null,
      callback4 = (input: Element | null): boolean =>
        input !== null &&
        (value9 === input || (value8 === input && Date.now() - index <= count)),
      index2: number = 0,
      callback5 = (): EmbedLedgerEntry | null => {
        let value15 = value3[value6] as EmbedLedgerEntry | null | undefined;
        if (value15 == null) {
          return null;
        } else {
          return value15;
        }
      },
      callback6 = (input: Element): void => {
        index2 += 1;
        value3[value6] = {
          el: input,
          seq: index2,
          grantAt: Date.now(),
        };
      },
      value10: HTMLElement | null = null,
      flag: boolean = false,
      flag2: boolean = false,
      index3: number = 0,
      flag3: boolean = true,
      flag4: boolean = false,
      flag5: boolean = true;
    value.addEventListener("focus", (input: FocusEvent): void => {
      if (!input.isTrusted) {
        return;
      }
      if (flag4) {
        flag4 = false;
        let activeElement: Element | null = value2.activeElement;
        if (activeElement !== null && activeElement.tagName !== "IFRAME") {
          if (
            activeElement instanceof value.HTMLElement &&
            activeElement !== value2.body
          ) {
            activeElement.focus();
          } else {
            callback13();
          }
        }
        return;
      }
      flag3 = true;
    });
    let callback7 = (): void => {
      if (!flag) {
        return;
      }
      flag = false;
      let value15 = value3["__embedSpendTokens:" + config.disabledEvent];
      if (typeof value15 === "function") {
        try {
          value15();
        } catch {
          callback19();
        }
      }
      let value16: EmbedLedgerEntry | null = callback5();
      if (
        callback({
          markPresent: value16 !== null,
          markStaleOrDeparted: value16 !== null,
        }).endPriorSession
      ) {
        callback22();
      }
    };
    value.addEventListener(
      "pointerdown",
      (event: PointerEvent): void => {
        if (!event.isTrusted) {
          return;
        }
        index3 = Date.now();
        let target = event.target as Element | null;
        if (
          target === null ||
          (target.tagName === "IFRAME" &&
            target.hasAttribute(config.markerAttr))
        ) {
          return;
        }
        flag = true;
        flag2 = false;
        callback26();
      },
      true,
    );
    value.addEventListener(
      "pointerover",
      (event: PointerEvent): void => {
        if (!event.isTrusted) {
          return;
        }
        let target = event.target as Element | null;
        if (target === null || target.tagName !== "IFRAME") {
          return;
        }
        if (target.hasAttribute(config.markerAttr)) {
          return;
        }
        value8 = target;
        index = Date.now();
        callback26();
      },
      true,
    );
    value.addEventListener(
      "pointerout",
      (event: PointerEvent): void => {
        if (!event.isTrusted) {
          return;
        }
        let target = event.target as Element | null;
        if (target !== null && target === value8) {
          value8 = null;
        }
      },
      true,
    );
    value.addEventListener("focusin", (event: FocusEvent): void => {
      if (!event.isTrusted) {
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.tagName !== "IFRAME" &&
        event.target !== value11
      ) {
        value10 = event.target;
        index3 = Date.now();
        if (event.isTrusted) {
          flag3 = true;
        }
        callback7();
        let value15: EmbedLedgerEntry | null = callback5();
        if (
          callback({
            markPresent: value15 !== null,
            markStaleOrDeparted:
              value15 !== null && value2.activeElement !== value15.el,
          }).endPriorSession
        ) {
          callback22();
        }
        return;
      }
      let target = event.target as Element | null;
      if (
        target instanceof value.HTMLIFrameElement &&
        target.hasAttribute(config.markerAttr)
      ) {
        callback8(target);
      }
    });
    value.addEventListener("focus", (input: FocusEvent): void => {
      if (!input.isTrusted) {
        return;
      }
      let activeElement: Element | null = value2.activeElement;
      if (
        activeElement !== null &&
        activeElement instanceof value.HTMLIFrameElement &&
        activeElement.hasAttribute(config.markerAttr)
      ) {
        callback8(activeElement);
      }
    });
    let state: EmbedPendingState = {
        el: null,
        seq: 0,
        hard: false,
        installAt: 0,
        installMoveSeq: 0,
        evidenceless: false,
        counted: false,
      },
      items: number[] = [],
      callback8 = (input: Element): void => {
        if (value3[value5] === true) {
          return;
        }
        if (value12.has(input)) {
          callback9(input, false);
          return;
        }
        let value15: EmbedLedgerEntry | null = callback5();
        if (value15 !== null && value15.el === input) {
          return;
        }
        callback9(input, value15 !== null);
      },
      state2: { el: Element | null; at: number } = {
        el: null,
        at: 0,
      },
      callback9 = (input: Element, options: boolean): void => {
        if (state2.el === input && Date.now() - state2.at < 64) {
          callback14(input);
          return;
        }
        if (value12.has(input)) {
          try {
            (input as HTMLElement).inert = true;
          } catch {}
          if (
            input instanceof value.HTMLElement &&
            value2.activeElement === input
          ) {
            input.blur();
          }
          callback13(true);
          setTimeout((): void => {
            if (value2.activeElement === input) {
              callback14(input);
            } else if (!flag3 && !callback18()) {
              callback13();
            }
          }, 0);
          return;
        }
        if (state.el === input) {
          state.hard = state.hard || options;
          if (state.evidenceless) {
            callback14(input);
            callback26();
            callback17(input);
            if (value12.has(input)) {
              state.el = null;
            }
          } else if (Date.now() - state.installAt > count6) {
            callback14(input);
          }
          return;
        }
        if (state.el !== null) {
          {
            let value15: EmbedEvidence = callback20(state.el);
            if (
              !(
                value15.touchEntry === true ||
                value15.active === true ||
                value15.msSince <= count ||
                value15.pressMsSince <= count
              )
            ) {
              callback17(state.el);
            }
            value15.consume();
          }
          {
            let { el: value15, counted: value16 } = state;
            state.el = null;
            if (value15 !== null && callback16(value15, value16)) {
              callback19();
              return;
            }
          }
        }
        state.el = input;
        state.seq += 1;
        state.installAt = Date.now();
        state.installMoveSeq = index4;
        state.evidenceless = false;
        state.counted = false;
        state.hard = options;
        let seq: number = state.seq;
        {
          let value15: EmbedEvidence = callback20(input);
          if (
            !(
              value15.active === true ||
              value15.msSince <= count ||
              value15.touchEntry === true ||
              value15.pressMsSince <= count
            ) &&
            input instanceof value.HTMLElement &&
            value2.activeElement === input
          ) {
            input.blur();
            callback13(true);
            state.evidenceless = true;
          }
        }
        callback26();
        let flag6: boolean = false,
          callback27: () => void = (): void => {
            if (state.el !== input) {
              return;
            }
            if (state.seq !== seq) {
              return;
            }
            if (!input.isConnected) {
              state.el = null;
              return;
            }
            {
              let activeElement: Element | null = value2.activeElement,
                value15: boolean =
                  activeElement === null || activeElement.tagName !== "IFRAME";
              if (
                activeElement === input ||
                activeElement === value11 ||
                (!flag3 && !callback18() && value15)
              ) {
                callback13();
              }
            }
            if (!flag6) {
              flag6 = true;
              if (callback16(input, state.counted)) {
                callback19();
                return;
              }
            }
            setTimeout(callback27, count6);
          };
        setTimeout(callback27, count6);
        callback11(input, false, seq);
        if (state.el !== input || state.seq !== seq) {
          return;
        }
        let flag7: boolean = false;
        if (config.pressFlush !== undefined) {
          try {
            flag7 = config.pressFlush(input, seq % count3) === true;
          } catch {
            callback19();
            return;
          }
        }
        if (!flag7) {
          state2.el = input;
          state2.at = Date.now();
          callback11(input, true, seq);
        }
      },
      callback10 = (): boolean => {
        let value15: number = Date.now();
        while (items.length > 0 && value15 - items[0]! > count5) items.shift();
        items.push(value15);
        return items.length > count4;
      },
      callback11 = (
        input: Element,
        options: boolean,
        context?: number,
        value15?: boolean,
      ): void => {
        let el2: Element | null = state.el;
        if (el2 === null || el2 !== input) {
          return;
        }
        if (context !== undefined && context !== state.seq) {
          return;
        }
        if (value3[value5] === true) {
          state.el = null;
          return;
        }
        if (!el2.isConnected) {
          state.el = null;
          return;
        }
        let value16: EmbedEvidence = callback20(el2);
        if (
          value16.pressMsSince <= count &&
          (value16.msSince <= count || value16.active === true) &&
          !value12.has(el2)
        ) {
          state.el = null;
          items.length = 0;
          cache.delete(el2);
          callback6(el2);
          value16.consume();
          if (
            value2.activeElement !== el2 &&
            el2 instanceof value.HTMLElement
          ) {
            el2.focus();
          }
          return;
        }
        if (!options) {
          return;
        }
        let { hard: value17, counted: value18 } = state;
        {
          let activeElement: Element | null = value2.activeElement,
            value19: boolean =
              activeElement === null || activeElement.tagName !== "IFRAME";
          if (activeElement !== el2 && value19) {
            let value20: boolean = index4 > state.installMoveSeq,
              value21: boolean = index3 >= state.installAt;
            if (value2.hasFocus() && !callback18() && !value21 && !value20) {
              state.el = null;
              callback19();
              return;
            }
          }
        }
        state.el = null;
        if (value16.touchEntry === true && callback5() === null && !value17) {
          value16.consumeTouchEntry?.();
          let callback27: () => void = (): void => {
            callback15(el2);
            if (value10 !== null && value10.isConnected) {
              let activeElement: Element | null = value2.activeElement;
              value10.focus();
              if (value2.activeElement !== activeElement) {
                index4 += 1;
              }
            }
          };
          if (value15 === true) {
            callback27();
          } else {
            setTimeout(callback27, 0);
          }
          setTimeout((): void => {
            let activeElement: Element | null = value2.activeElement;
            if (callback18()) {
              return;
            }
            if (
              activeElement === el2 ||
              (!flag3 &&
                (activeElement === null || activeElement.tagName !== "IFRAME"))
            ) {
              callback13();
            }
          }, 0);
          return;
        }
        value16.consume();
        callback15(el2);
        if (value10 !== null && value10.isConnected) {
          let activeElement: Element | null = value2.activeElement;
          value10.focus();
          if (value2.activeElement !== activeElement) {
            index4 += 1;
          }
        }
        setTimeout((): void => {
          let activeElement: Element | null = value2.activeElement;
          if (callback18()) {
            return;
          }
          if (
            activeElement === el2 ||
            (!flag3 &&
              (activeElement === null || activeElement.tagName !== "IFRAME"))
          ) {
            callback13();
          }
        }, 0);
        if (value15 === true) {
          if (value16.touchEntry !== true && value16.pressMsSince > count) {
            callback17(el2);
          }
          if (callback16(el2, value18)) {
            callback19();
          }
          return;
        }
        callback19();
      };
    value3["__embedPendingKick:" + config.disabledEvent] = (
      input: Element,
    ): void => {
      callback11(input, false);
    };
    value3["__embedPendingFrame:" + config.disabledEvent] =
      (): Element | null => state.el;
    value3["__embedPendingEcho:" + config.disabledEvent] = (
      input: Element,
      options: number,
    ): void => {
      if (state.el !== input) {
        return;
      }
      if (state.seq % count3 !== options) {
        return;
      }
      callback11(input, true, state.seq, true);
    };
    let callback12 = (): boolean =>
        value2.querySelector("iframe[" + config.markerAttr + "]") !== null,
      state3: EmbedEvidence = {
        active: false,
        msSince: 1 / 0,
        pressMsSince: 1 / 0,
        touchEntry: false,
        consumeTouchEntry: (): void => {},
        consume: (): void => {},
      },
      value11: HTMLDivElement | null = null,
      index4: number = 0,
      callback13 = (input?: boolean): void => {
        if (value11 === null || !value11.isConnected) {
          value11 = value2.createElement("div");
          value11.tabIndex = -1;
          value11.setAttribute("aria-hidden", "true");
          value11.style.cssText =
            "position:fixed;left:-9999px;top:0;width:1px;height:1px;padding:0;border:0;opacity:0";
          (value2.body ?? value2.documentElement).appendChild(value11);
        }
        let activeElement: Element | null = value2.activeElement;
        try {
          value11.focus({
            preventScroll: true,
          });
        } catch {
          value11.focus();
        }
        if (value2.activeElement !== activeElement) {
          index4 += 1;
        }
        if (input === true) {
          setTimeout((): void => {
            if (value2.activeElement === value11 && value11 !== null) {
              try {
                value11.focus({
                  preventScroll: true,
                });
              } catch {
                value11.focus();
              }
              if (value2.activeElement === value11) {
                flag3 = true;
              }
            }
          }, 0);
          return;
        }
        if (value2.activeElement === value11) {
          flag3 = true;
        }
      },
      callback14 = (input: Element): void => {
        if (value2.activeElement !== input) {
          if (!flag3 && !callback18()) {
            callback13();
          }
          return;
        }
        if (input instanceof value.HTMLElement) {
          input.blur();
        }
        callback13();
      },
      callback15 = (input: Element): void => {
        let activeElement: Element | null = value2.activeElement;
        if (activeElement === input) {
          callback14(input);
          return;
        }
        if (
          activeElement === null ||
          activeElement === value2.body ||
          activeElement === value2.documentElement
        ) {
          callback13();
        }
      },
      cache: WeakMap<Element, number> = new WeakMap(),
      value12: WeakSet<Element> = new WeakSet(),
      value13: WeakSet<Element> = new WeakSet(),
      callback16 = (input: Element, options: boolean): boolean => {
        if (options) {
          return false;
        }
        if (state.el === input) {
          state.counted = true;
        }
        if (!value13.has(input)) {
          value13.add(input);
          return false;
        }
        return callback10();
      },
      callback17 = (input: Element): void => {
        let value15: number = (cache.get(input) ?? 0) + 1;
        cache.set(input, value15);
        if (value15 >= 3) {
          value12.add(input);
          try {
            let value16 = input as HTMLIFrameElement;
            value16.inert = true;
            value16.style.pointerEvents = "none";
            value16.removeAttribute("src");
            value16.srcdoc = "";
          } catch {}
        }
      },
      callback18 = (): boolean => {
        let value15: EmbedLedgerEntry | null = callback5();
        return value15 !== null && value15.el === value2.activeElement;
      },
      callback19 = (): void => {
        if (value3[value5] === true) {
          return;
        }
        value3[value5] = true;
        let activeElement: Element | null = value2.activeElement;
        if (
          activeElement !== null &&
          activeElement instanceof value.HTMLElement &&
          activeElement.tagName === "IFRAME"
        ) {
          activeElement.blur();
          if (value2.activeElement === activeElement) {
            callback13();
          }
        } else if (!flag3) {
          callback13();
        }
        value.dispatchEvent(new Event(config.disabledEvent));
        setTimeout((): void => {
          if (value10 !== null && value10.isConnected) {
            let activeElement3: Element | null = value2.activeElement;
            value10.focus();
            if (value2.activeElement !== activeElement3) {
              index4 += 1;
            }
          }
          let activeElement2: Element | null = value2.activeElement;
          if (
            !flag3 ||
            (activeElement2 !== null &&
              (activeElement2.tagName === "IFRAME" ||
                activeElement2 === value11))
          ) {
            callback13();
          }
        }, 0);
      },
      callback20 = (input: Element): EmbedEvidence => {
        if (config.attribution === undefined) {
          return state3;
        }
        try {
          let value15: EmbedAttribution = config.attribution(input);
          return {
            active: value15.active,
            msSince: value15.msSince,
            pressMsSince: value15.pressMsSince,
            touchEntry: value15.touchEntry === true,
            consumeTouchEntry: (): void => {
              try {
                value15.consumeTouchEntry?.();
              } catch {
                callback19();
              }
            },
            consume: (): void => {
              try {
                value15.consume();
              } catch {
                callback19();
              }
            },
          };
        } catch {
          callback19();
          return state3;
        }
      },
      callback21 = (input: Element | null): EmbedFocusSource =>
        input !== null && input.tagName === "IFRAME"
          ? input.hasAttribute(config.markerAttr)
            ? "marked"
            : "other-frame"
          : "host",
      callback22 = (): void => {
        let value15: EmbedLedgerEntry | null = callback5();
        if (value15 === null) {
          return;
        }
        value3[value6] = null;
        callback20(value15.el).consume();
      },
      callback23 = (): void => {
        let activeElement: Element | null = value2.activeElement;
        if (value9 !== null && activeElement !== value9) {
          value9 = null;
        }
        if (flag) {
          let value22: EmbedFocusSource = callback21(activeElement);
          if (value22 === "host") {
            callback7();
          } else if (value22 === "marked" && !flag2) {
            flag = false;
          } else if (value22 === "marked" && flag2) {
            callback7();
          }
        }
        let value15: EmbedLedgerEntry | null = callback5(),
          value16 = callback({
            markPresent: value15 !== null,
            markStaleOrDeparted:
              value15 !== null && activeElement !== value15.el,
          }),
          endPriorSession: boolean = value16.endPriorSession;
        if (value16.endPriorSession) {
          callback22();
        }
        let value17: EmbedLedgerEntry | null = callback5(),
          value18: EmbedFocusSource = callback21(activeElement),
          value19: EmbedEvidence =
            value18 === "marked" && activeElement !== null
              ? callback20(activeElement)
              : state3,
          value20: boolean =
            value18 === "other-frame" && callback4(activeElement),
          value21: EmbedFocusDecision = callback3({
            alreadyDisabled: value3[value5] === true,
            framesPresent: callback12(),
            focusIn: value18,
            otherFrameLegit: value20,
            recipientLegit:
              value18 === "marked" &&
              value17 !== null &&
              value17.el === activeElement,
            msSinceGesture: value19.msSince,
            pressFresh: value19.pressMsSince <= count,
            active: value19.active,
          });
        if (value20 && activeElement !== null) {
          value9 = activeElement;
        }
        if (value21.verdict === "kill") {
          callback19();
          return;
        }
        if (value21.verdict === "pend") {
          if (activeElement !== null) {
            callback9(activeElement, endPriorSession || callback5() !== null);
          }
          return;
        }
        if (value21.markRecipient && activeElement !== null) {
          let value22: Element = activeElement;
          setTimeout((): void => {
            if (value3[value5] === true) {
              return;
            }
            if (value12.has(value22)) {
              return;
            }
            let value23: EmbedEvidence = callback20(value22);
            if (
              value23.pressMsSince <= count &&
              value2.activeElement === value22
            ) {
              callback6(value22);
              value23.consume();
            }
          }, 0);
        }
      };
    value.addEventListener(
      config.disabledEvent + ":ledger-multi",
      (): void => {
        let value15: EmbedLedgerEntry | null = callback5();
        if (value15 === null) {
          return;
        }
        if (Date.now() - (value15.grantAt ?? 0) <= 1000) {
          callback20(value15.el).consume();
          value3[value6] = null;
          if (
            (value2.activeElement === value15.el &&
              value15.el instanceof value.HTMLElement) ||
            !flag3
          ) {
            if (value15.el instanceof value.HTMLElement) {
              value15.el.blur();
            }
            if (value10 !== null && value10.isConnected) {
              let activeElement: Element | null = value2.activeElement;
              value10.focus();
              if (value2.activeElement !== activeElement) {
                index4 += 1;
              }
            } else {
              callback13();
            }
          }
        }
      },
    );
    value.addEventListener("blur", (input: FocusEvent): void => {
      if (!input.isTrusted) {
        return;
      }
      {
        let activeElement: Element | null = value2.activeElement;
        if (
          activeElement !== null &&
          activeElement.tagName === "IFRAME" &&
          activeElement.hasAttribute(config.markerAttr) &&
          value12.has(activeElement)
        ) {
          callback14(activeElement);
        }
      }
      flag5 = flag3;
      flag3 = false;
      let value15: number = index2,
        value16: number = index4,
        value17: number = index3;
      flag2 = true;
      setTimeout((): void => {
        callback7();
        let value18: boolean = value2.hasFocus();
        if (!value18) {
          flag3 = flag5;
          flag4 = true;
        }
        let value19: EmbedLedgerEntry | null = callback5(),
          value20 = callback({
            markPresent: value19 !== null,
            markStaleOrDeparted:
              value19 !== null && value18 && value19.seq <= value15,
          }),
          endPriorSession: boolean = value20.endPriorSession;
        if (value20.endPriorSession) {
          callback22();
        }
        let activeElement: Element | null = value2.activeElement,
          value21: EmbedLedgerEntry | null = callback5(),
          value22: EmbedFocusSource = callback21(activeElement),
          value23: "stale" | "marked" | "other-frame" =
            value22 === "host" ? "stale" : value22,
          value24: EmbedEvidence =
            value23 === "marked" && activeElement !== null
              ? callback20(activeElement)
              : state3;
        if (value9 !== null && activeElement !== value9) {
          value9 = null;
        }
        let value25: boolean =
            value23 === "other-frame" && callback4(activeElement),
          value26: EmbedFocusDecision = callback2({
            hasFocusAfterBlur: value18,
            alreadyDisabled: value3[value5] === true,
            framesPresent: callback12(),
            recipient: value23,
            otherFrameLegit: value25,
            recipientLegit:
              value23 === "marked" &&
              value21 !== null &&
              value21.el === activeElement,
            msSinceGesture: value24.msSince,
            pressFresh: value24.pressMsSince <= count,
            active: value24.active,
            selfEvictionSinceDispatch:
              index4 > value16 ||
              (flag3 &&
                (index3 > value17 ||
                  (state.el !== null && !state.el.isConnected))),
          });
        if (value25 && activeElement !== null) {
          value9 = activeElement;
        }
        if (value26.verdict === "kill") {
          callback19();
          return;
        }
        if (value26.verdict === "pend") {
          if (activeElement !== null) {
            callback9(activeElement, endPriorSession || callback5() !== null);
          }
          return;
        }
        if (value26.markRecipient && activeElement !== null) {
          let value27: Element = activeElement;
          setTimeout((): void => {
            if (value3[value5] === true) {
              return;
            }
            if (value12.has(value27)) {
              return;
            }
            let value28: EmbedEvidence = callback20(value27);
            if (
              value28.pressMsSince <= count &&
              value2.activeElement === value27
            ) {
              callback6(value27);
              value28.consume();
            }
          }, 0);
        }
      }, 0);
    });
    value.addEventListener("focus", (input: FocusEvent): void => {
      if (!input.isTrusted) {
        return;
      }
      flag2 = true;
      callback7();
      setTimeout(callback23, 0);
    });
    let callback24 = (): number => {
        let value15 = new Uint32Array(1);
        crypto.getRandomValues(value15);
        let value16: number = value15[0]! / 4294967296,
          value17: number = -Math.log(1 - value16) * count2;
        if (value17 < 1) {
          value17 = 1;
        }
        if (value17 > 1400) {
          value17 = 1400;
        }
        if (
          typeof value3[value7] === "number" &&
          Date.now() < (value3[value7] as number)
        ) {
          value17 = Math.min(value17, 5);
        }
        return value17;
      },
      value14: ReturnType<typeof setTimeout> | null = null,
      callback25: () => void = (): void => {
        let value15 = value14;
        value14 = setTimeout((): void => {
          try {
            callback23();
          } finally {
            callback25();
          }
        }, callback24());
        if (value15 !== null) {
          clearTimeout(value15);
        }
      };
    callback25();
    let callback26 = (): void => {
      value3[value7] = Date.now() + 2000;
      callback25();
    };
    value3["__embedSiblingEntry:" + config.disabledEvent] = (
      input: Element,
    ): void => {
      let value15: EmbedLedgerEntry | null = callback5();
      if (value15 !== null && value15.el !== input) {
        callback26();
      }
    };
    value3["__embedDepartureBoost:" + config.disabledEvent] = (): void => {
      callback26();
    };
  }
  function createEmbedFrame(options: EmbedFrameOptions): EmbedFrameMount {
    let value: HTMLIFrameElement = (options.doc ?? document).createElement(
      "iframe",
    );
    value.setAttribute("sandbox", runtime.embedSandboxPermissions);
    value.setAttribute(options.markerAttr, "");
    if (options.interactive === undefined) {
      value.setAttribute("inert", "");
    }
    value.tabIndex = -1;
    value.referrerPolicy = "no-referrer";
    value.title = options.title;
    value.style.width = "100%";
    value.style.height = "100%";
    value.style.border = "0";
    value.style.display = "block";
    if (options.interactive === undefined) {
      value.style.pointerEvents = "none";
    }
    value.style.background = "transparent";
    let flag: boolean = false;
    function value2(): void {
      if (flag) {
        return;
      }
      flag = true;
      options.onNavigated();
    }
    let callback = (input: string, options2?: string): string =>
        (0, runtime.buildEmbedSrcdoc)(input, {
          allowScripts: options.allowScripts,
          interactive: options.interactive !== undefined,
          ...(options2 !== undefined
            ? {
                saved: options2,
              }
            : {}),
          ...(options.onSave
            ? {
                keepsSaves: true,
              }
            : {}),
        }),
      callback2 = (input: string): boolean =>
        (0, runtime.inspectEmbedMarkup)(input) !== null ||
        (0, runtime.containsShadowRootMarkup)(input),
      html: string = options.html,
      value3: string = callback(html),
      flag2: boolean = false;
    if (options.interactive !== undefined && callback2(value3)) {
      html = (0, runtime.sanitizeEmbedMarkup)(options.html);
      value3 = callback(html);
      flag2 = callback2(value3);
      if (flag2) {
        value3 = callback("");
      }
    }
    if (!flag2 && options.state !== undefined) {
      value3 = callback(html, options.state);
    }
    let index: number = 0,
      value4: Window | null = null,
      flag3: boolean = false;
    value.addEventListener("load", (): void => {
      if (flag) {
        return;
      }
      if (value.srcdoc !== value3) {
        value2();
        return;
      }
      if (flag3) {
        return;
      }
      let contentWindow: Window | null = value.contentWindow,
        readyWindow: MessageEventSource | null = value5.readyWindow;
      if (
        contentWindow !== null &&
        (index > 0
          ? contentWindow !== value4
          : readyWindow !== null && contentWindow !== readyWindow) &&
        options.onRelocated
      ) {
        flag3 = true;
        options.onRelocated();
        return;
      }
      index += 1;
      if (index === 1) {
        value4 = contentWindow;
      } else {
        value2();
      }
    });
    value.srcdoc = value3;
    let value5: EmbedFrameHostHandle = new EmbedFrameHost({
      frame: value,
      renderTimeoutMs: options.renderTimeoutMs,
      onNavigating: value2,
      input: options.interactive,
      ...(options.onSave
        ? {
            onSave: options.onSave,
          }
        : {}),
    });
    return {
      iframe: value,
      host: value5,
      refused: flag2,
      dispose: (): void => {
        value5.dispose();
        value.remove();
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "EmbedFrameHost",
    () => EmbedFrameHost,
    (value) => {
      EmbedFrameHost = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeEmbedProps", () => normalizeEmbedProps);
  bindRuntimeValue(
    runtime,
    "scheduleEmbedAnimationFrame",
    () => scheduleEmbedAnimationFrame,
    (value) => {
      scheduleEmbedAnimationFrame = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clampEmbedNumber",
    () => clampEmbedNumber,
    (value) => {
      clampEmbedNumber = value;
    },
  );
  bindRuntimeValue(runtime, "embedsDisabled", () => embedsDisabled);
  bindRuntimeValue(
    runtime,
    "subscribeEmbedsDisabled",
    () => subscribeEmbedsDisabled,
  );
  bindRuntimeValue(
    runtime,
    "installEmbedRuntimeGuard",
    () => installEmbedRuntimeGuard,
  );
  bindRuntimeValue(runtime, "createEmbedFrame", () => createEmbedFrame);
  bindRuntimeValue(
    runtime,
    "initializeEmbedFrameHost",
    () => initializeEmbedFrameHost,
    (value) => {
      initializeEmbedFrameHost = value;
    },
  );
  return () => {
    EmbedFrameHost = class EmbedFrameHost {
      frame: HTMLIFrameElement;
      hostWindow: Window;
      renderTimeoutMs: number;
      onMessage: (event: MessageEvent) => void;
      pending: Map<number, PendingEmbedRender> = new Map();
      seq: number = 0;
      _ready: boolean = false;
      _version: number | null = null;
      disposed: boolean = false;
      navigated: boolean = false;
      onNavigating: (() => void) | undefined;
      input: EmbedHostInput | undefined;
      onSave: ((state: string) => void) | undefined;
      waitingState: string | null = null;
      sent: number = 0;
      readyFrom: MessageEventSource | null = null;
      get readyWindow(): MessageEventSource | null {
        return this.readyFrom;
      }
      port: MessagePort | null = null;
      portFrom: MessageEventSource | null = null;
      wheel: EmbedWheel | null = null;
      lastUpdate: {
        t: number;
        playing: boolean;
        selected: boolean;
        props: Record<string, number>;
      } | null = null;
      constructor(input: EmbedFrameHostOptions) {
        this.frame = input.frame;
        this.hostWindow = input.hostWindow ?? window;
        this.onNavigating = input.onNavigating;
        this.input = input.input;
        this.onSave = input.onSave;
        this.renderTimeoutMs = input.renderTimeoutMs ?? 1500;
        this.onMessage = (input2: MessageEvent): void => this.receive(input2);
        this.hostWindow.addEventListener("message", this.onMessage);
      }
      get ready(): boolean {
        return this._ready;
      }
      closePort(): void {
        if (this.port === null) {
          return;
        }
        this.port.onmessage = null;
        this.port.close();
        this.port = null;
      }
      receiveInput(
        input: EmbedInputMessage | string | number | boolean | null | undefined,
      ): void {
        if (this.disposed || this.navigated || this.input === undefined) {
          return;
        }
        if (typeof input !== "object" || input === null) {
          return;
        }
        let value: EmbedInputMessage = input;
        if (value.kind === "press") {
          this.input.onPress(value.cancelled === true);
        } else if (
          value.kind === "key" &&
          (value.key === "Delete" || value.key === "Escape")
        ) {
          this.input.onKey(value.key);
        } else if (value.kind === "wheel") {
          let value2: boolean = value.pinch === true;
          if (this.wheel !== null && this.wheel.pinch !== value2) {
            this.flushWheel();
          }
          let value3: boolean = this.wheel === null,
            value4: EmbedWheel = this.wheel ?? {
              dx: 0,
              dy: 0,
              pinch: value2,
              x: 0,
              y: 0,
            },
            value5: number = value2 ? 120 : 400;
          this.wheel = {
            dx: clampEmbedNumber(
              value4.dx + clampEmbedNumber(value.dx, -value5, value5),
              -value5,
              value5,
            ),
            dy: clampEmbedNumber(
              value4.dy + clampEmbedNumber(value.dy, -value5, value5),
              -value5,
              value5,
            ),
            pinch: value2,
            x: clampEmbedNumber(value.x, 0, this.frame.clientWidth ?? 8192),
            y: clampEmbedNumber(value.y, 0, this.frame.clientHeight ?? 8192),
          };
          if (value3) {
            scheduleEmbedAnimationFrame((): void => this.flushWheel());
          }
        }
      }
      flushWheel(): void {
        let wheel: EmbedWheel | null = this.wheel;
        this.wheel = null;
        if (wheel !== null && !this.disposed && !this.navigated) {
          this.input?.onWheel(wheel);
        }
      }
      dispose(): void {
        this.disposed = true;
        this.closePort();
        this.hostWindow.removeEventListener("message", this.onMessage);
        for (let [, value] of this.pending) {
          clearTimeout(value.timer);
          value.resolve(null);
        }
        this.pending.clear();
      }
      post(input: object): void {
        let contentWindow: Window | null = this.frame.contentWindow;
        if (contentWindow === null || this.disposed || this.navigated) {
          return;
        }
        try {
          contentWindow.postMessage(input, "*");
        } catch {}
      }
      update(input: EmbedHostUpdate): void {
        this.lastUpdate = {
          t: input.t,
          playing: input.playing === true,
          selected: input.selected === true,
          props: normalizeEmbedProps(input.props),
        };
        this.post({
          type: "appifact-embed:update",
          ...this.lastUpdate,
        });
      }
      state(input: string): void {
        if (this._ready || this.waitingState === null) {
          this.sent += 1;
        }
        if (this._ready) {
          this.post({
            type: "appifact-embed:state",
            state: input,
          });
        } else {
          this.waitingState = input;
        }
      }
      setSelected(input: boolean): void {
        this.post({
          type: "appifact-embed:selected",
          selected: input === true,
        });
      }
      gesture(source: EmbedGesture): void {
        this.post({
          type: "appifact-embed:gesture",
          gesture: {
            kind: source.kind,
            x: Number.isFinite(source.x) ? source.x : 0,
            y: Number.isFinite(source.y) ? source.y : 0,
            id: Number.isFinite(source.id) ? source.id : 0,
          },
        });
      }
      render(
        input: number,
        options: EmbedPropsInput | undefined,
        context: number,
        value: number,
      ): Promise<EmbedRenderedPixels | null> {
        let value2: number = Math.max(1, Math.min(8192, Math.floor(context))),
          value3: number = Math.max(1, Math.min(8192, Math.floor(value))),
          value4: number = this.seq++;
        return new Promise<EmbedRenderedPixels | null>(
          (input2: (frame: EmbedRenderedPixels | null) => void): void => {
            let value5: ReturnType<typeof setTimeout> = setTimeout((): void => {
              this.pending.delete(value4);
              input2(null);
            }, this.renderTimeoutMs);
            this.pending.set(value4, {
              resolve: input2,
              width: value2,
              height: value3,
              timer: value5,
            });
            this.post({
              type: "appifact-embed:render",
              seq: value4,
              t: input,
              props: normalizeEmbedProps(options),
              width: value2,
              height: value3,
            });
          },
        );
      }
      receive(dataset: MessageEvent): void {
        let contentWindow: Window | null = this.frame.contentWindow;
        if (contentWindow === null || dataset.source !== contentWindow) {
          return;
        }
        if (dataset.origin !== "null") {
          return;
        }
        if (this.navigated) {
          return;
        }
        let data:
          | EmbedFrameMessage
          | string
          | number
          | boolean
          | null
          | undefined = dataset.data;
        if (typeof data !== "object" || data === null) {
          return;
        }
        if (data.type === "appifact-embed:navigating") {
          this.navigated = true;
          this._ready = false;
          this.closePort();
          for (let [, value] of this.pending) {
            clearTimeout(value.timer);
            value.resolve(null);
          }
          this.pending.clear();
          this.onNavigating?.();
          return;
        }
        if (data.type === "appifact-embed:save") {
          if (
            (this.readyFrom !== null && dataset.source !== this.readyFrom) ||
            data.applied !== this.sent
          ) {
            return;
          }
          if (
            this.onSave !== undefined &&
            typeof data.state === "string" &&
            data.state.length <= 16384
          ) {
            this.onSave(data.state);
          }
          return;
        }
        if (data.type === "appifact-embed:port") {
          let value: MessagePort | undefined = dataset.ports?.[0],
            value2: boolean =
              this.port === null
                ? !this._ready
                : dataset.source !== this.portFrom;
          if (this.input === undefined || value === undefined || !value2) {
            return;
          }
          this.closePort();
          this.port = value;
          this.portFrom = dataset.source;
          value.onmessage = (input: MessageEvent): void =>
            this.receiveInput(input.data);
          return;
        }
        if (data.type === "appifact-embed:ready") {
          if (data.version === 1) {
            this._ready = true;
            this._version = data.version;
            if (this.readyFrom === null) {
              this.readyFrom = dataset.source;
            }
            if (this.lastUpdate !== null) {
              this.post({
                type: "appifact-embed:update",
                ...this.lastUpdate,
              });
            }
            if (this.waitingState !== null) {
              this.post({
                type: "appifact-embed:state",
                state: this.waitingState,
              });
            }
            this.waitingState = null;
          }
          return;
        }
        if (data.type === "appifact-embed:frame") {
          let value: number = typeof data.seq === "number" ? data.seq : -1,
            entry: PendingEmbedRender | undefined = this.pending.get(value);
          if (entry === undefined) {
            return;
          }
          let value2: number = typeof data.width === "number" ? data.width : 0,
            value3: number = typeof data.height === "number" ? data.height : 0,
            pixels: unknown = data.pixels;
          if (
            value2 !== entry.width ||
            value3 !== entry.height ||
            !(pixels instanceof ArrayBuffer) ||
            pixels.byteLength !== value2 * value3 * 4
          ) {
            this.pending.delete(value);
            clearTimeout(entry.timer);
            entry.resolve(null);
            return;
          }
          this.pending.delete(value);
          clearTimeout(entry.timer);
          entry.resolve({
            width: value2,
            height: value3,
            pixels: new Uint8ClampedArray(pixels),
          });
          return;
        }
        if (data.type === "appifact-embed:frame-error") {
          let value: number = typeof data.seq === "number" ? data.seq : -1,
            entry: PendingEmbedRender | undefined = this.pending.get(value);
          if (entry === undefined) {
            return;
          }
          this.pending.delete(value);
          clearTimeout(entry.timer);
          entry.resolve(null);
          return;
        }
      }
    };
    scheduleEmbedAnimationFrame = (input: () => void): void =>
      void (typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(input)
        : setTimeout(input, 16));
    clampEmbedNumber = (
      input: unknown,
      options: number,
      context: number,
    ): number =>
      typeof input === "number" && Number.isFinite(input)
        ? Math.max(options, Math.min(context, input))
        : 0;
    initializeEmbedFrameHost = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeEmbedSanitizer)();
      (0, runtime.initializeEmbedDocument)();
    });
  };
}
