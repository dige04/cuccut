/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement, ReactNode, Ref } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";

/** A position inside the cursor's roaming area. */
export interface CursorPoint {
  x: number;
  y: number;
}
/** One eased stroke of cursor motion; times are in seconds. */
export interface CursorMotionStroke {
  /** Start time. */
  t0: number;
  /** Duration. */
  T: number;
  dx: number;
  dy: number;
  /** Sideways bend of the path. */
  bend: number;
}
/** Half the width and height of the area the cursor roams in. */
export interface CursorLimits {
  rx: number;
  ry: number;
}
/** The first movement of the cursor, ending where it idles. */
export interface CursorIntroPath {
  from: CursorPoint;
  strokes: CursorMotionStroke[];
  rest: CursorPoint;
}
/** A small drift to a new resting spot. */
export interface CursorIdleMotion {
  strokes: CursorMotionStroke[];
  rest: CursorPoint;
}
export interface AgentWorkingCursorProps {
  working: boolean;
  /** Color family of the cursor, as in `--cds-<tint>-500`. */
  tint: string;
  /** Shown while the agent is not working. */
  idle: ReactNode;
  action?: ReactNode;
  busy?: boolean;
}
export interface AnimatedAgentLabelProps {
  text: string;
  /** Fade-out time of the old text, in milliseconds. */
  outMs: number;
  /** Fade-in time of the new text, in milliseconds. */
  inMs: number;
  shimmer?: boolean;
}
/** The two stacked text lines of the label, one in front. */
interface AgentLabelFaces {
  a: string;
  b: string;
  front: "a" | "b";
}
/** Measured width of the label and whether it just got narrower. */
interface AgentLabelSize {
  width: number;
  narrows: boolean;
}
/** Text on the tag next to the cursor. */
export type AgentCursorLabelSpec =
  | { kind: "name"; text: string }
  | {
      kind: "words";
      text: string;
      index?: number;
      shimmer?: boolean;
      outMs?: number;
      inMs?: number;
    };
export interface AgentCursorLabelProps {
  tint: string;
  label: AgentCursorLabelSpec;
}
export interface AgentCursorProps {
  tint: string;
  label: AgentCursorLabelSpec;
  /** Position of the arrow; the cursor flows with the layout when absent. */
  at?: { left: number; top: number };
  align?: "arrow" | "centre";
  /** Glide time to a new position, in milliseconds. */
  glideMs?: number;
  glyphScale?: number;
  hidden?: boolean;
  arrowRef?: Ref<HTMLDivElement>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    reactIV0: ReactNamespace;
    jsxFc: JsxNamespace;
    jsxsG: JsxNamespace;
    reactc3: ReactNamespace;
    jsxcq: JsxNamespace;
    jsxWz: JsxNamespace;
    PeerCursorArrow: (props: { color: string }) => ReactElement;
    seededCursorRandom: (seed: number) => () => number;
    clampCursorProgress: (progress: number) => number;
    cursorMotionEase: (progress: number) => number;
    cursorBendEnvelope: (progress: number) => number;
    cursorPositionAt: (
      initial: CursorPoint,
      motions: readonly CursorMotionStroke[],
      now: number,
    ) => CursorPoint;
    cursorMotionEndTime: (motions: readonly CursorMotionStroke[]) => number;
    createCursorMotion: (
      random: () => number,
      from: CursorPoint,
      to: CursorPoint,
      startTime: number,
      bend: number,
    ) => CursorMotionStroke[];
    createCursorIntroPath: (
      random: () => number,
      limits: CursorLimits,
    ) => CursorIntroPath;
    createCursorIdleMotion: (
      random: () => number,
      from: CursorPoint,
      limits: CursorLimits,
      startTime: number,
    ) => CursorIdleMotion;
    CLAUDE_WORKING_LABEL: string;
    CLAUDE_WORKING_LABEL_WIDTH: number;
    CLAUDE_WORKING_LABEL_HEIGHT: number;
    CLAUDE_WORKING_MARGIN: number;
    CLAUDE_CURSOR_IDLE_MS: number;
    CLAUDE_CURSOR_GLIDE_MS: number;
    CLAUDE_CURSOR_ARROW_SIZE: number;
    CLAUDE_CURSOR_LABEL_OFFSET: number;
    animateAgentWorkingCursor: (
      surface: HTMLElement,
      arrow: HTMLElement,
      label: HTMLElement,
      reducedMotion: boolean,
    ) => () => void;
    AgentWorkingCursor: (props: AgentWorkingCursorProps) => ReactElement;
    CLAUDE_LABEL_OUT_MS: number;
    CLAUDE_LABEL_IN_MS: number;
    AnimatedAgentLabel: (props: AnimatedAgentLabelProps) => ReactElement;
    AgentCursorLabel: (props: AgentCursorLabelProps) => ReactElement;
    AgentCursor: (props: AgentCursorProps) => ReactElement;
  }
}

