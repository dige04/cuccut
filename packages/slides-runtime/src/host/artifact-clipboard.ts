/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type { InternalClipboardEntry } from "./clipboard-text";

/** What a copy puts on the clipboard: the structured data and its plain-text rendering. */
export interface ArtifactClipboardPayload {
  data: unknown;
  text: string;
}
/** A cut also carries the deletion to run once the clipboard write succeeded. */
export interface ArtifactCutPayload extends ArtifactClipboardPayload {
  commit(): void;
}
/** A clipboard entry of this app: its kind and the (untrusted) data of the copy. */
export type ArtifactClipboardEntry = InternalClipboardEntry;
/** Handlers `useArtifactClipboard` routes the document's copy, cut and paste events to. */
export interface ArtifactClipboardOptions {
  /** Which kind of entry this surface copies and accepts on paste. */
  kind: string;
  /** Defaults to true; false detaches the surface from clipboard events. */
  enabled?: boolean;
  /** Returns undefined to leave the event to the browser. */
  onCopy?(): ArtifactClipboardPayload | undefined;
  onCut?(): ArtifactCutPayload | undefined;
  /** Receives the unvalidated data of a pasted entry of this surface's kind. */
  onPaste?(data: unknown): void;
  /** Returns true when the files were taken. */
  onPasteFiles?(files: File[]): boolean;
  /** Returns true when the text was taken. */
  onPasteText?(text: string): boolean;
  /** Which pasted files to offer to `onPasteFiles`; defaults to images. */
  acceptFile?(file: File): boolean;
}
/** The copy kept in memory for pastes where the browser strips the HTML marker. */
interface ArtifactClipboardFallback extends ArtifactClipboardPayload {
  kind: string;
}
/** The decoded clipboard marker, before it is validated. */
type ClipboardMarkerJson = Record<string, unknown> | string | number | boolean | null;

declare module "../bindings" {
  interface RuntimeBindings {
    reactNH0: ReactNamespace;
    /** HTML attribute that carries the encoded entry in the clipboard's `text/html`. */
    ARTIFACT_CLIPBOARD_ATTRIBUTE: string;
    ARTIFACT_CLIPBOARD_PATTERN: RegExp;
    encodeClipboardUtf8: (text: string) => string;
    /** Undefined when `encoded` is not valid base64. */
    decodeClipboardUtf8: (encoded: string) => string | undefined;
    escapeClipboardHtml: (text: string) => string;
    artifactClipboardFallback: ArtifactClipboardFallback | undefined;
    /** Fills the event's clipboard data; false when there is none or the write fails. */
    writeArtifactClipboard: (
      event: ClipboardEvent,
      kind: string,
      payload: ArtifactClipboardPayload,
    ) => boolean;
    /** Recovers this app's entry from a paste event, or undefined when the clipboard holds something else. */
    readArtifactClipboard: (
      event: ClipboardEvent,
    ) => ArtifactClipboardEntry | undefined;
    /** Whether pasted text only names the pasted files (or is a bare link) and so should not be inserted as text. */
    clipboardTextIsFileNames: (files: readonly File[], text: string) => boolean;
    clipboardFileBaseName: (path: string) => string;
    isClipboardEditingTarget: (target: EventTarget | null) => boolean;
    hasDocumentTextSelection: () => boolean;
    useArtifactClipboard: (options: ArtifactClipboardOptions) => void;
    /** Copies through a temporary selection so it works outside a copy event; false when the write failed. */
    copyArtifactToClipboard: (
      kind: string,
      payload: ArtifactClipboardPayload,
    ) => boolean;
  }
}

