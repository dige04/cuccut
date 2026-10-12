/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type {
  EmbedFrameHostHandle,
  EmbedFrameMount,
  EmbedHostInput,
  EmbedWheel,
} from "./frame-host";

/** Input handlers for an interactive embed, plus the notice that the guard refused to run it. */
export interface EmbedFrameInteractive extends EmbedHostInput {
  onRefused(): void;
}
export interface EmbedFrameProps {
  html: string;
  allowScripts?: boolean;
  markerAttr: string;
  title: string;
  onNavigated: () => void;
  /** Receives the host controller once the frame mounts, and null when it unmounts. */
  onHost: (host: EmbedFrameHostHandle | null) => void;
  interactive?: EmbedFrameInteractive;
  /** Saved embed state (a JSON string) to push into the frame. */
  state?: string;
  onSave?: (state: string) => void;
  /** True when a state change is an echo of this viewer's own save. */
  isOwnWrite?: (state: string) => boolean;
}
/** The latest callbacks, read by long-lived effects without re-subscribing. */
interface EmbedFrameLatest {
  onNavigated: () => void;
  onHost: (host: EmbedFrameHostHandle | null) => void;
  interactive: EmbedFrameInteractive | undefined;
  onSave: ((state: string) => void) | undefined;
  isOwnWrite: ((state: string) => boolean) | undefined;
}

declare module "../bindings" {
  interface RuntimeBindings {
    EmbedFrame: (props: EmbedFrameProps) => ReactElement;
    EmbedFrameReact: ReactNamespace;
    EmbedFrameJsx: JsxNamespace;
    initializeEmbedFrameComponent: () => void;
    initializeEmbeds: () => void;
  }
}

export function installEmbedsReactFrame(runtime: RuntimeBindings): () => void {
  var EmbedFrameReact: ReactNamespace;
  var EmbedFrameJsx: JsxNamespace;
  var initializeEmbedFrameComponent: RuntimeBindings["initializeEmbedFrameComponent"];
  var initializeEmbeds: RuntimeBindings["initializeEmbeds"];
  function EmbedFrame({
    html: html,
    allowScripts: allowScripts,
    markerAttr: markerAttr,
    title: title,
    onNavigated: onNavigated,
    onHost: onHost,
    interactive: interactive,
    state: state,
    onSave: onSave,
    isOwnWrite: isOwnWrite,
  }: EmbedFrameProps): ReactElement {
    let ref = EmbedFrameReact.useRef<HTMLDivElement | null>(null),
      [value, value2] = EmbedFrameReact.useState(0),
      ref2 = EmbedFrameReact.useRef(html);
    if (ref2.current !== html) {
      ref2.current = html;
      value2((input: number): number => input + 1);
    }
    let ref3 = EmbedFrameReact.useRef<EmbedFrameLatest>({
      onNavigated: onNavigated,
      onHost: onHost,
      interactive: interactive,
      onSave: onSave,
      isOwnWrite: isOwnWrite,
    });
    ref3.current = {
      onNavigated: onNavigated,
      onHost: onHost,
      interactive: interactive,
      onSave: onSave,
      isOwnWrite: isOwnWrite,
    };
    let ref4 = EmbedFrameReact.useRef(state),
      ref5 = EmbedFrameReact.useRef(false),
      ref6 = EmbedFrameReact.useRef<EmbedFrameHostHandle | null>(null);
    EmbedFrameReact.useEffect((): void => {
      if (state === undefined) {
        return;
      }
      let value5: boolean = ref3.current.isOwnWrite?.(state) === true;
      if ((value5 && !ref5.current) || state === ref4.current) {
        return;
      }
      ref5.current = !value5;
      ref4.current = state;
      ref6.current?.state(state);
    }, [state]);
    let value3: boolean = interactive !== undefined,
      value4: boolean = onSave !== undefined,
      ref7 = EmbedFrameReact.useRef(title);
    ref7.current = title;
    let ref8 = EmbedFrameReact.useRef<HTMLIFrameElement | null>(null);
    EmbedFrameReact.useEffect((): (() => void) | undefined => {
      let current: HTMLDivElement | null = ref.current;
      if (current === null) {
        return;
      }
      let value5: EmbedFrameMount = (0, runtime.createEmbedFrame)({
        html: ref2.current,
        allowScripts: allowScripts,
        markerAttr: markerAttr,
        title: ref7.current,
        onNavigated: (): void => ref3.current.onNavigated(),
        onRelocated: (): void => value2((input: number): number => input + 1),
        ...(ref4.current !== undefined
          ? {
              state: ref4.current,
            }
          : {}),
        ...(value4
          ? {
              onSave: (input: string): void => {
                ref4.current = input;
                ref5.current = false;
                ref3.current.onSave?.(input);
              },
            }
          : {}),
        ...(value3
          ? {
              interactive: {
                onPress: (input: boolean): void =>
                  ref3.current.interactive?.onPress(input),
                onKey: (input: "Delete" | "Escape"): void =>
                  ref3.current.interactive?.onKey(input),
                onWheel: (input: EmbedWheel): void =>
                  ref3.current.interactive?.onWheel(input),
              },
            }
          : {}),
      });
      ref8.current = value5.iframe;
      ref6.current = value5.host;
      current.appendChild(value5.iframe);
      ref3.current.onHost(value5.host);
      if (value5.refused) {
        ref3.current.interactive?.onRefused();
      }
      return (): void => {
        ref3.current.onHost(null);
        ref8.current = null;
        ref6.current = null;
        value5.dispose();
      };
    }, [value, allowScripts, markerAttr, value3, value4]);
    EmbedFrameReact.useEffect((): void => {
      if (ref8.current !== null) {
        ref8.current.title = title;
      }
    }, [title]);
    return EmbedFrameJsx.jsx("div", {
      ref: ref,
      style: {
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...(value3
          ? {}
          : {
              pointerEvents: "none",
            }),
      },
    });
  }
  bindRuntimeValue(runtime, "EmbedFrame", () => EmbedFrame);
  bindRuntimeValue(
    runtime,
    "EmbedFrameReact",
    () => EmbedFrameReact,
    (value) => {
      EmbedFrameReact = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EmbedFrameJsx",
    () => EmbedFrameJsx,
    (value) => {
      EmbedFrameJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEmbedFrameComponent",
    () => initializeEmbedFrameComponent,
    (value) => {
      initializeEmbedFrameComponent = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeEmbeds",
    () => initializeEmbeds,
    (value) => {
      initializeEmbeds = value;
    },
  );
  return () => {
    initializeEmbedFrameComponent = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeEmbedFrameHost)();
      EmbedFrameReact = (0, runtime.toModuleNamespace)(
        (0, runtime.loadReactNamespace)(),
        1,
      );
      EmbedFrameJsx = (0, runtime.toModuleNamespace)(
        (0, runtime.loadJsxNamespace)(),
        1,
      );
    });
    initializeEmbeds = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeEmbedDocument)();
      (0, runtime.initializeEmbedRuntimeScript)();
      (0, runtime.initializeEmbedFrameHost)();
      (0, runtime.initializeEmbedSanitizer)();
      initializeEmbedFrameComponent();
    });
  };
}
