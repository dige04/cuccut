/** Isolated iframe bridge. Authored edit code executes only in its dedicated Worker. */
export function fastEditIframeBridge(): void {
  const nonce = "__NONCE__";
  const origin = "__ORIGIN__";
  const parentWindow = window.parent;
  type Message = Record<string, unknown>;
  const postToParent = (message: Message): void => {
    message.nonce = nonce;
    parentWindow.postMessage(message, origin);
  };
  const readJsonScript = (id: string): unknown => {
    return JSON.parse(document.getElementById(id)!.textContent!);
  };
  let worker: Worker;
  let ready = false;
  const fault = (message: string): void =>
    postToParent({ kind: "fault", message });
  try {
    worker = new Worker(
      URL.createObjectURL(
        new Blob([readJsonScript("w") as string], { type: "text/javascript" }),
      ),
    );
  } catch {
    fault("no worker");
    return;
  }
  worker.onerror = (event): void => {
    const message = String((event && event.message) || "failed").slice(0, 300);
    if (ready)
      postToParent({
        kind: "error",
        message: "uncaught: " + message,
        stmt: "",
      });
    else fault("worker: " + message);
  };
  worker.onmessage = (event: MessageEvent<Message>): void => {
    const data = event.data;
    const kind = data && data.kind;
    if (kind === "ready") {
      ready = true;
      postToParent({ kind });
    } else if (kind === "beat") postToParent({ kind });
    else if (kind === "html")
      postToParent({
        kind,
        seq: data.seq,
        slideId: data.slideId,
        html: data.html,
        stmt: data.stmt,
        final: data.final === true,
      });
    else if (kind === "done")
      postToParent({
        kind,
        seq: data.seq,
        n: data.n,
        stmt: data.stmt,
        changed: data.changed,
        logged: data.logged,
        threw: data.threw,
        skipped: data.skipped,
        handles: data.handles,
      });
    else if (kind === "touch")
      postToParent({ kind, seq: data.seq, n: data.n, slideId: data.slideId });
    else if (kind === "preview")
      postToParent({
        kind,
        seq: data.seq,
        method: data.method,
        target: data.target,
        html: data.html,
        head: data.head,
      });
    else if (kind === "view")
      postToParent({
        kind,
        req: data.req,
        slideId: data.slideId,
        attr: data.attr,
        prefix: data.prefix,
        html: data.html,
      });
    else if (kind === "handles")
      postToParent({
        kind,
        req: data.req,
        attr: data.attr,
        prefix: data.prefix,
        rows: data.rows,
      });
    else if (kind === "op")
      postToParent({ kind, seq: data.seq, stmt: data.stmt, op: data.op });
    else if (kind === "error")
      postToParent({
        kind,
        message: data.message,
        stmt: data.stmt,
        code: data.code,
        id: data.id,
      });
    else if (kind === "log")
      postToParent({ kind, message: data.message, n: data.n, cut: data.cut });
  };
  addEventListener("message", (event: MessageEvent<Message>): void => {
    const data = event.data;
    if (event.source !== parentWindow || !data || data.nonce !== nonce) return;
    if (data.kind === "chunk" && typeof data.text === "string")
      worker.postMessage({ kind: "chunk", text: data.text });
    else if (data.kind === "flush") worker.postMessage({ kind: "flush" });
    else if (data.kind === "view" && typeof data.id === "string")
      worker.postMessage({ kind: "view", id: data.id, req: data.req });
    else if (data.kind === "handles")
      worker.postMessage({ kind: "handles", since: data.since, req: data.req });
    else if (data.kind === "end") worker.postMessage({ kind: "end" });
  });
  const configuration = (JSON.parse(readJsonScript("d") as string) ||
    {}) as Message;
  worker.postMessage({
    kind: "init",
    html: readJsonScript("h"),
    deck: configuration.deck || null,
    verbs: configuration.verbs || null,
    sdk: configuration.sdk || null,
    previewMs: configuration.previewMs,
    pace: configuration.pace,
    chains: configuration.chains,
  });
}