export function installHostArtifactClipboard(
  runtime: RuntimeBindings,
): () => void {
  var reactNH0: ReactNamespace;
  var ARTIFACT_CLIPBOARD_ATTRIBUTE: string;
  var ARTIFACT_CLIPBOARD_PATTERN: RegExp;
  var artifactClipboardFallback: ArtifactClipboardFallback | undefined;
  function encodeClipboardUtf8(text: string): string {
    let value = new TextEncoder().encode(text),
      text2 = "";
    for (let index = 0; index < value.length; index += 32768)
      text2 += String.fromCharCode(...value.subarray(index, index + 32768));
    return btoa(text2);
  }
  function decodeClipboardUtf8(encoded: string): string | undefined {
    try {
      let value = atob(encoded),
        value2 = new Uint8Array(value.length);
      for (let index = 0; index < value.length; index++)
        value2[index] = value.charCodeAt(index);
      return new TextDecoder().decode(value2);
    } catch {
      return;
    }
  }
  function escapeClipboardHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function writeArtifactClipboard(
    event: ClipboardEvent,
    kind: string,
    payload: ArtifactClipboardPayload,
  ): boolean {
    let clipboardData = event.clipboardData;
    if (!clipboardData) {
      return false;
    }
    let state = {
      appifact: 1,
      kind: kind,
      data: payload.data,
    };
    try {
      clipboardData.setData("text/plain", payload.text);
      clipboardData.setData(
        "text/html",
        "<span " +
          ARTIFACT_CLIPBOARD_ATTRIBUTE +
          '="' +
          encodeClipboardUtf8(JSON.stringify(state)) +
          '">' +
          escapeClipboardHtml(payload.text) +
          "</span>",
      );
    } catch {
      return false;
    }
    artifactClipboardFallback =
      payload.text === ""
        ? undefined
        : {
            kind: kind,
            data: payload.data,
            text: payload.text,
          };
    (0, runtime.setInternalClipboard)({
      kind: kind,
      data: payload.data,
    });
    return true;
  }
  function readArtifactClipboard(
    event: ClipboardEvent,
  ): ArtifactClipboardEntry | undefined {
    let clipboardData = event.clipboardData;
    if (!clipboardData) {
      return;
    }
    let value = clipboardData.getData("text/html"),
      value2 = value === "" ? null : ARTIFACT_CLIPBOARD_PATTERN.exec(value);
    if (value2?.[1] !== undefined) {
      let value3 = decodeClipboardUtf8(value2[1]);
      if (value3 !== undefined) {
        try {
          let value4: ClipboardMarkerJson = JSON.parse(value3);
          if (
            typeof value4 === "object" &&
            value4 !== null &&
            value4.appifact === 1 &&
            typeof value4.kind === "string" &&
            Object.hasOwn(value4, "data")
          ) {
            return {
              kind: value4.kind,
              data: value4.data,
            };
          }
        } catch {}
      }
    }
    if (
      artifactClipboardFallback !== undefined &&
      artifactClipboardFallback.text !== "" &&
      clipboardData.getData("text/plain") === artifactClipboardFallback.text
    ) {
      return {
        kind: artifactClipboardFallback.kind,
        data: artifactClipboardFallback.data,
      };
    }
    return;
  }
  function clipboardTextIsFileNames(
    files: readonly File[],
    text: string,
  ): boolean {
    let value = text.trim();
    if (value === "" || /^https?:\/\/\S+$/.test(value)) {
      return true;
    }
    let values = new Set(files.map((input: File): string => input.name));
    return value
      .split(/\r\n|\r|\n/)
      .every(
        (input: string): boolean => values.has(clipboardFileBaseName(input)),
      );
  }
  function clipboardFileBaseName(path: string): string {
    let value = path.trim().replace(/^"(.*)"$/, "$1");
    if (!/^(file:\/\/|\/|\\\\|[A-Za-z]:[\\/])/i.test(value)) {
      return value;
    }
    if (/^file:/i.test(value)) {
      try {
        value = decodeURIComponent(value);
      } catch {}
    }
    return value.slice(
      Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\")) + 1,
    );
  }
  function isClipboardEditingTarget(target: EventTarget | null): boolean {
    if (
      typeof HTMLElement === "undefined" ||
      !(target instanceof HTMLElement)
    ) {
      return false;
    }
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    );
  }
  function hasDocumentTextSelection(): boolean {
    let value =
      typeof document === "undefined" ? null : document.getSelection();
    return value !== null && !value.isCollapsed;
  }
  function useArtifactClipboard(options: ArtifactClipboardOptions): void {
    let ref = reactNH0.useRef(options);
    ref.current = options;
    let value = options.enabled !== false;
    reactNH0.useEffect((): (() => void) | undefined => {
      if (!value) {
        return;
      }
      let callback = (event: ClipboardEvent): boolean =>
          event.defaultPrevented ||
          isClipboardEditingTarget(event.target) ||
          hasDocumentTextSelection() ||
          (0, runtime.hasOpenOverlay)(),
        callback2 = (event: ClipboardEvent): void => {
          if (callback(event)) {
            return;
          }
          let value2 = ref.current.onCopy?.();
          if (value2 === undefined) {
            return;
          }
          event.preventDefault();
          writeArtifactClipboard(event, ref.current.kind, value2);
        },
        callback3 = (event: ClipboardEvent): void => {
          if (callback(event)) {
            return;
          }
          let value2 = ref.current.onCut?.();
          if (value2 === undefined) {
            return;
          }
          event.preventDefault();
          if (writeArtifactClipboard(event, ref.current.kind, value2)) {
            value2.commit();
          }
        },
        callback4 = (event: ClipboardEvent): void => {
          if (event.defaultPrevented) {
            return;
          }
          if (
            isClipboardEditingTarget(event.target) ||
            (0, runtime.hasOpenOverlay)()
          ) {
            return;
          }
          let value2 = readArtifactClipboard(event);
          if (value2 !== undefined) {
            if (value2.kind !== ref.current.kind) {
              return;
            }
            if (!ref.current.onPaste) {
              return;
            }
            event.preventDefault();
            ref.current.onPaste(value2.data);
            return;
          }
          let value3 = event.clipboardData?.getData("text/plain") ?? "",
            items = [...(event.clipboardData?.files ?? [])],
            value4 = items.filter(
              ref.current.acceptFile ?? runtime.isImageFile,
            );
          if (
            value4.length > 0 &&
            ref.current.onPasteFiles &&
            clipboardTextIsFileNames(items, value3) &&
            ref.current.onPasteFiles(value4)
          ) {
            event.preventDefault();
            return;
          }
          if (value3 !== "" && ref.current.onPasteText) {
            if (ref.current.onPasteText(value3)) {
              event.preventDefault();
            }
          }
        };
      document.addEventListener("copy", callback2);
      document.addEventListener("cut", callback3);
      document.addEventListener("paste", callback4);
      return (): void => {
        document.removeEventListener("copy", callback2);
        document.removeEventListener("cut", callback3);
        document.removeEventListener("paste", callback4);
      };
    }, [value]);
  }
  function copyArtifactToClipboard(
    kind: string,
    payload: ArtifactClipboardPayload,
  ): boolean {
    let flag = false,
      callback = (event: ClipboardEvent): void => {
        event.preventDefault();
        flag = writeArtifactClipboard(event, kind, payload);
      },
      activeElement = document.activeElement,
      value = document.createElement("textarea");
    value.value = payload.text === "" ? " " : payload.text;
    value.style.position = "fixed";
    value.style.opacity = "0";
    document.body.appendChild(value);
    value.select();
    document.addEventListener("copy", callback, {
      capture: true,
      once: true,
    });
    try {
      document.execCommand("copy");
    } catch {}
    document.removeEventListener("copy", callback, {
      capture: true,
    });
    value.remove();
    if (activeElement instanceof HTMLElement && activeElement.isConnected) {
      activeElement.focus({
        preventScroll: true,
      });
    }
    return flag;
  }
  bindRuntimeValue(
    runtime,
    "reactNH0",
    () => reactNH0,
    (value) => {
      reactNH0 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_CLIPBOARD_ATTRIBUTE",
    () => ARTIFACT_CLIPBOARD_ATTRIBUTE,
    (value) => {
      ARTIFACT_CLIPBOARD_ATTRIBUTE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_CLIPBOARD_PATTERN",
    () => ARTIFACT_CLIPBOARD_PATTERN,
    (value) => {
      ARTIFACT_CLIPBOARD_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "encodeClipboardUtf8", () => encodeClipboardUtf8);
  bindRuntimeValue(runtime, "decodeClipboardUtf8", () => decodeClipboardUtf8);
  bindRuntimeValue(runtime, "escapeClipboardHtml", () => escapeClipboardHtml);
  bindRuntimeValue(
    runtime,
    "artifactClipboardFallback",
    () => artifactClipboardFallback,
    (value) => {
      artifactClipboardFallback = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "writeArtifactClipboard",
    () => writeArtifactClipboard,
  );
  bindRuntimeValue(
    runtime,
    "readArtifactClipboard",
    () => readArtifactClipboard,
  );
  bindRuntimeValue(
    runtime,
    "clipboardTextIsFileNames",
    () => clipboardTextIsFileNames,
  );
  bindRuntimeValue(
    runtime,
    "clipboardFileBaseName",
    () => clipboardFileBaseName,
  );
  bindRuntimeValue(
    runtime,
    "isClipboardEditingTarget",
    () => isClipboardEditingTarget,
  );
  bindRuntimeValue(
    runtime,
    "hasDocumentTextSelection",
    () => hasDocumentTextSelection,
  );
  bindRuntimeValue(runtime, "useArtifactClipboard", () => useArtifactClipboard);
  bindRuntimeValue(
    runtime,
    "copyArtifactToClipboard",
    () => copyArtifactToClipboard,
  );
  return () => {
    (0, runtime.initializeImageDownsampling)();
    (0, runtime.initializeUiPropertyFocus)();
    reactNH0 = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    ARTIFACT_CLIPBOARD_ATTRIBUTE = "data-appifact-object";
    ARTIFACT_CLIPBOARD_PATTERN = new RegExp(
      ARTIFACT_CLIPBOARD_ATTRIBUTE + '="([A-Za-z0-9+/=]+)"',
    );
  };
}
