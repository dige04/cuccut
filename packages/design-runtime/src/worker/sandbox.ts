/** Worker entry: disable network/storage APIs, cap console output and dispatch input. */
import { createEditRuntime, DEFAULT_LIMITS } from "./runtime";
import type { Dynamic } from "./types";
try {
  Function("");
} catch (value: Dynamic) {
  throw Error(
    "eval is blocked in the sandbox Worker (the page CSP must allow unsafe-eval for the frame)",
  );
}
var sendWorkerMessage: Dynamic = (self as Dynamic).postMessage.bind(self);
var scheduleHeartbeat: Dynamic = (self as Dynamic).setInterval.bind(self);
var BLOCKED_WORKER_CAPABILITIES: Dynamic = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebSocketStream",
  "WebTransport",
  "EventSource",
  "FontFace",
  "importScripts",
  "Worker",
  "SharedWorker",
  "BroadcastChannel",
  "indexedDB",
  "caches",
  "RTCPeerConnection",
  "Request",
  "createImageBitmap",
];
for (let value of BLOCKED_WORKER_CAPABILITIES) {
  for (
    let value2: Dynamic = self;
    value2 && value2 !== Object.prototype;
    value2 = Object.getPrototypeOf(value2)
  )
    try {
      delete value2[value];
    } catch (value3: Dynamic) {}
  try {
    Object.defineProperty(self, value, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch (value2: Dynamic) {}
}
try {
  let value: Dynamic = Object.getPrototypeOf((self as Dynamic).navigator);
  delete value.sendBeacon;
  delete value.serviceWorker;
  delete value.storage;
  delete value.locks;
} catch (value: Dynamic) {}
var consoleLogCount: Dynamic = 0;
var createConsoleLogger: Dynamic =
  (input?: Dynamic, ..._extraArguments: Dynamic[]): Dynamic =>
  (...input2: Dynamic[]): Dynamic => {
    if (consoleLogCount++ >= DEFAULT_LIMITS.maxLogs) return;
    let value: Dynamic;
    try {
      value = input2
        .map(
          (input3?: Dynamic, ..._extraArguments2: Dynamic[]): Dynamic =>
            typeof input3 === "string"
              ? input3
              : (JSON.stringify(input3) ?? String(input3)),
        )
        .join(" ");
    } catch (value2: Dynamic) {
      value = input2.map(String).join(" ");
    }
    sendWorkerMessage({
      kind: "log",
      message: (input === "log" ? "" : input + ": ") + value.slice(0, 1500),
    });
  };
(self as Dynamic).console = {
  log: createConsoleLogger("log"),
  info: createConsoleLogger("log"),
  debug: createConsoleLogger("log"),
  warn: createConsoleLogger("warn"),
  error: createConsoleLogger("error"),
  trace(): Dynamic {},
  table: createConsoleLogger("log"),
  group(): Dynamic {},
  groupEnd(): Dynamic {},
  assert(): Dynamic {},
  time(): Dynamic {},
  timeEnd(): Dynamic {},
};
var editRuntime: Dynamic = createEditRuntime(sendWorkerMessage);
scheduleHeartbeat(
  (..._extraArguments3: Dynamic[]): Dynamic =>
    sendWorkerMessage({
      kind: "beat",
    }),
  500,
);
(self as Dynamic).onmessage = (
  input?: Dynamic,
  ..._extraArguments4: Dynamic[]
): Dynamic => {
  let data: Dynamic = input.data;
  if (!data || typeof data !== "object") return;
  try {
    if (data.kind === "init")
      editRuntime.init(
        data.html,
        data.deck || null,
        data.verbs || null,
        data.sdk || null,
        {
          previewMs: data.previewMs,
          pace: data.pace,
          chains: data.chains,
        },
      );
    else if (data.kind === "chunk" && typeof data.text === "string")
      editRuntime.chunk(data.text);
    else if (data.kind === "flush") editRuntime.flush();
    else if (data.kind === "view") editRuntime.view(data.id, data.req);
    else if (data.kind === "handles") editRuntime.handles(data.since, data.req);
    else if (data.kind === "end") editRuntime.end();
  } catch (value: Dynamic) {
    sendWorkerMessage({
      kind: "error",
      message: ("sandbox: " + String(value)).slice(0, 500),
      stmt: "",
    });
  }
};