export function installUiAgentCursor(runtime: RuntimeBindings): () => void {
  var reactIV0: ReactNamespace;
  var jsxFc: JsxNamespace;
  var clampCursorProgress: RuntimeBindings["clampCursorProgress"];
  var cursorMotionEase: RuntimeBindings["cursorMotionEase"];
  var cursorBendEnvelope: RuntimeBindings["cursorBendEnvelope"];
  var cursorMotionEndTime: RuntimeBindings["cursorMotionEndTime"];
  var jsxsG: JsxNamespace;
  var CLAUDE_WORKING_LABEL: string;
  var CLAUDE_WORKING_LABEL_WIDTH: number;
  var CLAUDE_WORKING_LABEL_HEIGHT: number;
  var CLAUDE_WORKING_MARGIN: number;
  var CLAUDE_CURSOR_IDLE_MS: number;
  var CLAUDE_CURSOR_GLIDE_MS: number;
  var CLAUDE_CURSOR_ARROW_SIZE: number;
  var CLAUDE_CURSOR_LABEL_OFFSET: number;
  var reactc3: ReactNamespace;
  var jsxcq: JsxNamespace;
  var CLAUDE_LABEL_OUT_MS: number;
  var CLAUDE_LABEL_IN_MS: number;
  var jsxWz: JsxNamespace;
  function PeerCursorArrow({ color: color }: { color: string }): ReactElement {
    return jsxFc.jsx("svg", {
      "aria-hidden": "true",
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      className: "mc-peer-cursor-arrow",
      children: jsxFc.jsx("path", {
        d: "M1.5 1.2 L14 7.2 L8.4 8.6 L6.4 14.5 Z",
        fill: color,
        stroke: "#fff",
        strokeWidth: "1.2",
        strokeLinejoin: "round",
      }),
    });
  }
  function seededCursorRandom(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
      value = (value + 1831565813) >>> 0;
      let value2 = Math.imul(value ^ (value >>> 15), value | 1);
      value2 ^= value2 + Math.imul(value2 ^ (value2 >>> 7), value2 | 61);
      return ((value2 ^ (value2 >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cursorPositionAt(
    initial: CursorPoint,
    motions: readonly CursorMotionStroke[],
    now: number,
  ): CursorPoint {
    let { x: x, y: y } = initial;
    for (let value of motions) {
      let value2 = (now - value.t0) / value.T;
      if (value2 <= 0) {
        continue;
      }
      let value3 = cursorMotionEase(value2);
      x += value.dx * value3;
      y += value.dy * value3;
      let value4 = Math.hypot(value.dx, value.dy);
      if (value4 > 0 && value.bend !== 0 && value2 < 1) {
        let value5 =
          (value.bend * cursorBendEnvelope(value2)) / value4;
        x += -value.dy * value5;
        y += value.dx * value5;
      }
    }
    return {
      x: x,
      y: y,
    };
  }
  function createCursorMotion(
    random: () => number,
    from: CursorPoint,
    to2: CursorPoint,
    startTime: number,
    bend: number,
  ): CursorMotionStroke[] {
    let value = to2.x - from.x,
      value2 = to2.y - from.y,
      value3 = Math.hypot(value, value2),
      value4 =
        random() < 0.75 ? 0.05 + 0.08 * random() : -(0.05 + 0.06 * random()),
      value5 = (random() - 0.5) * 0.1,
      state = {
        t0: startTime,
        T: 0.9 + 0.25 * random() + Math.min(0.2, value3 / 600),
        dx: value * (1 + value4) - value2 * value5,
        dy: value2 * (1 + value4) + value * value5,
        bend: bend * (0.1 + 0.1 * random()) * value3,
      };
    return [
      state,
      {
        t0: startTime + (0.7 + 0.08 * random()) * state.T,
        T: 0.5 + 0.2 * random(),
        dx: value - state.dx,
        dy: value2 - state.dy,
        bend: 0,
      },
    ];
  }
  function createCursorIntroPath(
    random: () => number,
    { rx: limits, ry: ry2 }: CursorLimits,
  ): CursorIntroPath {
    let value = random() < 0.65 ? 1 : -1,
      state = {
        x: (random() - 0.5) * 0.3 * limits,
        y: (random() - 0.3) * 0.4 * ry2,
      },
      value2 = random() < 0.7 ? value : -value,
      value3 = value2 === value ? 0 : 0.2,
      state2 = {
        x: value * (0.72 + 0.2 * random()) * limits,
        y: (0.65 - value3 + 0.3 * random()) * ry2,
      };
    if (random() < 0.6) {
      return {
        from: state2,
        strokes: createCursorMotion(random, state2, state, 0, value2),
        rest: state,
      };
    }
    let state3 = {
        x: state.x + value * (0.1 + 0.3 * random()) * limits,
        y: state.y - (0.4 + 0.4 * random()) * ry2,
      },
      state4 = {
        t0: 0,
        T: 0.85 + 0.2 * random(),
        dx: state3.x - state2.x,
        dy: state3.y - state2.y,
        bend:
          value2 * 0.12 * Math.hypot(state3.x - state2.x, state3.y - state2.y),
      };
    return {
      from: state2,
      strokes: [
        state4,
        ...createCursorMotion(
          random,
          state3,
          state,
          (0.5 + 0.1 * random()) * state4.T,
          -value2,
        ),
      ],
      rest: state,
    };
  }
  function createCursorIdleMotion(
    random: () => number,
    from: CursorPoint,
    { rx: limits, ry: startTime }: CursorLimits,
    value: number,
  ): CursorIdleMotion {
    let callback = (input: number, options: number) =>
        Math.min(options, Math.max(-options, input)),
      value2 = from,
      value3 = -1;
    for (let index = 0; index < 8 && value3 < 30; index++) {
      let value4 = random() * 2 * Math.PI,
        value5 = 30 + 50 * random(),
        state = {
          x: callback(from.x + value5 * Math.cos(value4), 0.62 * limits),
          y: callback(
            from.y + 0.6 * value5 * Math.sin(value4),
            0.5 * startTime,
          ),
        },
        value6 = Math.hypot(state.x - from.x, state.y - from.y);
      if (value6 > value3) {
        value3 = value6;
        value2 = state;
      }
    }
    return {
      strokes: createCursorMotion(
        random,
        from,
        value2,
        value,
        random() < 0.5 ? 1 : -1,
      ),
      rest: value2,
    };
  }
  function animateAgentWorkingCursor(
    surface: HTMLElement,
    arrow: HTMLElement,
    label: HTMLElement,
    reducedMotion: boolean,
  ): () => void {
    let value =
        reducedMotion || typeof requestAnimationFrame !== "function",
      clientWidth = surface.clientWidth,
      clientHeight = surface.clientHeight,
      callback = () => ({
        rx: Math.max(
          0,
          (clientWidth -
            CLAUDE_WORKING_LABEL_WIDTH -
            2 * CLAUDE_WORKING_MARGIN) /
            2,
        ),
        ry: Math.max(
          0,
          (clientHeight -
            CLAUDE_WORKING_LABEL_HEIGHT -
            2 * CLAUDE_WORKING_MARGIN) /
            2,
        ),
      }),
      value2 = seededCursorRandom(Math.random() * 4294967296),
      value3 = createCursorIntroPath(value2, callback()),
      from = value3.from,
      strokes = value3.strokes,
      NaN2 = Number.NaN,
      index = 0,
      index2 = 0,
      index3 = 0,
      count = 0.18,
      value4 = -1,
      index4 = 0,
      value5: ReturnType<typeof setTimeout> | undefined,
      callback2 = (input: number) => {
        let value7 =
          value4 < 0 ? 0 : Math.min(0.05, Math.max(0, (input - value4) / 1000));
        value4 = input;
        count += value7;
        let { rx: value8, ry: value9 } = callback(),
          value10 = value
            ? value3.rest
            : cursorPositionAt(from, strokes, count),
          value11 =
            CLAUDE_WORKING_MARGIN +
            value8 +
            Math.min(value8, Math.max(-value8, value10.x)),
          value12 =
            CLAUDE_WORKING_MARGIN +
            value9 +
            Math.min(value9, Math.max(-value9, value10.y));
        if (value || Number.isNaN(NaN2)) {
          NaN2 = value11;
          index = value12;
        }
        for (let value14 = value7; value14 > 0; value14 -= 0.008) {
          let value15 = Math.min(0.008, value14);
          index2 +=
            (CLAUDE_CURSOR_IDLE_MS * (value11 - NaN2) -
              CLAUDE_CURSOR_GLIDE_MS * index2) *
            value15;
          index3 +=
            (CLAUDE_CURSOR_IDLE_MS * (value12 - index) -
              CLAUDE_CURSOR_GLIDE_MS * index3) *
            value15;
          NaN2 += index2 * value15;
          index += index3 * value15;
        }
        let value13 =
          !value &&
          (count < cursorMotionEndTime(strokes) ||
            Math.abs(value11 - NaN2) + Math.abs(value12 - index) > 0.05 ||
            Math.abs(index2) + Math.abs(index3) > 1);
        if (!value13) {
          NaN2 = value11;
          index = value12;
          index2 = index3 = 0;
        }
        arrow.style.transform =
          "translate(" +
          value11.toFixed(2) +
          "px," +
          value12.toFixed(2) +
          "px)";
        label.style.transform =
          "translate(" + NaN2.toFixed(2) + "px," + index.toFixed(2) + "px)";
        return value13;
      },
      callback3 = (input: number) => {
        index4 = callback2(input) ? requestAnimationFrame(callback3) : 0;
        if (index4 === 0) {
          callback5();
        }
      },
      callback4 = () => {
        value4 = -1;
        index4 = requestAnimationFrame(callback3);
      },
      callback5 = () => {
        value5 = setTimeout(
          () => {
            from = cursorPositionAt(from, strokes, count);
            strokes = createCursorIdleMotion(
              value2,
              from,
              callback(),
              count,
            ).strokes;
            callback4();
          },
          (CLAUDE_CURSOR_ARROW_SIZE + CLAUDE_CURSOR_LABEL_OFFSET * value2()) *
            1000,
        );
      },
      value6 =
        typeof ResizeObserver === "function"
          ? new ResizeObserver(() => {
              clientWidth = surface.clientWidth;
              clientHeight = surface.clientHeight;
              if (index4 === 0) {
                NaN2 = Number.NaN;
                callback2(value4);
              }
            })
          : null;
    value6?.observe(surface);
    callback2(typeof performance === "object" ? performance.now() : 0);
    if (!value) {
      callback4();
    }
    return () => {
      if (index4 !== 0) {
        cancelAnimationFrame(index4);
      }
      clearTimeout(value5);
      value6?.disconnect();
    };
  }
  function AgentWorkingCursor({
    working: working,
    tint: tint,
    idle: idle,
    action: action,
    busy: busy,
  }: AgentWorkingCursorProps): ReactElement {
    let ref = reactIV0.useRef<HTMLDivElement>(null),
      ref2 = reactIV0.useRef<HTMLDivElement>(null),
      ref3 = reactIV0.useRef<HTMLDivElement>(null);
    reactIV0.useLayoutEffect(() => {
      let current = ref.current,
        current2 = ref2.current,
        current3 = ref3.current;
      if (!working || !current || !current2 || !current3) {
        return;
      }
      let value2 =
          typeof matchMedia === "function"
            ? matchMedia("(prefers-reduced-motion: reduce)")
            : null,
        value3 = animateAgentWorkingCursor(
          current,
          current2,
          current3,
          value2?.matches === true,
        ),
        callback = () => {
          value3();
          value3 = animateAgentWorkingCursor(
            current,
            current2,
            current3,
            value2?.matches === true,
          );
        };
      value2?.addEventListener?.("change", callback);
      return () => {
        value2?.removeEventListener?.("change", callback);
        value3();
      };
    }, [working]);
    let value = "var(--cds-" + tint + "-500)";
    return jsxsG.jsxs("div", {
      "data-kit": "claude-working-empty-state",
      "data-working": working ? "true" : undefined,
      className: "mc-claude-empty flex flex-col items-center gap-3",
      children: [
        jsxsG.jsxs("div", {
          className: "relative",
          "aria-busy": busy ? true : undefined,
          children: [
            jsxsG.jsx("div", {
              className:
                "mc-claude-empty-idle flex flex-col items-center gap-3",
              "aria-hidden": working ? true : undefined,
              children: idle,
            }),
            jsxsG.jsxs("div", {
              ref: ref,
              className: "mc-claude-empty-working",
              "aria-hidden": "true",
              children: [
                jsxsG.jsx("div", {
                  ref: ref3,
                  className: "mc-peer-cursor",
                  children: jsxsG.jsx("span", {
                    className: "mc-peer-tag mc-cursor-chat",
                    style: {
                      background: value,
                    },
                    children: CLAUDE_WORKING_LABEL,
                  }),
                }),
                jsxsG.jsx("div", {
                  ref: ref2,
                  className: "mc-peer-cursor",
                  children: jsxsG.jsx(PeerCursorArrow, {
                    color: value,
                  }),
                }),
              ],
            }),
          ],
        }),
        action,
        working
          ? jsxsG.jsx("span", {
              className: "sr-only",
              children: CLAUDE_WORKING_LABEL,
            })
          : null,
      ],
    });
  }
  function AnimatedAgentLabel({
    text: text,
    outMs: outMs,
    inMs: inMs,
    shimmer: shimmer,
  }: AnimatedAgentLabelProps): ReactElement {
    let [value, value2] = reactc3.useState<AgentLabelFaces>({
        a: text,
        b: "",
        front: "a",
      }),
      ref = reactc3.useRef<HTMLSpanElement>(null),
      [value3, value4] = reactc3.useState<AgentLabelSize | null>(null),
      [value5, value6] = reactc3.useState(0);
    reactc3.useEffect(() => {
      value2((input: AgentLabelFaces) => {
        if ((input.front === "a" ? input.a : input.b) === text) {
          return input;
        }
        if (input.front === "a") {
          return {
            ...input,
            b: text,
            front: "b",
          };
        } else {
          return {
            ...input,
            a: text,
            front: "a",
          };
        }
      });
    }, [text]);
    reactc3.useEffect(() => {
      let flag = true;
      (typeof document !== "undefined"
        ? document.fonts?.ready
        : undefined
      )?.then(() => {
        if (flag) {
          value6((input) => input + 1);
        }
      });
      return () => {
        flag = false;
      };
    }, []);
    reactc3.useLayoutEffect(() => {
      if (!ref.current) {
        return;
      }
      let value9 = ref.current.offsetWidth + 1;
      value4(
        (input: AgentLabelSize | null) =>
          input !== null && input.width === value9
            ? input
            : {
                width: value9,
                narrows: input !== null && value9 < input.width,
              },
      );
    }, [value, value5]);
    let value7 =
        value3?.narrows === true
          ? {
              transitionDuration: inMs + "ms",
              transitionDelay: outMs + "ms",
            }
          : {
              transitionDuration: outMs + "ms",
              transitionDelay: "0ms",
            },
      callback = (input: boolean) =>
        input
          ? {
              transitionDuration: inMs + "ms",
              transitionDelay: outMs + "ms",
            }
          : {
              transitionDuration: outMs + "ms",
              transitionDelay: "0ms",
            },
      value8 = value.front === "a" ? value.a : value.b;
    return jsxcq.jsxs("span", {
      className: "mc-tip-fade",
      style: {
        width: value3 === null ? undefined : value3.width,
        ...value7,
      },
      children: [
        jsxcq.jsx("span", {
          ref: ref,
          className: "mc-tip-sizer",
          "aria-hidden": "true",
          children: value8,
        }),
        (["a", "b"] as const).map(
          (input) =>
            jsxcq.jsx(
              "span",
              {
                className: shimmer
                  ? "mc-tip-line mc-tip-shimmer"
                  : "mc-tip-line",
                "data-front": value.front === input ? "true" : undefined,
                style: callback(value.front === input),
                children: value[input],
              },
              input,
            ),
        ),
      ],
    });
  }
  function AgentCursorLabel({
    tint: tint,
    label: label,
  }: AgentCursorLabelProps): ReactElement {
    let value = "var(--cds-" + tint + "-500)";
    if (label.kind === "name") {
      return jsxcq.jsx("span", {
        "aria-hidden": "true",
        className: "mc-peer-tag mc-peer-cursor-label mc-claude-tag-name",
        style: {
          background: value,
        },
        children: label.text,
      });
    }
    return jsxcq.jsx("span", {
      "aria-hidden": "true",
      className: "mc-peer-tag mc-cursor-chat",
      style: {
        background: value,
      },
      children: jsxcq.jsx(AnimatedAgentLabel, {
        text: label.text,
        outMs: label.outMs ?? CLAUDE_LABEL_OUT_MS,
        inMs: label.inMs ?? CLAUDE_LABEL_IN_MS,
        shimmer: label.shimmer === true,
      }),
    });
  }
  function AgentCursor({
    tint: tint,
    label: label,
    at: at,
    align = "arrow",
    glideMs = 0,
    glyphScale: glyphScale,
    hidden = false,
    arrowRef: arrowRef,
  }: AgentCursorProps): ReactElement {
    let value =
        glyphScale !== undefined &&
        Number.isFinite(glyphScale) &&
        glyphScale > 0
          ? glyphScale
          : 1,
      value2 = at !== undefined && glideMs > 0,
      value3 = value === 1 ? "" : " scale(" + String(value) + ")",
      value4 =
        at !== undefined
          ? {
              transform:
                "translate(" +
                String(at.left) +
                "px," +
                String(at.top) +
                "px)" +
                value3,
              transformOrigin: "0 0",
              ...(value2
                ? {
                    "--mc-claude-glide": String(glideMs) + "ms",
                  }
                : {}),
            }
          : value === 1
            ? undefined
            : {
                transform: value3.trim(),
                transformOrigin: "0 0",
              };
    return jsxWz.jsx("div", {
      "aria-hidden": "true",
      className: "mc-claude-cursor",
      "data-flow": at === undefined ? "" : undefined,
      "data-align":
        at !== undefined && align === "centre" ? "centre" : undefined,
      "data-glide": value2 ? "" : undefined,
      "data-hidden": hidden ? "" : undefined,
      style: value4,
      children: jsxWz.jsxs("div", {
        className: "mc-claude-cursor-unit",
        children: [
          jsxWz.jsx("div", {
            ref: arrowRef,
            className: "mc-claude-cursor-arrow",
            children: jsxWz.jsx(PeerCursorArrow, {
              color: "var(--cds-" + tint + "-500)",
            }),
          }),
          jsxWz.jsx(AgentCursorLabel, {
            tint: tint,
            label: label,
          }),
        ],
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "reactIV0",
    () => reactIV0,
    (value) => {
      reactIV0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxFc",
    () => jsxFc,
    (value) => {
      jsxFc = value;
    },
  );
  bindRuntimeValue(runtime, "PeerCursorArrow", () => PeerCursorArrow);
  bindRuntimeValue(runtime, "seededCursorRandom", () => seededCursorRandom);
  bindRuntimeValue(
    runtime,
    "clampCursorProgress",
    () => clampCursorProgress,
    (value) => {
      clampCursorProgress = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cursorMotionEase",
    () => cursorMotionEase,
    (value) => {
      cursorMotionEase = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cursorBendEnvelope",
    () => cursorBendEnvelope,
    (value) => {
      cursorBendEnvelope = value;
    },
  );
  bindRuntimeValue(runtime, "cursorPositionAt", () => cursorPositionAt);
  bindRuntimeValue(
    runtime,
    "cursorMotionEndTime",
    () => cursorMotionEndTime,
    (value) => {
      cursorMotionEndTime = value;
    },
  );
  bindRuntimeValue(runtime, "createCursorMotion", () => createCursorMotion);
  bindRuntimeValue(
    runtime,
    "createCursorIntroPath",
    () => createCursorIntroPath,
  );
  bindRuntimeValue(
    runtime,
    "createCursorIdleMotion",
    () => createCursorIdleMotion,
  );
  bindRuntimeValue(
    runtime,
    "jsxsG",
    () => jsxsG,
    (value) => {
      jsxsG = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_WORKING_LABEL",
    () => CLAUDE_WORKING_LABEL,
    (value) => {
      CLAUDE_WORKING_LABEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_WORKING_LABEL_WIDTH",
    () => CLAUDE_WORKING_LABEL_WIDTH,
    (value) => {
      CLAUDE_WORKING_LABEL_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_WORKING_LABEL_HEIGHT",
    () => CLAUDE_WORKING_LABEL_HEIGHT,
    (value) => {
      CLAUDE_WORKING_LABEL_HEIGHT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_WORKING_MARGIN",
    () => CLAUDE_WORKING_MARGIN,
    (value) => {
      CLAUDE_WORKING_MARGIN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_CURSOR_IDLE_MS",
    () => CLAUDE_CURSOR_IDLE_MS,
    (value) => {
      CLAUDE_CURSOR_IDLE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_CURSOR_GLIDE_MS",
    () => CLAUDE_CURSOR_GLIDE_MS,
    (value) => {
      CLAUDE_CURSOR_GLIDE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_CURSOR_ARROW_SIZE",
    () => CLAUDE_CURSOR_ARROW_SIZE,
    (value) => {
      CLAUDE_CURSOR_ARROW_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_CURSOR_LABEL_OFFSET",
    () => CLAUDE_CURSOR_LABEL_OFFSET,
    (value) => {
      CLAUDE_CURSOR_LABEL_OFFSET = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "animateAgentWorkingCursor",
    () => animateAgentWorkingCursor,
  );
  bindRuntimeValue(runtime, "AgentWorkingCursor", () => AgentWorkingCursor);
  bindRuntimeValue(
    runtime,
    "reactc3",
    () => reactc3,
    (value) => {
      reactc3 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxcq",
    () => jsxcq,
    (value) => {
      jsxcq = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_LABEL_OUT_MS",
    () => CLAUDE_LABEL_OUT_MS,
    (value) => {
      CLAUDE_LABEL_OUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_LABEL_IN_MS",
    () => CLAUDE_LABEL_IN_MS,
    (value) => {
      CLAUDE_LABEL_IN_MS = value;
    },
  );
  bindRuntimeValue(runtime, "AnimatedAgentLabel", () => AnimatedAgentLabel);
  bindRuntimeValue(runtime, "AgentCursorLabel", () => AgentCursorLabel);
  bindRuntimeValue(
    runtime,
    "jsxWz",
    () => jsxWz,
    (value) => {
      jsxWz = value;
    },
  );
  bindRuntimeValue(runtime, "AgentCursor", () => AgentCursor);
  return () => {
    reactIV0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxFc = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    clampCursorProgress = (progress: number) =>
      progress < 0 ? 0 : progress > 1 ? 1 : progress;
    cursorMotionEase = (progress: number) => {
      let value = Math.pow(clampCursorProgress(progress), 0.86);
      return value * value * value * (10 + value * (6 * value - 15));
    };
    cursorBendEnvelope = (progress: number) => {
      let value =
        clampCursorProgress(progress) * (1 - clampCursorProgress(progress));
      return 16 * value * value;
    };
    cursorMotionEndTime = (motions: readonly CursorMotionStroke[]) =>
      motions.reduce(
        (input: number, options: CursorMotionStroke) =>
          Math.max(input, options.t0 + options.T),
        0,
      );
    jsxsG = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    CLAUDE_WORKING_LABEL = "The agent is working…";
    CLAUDE_WORKING_LABEL_WIDTH = 176;
    CLAUDE_WORKING_LABEL_HEIGHT = 56;
    CLAUDE_WORKING_MARGIN = 8;
    CLAUDE_CURSOR_IDLE_MS = 1600;
    CLAUDE_CURSOR_GLIDE_MS = 76;
    CLAUDE_CURSOR_ARROW_SIZE = 12;
    CLAUDE_CURSOR_LABEL_OFFSET = 14;
    reactc3 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    jsxcq = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    CLAUDE_LABEL_OUT_MS = 80;
    CLAUDE_LABEL_IN_MS = 120;
    jsxWz = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
  };
}
