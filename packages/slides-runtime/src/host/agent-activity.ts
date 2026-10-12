/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";

/** Whether the surrounding agent is busy: "unknown" until the parent window reports. */
export type AgentActivityState = "unknown" | "working" | "idle";
/** The two windows the activity bridge talks between. */
export interface AgentActivityBridgeOptions {
  ownWindow: Window;
  /** The embedding window, or null when this page is top-level. */
  parentWindow: Window | null;
}
/** Listens for the parent window's activity reports and fans them out to subscribers. */
export interface AgentActivityBridge {
  get(): AgentActivityState;
  /** Starts listening on first use; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
/** `useSyncExternalStore`-shaped view of the shared bridge. */
export interface AgentActivityStore {
  get: () => AgentActivityState;
  subscribe: (listener: () => void) => () => void;
}
/** A parent-window message body, before it is checked for the activity marker. */
type ActivityMessageData =
  | Record<string, unknown>
  | string
  | number
  | boolean
  | null
  | undefined;

declare module "../bindings" {
  interface RuntimeBindings {
    reactql0: ReactNamespace;
    /** Message the page posts to its parent to ask for the current activity. */
    CLAUDE_ACTIVITY_REQUEST_MESSAGE: string;
    /** Marker key of the parent's activity reports (`{ [marker]: true, working: boolean }`). */
    CLAUDE_ACTIVITY_MESSAGE: string;
    createAgentActivityBridge: (
      options: AgentActivityBridgeOptions,
    ) => AgentActivityBridge;
    agentActivityBridge: AgentActivityBridge | null;
    getAgentActivityBridge: () => AgentActivityBridge;
    agentActivityStore: AgentActivityStore;
    useAgentActivity: () => AgentActivityState;
  }
}

export function installHostAgentActivity(
  runtime: RuntimeBindings,
): () => void {
  var reactql0: ReactNamespace;
  var CLAUDE_ACTIVITY_REQUEST_MESSAGE: string;
  var CLAUDE_ACTIVITY_MESSAGE: string;
  var agentActivityBridge: AgentActivityBridge | null;
  var agentActivityStore: AgentActivityStore;
  function createAgentActivityBridge(
    options: AgentActivityBridgeOptions,
  ): AgentActivityBridge {
    let parentWindow = options.parentWindow,
      values = new Set<() => void>(),
      text: AgentActivityState = "unknown",
      flag = false,
      callback = (input: AgentActivityState): void => {
        if (input === text) {
          return;
        }
        text = input;
        for (let value of [...values])
          try {
            value();
          } catch {}
      },
      callback2 = (dataset: MessageEvent): void => {
        if (parentWindow === null || dataset.source !== parentWindow) {
          return;
        }
        let data: ActivityMessageData = dataset.data;
        if (
          typeof data !== "object" ||
          data === null ||
          data[CLAUDE_ACTIVITY_MESSAGE] !== true
        ) {
          return;
        }
        if (data.working === true) {
          callback("working");
        } else if (data.working === false) {
          callback("idle");
        }
      },
      callback3 = (): void => {
        if (flag || parentWindow === null) {
          return;
        }
        flag = true;
        try {
          options.ownWindow.addEventListener("message", callback2);
          parentWindow.postMessage(
            {
              [CLAUDE_ACTIVITY_REQUEST_MESSAGE]: true,
            },
            "*",
          );
        } catch {}
      };
    return {
      get: (): AgentActivityState => text,
      subscribe(input: () => void): () => void {
        values.add(input);
        callback3();
        return (): void => {
          values.delete(input);
        };
      },
      dispose(): void {
        if (flag) {
          options.ownWindow.removeEventListener("message", callback2);
        }
        flag = false;
        values.clear();
        text = "unknown";
      },
    };
  }
  function getAgentActivityBridge(): AgentActivityBridge {
    if (agentActivityBridge === null) {
      agentActivityBridge = createAgentActivityBridge({
        ownWindow: window,
        parentWindow: window.parent !== window ? window.parent : null,
      });
    }
    return agentActivityBridge;
  }
  function useAgentActivity(): AgentActivityState {
    return reactql0.useSyncExternalStore(
      agentActivityStore.subscribe,
      agentActivityStore.get,
      (): AgentActivityState => "unknown",
    );
  }
  bindRuntimeValue(
    runtime,
    "reactql0",
    () => reactql0,
    (value) => {
      reactql0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_ACTIVITY_REQUEST_MESSAGE",
    () => CLAUDE_ACTIVITY_REQUEST_MESSAGE,
    (value) => {
      CLAUDE_ACTIVITY_REQUEST_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CLAUDE_ACTIVITY_MESSAGE",
    () => CLAUDE_ACTIVITY_MESSAGE,
    (value) => {
      CLAUDE_ACTIVITY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createAgentActivityBridge",
    () => createAgentActivityBridge,
  );
  bindRuntimeValue(
    runtime,
    "agentActivityBridge",
    () => agentActivityBridge,
    (value) => {
      agentActivityBridge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getAgentActivityBridge",
    () => getAgentActivityBridge,
  );
  bindRuntimeValue(
    runtime,
    "agentActivityStore",
    () => agentActivityStore,
    (value) => {
      agentActivityStore = value;
    },
  );
  bindRuntimeValue(runtime, "useAgentActivity", () => useAgentActivity);
  return () => {
    reactql0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    CLAUDE_ACTIVITY_REQUEST_MESSAGE = "__frame_claude_activity_ask";
    CLAUDE_ACTIVITY_MESSAGE = "__frame_claude_activity";
    agentActivityBridge = null;
    agentActivityStore = {
      get: (): AgentActivityState => getAgentActivityBridge().get(),
      subscribe: (input: () => void): (() => void) =>
        getAgentActivityBridge().subscribe(input),
    };
  };
}
