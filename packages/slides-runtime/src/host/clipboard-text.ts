/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** The last copy made inside the editor: a clipboard kind and its structured payload, kept so a paste can skip the system clipboard. */
export interface InternalClipboardEntry {
  kind: string;
  data: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    internalClipboardValue: InternalClipboardEntry | undefined;
    getInternalClipboard: () => InternalClipboardEntry | undefined;
    /** Documents that already carry the copy/cut/blur listeners that drop the internal clipboard. */
    clipboardListenerDocuments: WeakSet<Document>;
    /** Remembers (or, with no argument, forgets) the editor's own clipboard entry. */
    setInternalClipboard: (value?: InternalClipboardEntry) => void;
    /** Writes text to the system clipboard, falling back to `execCommand("copy")`; resolves to whether it worked. */
    copyTextToClipboard: (text: string) => Promise<boolean>;
  }
}

export function installHostClipboardText(runtime: RuntimeBindings): () => void {
  var internalClipboardValue: InternalClipboardEntry | undefined;
  var getInternalClipboard: () => InternalClipboardEntry | undefined;
  var clipboardListenerDocuments: WeakSet<Document>;
  function setInternalClipboard(value?: InternalClipboardEntry): void {
    internalClipboardValue = value;
    if (value === undefined || clipboardListenerDocuments.has(document)) {
      return;
    }
    clipboardListenerDocuments.add(document);
    let callback = (): void => setInternalClipboard(undefined);
    document.addEventListener("copy", callback, true);
    document.addEventListener("cut", callback, true);
    window.addEventListener("blur", callback);
  }
  async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      setInternalClipboard(undefined);
      return true;
    } catch {}
    try {
      let value = document.createElement("textarea");
      value.value = text;
      value.style.position = "fixed";
      value.style.opacity = "0";
      document.body.appendChild(value);
      value.select();
      let value2 = document.execCommand("copy");
      value.remove();
      return value2;
    } catch {
      return false;
    }
  }
  bindRuntimeValue(
    runtime,
    "internalClipboardValue",
    () => internalClipboardValue,
    (value) => {
      internalClipboardValue = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getInternalClipboard",
    () => getInternalClipboard,
    (value) => {
      getInternalClipboard = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "clipboardListenerDocuments",
    () => clipboardListenerDocuments,
    (value) => {
      clipboardListenerDocuments = value;
    },
  );
  bindRuntimeValue(runtime, "setInternalClipboard", () => setInternalClipboard);
  bindRuntimeValue(runtime, "copyTextToClipboard", () => copyTextToClipboard);
  return () => {
    (0, runtime.initializeUiPropertyLabels)();
    getInternalClipboard = (): InternalClipboardEntry | undefined =>
      internalClipboardValue;
    clipboardListenerDocuments = new WeakSet();
  };
}
